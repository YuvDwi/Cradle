import aioredis
import json
import logging
from typing import Any, Optional, Dict
from datetime import timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
    
    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                retry_on_timeout=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Test connection
            await self.redis.ping()
            logger.info("Redis service connected successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis:
            await self.redis.close()
            logger.info("Redis service disconnected")
    
    async def set(self, key: str, value: Any, expire: Optional[int] = None):
        """Set key-value pair with optional expiration"""
        if not self.redis:
            logger.error("Redis not connected")
            return False
        
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            
            await self.redis.set(key, value, ex=expire)
            return True
            
        except Exception as e:
            logger.error(f"Failed to set key {key}: {e}")
            return False
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value by key"""
        if not self.redis:
            logger.error("Redis not connected")
            return None
        
        try:
            value = await self.redis.get(key)
            if value is None:
                return None
            
            # Try to parse as JSON
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
                
        except Exception as e:
            logger.error(f"Failed to get key {key}: {e}")
            return None
    
    async def delete(self, key: str) -> bool:
        """Delete key"""
        if not self.redis:
            return False
        
        try:
            result = await self.redis.delete(key)
            return result > 0
        except Exception as e:
            logger.error(f"Failed to delete key {key}: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis:
            return False
        
        try:
            return await self.redis.exists(key) > 0
        except Exception as e:
            logger.error(f"Failed to check key {key}: {e}")
            return False
    
    async def increment(self, key: str) -> Optional[int]:
        """Increment counter"""
        if not self.redis:
            return None
        
        try:
            return await self.redis.incr(key)
        except Exception as e:
            logger.error(f"Failed to increment key {key}: {e}")
            return None
    
    async def set_device_status(self, device_id: str, status: Dict[str, Any], expire: int = 300):
        """Set device status with 5-minute expiration"""
        key = f"device:status:{device_id}"
        await self.set(key, status, expire)
    
    async def get_device_status(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get device status"""
        key = f"device:status:{device_id}"
        return await self.get(key)
    
    async def cache_ml_result(self, session_id: str, model_type: str, result: Dict[str, Any], expire: int = 3600):
        """Cache ML inference result for 1 hour"""
        key = f"ml:result:{session_id}:{model_type}"
        await self.set(key, result, expire)
    
    async def get_cached_ml_result(self, session_id: str, model_type: str) -> Optional[Dict[str, Any]]:
        """Get cached ML result"""
        key = f"ml:result:{session_id}:{model_type}"
        return await self.get(key)
    
    async def rate_limit_check(self, identifier: str, limit: int, window: int) -> bool:
        """Check rate limit - returns True if under limit"""
        key = f"rate_limit:{identifier}"
        
        try:
            current = await self.increment(key)
            if current == 1:
                await self.redis.expire(key, window)
            
            return current <= limit
            
        except Exception as e:
            logger.error(f"Rate limit check failed for {identifier}: {e}")
            return True  # Allow on error
