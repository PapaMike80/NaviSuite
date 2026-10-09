FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package.json worker.js ./
ENV TZ=Europe/Rome
CMD ["node", "worker.js"]
