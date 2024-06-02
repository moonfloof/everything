FROM node:22

VOLUME [ "/app/data" ]

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

COPY ./src/ ./src/
COPY ./public/ ./public/

CMD [ "npm", "run", "start:production" ]
