FROM node:20-bookworm-slim

WORKDIR /opt/metatron-os

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build

RUN mkdir -p /var/lib/metatron && rm -rf /opt/metatron-os/data && ln -s /var/lib/metatron /opt/metatron-os/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

VOLUME ["/var/lib/metatron"]

CMD ["npx", "tsx", "server.ts"]
