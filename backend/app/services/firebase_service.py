import firebase_admin
from firebase_admin import credentials, messaging
import logging
from typing import Optional, Dict, Any, List
import json
import os

from app.core.config import settings

logger = logging.getLogger(__name__)

class FirebaseService:
    def __init__(self):
        self.app = None
        self._initialize_firebase()
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            if not os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
                logger.warning("Firebase credentials file not found")
                return
            
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            self.app = firebase_admin.initialize_app(cred)
            logger.info("Firebase service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {e}")
            self.app = None
    
    async def send_notification(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> bool:
        """Send push notification to device"""
        if not self.app:
            logger.error("Firebase not initialized")
            return False
        
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                token=token,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        icon='ic_notification',
                        color='#FF6B35',
                        sound='default',
                        channel_id='baby_monitor_alerts'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(
                                title=title,
                                body=body
                            ),
                            sound='default',
                            badge=1
                        )
                    )
                )
            )
            
            response = messaging.send(message)
            logger.info(f"Notification sent successfully: {response}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            return False
    
    async def send_multicast_notification(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Send notification to multiple devices"""
        if not self.app:
            logger.error("Firebase not initialized")
            return {"success_count": 0, "failure_count": len(tokens)}
        
        try:
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                tokens=tokens,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        icon='ic_notification',
                        color='#FF6B35',
                        sound='default'
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(
                                title=title,
                                body=body
                            ),
                            sound='default'
                        )
                    )
                )
            )
            
            response = messaging.send_multicast(message)
            
            logger.info(f"Multicast notification sent - Success: {response.success_count}, Failure: {response.failure_count}")
            
            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "responses": [{"success": resp.success, "message_id": resp.message_id} for resp in response.responses]
            }
            
        except Exception as e:
            logger.error(f"Failed to send multicast notification: {e}")
            return {"success_count": 0, "failure_count": len(tokens)}
    
    async def send_topic_notification(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> bool:
        """Send notification to topic subscribers"""
        if not self.app:
            return False
        
        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data=data or {},
                topic=topic
            )
            
            response = messaging.send(message)
            logger.info(f"Topic notification sent to {topic}: {response}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send topic notification: {e}")
            return False
    
    async def subscribe_to_topic(self, tokens: List[str], topic: str) -> Dict[str, Any]:
        """Subscribe tokens to topic"""
        if not self.app:
            return {"success_count": 0, "failure_count": len(tokens)}
        
        try:
            response = messaging.subscribe_to_topic(tokens, topic)
            
            logger.info(f"Subscribed to topic {topic} - Success: {response.success_count}, Failure: {response.failure_count}")
            
            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count
            }
            
        except Exception as e:
            logger.error(f"Failed to subscribe to topic: {e}")
            return {"success_count": 0, "failure_count": len(tokens)}
    
    async def unsubscribe_from_topic(self, tokens: List[str], topic: str) -> Dict[str, Any]:
        """Unsubscribe tokens from topic"""
        if not self.app:
            return {"success_count": 0, "failure_count": len(tokens)}
        
        try:
            response = messaging.unsubscribe_from_topic(tokens, topic)
            
            logger.info(f"Unsubscribed from topic {topic} - Success: {response.success_count}, Failure: {response.failure_count}")
            
            return {
                "success_count": response.success_count,
                "failure_count": response.failure_count
            }
            
        except Exception as e:
            logger.error(f"Failed to unsubscribe from topic: {e}")
            return {"success_count": 0, "failure_count": len(tokens)}
