from fastapi import APIRouter, Depends
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response
import psutil
import time
from typing import Dict, Any

from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter()

# Prometheus metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency')
ACTIVE_CONNECTIONS = Gauge('websocket_active_connections', 'Active WebSocket connections')
ALERTS_GENERATED = Counter('alerts_generated_total', 'Total alerts generated', ['type', 'severity'])
ML_INFERENCE_LATENCY = Histogram('ml_inference_duration_seconds', 'ML inference latency', ['model_type'])
SYSTEM_MEMORY_USAGE = Gauge('system_memory_usage_percent', 'System memory usage percentage')
SYSTEM_CPU_USAGE = Gauge('system_cpu_usage_percent', 'System CPU usage percentage')

@router.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    # Update system metrics
    SYSTEM_MEMORY_USAGE.set(psutil.virtual_memory().percent)
    SYSTEM_CPU_USAGE.set(psutil.cpu_percent())
    
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@router.get("/health")
async def health_check():
    """Detailed health check endpoint"""
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "system": {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": memory.percent,
            "memory_available_gb": memory.available / (1024**3),
            "disk_percent": (disk.used / disk.total) * 100,
            "disk_free_gb": disk.free / (1024**3)
        },
        "services": {
            "database": "connected",  # Could add actual DB health check
            "kafka": "connected",     # Could add actual Kafka health check
            "redis": "connected"      # Could add actual Redis health check
        }
    }

@router.get("/system-stats")
async def get_system_stats(current_user: User = Depends(get_current_user)):
    """System statistics for authenticated users"""
    return {
        "uptime_seconds": time.time() - psutil.boot_time(),
        "process_count": len(psutil.pids()),
        "network_io": psutil.net_io_counters()._asdict(),
        "load_average": psutil.getloadavg() if hasattr(psutil, 'getloadavg') else None
    }

@router.get("/performance")
async def get_performance_metrics(current_user: User = Depends(get_current_user)):
    """Performance metrics dashboard data"""
    return {
        "requests_per_second": 0,  # Would calculate from metrics
        "avg_response_time_ms": 0,  # Would calculate from metrics
        "active_sessions": 0,       # Would get from connection manager
        "error_rate_percent": 0,    # Would calculate from error metrics
        "ml_inference_stats": {
            "audio_model_avg_latency_ms": 0,
            "video_model_avg_latency_ms": 0,
            "total_inferences_today": 0
        }
    }
