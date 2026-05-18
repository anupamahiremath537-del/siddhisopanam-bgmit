# Use official Node.js image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Bundle app source
COPY . .

# Expose port 8080 (default for Cloud Run)
EXPOSE 8080

# Define the command to run the app
CMD [ "node", "server.js" ]
