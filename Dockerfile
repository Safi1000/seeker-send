# ===========================================================================
# RFQ Automation Platform — production image
#
# Built on the official Playwright image so Chromium + all system libraries
# (also needed by @napi-rs/canvas and Tesseract OCR) are already present.
# ===========================================================================

# ---- Builder -------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v1.50.1-jammy AS builder
WORKDIR /app

# Browsers already live in the base image — don't re-download during install.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
# Build the standalone server bundle.
RUN npm run build

# ---- Runner --------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v1.50.1-jammy AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Use the browsers bundled in the base image.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Next.js standalone output is self-contained (includes traced node_modules).
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
