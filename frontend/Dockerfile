# Frontend (Next.js SSR)
FROM node:18-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY frontend ./frontend
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Build the Next.js app
RUN npm run build

# Start Next in production
CMD ["node", "scripts/start-frontend.js"]

