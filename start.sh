#!/bin/bash
set -e

# Deployment script to build and start the application without PostgreSQL (Visual Only Mode)
echo "Starting deployment script (Visual Only Mode)..."

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
