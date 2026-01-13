FROM node:18-alpine

WORKDIR /app

# Build tools for native modules
RUN apk add --no-cache python3 make g++

# Canvas (node-canvas) dependencies for image generation
RUN apk add --no-cache \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    fontconfig \
    font-noto \
    font-noto-cjk

COPY package*.json ./

RUN npm install

COPY . .

RUN mkdir -p /app/data

VOLUME ["/app/data"]

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
