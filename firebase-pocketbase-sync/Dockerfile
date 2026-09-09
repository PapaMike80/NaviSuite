FROM node:22-alpine
WORKDIR /app
COPY package.json ./
# Nessuna dipendenza esterna: Node 22 ha fetch/AbortController nativi.
COPY sync.js entities.js ./
USER node
CMD ["node", "sync.js"]
