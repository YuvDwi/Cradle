from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String, nullable=False)  # cry_detected, motion_detected, sound_anomaly
    severity = Column(String, default="medium")  # low, medium, high, critical
    confidence_score = Column(Float, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    is_acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime(timezone=True))
    description = Column(Text)
    metadata = Column(JSON)  # Store ML model outputs, audio features, etc.
    s3_audio_url = Column(String)
    s3_video_url = Column(String)
    duration_seconds = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="alerts")
    device = relationship("Device", back_populates="alerts")
