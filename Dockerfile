# -------------------
# Stage 1: Builder
# -------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY tsconfig*.json ./
COPY src ./src

# Build
RUN pnpm build

# -------------------
# Stage 2: Runner
# -------------------
FROM node:22-alpine

WORKDIR /app

# Copy only what’s needed
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
CMD ["node", "dist/main.js"]
