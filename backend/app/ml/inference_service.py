import asyncio
import logging
from typing import Dict, Any, Optional
import time
import json
from datetime import datetime

from app.ml.audio_classifier import AudioInferenceService
from app.ml.video_detector import VideoInferenceService
from app.services.kafka_service import KafkaService
from app.services.redis_service import RedisService
from app.services.s3_service import S3Service
from app.core.config import settings
from app.api.monitoring import ML_INFERENCE_LATENCY, ALERTS_GENERATED

logger = logging.getLogger(__name__)

class MLInferenceService:
    """Main ML inference service that coordinates audio and video analysis"""
    
    def __init__(self):
        self.audio_service = AudioInferenceService()
        self.video_service = VideoInferenceService()
        self.kafka_service: Optional[KafkaService] = None
        self.redis_service: Optional[RedisService] = None
        self.s3_service = S3Service()
        self.running = False
    
    async def start(self):
        """Start the ML inference service"""
        try:
            self.kafka_service = KafkaService()
            self.redis_service = RedisService()
            
            await self.kafka_service.start()
            await self.redis_service.connect()
            
            # Start Kafka consumers
            asyncio.create_task(self._consume_audio_stream())
            asyncio.create_task(self._consume_video_stream())
            
            self.running = True
            logger.info("ML Inference Service started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start ML Inference Service: {e}")
            raise
    
    async def stop(self):
        """Stop the ML inference service"""
        self.running = False
        
        if self.kafka_service:
            await self.kafka_service.stop()
        
        if self.redis_service:
            await self.redis_service.disconnect()
        
        logger.info("ML Inference Service stopped")
    
    async def _consume_audio_stream(self):
        """Consume audio stream messages from Kafka"""
        if not self.kafka_service:
            return
        
        async def process_audio_message(message: Dict[str, Any]):
            try:
                session_id = message.get("session_id")
                device_id = message.get("device_id")
                
                if not session_id or not device_id:
                    logger.warning("Invalid audio message: missing session_id or device_id")
                    return
                
                # Check rate limiting
                if not await self._check_rate_limit(f"audio:{device_id}", 10, 60):
                    logger.warning(f"Rate limit exceeded for audio processing: {device_id}")
                    return
                
                # Simulate fetching audio data (in real implementation, would get from S3 or message)
                audio_data = b'\x00' * 16000  # Dummy audio data
                
                # Process audio
                start_time = time.time()
                result = await self.audio_service.detect_cry(audio_data)
                inference_time = time.time() - start_time
                
                # Record metrics
                ML_INFERENCE_LATENCY.labels(model_type='audio').observe(inference_time)
                
                # Cache result
                await self._cache_inference_result(session_id, "audio", result)
                
                # Check for alerts
                await self._check_audio_alerts(device_id, session_id, result)
                
            except Exception as e:
                logger.error(f"Audio processing failed: {e}")
        
        await self.kafka_service.consume_messages(
            settings.KAFKA_AUDIO_TOPIC,
            process_audio_message
        )
    
    async def _consume_video_stream(self):
        """Consume video stream messages from Kafka"""
        if not self.kafka_service:
            return
        
        async def process_video_message(message: Dict[str, Any]):
            try:
                session_id = message.get("session_id")
                device_id = message.get("device_id")
                
                if not session_id or not device_id:
                    logger.warning("Invalid video message: missing session_id or device_id")
                    return
                
                # Check rate limiting
                if not await self._check_rate_limit(f"video:{device_id}", 5, 60):
                    logger.warning(f"Rate limit exceeded for video processing: {device_id}")
                    return
                
                # Simulate fetching video frame data
                frame_data = b'\xff\xd8\xff' + b'\x00' * 10000  # Dummy JPEG frame
                
                # Process video
                start_time = time.time()
                result = await self.video_service.analyze_video_frame(frame_data)
                inference_time = time.time() - start_time
                
                # Record metrics
                ML_INFERENCE_LATENCY.labels(model_type='video').observe(inference_time)
                
                # Cache result
                await self._cache_inference_result(session_id, "video", result)
                
                # Check for alerts
                await self._check_video_alerts(device_id, session_id, result)
                
            except Exception as e:
                logger.error(f"Video processing failed: {e}")
        
        await self.kafka_service.consume_messages(
            settings.KAFKA_VIDEO_TOPIC,
            process_video_message
        )
    
    async def _check_rate_limit(self, identifier: str, limit: int, window: int) -> bool:
        """Check rate limiting for inference requests"""
        if not self.redis_service:
            return True
        
        return await self.redis_service.rate_limit_check(identifier, limit, window)
    
    async def _cache_inference_result(self, session_id: str, model_type: str, result: Dict[str, Any]):
        """Cache inference results"""
        if not self.redis_service:
            return
        
        await self.redis_service.cache_ml_result(session_id, model_type, result)
    
    async def _check_audio_alerts(self, device_id: str, session_id: str, result: Dict[str, Any]):
        """Check audio analysis results for alert conditions"""
        try:
            if result.get("is_crying", False):
                confidence = result.get("confidence", 0.0)
                
                # Determine severity based on confidence
                if confidence > 0.9:
                    severity = "high"
                elif confidence > 0.7:
                    severity = "medium"
                else:
                    severity = "low"
                
                alert_data = {
                    "alert_type": "cry_detected",
                    "severity": severity,
                    "confidence": confidence,
                    "device_id": device_id,
                    "session_id": session_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "metadata": {
                        "audio_features": result.get("spectral_features", {}),
                        "model_used": result.get("model_used", "unknown"),
                        "inference_time_ms": result.get("inference_time_ms", 0)
                    }
                }
                
                # Send alert to Kafka
                if self.kafka_service:
                    await self.kafka_service.send_alert(alert_data)
                
                # Record alert metric
                ALERTS_GENERATED.labels(type='cry_detected', severity=severity).inc()
                
                logger.info(f"Cry alert generated - Device: {device_id}, Confidence: {confidence:.3f}")
        
        except Exception as e:
            logger.error(f"Audio alert check failed: {e}")
    
    async def _check_video_alerts(self, device_id: str, session_id: str, result: Dict[str, Any]):
        """Check video analysis results for alert conditions"""
        try:
            analysis = result.get("analysis", {})
            
            # High activity alert
            if analysis.get("activity_level") == "high":
                alert_data = {
                    "alert_type": "high_activity",
                    "severity": "medium",
                    "confidence": 0.8,
                    "device_id": device_id,
                    "session_id": session_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "metadata": {
                        "motion_features": result.get("motion_features", {}),
                        "detections": result.get("detections", []),
                        "activity_level": analysis.get("activity_level"),
                        "inference_time_ms": result.get("inference_time_ms", 0)
                    }
                }
                
                if self.kafka_service:
                    await self.kafka_service.send_alert(alert_data)
                
                ALERTS_GENERATED.labels(type='high_activity', severity='medium').inc()
            
            # Safety alerts
            safety_alerts = analysis.get("safety_alerts", [])
            for alert_msg in safety_alerts:
                alert_data = {
                    "alert_type": "safety_concern",
                    "severity": "high",
                    "confidence": 0.9,
                    "device_id": device_id,
                    "session_id": session_id,
                    "timestamp": datetime.utcnow().isoformat(),
                    "description": alert_msg,
                    "metadata": {
                        "detections": result.get("detections", []),
                        "safety_alert": alert_msg
                    }
                }
                
                if self.kafka_service:
                    await self.kafka_service.send_alert(alert_data)
                
                ALERTS_GENERATED.labels(type='safety_concern', severity='high').inc()
                
                logger.warning(f"Safety alert - Device: {device_id}, Alert: {alert_msg}")
        
        except Exception as e:
            logger.error(f"Video alert check failed: {e}")
    
    async def process_realtime_data(self, device_id: str, data_type: str, data: bytes) -> Dict[str, Any]:
        """Process real-time data directly (for WebSocket connections)"""
        try:
            start_time = time.time()
            
            if data_type == "audio":
                result = await self.audio_service.detect_cry(data)
                ML_INFERENCE_LATENCY.labels(model_type='audio').observe(time.time() - start_time)
                return result
            
            elif data_type == "video":
                result = await self.video_service.analyze_video_frame(data)
                ML_INFERENCE_LATENCY.labels(model_type='video').observe(time.time() - start_time)
                return result
            
            else:
                return {"error": f"Unsupported data type: {data_type}"}
        
        except Exception as e:
            logger.error(f"Real-time processing failed: {e}")
            return {"error": str(e)}
    
    async def get_cached_results(self, session_id: str) -> Dict[str, Any]:
        """Get cached inference results for a session"""
        if not self.redis_service:
            return {}
        
        try:
            audio_result = await self.redis_service.get_cached_ml_result(session_id, "audio")
            video_result = await self.redis_service.get_cached_ml_result(session_id, "video")
            
            return {
                "session_id": session_id,
                "audio_analysis": audio_result,
                "video_analysis": video_result,
                "retrieved_at": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Failed to get cached results: {e}")
            return {}
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get ML inference service status"""
        return {
            "running": self.running,
            "audio_model_info": self.audio_service.get_model_info(),
            "video_model_info": self.video_service.get_model_info(),
            "kafka_connected": self.kafka_service is not None,
            "redis_connected": self.redis_service is not None,
            "s3_available": self.s3_service is not None
        }
