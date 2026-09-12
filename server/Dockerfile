FROM node:18-slim
RUN apt-get update && apt-get install -y openssl libssl-dev build-essential python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --save-dev @types/luxon && npm install
COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma
COPY . .
RUN npm run build
ENV DATABASE_URL="mysql://trainer:trainer_dev_pass@host.docker.internal:3306/trainer_tracker"
ENV JWT_SECRET="change-me-to-a-long-random-string"
ENV PORT=3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
