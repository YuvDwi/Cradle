from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.models.alert import Alert
from app.models.device import Device
from app.api.auth import get_current_user
from app.models.user import User
from app.services.firebase_service import FirebaseService

router = APIRouter()

@router.get("/")
async def get_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    severity: Optional[str] = None,
    alert_type: Optional[str] = None
):
    query = select(Alert).where(Alert.user_id == current_user.id)
    
    if severity:
        query = query.where(Alert.severity == severity)
    if alert_type:
        query = query.where(Alert.alert_type == alert_type)
    
    query = query.order_by(desc(Alert.created_at)).limit(limit)
    
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    return [{
        "id": alert.id,
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "confidence_score": alert.confidence_score,
        "device_id": alert.device.device_id,
        "is_acknowledged": alert.is_acknowledged,
        "description": alert.description,
        "metadata": alert.metadata,
        "s3_audio_url": alert.s3_audio_url,
        "s3_video_url": alert.s3_video_url,
        "duration_seconds": alert.duration_seconds,
        "created_at": alert.created_at,
        "acknowledged_at": alert.acknowledged_at
    } for alert in alerts]

@router.post("/")
async def create_alert(
    alert_type: str,
    severity: str,
    confidence_score: float,
    device_id: str,
    description: Optional[str] = None,
    metadata: Optional[dict] = None,
    s3_audio_url: Optional[str] = None,
    s3_video_url: Optional[str] = None,
    duration_seconds: Optional[float] = None,
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
    
    # Create alert
    alert = Alert(
        alert_type=alert_type,
        severity=severity,
        confidence_score=confidence_score,
        user_id=current_user.id,
        device_id=device.id,
        description=description,
        metadata=metadata,
        s3_audio_url=s3_audio_url,
        s3_video_url=s3_video_url,
        duration_seconds=duration_seconds
    )
    
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    
    # Send push notification
    background_tasks.add_task(
        send_alert_notification,
        current_user.firebase_uid,
        alert_type,
        severity,
        description
    )
    
    return {
        "id": alert.id,
        "message": "Alert created successfully",
        "alert_type": alert_type,
        "severity": severity
    }

@router.patch("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.is_acknowledged = True
    alert.acknowledged_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Alert acknowledged"}

@router.get("/stats")
async def get_alert_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    days: int = 7
):
    since_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(Alert).where(
            Alert.user_id == current_user.id,
            Alert.created_at >= since_date
        )
    )
    alerts = result.scalars().all()
    
    stats = {
        "total_alerts": len(alerts),
        "acknowledged": sum(1 for a in alerts if a.is_acknowledged),
        "by_severity": {},
        "by_type": {},
        "avg_confidence": sum(a.confidence_score for a in alerts) / len(alerts) if alerts else 0
    }
    
    for alert in alerts:
        stats["by_severity"][alert.severity] = stats["by_severity"].get(alert.severity, 0) + 1
        stats["by_type"][alert.alert_type] = stats["by_type"].get(alert.alert_type, 0) + 1
    
    return stats

async def send_alert_notification(firebase_uid: str, alert_type: str, severity: str, description: str):
    if not firebase_uid:
        return
    
    firebase_service = FirebaseService()
    
    title = f"Baby Monitor Alert - {alert_type.replace('_', ' ').title()}"
    body = description or f"{severity.title()} alert detected"
    
    await firebase_service.send_notification(
        firebase_uid,
        title,
        body,
        {"alert_type": alert_type, "severity": severity}
    )
