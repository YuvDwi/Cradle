<img width="919" height="566" alt="image" src="https://github.com/user-attachments/assets/41a97d77-66a9-4d5e-a407-441675b652fb" />


# Cradle: Multi-Modal AI Baby Monitoring System

## **Project Overview**

**Cradle** is a multimodal baby monitoring system that uses React Native with a PyTorch backend. The app streams real-time audio and video from a caregiver’s phone, while the backend processes those streams to detect crying, unusual motion, or other events of interest. 

Models trained in PyTorch and optimized with ONNX Runtime handle audio classification and video activity recognition. Data flows through Apache Kafka for scalable streaming, and predictions are served via a FastAPI service. The system sends instant alerts to caregivers through Firebase Cloud Messaging, while all services are containerized with Docker and deployed on AWS ECS

**Key Achievement**: Successfully architected and deployed an end-to-end ML system handling real-time audio/video streams with sub-second latency across mobile and cloud platforms.

---

##  **Technical Architecture & Skills Demonstrated**

### **Mobile Development**
- **React Native** - React Native mobile application (iOS & Android)
- **WebRTC** - Real-time peer-to-peer communication for audio/video streaming
- **Firebase Cloud Messaging** - Push notification system for instant alerts

### **Machine Learning & AI Engineering**
- **Computer Vision** - YOLOv8-tiny implementation for motion detection with quantization optimization
- **PyTorch** - Custom CNN models with MFCC feature extraction for cry detection
- **Model Optimization** - ONNX Runtime deployment for production inference
- **Hugging Face Transformers** - Advanced NLP/audio model integration

### **Backend & API Development**
- **FastAPI** - High-performance async web framework
- **RESTful APIs** - Comprehensive API design and documentation
- **WebSocket APIs** - Real-time bidirectional communication
- **Python 3.9+** - Advanced Python programming and async/await patterns

### **Data Engineering & Streaming**
- **Apache Kafka** - Distributed streaming platform for handling high-throughput data
- **Message Queue Architecture** - Event-driven microservices design
- **Real-time Data Processing** - Stream processing pipelines for audio/video analysis
- **Data Pipeline Orchestration** - End-to-end ETL processes

### **Database & Storage Systems**
- **PostgreSQL** - Relational database with queries and indexing
- **Redis** - In-memory caching and session management
- **AWS S3** - Cloud object storage for media files

### **Cloud Infrastructure & DevOps**
- **AWS ECS** Microservices deployment
- **Docker** - Containerization and multi-stage builds
- **Terraform** - Cloud provisioning
- **AWS CLI** - Cloud resource management and automation

### **Monitoring & Observability**
- **Prometheus** - Metrics collection and monitoring
- **Grafana** - Data visualization and alerting dashboards

---

## **Key Technical Achievements**

### **Performance Optimization**
- Architected streaming pipeline to handle concurrent connections**
- Optimized mobile app for **fast response times** on real-time alerts

### **Scalability Engineering**
- Designed fault-tolerant message queue system with Apache Kafka
- Built auto-scaling cloud infrastructure supporting variable load
- Implemented microservices architecture enabling independent scaling

### **Production-Ready Features**
- Comprehensive error handling and graceful degradation
- Health checks and monitoring across all system components
- Secure API authentication and data encryption
- Offline capability with local inference fallbacks

---

##  **Technologies Mastered**

**Programming Languages**: Python, JavaScript/TypeScript  
**Mobile Frameworks**: React Native, Flutter  
**ML/AI Frameworks**: PyTorch, ONNX Runtime, Hugging Face  
**Web Frameworks**: FastAPI, Node.js  
**Databases**: PostgreSQL, Redis  
**Message Queues**: Apache Kafka  
**Cloud Platforms**: AWS (ECS, S3, CloudWatch)  
**Infrastructure**: Docker, Terraform, Kubernetes concepts  
**Monitoring**: Prometheus, Grafana  
**CI/CD**: GitHub Actions, Docker Compose  

---

##  **Quick Start Guide**

```bash
# Clone and set up the full environment
git clone https://github.com/YuvDwi/Cradle
cd Cradle

# Launch complete development environment
docker-compose up -d

# Deploy to production (AWS)
cd infrastructure
terraform init && terraform apply

# Access monitoring dashboard
# Grafana: http://localhost:3000
```

