FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund --fetch-retries=5 --fetch-timeout=120000
COPY . .
EXPOSE 3000
CMD ["npm","run","dev"]
