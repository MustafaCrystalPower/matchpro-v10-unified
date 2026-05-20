FROM node:22-alpine AS builder
WORKDIR /app

# Copy package.json only — no lock file dependency
COPY package.json ./

# Install all dependencies with npm
RUN npm install

# Copy the rest of the application
COPY . .

# Build the app
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# Copy package.json and install production deps
COPY package.json ./
RUN npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Create required directories
RUN mkdir -p /app/uploads /app/data

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
