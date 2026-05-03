#
# Remote Security System — Docker image
# - Builds frontend
# - Runs backend which serves frontend/dist + REST + WebSocket + SQLite
#

FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install deps first (better layer caching)
COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix backend && npm ci --prefix frontend

# Build frontend
COPY frontend ./frontend
RUN npm run build --prefix frontend

# Copy backend source
COPY backend ./backend

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist

# DB lives on a volume (compose mounts it)
ENV DB_PATH=/data/security.db

EXPOSE 3000
CMD ["node", "backend/server.js"]

