#!/bin/bash

# Smart Baby Monitor - Push to GitHub Script
# This script initializes git and pushes to the specified repository

set -e

echo "Initializing Smart Baby Monitor git repository..."

# Initialize git repo
git init

# Configure git if not already configured
if ! git config user.name >/dev/null 2>&1; then
    echo "Please enter your name for git commits:"
    read -r git_name
    git config user.name "$git_name"
fi

if ! git config user.email >/dev/null 2>&1; then
    echo "Please enter your email for git commits:"
    read -r git_email
    git config user.email "$git_email"
fi

# Add all files
echo "Adding all files to git..."
git add .

# Create initial commit
echo "Creating initial commit..."
git commit -m "Initial commit: Smart Baby Monitor - Full-stack ML application

- FastAPI backend with WebSocket support
- React Native cross-platform mobile app
- PyTorch ML models with ONNX optimization
- Apache Kafka for stream processing
- PostgreSQL database with Redis caching
- AWS ECS deployment with Terraform
- Prometheus + Grafana monitoring
- Comprehensive CI/CD pipelines
- Security scanning and best practices

Features:
- Real-time baby cry detection using MFCC + CNN
- Video motion analysis with YOLOv8
- WebSocket streaming for live audio/video
- Push notifications via Firebase
- Auto-scaling infrastructure
- Production-ready monitoring"

# Add remote repository
echo "Adding remote repository..."
git remote add origin https://github.com/YuvDwi/Cradle.git

# Set main branch
git branch -M main

# Push to GitHub
echo "Pushing to GitHub..."
git push -u origin main

echo "Successfully pushed Smart Baby Monitor to GitHub!"
echo "Repository: https://github.com/YuvDwi/Cradle"
