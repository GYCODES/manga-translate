# Use an official Node.js runtime as a parent image
FROM node:18-bullseye-slim

# Install Python and pip
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Map 'python' to 'python3' so the spawn('python') commands work
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set the working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy Python requirements if any, or just install deep-translator
RUN pip3 install deep-translator

# Copy the rest of the backend files
COPY . .

# Expose port (Render automatically assigns one to process.env.PORT, but defaults to 3000)
EXPOSE 3000

# Command to run the backend
CMD ["npx", "tsx", "server.ts"]
