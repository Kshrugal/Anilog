# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set build-time arguments for Vite
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install 'serve' to host the static files
RUN npm install -g serve

# Copy built files from build stage
COPY --from=build /app/dist ./dist

# Expose port (Cloud Run sets this automatically, but good for local)
ENV PORT=8080
EXPOSE 8080

# Start the application
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
