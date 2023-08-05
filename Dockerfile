FROM node:lts

VOLUME [ "/app/data" ]

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY ./src/ ./src/
COPY ./public/ ./public/

RUN npm ci --omit=dev

CMD [ "npm", "run", "start:production" ]
