# Backend Dockerfile — Node 20 + Express (JavaScript / ES Modules).
# Multi-stage not needed at this size; we keep a single slim runtime image.

FROM node:20-alpine

# tini gives us proper PID-1 signal handling so SIGTERM shuts Express down
# cleanly (mongoose connection drains, in-flight requests finish).
RUN apk add --no-cache tini

WORKDIR /app

# Copy manifests first for layer caching.
COPY package.json package-lock.json* ./

# Install ALL deps (no dev/prod split at this size; keeps image simple).
# Falls back to `npm install` when no lockfile is present yet.
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy application source.
COPY . .

EXPOSE 8000

# Run the seeder (idempotent) before booting the server. The seeder exits 0
# quickly once the 25 catalog companies exist; it never blocks the API long.
CMD ["sh", "-c", "node src/seed/seed.js && node src/server.js"]
