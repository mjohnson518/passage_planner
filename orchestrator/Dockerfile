# Base image for building
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --frozen-lockfile

COPY . ./

RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install --omit=dev --frozen-lockfile

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]

