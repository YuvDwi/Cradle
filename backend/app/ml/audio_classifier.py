import torch
import torch.nn as nn
import numpy as np
import librosa
import onnxruntime as ort
from typing import Dict, Any, Optional, Tuple
import logging
import time
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

class AudioFeatureExtractor:
    """Extract MFCC and other audio features for cry detection"""
    
    def __init__(self, sample_rate: int = 16000, n_mfcc: int = 13):
        self.sample_rate = sample_rate
        self.n_mfcc = n_mfcc
        self.hop_length = 512
        self.n_fft = 2048
    
    def extract_mfcc(self, audio_data: np.ndarray, duration: float = 2.0) -> np.ndarray:
        """Extract MFCC features from audio"""
        try:
            # Ensure audio is the right length
            target_length = int(self.sample_rate * duration)
            if len(audio_data) < target_length:
                audio_data = np.pad(audio_data, (0, target_length - len(audio_data)))
            else:
                audio_data = audio_data[:target_length]
            
            # Extract MFCC features
            mfccs = librosa.feature.mfcc(
                y=audio_data,
                sr=self.sample_rate,
                n_mfcc=self.n_mfcc,
                hop_length=self.hop_length,
                n_fft=self.n_fft
            )
            
            # Normalize
            mfccs = (mfccs - np.mean(mfccs)) / (np.std(mfccs) + 1e-8)
            
            return mfccs
            
        except Exception as e:
            logger.error(f"MFCC extraction failed: {e}")
            return np.zeros((self.n_mfcc, 63))  # Default shape
    
    def extract_spectral_features(self, audio_data: np.ndarray) -> Dict[str, float]:
        """Extract additional spectral features"""
        try:
            # Spectral centroid
            spectral_centroids = librosa.feature.spectral_centroid(
                y=audio_data, sr=self.sample_rate
            )[0]
            
            # Zero crossing rate
            zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
            
            # Spectral rolloff
            spectral_rolloff = librosa.feature.spectral_rolloff(
                y=audio_data, sr=self.sample_rate
            )[0]
            
            # Chroma features
            chroma = librosa.feature.chroma_stft(
                y=audio_data, sr=self.sample_rate
            )
            
            return {
                "spectral_centroid_mean": float(np.mean(spectral_centroids)),
                "spectral_centroid_std": float(np.std(spectral_centroids)),
                "zcr_mean": float(np.mean(zcr)),
                "zcr_std": float(np.std(zcr)),
                "spectral_rolloff_mean": float(np.mean(spectral_rolloff)),
                "spectral_rolloff_std": float(np.std(spectral_rolloff)),
                "chroma_mean": float(np.mean(chroma)),
                "chroma_std": float(np.std(chroma))
            }
            
        except Exception as e:
            logger.error(f"Spectral feature extraction failed: {e}")
            return {}

class CryDetectionModel(nn.Module):
    """CNN-based baby cry detection model"""
    
    def __init__(self, input_shape: Tuple[int, int] = (13, 63), num_classes: int = 2):
        super().__init__()
        
        self.conv1 = nn.Conv2d(1, 32, kernel_size=3, padding=1)
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.conv3 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        
        self.pool = nn.MaxPool2d(2, 2)
        self.dropout = nn.Dropout(0.3)
        self.batch_norm1 = nn.BatchNorm2d(32)
        self.batch_norm2 = nn.BatchNorm2d(64)
        self.batch_norm3 = nn.BatchNorm2d(128)
        
        # Calculate flattened size
        self.flat_size = self._get_flat_size(input_shape)
        
        self.fc1 = nn.Linear(self.flat_size, 256)
        self.fc2 = nn.Linear(256, 128)
        self.fc3 = nn.Linear(128, num_classes)
        
        self.relu = nn.ReLU()
        self.softmax = nn.Softmax(dim=1)
    
    def _get_flat_size(self, input_shape):
        # Simulate forward pass to get size
        x = torch.randn(1, 1, *input_shape)
        x = self.pool(self.relu(self.conv1(x)))
        x = self.pool(self.relu(self.conv2(x)))
        x = self.pool(self.relu(self.conv3(x)))
        return x.numel()
    
    def forward(self, x):
        # Input shape: (batch_size, 1, 13, 63)
        x = self.pool(self.relu(self.batch_norm1(self.conv1(x))))
        x = self.pool(self.relu(self.batch_norm2(self.conv2(x))))
        x = self.pool(self.relu(self.batch_norm3(self.conv3(x))))
        
        x = x.view(x.size(0), -1)  # Flatten
        
        x = self.dropout(self.relu(self.fc1(x)))
        x = self.dropout(self.relu(self.fc2(x)))
        x = self.fc3(x)
        
        return self.softmax(x)

class AudioInferenceService:
    """ONNX-optimized audio inference service"""
    
    def __init__(self):
        self.feature_extractor = AudioFeatureExtractor()
        self.onnx_session: Optional[ort.InferenceSession] = None
        self.model_loaded = False
        self._load_model()
    
    def _load_model(self):
        """Load ONNX model for inference"""
        try:
            model_path = Path(settings.AUDIO_MODEL_PATH)
            if not model_path.exists():
                logger.warning(f"Audio model not found at {model_path}")
                return
            
            # Configure ONNX Runtime
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
            self.onnx_session = ort.InferenceSession(
                str(model_path),
                providers=providers
            )
            
            self.model_loaded = True
            logger.info("Audio ONNX model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load audio model: {e}")
            self.model_loaded = False
    
    async def detect_cry(self, audio_data: bytes) -> Dict[str, Any]:
        """Main cry detection inference"""
        start_time = time.time()
        
        try:
            # Convert bytes to numpy array
            audio_array = np.frombuffer(audio_data, dtype=np.float32)
            
            # Extract features
            mfcc_features = self.feature_extractor.extract_mfcc(audio_array)
            spectral_features = self.feature_extractor.extract_spectral_features(audio_array)
            
            # Prepare input for ONNX model
            input_tensor = mfcc_features.reshape(1, 1, *mfcc_features.shape).astype(np.float32)
            
            # Run inference if model is available
            if self.model_loaded and self.onnx_session:
                input_name = self.onnx_session.get_inputs()[0].name
                output = self.onnx_session.run(None, {input_name: input_tensor})
                probabilities = output[0][0]
                
                cry_probability = float(probabilities[1])  # Index 1 for cry class
                is_crying = cry_probability > 0.7  # Threshold
                
            else:
                # Fallback heuristic-based detection
                cry_probability, is_crying = self._heuristic_cry_detection(
                    audio_array, spectral_features
                )
            
            inference_time = time.time() - start_time
            
            result = {
                "is_crying": is_crying,
                "confidence": cry_probability,
                "inference_time_ms": inference_time * 1000,
                "spectral_features": spectral_features,
                "audio_duration_sec": len(audio_array) / self.feature_extractor.sample_rate,
                "model_used": "onnx" if self.model_loaded else "heuristic"
            }
            
            logger.info(f"Cry detection - Crying: {is_crying}, Confidence: {cry_probability:.3f}")
            return result
            
        except Exception as e:
            logger.error(f"Cry detection failed: {e}")
            return {
                "is_crying": False,
                "confidence": 0.0,
                "error": str(e),
                "inference_time_ms": (time.time() - start_time) * 1000
            }
    
    def _heuristic_cry_detection(self, audio_data: np.ndarray, spectral_features: Dict) -> Tuple[float, bool]:
        """Fallback heuristic-based cry detection"""
        try:
            # Simple heuristic based on spectral features
            score = 0.0
            
            # High-pitched sounds (typical of crying)
            if spectral_features.get("spectral_centroid_mean", 0) > 2000:
                score += 0.3
            
            # High zero-crossing rate (irregular sound)
            if spectral_features.get("zcr_mean", 0) > 0.1:
                score += 0.2
            
            # High variability in spectral centroid
            if spectral_features.get("spectral_centroid_std", 0) > 500:
                score += 0.2
            
            # Energy level check
            rms_energy = np.sqrt(np.mean(audio_data**2))
            if rms_energy > 0.05:
                score += 0.3
            
            is_crying = score > 0.6
            return float(score), is_crying
            
        except Exception as e:
            logger.error(f"Heuristic detection failed: {e}")
            return 0.0, False
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "model_loaded": self.model_loaded,
            "model_path": settings.AUDIO_MODEL_PATH,
            "feature_extractor": {
                "sample_rate": self.feature_extractor.sample_rate,
                "n_mfcc": self.feature_extractor.n_mfcc,
                "hop_length": self.feature_extractor.hop_length
            }
        }
