from typing import Dict, List
from fastapi import WebSocket
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.device_metadata: Dict[str, dict] = {}
    
    async def connect(self, websocket: WebSocket, device_id: str):
        await websocket.accept()
        self.active_connections[device_id] = websocket
        self.device_metadata[device_id] = {
            "connected_at": asyncio.get_event_loop().time(),
            "stream_active": True
        }
        logger.info(f"Device {device_id} connected via WebSocket")
    
    def disconnect(self, device_id: str):
        if device_id in self.active_connections:
            del self.active_connections[device_id]
        if device_id in self.device_metadata:
            del self.device_metadata[device_id]
        logger.info(f"Device {device_id} disconnected")
    
    async def send_personal_message(self, message: dict, device_id: str):
        if device_id in self.active_connections:
            websocket = self.active_connections[device_id]
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send message to {device_id}: {e}")
                self.disconnect(device_id)
    
    async def broadcast_alert(self, alert_data: dict):
        disconnected_devices = []
        
        for device_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(json.dumps({
                    "type": "alert",
                    "data": alert_data
                }))
            except Exception as e:
                logger.error(f"Failed to broadcast to {device_id}: {e}")
                disconnected_devices.append(device_id)
        
        # Clean up disconnected devices
        for device_id in disconnected_devices:
            self.disconnect(device_id)
    
    def get_active_devices(self) -> List[str]:
        return list(self.active_connections.keys())
    
    def get_device_count(self) -> int:
        return len(self.active_connections)
