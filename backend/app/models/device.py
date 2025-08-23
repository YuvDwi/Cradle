from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    device_type = Column(String, default="mobile")  # mobile, camera, sensor
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    last_seen = Column(DateTime(timezone=True))
    firmware_version = Column(String)
    battery_level = Column(Float)
    location_lat = Column(Float)
    location_lng = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="devices")
    stream_sessions = relationship("StreamSession", back_populates="device")
    alerts = relationship("Alert", back_populates="device")
