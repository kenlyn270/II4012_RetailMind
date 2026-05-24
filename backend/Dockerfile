FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules like bcrypt
RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./
RUN npm ci

COPY backend ./

EXPOSE 3001

CMD ["npm", "run", "dev"]
