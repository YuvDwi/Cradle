from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid
import asyncio
from datetime import datetime

from app.db.database import get_db
from app.models.device import Device
from app.models.stream_session import StreamSession
from app.api.auth import get_current_user
from app.models.user import User
from app.services.kafka_service import KafkaService
from app.services.s3_service import S3Service

router = APIRouter()

@router.post("/start-session/{device_id}")
async def start_stream_session(
    device_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify device belongs to user
    result = await db.execute(
        select(Device).where(Device.device_id == device_id, Device.user_id == current_user.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Create new stream session
    session_id = str(uuid.uuid4())
    stream_session = StreamSession(
        session_id=session_id,
        device_id=device.id,
        is_active=True
    )
    
    db.add(stream_session)
    await db.commit()
    await db.refresh(stream_session)
    
    return {
        "session_id": session_id,
        "device_id": device_id,
        "status": "session_started"
    }

@router.post("/end-session/{session_id}")
async def end_stream_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StreamSession).where(StreamSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update session
    session.ended_at = datetime.utcnow()
    session.is_active = False
    if session.started_at:
        duration = (session.ended_at - session.started_at).total_seconds()
        session.duration_seconds = duration
    
    await db.commit()
    
    return {"message": "Session ended successfully"}

@router.post("/upload-chunk/{session_id}")
async def upload_stream_chunk(
    session_id: str,
    chunk_type: str,  # 'audio' or 'video'
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StreamSession).where(StreamSession.session_id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session or not session.is_active:
        raise HTTPException(status_code=404, detail="Active session not found")
    
    # Read file data
    chunk_data = await file.read()
    
    # Process in background
    background_tasks.add_task(
        process_stream_chunk,
        session_id,
        chunk_type,
        chunk_data
    )
    
    # Update session stats
    session.total_bytes_received += len(chunk_data)
    await db.commit()
    
    return {
        "message": "Chunk received",
        "chunk_size": len(chunk_data),
        "type": chunk_type
    }

async def process_stream_chunk(session_id: str, chunk_type: str, data: bytes):
    # Send to Kafka for ML processing
    kafka_service = KafkaService()
    topic = "baby-audio-stream" if chunk_type == "audio" else "baby-video-stream"
    
    await kafka_service.send_message(topic, {
        "session_id": session_id,
        "chunk_type": chunk_type,
        "timestamp": datetime.utcnow().isoformat(),
        "data_size": len(data)
    })

@router.get("/sessions")
async def get_user_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(StreamSession)
        .join(Device)
        .where(Device.user_id == current_user.id)
        .order_by(StreamSession.started_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    
    return [{
        "session_id": session.session_id,
        "device_id": session.device.device_id,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "duration_seconds": session.duration_seconds,
        "is_active": session.is_active
    } for session in sessions]
