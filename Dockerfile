FROM node:22

VOLUME [ "/app/data" ]

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY ./src/ ./src/
COPY ./public/ ./public/
RUN npm run build

CMD [ "npm", "run", "start:production" ]
