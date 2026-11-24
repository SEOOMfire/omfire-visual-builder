FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build && chmod +x docker/entrypoint.sh
ENV NODE_ENV=production
EXPOSE 3000
CMD ["/app/docker/entrypoint.sh"]
