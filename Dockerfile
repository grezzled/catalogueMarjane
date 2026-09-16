# SQLite + Next.js production image.
# No Postgres: the database is a single SQLite file on a shared volume.
FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# NEXT_PUBLIC_* values are inlined at build time — pass the public URL here.
ARG NEXT_PUBLIC_APP_URL=https://cataloguemarjane.com
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3006

# The compose file overrides this per service (app / worker).
CMD ["npm", "start"]
