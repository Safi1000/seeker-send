# Deploy-only image for Render / Railway (built in their cloud — you never run
# Docker locally). Based on the official Playwright image, which ships Chromium
# and all the system libraries it (and OCR/canvas) need.
FROM mcr.microsoft.com/playwright:v1.50.1-jammy

WORKDIR /app

# Browsers already live in the image — skip the redundant postinstall download.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

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
