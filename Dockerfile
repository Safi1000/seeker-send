# Deploy-only image for Render / Railway (built in their cloud — you never run
# Docker locally). No headless browser any more: supplier search runs over plain
# HTTP fetch, so a slim Node image is enough. This drops Chromium's 200-400MB
# runtime footprint, which is what OOM-crashed the 512MB free tier.
FROM node:20-bookworm-slim

WORKDIR /app

# @napi-rs/canvas (PDF-render OCR fallback) needs fontconfig at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libfontconfig1 \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (dev deps included — needed for the Next.js build).
COPY package*.json ./
RUN npm ci

# Build the app.
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Render/Railway inject PORT; Next reads it. 3000 is the local default.
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
