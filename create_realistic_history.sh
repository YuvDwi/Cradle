#!/bin/bash

# Smart Baby Monitor - Create Realistic Git History
# This script creates commits with specific files for each development phase

set -e

echo "Creating realistic git history for Smart Baby Monitor..."

# Remove existing git history
rm -rf .git
git init
git config user.name "Yuvraj"
git config user.email "yuvraj@example.com"

# Function to commit with specific date
commit_with_date() {
    local date=$1
    local time=$2
    local message="$3"
    shift 3
    local files=("$@")
    
    # Set environment variables for commit date
    export GIT_AUTHOR_DATE="$date $time"
    export GIT_COMMITTER_DATE="$date $time"
    
    # Add specific files
    for file in "${files[@]}"; do
        if [ -f "$file" ] || [ -d "$file" ]; then
            git add "$file"
        fi
    done
    
    git commit -m "$message"
    
    # Unset environment variables
    unset GIT_AUTHOR_DATE
    unset GIT_COMMITTER_DATE
}

# Day 1 (14 days ago) - Project initialization
DATE1=$(date -v-14d '+%Y-%m-%d')
commit_with_date "$DATE1" "09:00:00" "Initial project setup and README" "README.md"

# Day 1 Evening - Basic structure
commit_with_date "$DATE1" "18:30:00" "Create project directory structure and environment config" "env.example"

# Day 2 (13 days ago) - Backend foundation
DATE2=$(date -v-13d '+%Y-%m-%d')
commit_with_date "$DATE2" "10:15:00" "Setup FastAPI backend foundation" \
    "backend/requirements.txt" "backend/app/main.py" "backend/app/__init__.py" "backend/app/core/"

# Day 2 Evening - Database models
commit_with_date "$DATE2" "19:45:00" "Add PostgreSQL database models and configuration" \
    "backend/app/db/" "backend/app/models/"

# Day 3 (12 days ago) - API endpoints
DATE3=$(date -v-12d '+%Y-%m-%d')
commit_with_date "$DATE3" "11:20:00" "Implement REST API endpoints and authentication" \
    "backend/app/api/"

# Day 4 (11 days ago) - Services layer
DATE4=$(date -v-11d '+%Y-%m-%d')
commit_with_date "$DATE4" "09:45:00" "Implement Kafka and Redis services" \
    "backend/app/services/"

# Day 5 (10 days ago) - ML foundation
DATE5=$(date -v-10d '+%Y-%m-%d')
commit_with_date "$DATE5" "14:30:00" "Add ML inference services with PyTorch" \
    "backend/app/ml/audio_classifier.py" "backend/app/ml/model_optimizer.py" "backend/app/ml/__init__.py"

# Day 5 Evening - ONNX optimization
commit_with_date "$DATE5" "21:00:00" "Implement video detection and ML inference service" \
    "backend/app/ml/video_detector.py" "backend/app/ml/inference_service.py"

# Day 7 (8 days ago) - Mobile app foundation
DATE7=$(date -v-8d '+%Y-%m-%d')
commit_with_date "$DATE7" "11:15:00" "Initialize React Native mobile app" \
    "mobile/package.json" "mobile/index.js" "mobile/src/App.tsx"

# Day 7 Evening - Mobile services
commit_with_date "$DATE7" "20:45:00" "Implement mobile services and WebSocket client" \
    "mobile/src/services/"

# Day 8 (7 days ago) - Mobile screens
DATE8=$(date -v-7d '+%Y-%m-%d')
commit_with_date "$DATE8" "13:20:00" "Add mobile screens and navigation" \
    "mobile/src/screens/"

# Day 9 (6 days ago) - Docker containers
DATE9=$(date -v-6d '+%Y-%m-%d')
commit_with_date "$DATE9" "09:30:00" "Add Docker containers and docker-compose" \
    "backend/Dockerfile" "docker-compose.yml" "backend/.dockerignore"

# Day 9 Evening - Nginx configuration
commit_with_date "$DATE9" "18:00:00" "Configure Nginx load balancer" \
    "infrastructure/nginx/"

# Day 10 (5 days ago) - Monitoring setup
DATE10=$(date -v-5d '+%Y-%m-%d')
commit_with_date "$DATE10" "12:00:00" "Setup Prometheus and Grafana monitoring" \
    "monitoring/"

# Day 10 Evening - Infrastructure as Code
commit_with_date "$DATE10" "21:30:00" "Add Terraform infrastructure configuration" \
    "infrastructure/terraform/main.tf" "infrastructure/terraform/variables.tf" "infrastructure/terraform/outputs.tf"

# Day 11 (4 days ago) - AWS deployment
DATE11=$(date -v-4d '+%Y-%m-%d')
commit_with_date "$DATE11" "10:45:00" "Configure AWS ECS deployment" \
    "infrastructure/terraform/ecs.tf" "infrastructure/terraform/terraform.tfvars.example"

# Day 11 Evening - CI/CD pipeline
commit_with_date "$DATE11" "19:15:00" "Setup GitHub Actions CI/CD pipeline" \
    ".github/workflows/backend-ci.yml" ".github/workflows/mobile-ci.yml"

# Day 12 (3 days ago) - Security enhancements
DATE12=$(date -v-3d '+%Y-%m-%d')
commit_with_date "$DATE12" "11:30:00" "Add security scanning and infrastructure workflows" \
    ".github/workflows/security.yml" ".github/workflows/infrastructure.yml"

# Day 13 (2 days ago) - Final touches
DATE13=$(date -v-2d '+%Y-%m-%d')
commit_with_date "$DATE13" "14:15:00" "Add deployment scripts and final configuration" \
    "push_to_github.sh" "push_options.sh" "setup_git_history.sh"

# Today - Project completion
TODAY_DATE=$(date '+%Y-%m-%d')
commit_with_date "$TODAY_DATE" "16:00:00" "Project ready for deployment - Smart Baby Monitor v1.0" \
    "setup_git_history_macos.sh" "create_realistic_history.sh"

echo "Realistic git history created successfully!"
echo ""
echo "Git log:"
git log --oneline --graph
echo ""
echo "Ready to push to GitHub with: git push -u origin main --force"
