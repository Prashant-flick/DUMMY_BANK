FROM node:slim

WORKDIR /user/src/app

COPY package.json package-lock.json tsconfig.json prisma src views ./

RUN npm install

RUN npm run db:generate

CMD ["npm", "run", "dev"]