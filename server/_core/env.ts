export const ENV = {
  // Server
  port: parseInt(process.env.PORT ?? "3000"),
  cookieSecret: process.env.JWT_SECRET ?? "matchpro-default-secret-change-me",
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://matchpro:matchpro@localhost:5432/matchpro",
  isProduction: process.env.NODE_ENV === "production",
  
  // Auth (local)
  adminEmail: process.env.ADMIN_EMAIL ?? "mmaisara@crystalpowerinvestment.com",
  adminPhone: process.env.ADMIN_PHONE ?? "+201066505665",

  // LLM (OpenAI-compatible endpoint)
  llmApiUrl: process.env.LLM_API_URL ?? "https://api.openai.com/v1",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",

  // WhatsApp (Green API)
  greenApiInstanceId: process.env.GREEN_API_INSTANCE_ID ?? "",
  greenApiToken: process.env.GREEN_API_TOKEN ?? "",
  greenApiVerifyToken: process.env.GREEN_API_VERIFY_TOKEN ?? "matchpro_verify_token",

  // Email (SMTP)
  smtpHost: process.env.SMTP_HOST ?? "smtp.gmail.com",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587"),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",

  // Storage
  storageType: process.env.STORAGE_TYPE ?? "local",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKey: process.env.S3_ACCESS_KEY ?? "",
  s3SecretKey: process.env.S3_SECRET_KEY ?? "",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",

  // Legacy compat (mapped to new vars)
  get appId() { return "matchpro-local"; },
  get ownerOpenId() { return ""; },
  get oAuthServerUrl() { return ""; },
  get forgeApiUrl() { return this.llmApiUrl; },
  get forgeApiKey() { return this.llmApiKey; },
};
