import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { whatsappRouter, setWebSocketBroadcast } from "../whatsappHandler";
import { magicLinkRouter } from "../whatsappMagicLink";
import { initMatchBroadcast } from "../matchingEngine";
import { startHeartbeat } from "../heartbeat";
import { registerWhatsAppAuthRoutes, sdk as waSdk, COOKIE_NAME as waCookie, getSessionCookieOptions as waGetCookieOpts } from "../whatsappAuth";
import { registerPasskeyRoutes, ensurePasskeysTable } from "../passkeyAuth";
import { initializeReportScheduler } from "../newReportScheduler";
import { autoMigrateReportTables } from "../autoMigrateReportTables";
// import { startReportScheduler } from "../reportingService";
// import { sendDailyDemandReports } from "../dailyDemandReportService";
// import { startAdvancedReportScheduler } from "../advancedReportingService";
// import { startScheduledReportService } from "../scheduledReportService";
// import { initializeReportScheduler } from "../reportScheduler";
// import { initializeIntegratedScheduler } from "../integratedReportScheduler";

// Initialize 9 AM cron job for daily demand reports (Cairo time UTC+2)
let dailyReportTask: any = null;

async function initializeDailyReportScheduler() {
  try {
    // Dynamically import node-cron
    const cron = await import('node-cron');
    const cronSchedule = cron.default?.schedule || cron.schedule;
    
    if (!cronSchedule) {
      console.warn('[Daily Reports] node-cron schedule function not found');
      return null;
    }
    
    // Schedule at 9 AM Cairo time (07:00 UTC)
    // Cron format: second minute hour day month weekday
    dailyReportTask = cronSchedule('0 7 * * *', async () => {
      console.log('[Daily Reports] Running 9 AM demand report generation...');
      try {
        // await sendDailyDemandReports();
        console.log('[Daily Reports] Daily reports sent successfully');
      } catch (error) {
        console.error('[Daily Reports] Error sending daily reports:', error);
      }
    }, { timezone: 'Africa/Cairo' });
    
    console.log('[Daily Reports] Scheduler initialized - reports will run daily at 9 AM Cairo time');
    return dailyReportTask;
  } catch (error) {
    console.warn('[Daily Reports] node-cron not available, daily scheduler disabled:', error);
    return null;
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Initialize Socket.IO for real-time updates
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: "/api/socket.io"
  });

  // Set up WebSocket broadcast function for WhatsApp handler
  const broadcastFn = (event: string, data: unknown) => {
    io.emit(event, data);
  };
  setWebSocketBroadcast(broadcastFn);
  
  // Set up broadcast for matching engine (high-confidence match alerts)
  initMatchBroadcast(broadcastFn);

  // Socket.IO connection handling
  io.on("connection", (socket: Socket) => {
    console.log("[Socket.IO] Client connected:", socket.id);
    
    socket.emit("connection_status", { 
      status: "connected", 
      timestamp: new Date().toISOString() 
    });

    socket.on("disconnect", () => {
      console.log("[Socket.IO] Client disconnected:", socket.id);
    });
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve uploaded files (local storage)
  app.use("/uploads", express.static(process.env.UPLOAD_DIR || "./uploads"));
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // WhatsApp OTP auth routes (alternative to Manus OAuth)
  registerWhatsAppAuthRoutes(app);

  // Passkey / WebAuthn biometric auth routes (owner Touch ID / Face ID)
  await ensurePasskeysTable();
  registerPasskeyRoutes(app, waSdk, waGetCookieOpts, waCookie);

  // WhatsApp magic link onboarding routes (must be before the general whatsapp router)
  app.use("/api/whatsapp/magic-link", magicLinkRouter);
  
  // WhatsApp webhook routes
  app.use("/api/whatsapp", whatsappRouter);
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Start WhatsApp heartbeat monitor (checks every hour, alerts after 24h silence)
  startHeartbeat();

  // Auto-migrate report tables
  try {
    await autoMigrateReportTables();
    console.log('[Database] Report tables migration completed');
  } catch (error) {
    console.error('[Database] Failed to migrate report tables:', error);
  }

  // Initialize new 6-hour report scheduler
  try {
    initializeReportScheduler();
    console.log('[Schedulers] New 6-hour report scheduler activated');
  } catch (error) {
    console.error('[Schedulers] Failed to initialize report scheduler:', error);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`WhatsApp webhook: http://localhost:${port}/api/whatsapp/webhook`);
    console.log(`WhatsApp magic link: http://localhost:${port}/api/whatsapp/magic-link/verify`);
    console.log(`Socket.IO: http://localhost:${port}/api/socket.io`);
  });
}

startServer().catch(console.error);
