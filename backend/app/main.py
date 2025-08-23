from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import logging

from app.api import auth, monitoring, streams, alerts
from app.core.config import settings
from app.core.websocket_manager import ConnectionManager
from app.db.database import engine, create_tables
from app.services.kafka_service import KafkaService
from app.services.redis_service import RedisService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Smart Baby Monitor API...")
    await create_tables()
    
    # Initialize services
    app.state.kafka_service = KafkaService()
    app.state.redis_service = RedisService()
    app.state.connection_manager = ConnectionManager()
    
    await app.state.kafka_service.start()
    await app.state.redis_service.connect()
    
    yield
    
    # Shutdown
    logger.info("Shutting down services...")
    await app.state.kafka_service.stop()
    await app.state.redis_service.disconnect()

app = FastAPI(
    title="Smart Baby Monitor API",
    description="Real-time ML-powered baby monitoring system",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(monitoring.router, prefix="/api/v1/monitoring", tags=["monitoring"])
app.include_router(streams.router, prefix="/api/v1/streams", tags=["streams"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])

@app.get("/")
async def root():
    return {"message": "Smart Baby Monitor API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "baby-monitor-api"}

@app.websocket("/ws/{device_id}")
async def websocket_endpoint(websocket: WebSocket, device_id: str):
    manager = app.state.connection_manager
    await manager.connect(websocket, device_id)
    
    try:
        while True:
            data = await websocket.receive_bytes()
            # Process incoming stream data
            await app.state.kafka_service.send_stream_data(device_id, data)
            
    except WebSocketDisconnect:
        manager.disconnect(device_id)
        logger.info(f"Device {device_id} disconnected")

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
