# Use an official Node.js runtime as a parent image (Node 20 recommended)
FROM node:20-bookworm-slim

# Install Python, pip, and build tools for native modules (like canvas/oxide)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libgl1-mesa-glx \
    libsm6 \
    libxrender1 \
    libxext6 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Map 'python' to 'python3'
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set the working directory
WORKDIR /app

# Copy package.json and install Node dependencies (ignoring local lockfile for platform compatibility)
COPY package.json ./
RUN npm install

# Install Python libraries for translation and OCR
RUN pip3 install deep-translator paddleocr paddlepaddle --break-system-packages

# Copy the rest of the project files
COPY . .

# Build the frontend (React/Vite)
RUN npm run build

# Build the backend server
RUN npm run build:server

# Expose port
EXPOSE 3000

# Command to run the backend (using the compiled JS version)
CMD ["npm", "start"]
