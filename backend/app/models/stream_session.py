from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class StreamSession(Base):
    __tablename__ = "stream_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True))
    duration_seconds = Column(Float)
    total_bytes_received = Column(Integer, default=0)
    avg_bitrate_kbps = Column(Float)
    connection_quality = Column(String)  # excellent, good, fair, poor
    disconnect_reason = Column(String)
    metadata = Column(JSON)  # Store connection info, errors, etc.
    is_active = Column(Boolean, default=True)
    
    # Relationships
    device = relationship("Device", back_populates="stream_sessions")
