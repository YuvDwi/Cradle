# Smart Baby Monitor

A full-stack machine learning application for intelligent baby monitoring with real-time audio/video analysis.

## Tech Stack

- **Backend**: FastAPI, Python, PyTorch, Hugging Face Transformers
- **Database**: PostgreSQL, Redis
- **Message Queue**: Apache Kafka
- **ML**: ONNX Runtime, quantization, YOLOv8, MFCC
- **Mobile**: React Native, WebRTC, Firebase Cloud Messaging
- **Infrastructure**: Docker, AWS ECS, S3, Terraform
- **Monitoring**: Prometheus, Grafana
- **CI/CD**: GitHub Actions

## Architecture

```
Mobile App (React Native) 
    ↓ WebSocket/RTSP
Backend API (FastAPI)
    ↓ Kafka
ML Inference Service (PyTorch → ONNX)
    ↓ 
PostgreSQL + S3 Storage
```

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 16+
- Docker & Docker Compose
- AWS CLI

### Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Mobile
cd mobile
npm install
npx react-native run-ios  # or run-android

# Infrastructure
docker-compose up -d
```

## Deployment

Deploy to AWS ECS using the provided Terraform configurations:

```bash
cd infrastructure
terraform init
terraform apply
```

## Monitoring

Access Grafana dashboards at `http://localhost:3000` after running docker-compose.
