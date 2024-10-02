FROM node:20.12.0-alpine3.19

WORKDIR /user/src/app

COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY views ./views
COPY prisma ./prisma

RUN npm install

RUN npm run db:generate

CMD ["npm", "run", "dev"]