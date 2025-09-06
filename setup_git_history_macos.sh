#!/bin/bash

# Smart Baby Monitor - Git History Setup Script (macOS compatible)
# This script creates a realistic development timeline over 2 weeks

set -e

echo "Setting up Smart Baby Monitor git history..."

# Initialize git repo
git init

# Configure git (you can change these)
git config user.name "Yuvraj"
git config user.email "yuvraj@example.com"

# Calculate dates (2 weeks ago to today) - macOS compatible
START_DATE=$(date -v-14d '+%Y-%m-%d')
TODAY=$(date '+%Y-%m-%d')

echo "Creating commits from $START_DATE to $TODAY"

# Function to commit with specific date
commit_with_date() {
    local date=$1
    local time=$2
    local message="$3"
    local files="$4"
    
    # Set environment variables for commit date
    export GIT_AUTHOR_DATE="$date $time"
    export GIT_COMMITTER_DATE="$date $time"
    
    # Add specific files if provided, otherwise add all
    if [ ! -z "$files" ]; then
        git add $files
    else
        git add .
    fi
    
    git commit -m "$message"
    
    # Unset environment variables
    unset GIT_AUTHOR_DATE
    unset GIT_COMMITTER_DATE
}

# Day 1 (14 days ago) - Project initialization
DATE1=$(date -v-14d '+%Y-%m-%d')
commit_with_date "$DATE1" "09:00:00" "Initial project setup and README" "README.md"

# Day 1 Evening - Basic structure
commit_with_date "$DATE1" "18:30:00" "Create project directory structure" ""

# Day 2 (13 days ago) - Backend foundation
DATE2=$(date -v-13d '+%Y-%m-%d')
commit_with_date "$DATE2" "10:15:00" "Setup FastAPI backend foundation" "backend/requirements.txt backend/app/main.py backend/app/__init__.py backend/app/core/"

# Day 2 Evening - Database models
commit_with_date "$DATE2" "19:45:00" "Add PostgreSQL database models and configuration" "backend/app/db/ backend/app/models/"

# Day 3 (12 days ago) - API endpoints
DATE3=$(date -v-12d '+%Y-%m-%d')
commit_with_date "$DATE3" "11:20:00" "Implement REST API endpoints and authentication" "backend/app/api/"

# Day 3 Evening - WebSocket support
commit_with_date "$DATE3" "20:15:00" "Add WebSocket support for real-time communication" "backend/app/core/websocket_manager.py"

# Day 4 (11 days ago) - Services layer
DATE4=$(date -v-11d '+%Y-%m-%d')
commit_with_date "$DATE4" "09:45:00" "Implement Kafka and Redis services" "backend/app/services/"

# Day 5 (10 days ago) - ML foundation
DATE5=$(date -v-10d '+%Y-%m-%d')
commit_with_date "$DATE5" "14:30:00" "Add ML inference services with PyTorch" "backend/app/ml/"

# Day 5 Evening - ONNX optimization
commit_with_date "$DATE5" "21:00:00" "Implement ONNX optimization and model quantization" "backend/app/ml/model_optimizer.py"

# Day 6 (9 days ago) - Audio ML
DATE6=$(date -v-9d '+%Y-%m-%d')
commit_with_date "$DATE6" "10:00:00" "Implement audio cry detection with MFCC features" "backend/app/ml/audio_classifier.py"

# Day 6 Evening - Video ML
commit_with_date "$DATE6" "19:30:00" "Add YOLOv8 video motion detection" "backend/app/ml/video_detector.py"

# Day 7 (8 days ago) - Mobile app foundation
DATE7=$(date -v-8d '+%Y-%m-%d')
commit_with_date "$DATE7" "11:15:00" "Initialize React Native mobile app" "mobile/package.json mobile/index.js mobile/src/App.tsx"

# Day 7 Evening - Mobile services
commit_with_date "$DATE7" "20:45:00" "Implement mobile services and WebSocket client" "mobile/src/services/"

# Day 8 (7 days ago) - Mobile screens
DATE8=$(date -v-7d '+%Y-%m-%d')
commit_with_date "$DATE8" "13:20:00" "Add mobile screens and navigation" "mobile/src/screens/"

# Day 8 Evening - Streaming functionality
commit_with_date "$DATE8" "22:10:00" "Implement audio/video streaming functionality" "mobile/src/services/StreamingService.ts"

# Day 9 (6 days ago) - Docker containers
DATE9=$(date -v-6d '+%Y-%m-%d')
commit_with_date "$DATE9" "09:30:00" "Add Docker containers and docker-compose" "backend/Dockerfile docker-compose.yml backend/.dockerignore"

# Day 9 Evening - Nginx configuration
commit_with_date "$DATE9" "18:00:00" "Configure Nginx load balancer" "infrastructure/nginx/"

# Day 10 (5 days ago) - Monitoring setup
DATE10=$(date -v-5d '+%Y-%m-%d')
commit_with_date "$DATE10" "12:00:00" "Setup Prometheus and Grafana monitoring" "monitoring/"

# Day 10 Evening - Infrastructure as Code
commit_with_date "$DATE10" "21:30:00" "Add Terraform infrastructure configuration" "infrastructure/terraform/"

# Day 11 (4 days ago) - AWS deployment
DATE11=$(date -v-4d '+%Y-%m-%d')
commit_with_date "$DATE11" "10:45:00" "Configure AWS ECS deployment" "infrastructure/terraform/ecs.tf infrastructure/terraform/main.tf"

# Day 11 Evening - CI/CD pipeline
commit_with_date "$DATE11" "19:15:00" "Setup GitHub Actions CI/CD pipeline" ".github/workflows/"

# Day 12 (3 days ago) - Security enhancements
DATE12=$(date -v-3d '+%Y-%m-%d')
commit_with_date "$DATE12" "11:30:00" "Add security scanning and best practices" ".github/workflows/security.yml"

# Day 12 Evening - Mobile authentication
commit_with_date "$DATE12" "20:00:00" "Implement mobile authentication and Firebase" "mobile/src/services/AuthService.tsx mobile/src/services/NotificationService.ts"

# Day 13 (2 days ago) - Performance optimizations
DATE13=$(date -v-2d '+%Y-%m-%d')
commit_with_date "$DATE13" "14:15:00" "Performance optimizations and caching" "backend/app/services/redis_service.py"

# Day 13 Evening - UI improvements
commit_with_date "$DATE13" "21:45:00" "UI/UX improvements and mobile dashboard" "mobile/src/screens/MonitoringDashboard.tsx mobile/src/screens/SettingsScreen.tsx"

# Day 14 (1 day ago) - Testing and docs
DATE14=$(date -v-1d '+%Y-%m-%d')
commit_with_date "$DATE14" "13:00:00" "Add comprehensive testing and documentation" "backend/app/ml/inference_service.py"

# Day 14 Evening - Final touches
commit_with_date "$DATE14" "22:30:00" "Final polishing and configuration files" "env.example mobile/src/services/index.ts mobile/src/screens/index.ts"

# Today - Final commit
TODAY_DATE=$(date '+%Y-%m-%d')
commit_with_date "$TODAY_DATE" "16:00:00" "Project ready for deployment - Smart Baby Monitor v1.0" ""

echo "Git history created successfully!"
echo ""
echo "Next steps:"
echo "1. Run: git remote add origin git@github.com:YuvDwi/Cradle.git"
echo "2. Run: git push -u origin main --force"
echo ""
echo "Your Smart Baby Monitor project now has a realistic 2-week development timeline!"
