from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/baby_monitor"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_AUDIO_TOPIC: str = "baby-audio-stream"
    KAFKA_VIDEO_TOPIC: str = "baby-video-stream"
    KAFKA_ALERTS_TOPIC: str = "baby-alerts"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # AWS
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION: str = "us-west-2"
    S3_BUCKET_NAME: str = "baby-monitor-recordings"
    
    # ML Models
    AUDIO_MODEL_PATH: str = "./models/audio_classifier.onnx"
    VIDEO_MODEL_PATH: str = "./models/yolo_detector.onnx"
    
    # Monitoring
    PROMETHEUS_PORT: int = 8001
    
    # App
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    API_V1_STR: str = "/api/v1"
    
    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-service-account.json"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
