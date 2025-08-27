import cv2
import numpy as np
import onnxruntime as ort
from typing import Dict, Any, Optional, List, Tuple
import logging
import time
from pathlib import Path
import torch
import torchvision.transforms as transforms

from app.core.config import settings

logger = logging.getLogger(__name__)

class VideoPreprocessor:
    """Video preprocessing for object detection and motion analysis"""
    
    def __init__(self, target_size: Tuple[int, int] = (640, 640)):
        self.target_size = target_size
        self.transforms = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize(target_size),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
    
    def preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """Preprocess single frame for YOLO inference"""
        try:
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Resize and normalize
            frame_resized = cv2.resize(frame_rgb, self.target_size)
            frame_normalized = frame_resized.astype(np.float32) / 255.0
            
            # Convert to NCHW format
            frame_tensor = np.transpose(frame_normalized, (2, 0, 1))
            frame_batch = np.expand_dims(frame_tensor, axis=0)
            
            return frame_batch
            
        except Exception as e:
            logger.error(f"Frame preprocessing failed: {e}")
            return np.zeros((1, 3, *self.target_size), dtype=np.float32)
    
    def extract_motion_features(self, current_frame: np.ndarray, previous_frame: np.ndarray) -> Dict[str, float]:
        """Extract motion-based features"""
        try:
            # Convert to grayscale
            current_gray = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
            previous_gray = cv2.cvtColor(previous_frame, cv2.COLOR_BGR2GRAY)
            
            # Calculate optical flow
            flow = cv2.calcOpticalFlowPyrLK(
                previous_gray, current_gray, None, None
            )
            
            # Motion magnitude
            frame_diff = cv2.absdiff(current_gray, previous_gray)
            motion_magnitude = np.mean(frame_diff)
            
            # Motion vectors
            motion_pixels = np.sum(frame_diff > 30)  # Threshold for motion
            total_pixels = frame_diff.size
            motion_ratio = motion_pixels / total_pixels
            
            # Edge detection for activity level
            edges = cv2.Canny(current_gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            
            return {
                "motion_magnitude": float(motion_magnitude),
                "motion_ratio": float(motion_ratio),
                "edge_density": float(edge_density),
                "activity_score": float(motion_magnitude * motion_ratio * edge_density)
            }
            
        except Exception as e:
            logger.error(f"Motion feature extraction failed: {e}")
            return {
                "motion_magnitude": 0.0,
                "motion_ratio": 0.0,
                "edge_density": 0.0,
                "activity_score": 0.0
            }

class YOLODetector:
    """YOLOv8-based object detection for baby monitoring"""
    
    def __init__(self):
        self.onnx_session: Optional[ort.InferenceSession] = None
        self.model_loaded = False
        self.class_names = [
            'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
            'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
            'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
            'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
            'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
            'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
            'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
            'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
            'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
            'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
            'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
            'toothbrush'
        ]
        self._load_model()
    
    def _load_model(self):
        """Load YOLO ONNX model"""
        try:
            model_path = Path(settings.VIDEO_MODEL_PATH)
            if not model_path.exists():
                logger.warning(f"Video model not found at {model_path}")
                return
            
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
            self.onnx_session = ort.InferenceSession(
                str(model_path),
                providers=providers
            )
            
            self.model_loaded = True
            logger.info("YOLO ONNX model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self.model_loaded = False
    
    def detect_objects(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """Run object detection on frame"""
        if not self.model_loaded or not self.onnx_session:
            return []
        
        try:
            # Preprocess frame
            preprocessor = VideoPreprocessor()
            input_tensor = preprocessor.preprocess_frame(frame)
            
            # Run inference
            input_name = self.onnx_session.get_inputs()[0].name
            outputs = self.onnx_session.run(None, {input_name: input_tensor})
            
            # Post-process detections
            detections = self._postprocess_detections(outputs[0], frame.shape)
            
            return detections
            
        except Exception as e:
            logger.error(f"Object detection failed: {e}")
            return []
    
    def _postprocess_detections(self, raw_output: np.ndarray, frame_shape: Tuple[int, int, int]) -> List[Dict[str, Any]]:
        """Post-process YOLO output"""
        try:
            detections = []
            h, w = frame_shape[:2]
            
            # YOLO output format: [batch, num_detections, 85] where 85 = 4 bbox + 1 conf + 80 classes
            for detection in raw_output[0]:
                confidence = detection[4]
                
                if confidence > 0.5:  # Confidence threshold
                    # Get class with highest score
                    class_scores = detection[5:]
                    class_id = np.argmax(class_scores)
                    class_confidence = class_scores[class_id]
                    
                    if class_confidence > 0.3:
                        # Convert normalized coordinates to pixel coordinates
                        cx, cy, width, height = detection[:4]
                        x1 = int((cx - width/2) * w)
                        y1 = int((cy - height/2) * h)
                        x2 = int((cx + width/2) * w)
                        y2 = int((cy + height/2) * h)
                        
                        detections.append({
                            "class_id": int(class_id),
                            "class_name": self.class_names[class_id] if class_id < len(self.class_names) else "unknown",
                            "confidence": float(confidence),
                            "bbox": [x1, y1, x2, y2],
                            "center": [int(cx * w), int(cy * h)],
                            "area": int(width * w * height * h)
                        })
            
            return detections
            
        except Exception as e:
            logger.error(f"Post-processing failed: {e}")
            return []

class VideoInferenceService:
    """Complete video inference service for baby monitoring"""
    
    def __init__(self):
        self.yolo_detector = YOLODetector()
        self.preprocessor = VideoPreprocessor()
        self.previous_frame: Optional[np.ndarray] = None
        self.frame_count = 0
    
    async def analyze_video_frame(self, frame_data: bytes) -> Dict[str, Any]:
        """Main video analysis function"""
        start_time = time.time()
        
        try:
            # Convert bytes to OpenCV frame
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                raise ValueError("Invalid frame data")
            
            self.frame_count += 1
            
            # Object detection
            detections = self.yolo_detector.detect_objects(frame)
            
            # Motion analysis
            motion_features = {}
            if self.previous_frame is not None:
                motion_features = self.preprocessor.extract_motion_features(frame, self.previous_frame)
            
            # Analyze detections for baby monitoring
            analysis = self._analyze_detections(detections, motion_features)
            
            # Store current frame for next iteration
            self.previous_frame = frame.copy()
            
            inference_time = time.time() - start_time
            
            result = {
                "frame_number": self.frame_count,
                "detections": detections,
                "motion_features": motion_features,
                "analysis": analysis,
                "inference_time_ms": inference_time * 1000,
                "frame_shape": frame.shape,
                "model_used": "yolo" if self.yolo_detector.model_loaded else "basic"
            }
            
            logger.info(f"Video analysis - Objects: {len(detections)}, Activity: {analysis.get('activity_level', 'unknown')}")
            return result
            
        except Exception as e:
            logger.error(f"Video analysis failed: {e}")
            return {
                "error": str(e),
                "inference_time_ms": (time.time() - start_time) * 1000,
                "detections": [],
                "analysis": {"activity_level": "error"}
            }
    
    def _analyze_detections(self, detections: List[Dict], motion_features: Dict) -> Dict[str, Any]:
        """Analyze detections for baby monitoring context"""
        try:
            analysis = {
                "person_detected": False,
                "baby_likely": False,
                "activity_level": "low",
                "safety_alerts": [],
                "object_summary": {}
            }
            
            # Count object types
            object_counts = {}
            for detection in detections:
                class_name = detection["class_name"]
                object_counts[class_name] = object_counts.get(class_name, 0) + 1
            
            analysis["object_summary"] = object_counts
            
            # Person detection analysis
            persons = [d for d in detections if d["class_name"] == "person"]
            if persons:
                analysis["person_detected"] = True
                
                # Heuristic for baby detection (small person objects)
                for person in persons:
                    area_ratio = person["area"] / (640 * 640)  # Normalized area
                    if area_ratio < 0.3:  # Small person likely a baby
                        analysis["baby_likely"] = True
                        break
            
            # Activity level based on motion
            motion_score = motion_features.get("activity_score", 0)
            if motion_score > 0.1:
                analysis["activity_level"] = "high"
            elif motion_score > 0.05:
                analysis["activity_level"] = "medium"
            else:
                analysis["activity_level"] = "low"
            
            # Safety alerts
            dangerous_objects = ["knife", "scissors", "fire hydrant", "car", "truck"]
            for obj_name in object_counts:
                if obj_name in dangerous_objects:
                    analysis["safety_alerts"].append(f"Potentially dangerous object detected: {obj_name}")
            
            # High activity alert
            if motion_score > 0.15:
                analysis["safety_alerts"].append("High activity level detected")
            
            return analysis
            
        except Exception as e:
            logger.error(f"Detection analysis failed: {e}")
            return {"activity_level": "error", "safety_alerts": []}
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "yolo_model_loaded": self.yolo_detector.model_loaded,
            "model_path": settings.VIDEO_MODEL_PATH,
            "supported_classes": len(self.yolo_detector.class_names),
            "frames_processed": self.frame_count
        }
