# Multi-stage production build for MatchPro v10 Unified

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build frontend & backend
RUN pnpm run build

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-lock.yaml .

# Install production dependencies
RUN npm install -g pnpm@10 && pnpm install --prod

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]