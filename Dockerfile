FROM node:14-alpine

# Install build dependencies
RUN apk add --no-cache \
    build-base \
    python2 \
    git \
    curl \
    bash

# Create app directory
WORKDIR /app

# Install Meteor 2.13 specifically
RUN curl https://install.meteor.com/?release=2.13 | sh

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Build Meteor app with architecture flag
RUN METEOR_DISABLE_OPTIMISTIC_CACHING=1 meteor build --directory /build --server-only --architecture os.linux.x86_64

# Change to the built app directory
WORKDIR /build/bundle

# Install production dependencies
RUN cd programs/server && npm install

# Set environment variables
ENV PORT=3000 \
    ROOT_URL=http://localhost \
    MONGO_URL=mongodb://mongo:27017/meteor \
    MONGO_OPLOG_URL=mongodb://mongo:27017/local

# Expose the application port
EXPOSE 3000

# Start the app
CMD ["node", "main.js"]