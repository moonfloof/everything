FROM node:22

VOLUME [ "/app/data", "/app/public/game-images" ]

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY ./migrations/ ./migrations/
COPY ./public/ ./public/
COPY ./src/ ./src/

RUN npm run build

CMD [ "npm", "run", "start:production" ]
