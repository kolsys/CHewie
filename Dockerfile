# Bun-optimized Dockerfile for CHewie
# Using Bun for faster builds and smaller images

# Build stage
FROM oven/bun:latest AS build

# Build arguments - declare at the top
ARG VERSION=dev
ARG COMMIT_SHA=unknown
ARG BUILD_DATE=unknown

# Set the working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies using Bun (much faster than npm)
RUN bun install --frozen-lockfile

# Copy application source
COPY . .

# Build the application using Bun
RUN bun run build

# Runtime stage
FROM oven/bun:1-alpine AS runtime

# Install CA certificates for proxy/corporate environments
RUN apk add --no-cache ca-certificates && update-ca-certificates

# Re-declare build arguments for runtime stage
ARG VERSION=dev
ARG COMMIT_SHA=unknown
ARG BUILD_DATE=unknown

# Set the working directory
WORKDIR /app

# Copy built application from build stage
COPY --from=build /app/dist /app

# Copy environment injection script
COPY inject-env.cjs /app/inject-env.cjs

# Install serve locally in /app (pinned version for reproducibility)
RUN bun add serve@14.2.5

# Create non-root user
RUN addgroup -S chewie-group -g 1001 && \
    adduser -S chewie-user -u 1001 -G chewie-group

# Set ownership (includes node_modules with serve)
RUN chown -R chewie-user:chewie-group /app

# Add metadata labels
LABEL org.opencontainers.image.title="CHewie" \
      org.opencontainers.image.description="A modern, feature-rich web interface for ClickHouse databases. Originally forked from CH-UI, with multi-host connection support." \
      org.opencontainers.image.vendor="kolsys" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.source="https://github.com/kolsys/chewie"

# Environment variables with defaults
ENV VITE_CLICKHOUSE_URL="" \
    VITE_CLICKHOUSE_USER="" \
    VITE_CLICKHOUSE_PASS="" \
    VITE_CLICKHOUSE_USE_ADVANCED="" \
    VITE_CLICKHOUSE_CUSTOM_PATH="" \
    VITE_CLICKHOUSE_REQUEST_TIMEOUT=30000 \
    VITE_BASE_PATH="/" \
    NODE_ENV=production

# Expose port
EXPOSE 5521

# Switch to non-root user
USER chewie-user

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5521 || exit 1

# Start the application
# -u/--no-compression: `serve` otherwise streams brotli via chunked transfer
# encoding (no Content-Length, since the compressed size isn't known upfront).
# Some corporate load balancers/WAFs buffer or inspect response bodies and
# don't handle brotli well, causing truncated ("partial transfer") downloads
# of large bundles through them. Serving raw files with a fixed Content-Length
# is far more broadly compatible; let the reverse proxy/LB in front of this
# container do its own (gzip) compression if needed.
CMD ["/bin/sh", "-c", "bun run /app/inject-env.cjs && ./node_modules/.bin/serve -u -s -l 5521 /app"]