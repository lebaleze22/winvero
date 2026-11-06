FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM nginx:stable-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html
EXPOSE 80

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=development
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./
COPY telegram-bot /app/telegram-bot
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3002
CMD ["node", "secure-server.mjs"]

FROM node:24-bookworm-slim AS bot
ENV NODE_ENV=development
WORKDIR /app/telegram-bot
COPY telegram-bot ./
USER node
EXPOSE 3001
CMD ["node", "bot.mjs"]
