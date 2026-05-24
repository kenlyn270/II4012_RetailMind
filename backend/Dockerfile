FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend ./

EXPOSE 3001

CMD ["npm", "run", "dev"]
