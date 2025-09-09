# Backend API (Express)
FROM node:18-alpine AS base
WORKDIR /app

# Install production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy sources
COPY backend ./backend
COPY data ./data

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "backend/server.js"]

