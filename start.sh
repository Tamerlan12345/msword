#!/bin/bash
set -e

echo "Starting deployment script..."

# Build Frontend
echo "Building Frontend..."
cd frontend
npm install
npm run build
cd ..

# Build Backend
echo "Building Backend..."
cd backend
npm install
npm run build
cd ..

# Start Backend
echo "Starting Backend..."
cd backend
npm run start
