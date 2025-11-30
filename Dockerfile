# Multi-stage build for ScaleIT Bridge
FROM node:18-alpine AS frontend-builder

# Set working directory for frontend
WORKDIR /app/frontend

# Copy frontend package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install frontend dependencies
RUN npm install -g pnpm && pnpm install

# Copy frontend source code
COPY src ./src
COPY public ./public
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

# Build frontend
RUN pnpm run build

# Rust backend builder stage
FROM rust:1.75-alpine AS backend-builder

# Install build dependencies
RUN apk add --no-cache musl-dev pkgconfig openssl-dev

# Set working directory for backend
WORKDIR /app/backend

# Copy Cargo files
COPY src-rust/Cargo.toml src-rust/Cargo.lock ./

# Create dummy source to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Copy actual source code
COPY src-rust/src ./src

# Build backend
RUN cargo build --release

# Final runtime stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S scaleit && \
    adduser -S scaleit -u 1001

# Create app directory
WORKDIR /app

# Copy backend binary from builder
COPY --from=backend-builder /app/backend/target/release/scaleit-bridge ./bin/scaleit-bridge

# Copy frontend build from builder
COPY --from=frontend-builder /app/frontend/dist ./web

# Create config directory
RUN mkdir -p config logs

# Copy default configuration
COPY src-rust/config/devices.json ./config/devices.json.example

# Set up proper permissions
RUN chown -R scaleit:scaleit /app && \
    chmod +x /app/bin/scaleit-bridge

# Switch to non-root user
USER scaleit

# Create default config if not exists
RUN cp config/devices.json.example config/devices.json || true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose ports
EXPOSE 8080

# Environment variables
ENV RUST_LOG=info
ENV CONFIG_PATH=config/devices.json
ENV WEB_PATH=web
ENV HOST=0.0.0.0
ENV PORT=8080

# Labels for better container management
LABEL maintainer="ScaleIT Team <support@scaleit.io>"
LABEL version="3.1.0"
LABEL description="ScaleIT Bridge - Universal Industrial Scale Communication Bridge"
LABEL org.opencontainers.image.source="https://github.com/scaleit/bridge-rust"
LABEL org.opencontainers.image.documentation="https://github.com/scaleit/bridge-rust/README.md"
LABEL org.opencontainers.image.licenses="MIT"

# Start the application
CMD ["./bin/scaleit-bridge"]
