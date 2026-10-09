FROM node:20-alpine
WORKDIR /app
COPY package.json worker.js ./
ENV TZ=Europe/Rome
CMD ["node", "worker.js"]
