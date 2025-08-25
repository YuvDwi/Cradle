from kafka import KafkaProducer, KafkaConsumer
from kafka.errors import KafkaError
import json
import asyncio
import logging
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor

from app.core.config import settings

logger = logging.getLogger(__name__)

class KafkaService:
    def __init__(self):
        self.producer: Optional[KafkaProducer] = None
        self.consumers: Dict[str, KafkaConsumer] = {}
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.running = False
    
    async def start(self):
        """Initialize Kafka producer and consumers"""
        try:
            # Initialize producer
            self.producer = KafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','),
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                retry_backoff_ms=500,
                request_timeout_ms=30000
            )
            
            # Initialize consumers for different topics
            await self._setup_consumers()
            
            self.running = True
            logger.info("Kafka service started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start Kafka service: {e}")
            raise
    
    async def stop(self):
        """Stop all Kafka connections"""
        self.running = False
        
        if self.producer:
            self.producer.close()
        
        for consumer in self.consumers.values():
            consumer.close()
        
        self.executor.shutdown(wait=True)
        logger.info("Kafka service stopped")
    
    async def _setup_consumers(self):
        """Setup Kafka consumers for different topics"""
        topics = [
            settings.KAFKA_AUDIO_TOPIC,
            settings.KAFKA_VIDEO_TOPIC,
            settings.KAFKA_ALERTS_TOPIC
        ]
        
        for topic in topics:
            consumer = KafkaConsumer(
                topic,
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(','),
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                auto_offset_reset='latest',
                group_id=f'baby-monitor-{topic}-group'
            )
            self.consumers[topic] = consumer
    
    async def send_message(self, topic: str, message: Dict[str, Any], key: Optional[str] = None):
        """Send message to Kafka topic"""
        if not self.producer:
            logger.error("Kafka producer not initialized")
            return False
        
        try:
            future = self.producer.send(topic, value=message, key=key)
            # Don't wait for result in async context - fire and forget
            return True
            
        except KafkaError as e:
            logger.error(f"Failed to send message to {topic}: {e}")
            return False
    
    async def send_stream_data(self, device_id: str, data: bytes):
        """Send streaming data to appropriate topic based on content type"""
        # Simple heuristic to determine content type
        # In production, this would be more sophisticated
        if len(data) < 10000:  # Assume audio if small
            topic = settings.KAFKA_AUDIO_TOPIC
            content_type = "audio"
        else:
            topic = settings.KAFKA_VIDEO_TOPIC
            content_type = "video"
        
        message = {
            "device_id": device_id,
            "content_type": content_type,
            "data_size": len(data),
            "timestamp": asyncio.get_event_loop().time()
        }
        
        await self.send_message(topic, message, key=device_id)
    
    async def send_alert(self, alert_data: Dict[str, Any]):
        """Send alert to alerts topic"""
        await self.send_message(settings.KAFKA_ALERTS_TOPIC, alert_data)
    
    def get_consumer(self, topic: str) -> Optional[KafkaConsumer]:
        """Get consumer for specific topic"""
        return self.consumers.get(topic)
    
    async def consume_messages(self, topic: str, handler_func):
        """Consume messages from topic with handler function"""
        consumer = self.get_consumer(topic)
        if not consumer:
            logger.error(f"No consumer found for topic: {topic}")
            return
        
        def _consume():
            try:
                for message in consumer:
                    if not self.running:
                        break
                    asyncio.create_task(handler_func(message.value))
            except Exception as e:
                logger.error(f"Error consuming from {topic}: {e}")
        
        await asyncio.get_event_loop().run_in_executor(self.executor, _consume)
