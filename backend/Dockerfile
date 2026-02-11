FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy prisma schema directory (needed for postinstall script)
COPY prisma ./prisma/

# Install dependencies (will run postinstall: prisma generate)
RUN npm install

# Copy source code and config files
COPY . .

# Build the application
RUN npm run build

# Start the application
CMD ["npm", "run", "start"]
