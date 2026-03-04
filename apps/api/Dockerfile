FROM node:20-alpine AS base
WORKDIR /app

# GÃ¼venlik: root olmayan kullanÄ±cÄ±
RUN addgroup -S AlbaChat && adduser -S AlbaChat -G AlbaChat

# BaÄŸÄ±mlÄ±lÄ±klarÄ± kur
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Uygulama kodunu kopyala
COPY src ./src

# Dosya sahipliÄŸini deÄŸiÅŸtir
RUN chown -R AlbaChat:AlbaChat /app

USER AlbaChat

# Migration + Seed + server başlat
CMD ["sh", "-c", "node src/db/migrate.js && node src/db/seed.js && node src/server.js"]

EXPOSE 3001

# SaÄŸlÄ±k kontrolÃ¼
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

