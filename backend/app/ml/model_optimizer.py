import torch
import torch.nn as nn
import onnx
import onnxruntime as ort
from torch.quantization import quantize_dynamic
import numpy as np
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Union
import tempfile
import os

from app.ml.audio_classifier import CryDetectionModel

logger = logging.getLogger(__name__)

class ModelOptimizer:
    """Optimize PyTorch models for production deployment"""
    
    def __init__(self):
        self.quantization_backends = ['fbgemm', 'qnnpack']
    
    def export_to_onnx(
        self,
        model: nn.Module,
        input_shape: tuple,
        output_path: str,
        opset_version: int = 11
    ) -> bool:
        """Export PyTorch model to ONNX format"""
        try:
            model.eval()
            
            # Create dummy input
            dummy_input = torch.randn(1, *input_shape)
            
            # Export to ONNX
            torch.onnx.export(
                model,
                dummy_input,
                output_path,
                export_params=True,
                opset_version=opset_version,
                do_constant_folding=True,
                input_names=['input'],
                output_names=['output'],
                dynamic_axes={
                    'input': {0: 'batch_size'},
                    'output': {0: 'batch_size'}
                }
            )
            
            # Verify the exported model
            onnx_model = onnx.load(output_path)
            onnx.checker.check_model(onnx_model)
            
            logger.info(f"Model exported to ONNX: {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"ONNX export failed: {e}")
            return False
    
    def quantize_model(
        self,
        model: nn.Module,
        quantization_type: str = 'dynamic'
    ) -> Optional[nn.Module]:
        """Apply quantization to reduce model size"""
        try:
            model.eval()
            
            if quantization_type == 'dynamic':
                quantized_model = quantize_dynamic(
                    model,
                    {nn.Linear, nn.Conv2d},
                    dtype=torch.qint8
                )
            else:
                logger.warning(f"Quantization type {quantization_type} not implemented")
                return None
            
            logger.info(f"Model quantized using {quantization_type} quantization")
            return quantized_model
            
        except Exception as e:
            logger.error(f"Quantization failed: {e}")
            return None
    
    def optimize_onnx_model(self, onnx_path: str, optimized_path: str) -> bool:
        """Optimize ONNX model for inference"""
        try:
            import onnxoptimizer
            
            # Load original model
            model = onnx.load(onnx_path)
            
            # Apply optimizations
            optimized_model = onnxoptimizer.optimize(model)
            
            # Save optimized model
            onnx.save(optimized_model, optimized_path)
            
            logger.info(f"ONNX model optimized: {optimized_path}")
            return True
            
        except ImportError:
            logger.warning("onnxoptimizer not available, skipping optimization")
            return False
        except Exception as e:
            logger.error(f"ONNX optimization failed: {e}")
            return False
    
    def benchmark_model(
        self,
        model_path: str,
        input_shape: tuple,
        num_runs: int = 100
    ) -> Dict[str, float]:
        """Benchmark ONNX model performance"""
        try:
            # Create ONNX Runtime session
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
            session = ort.InferenceSession(model_path, providers=providers)
            
            # Create dummy input
            dummy_input = np.random.randn(1, *input_shape).astype(np.float32)
            input_name = session.get_inputs()[0].name
            
            # Warmup runs
            for _ in range(10):
                session.run(None, {input_name: dummy_input})
            
            # Benchmark runs
            import time
            times = []
            
            for _ in range(num_runs):
                start_time = time.time()
                session.run(None, {input_name: dummy_input})
                end_time = time.time()
                times.append(end_time - start_time)
            
            times = np.array(times)
            
            benchmark_results = {
                "avg_inference_time_ms": float(np.mean(times) * 1000),
                "std_inference_time_ms": float(np.std(times) * 1000),
                "min_inference_time_ms": float(np.min(times) * 1000),
                "max_inference_time_ms": float(np.max(times) * 1000),
                "p95_inference_time_ms": float(np.percentile(times, 95) * 1000),
                "p99_inference_time_ms": float(np.percentile(times, 99) * 1000),
                "throughput_inferences_per_sec": float(1.0 / np.mean(times))
            }
            
            logger.info(f"Benchmark results: {benchmark_results}")
            return benchmark_results
            
        except Exception as e:
            logger.error(f"Benchmarking failed: {e}")
            return {}
    
    def export_to_mobile_formats(
        self,
        model: nn.Module,
        input_shape: tuple,
        output_dir: str
    ) -> Dict[str, bool]:
        """Export model to mobile-friendly formats"""
        results = {
            "torchscript": False,
            "coreml": False,
            "tflite": False
        }
        
        try:
            model.eval()
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # TorchScript export
            try:
                dummy_input = torch.randn(1, *input_shape)
                traced_model = torch.jit.trace(model, dummy_input)
                torchscript_path = output_path / "model.pt"
                traced_model.save(str(torchscript_path))
                results["torchscript"] = True
                logger.info(f"TorchScript model saved: {torchscript_path}")
            except Exception as e:
                logger.error(f"TorchScript export failed: {e}")
            
            # CoreML export (if available)
            try:
                import coremltools as ct
                
                dummy_input = torch.randn(1, *input_shape)
                traced_model = torch.jit.trace(model, dummy_input)
                
                coreml_model = ct.convert(
                    traced_model,
                    inputs=[ct.TensorType(shape=dummy_input.shape)]
                )
                
                coreml_path = output_path / "model.mlmodel"
                coreml_model.save(str(coreml_path))
                results["coreml"] = True
                logger.info(f"CoreML model saved: {coreml_path}")
                
            except ImportError:
                logger.warning("CoreML tools not available")
            except Exception as e:
                logger.error(f"CoreML export failed: {e}")
            
            # TensorFlow Lite export (via ONNX)
            try:
                # First export to ONNX
                onnx_path = output_path / "temp_model.onnx"
                if self.export_to_onnx(model, input_shape, str(onnx_path)):
                    # Convert ONNX to TFLite
                    tflite_path = output_path / "model.tflite"
                    if self._convert_onnx_to_tflite(str(onnx_path), str(tflite_path)):
                        results["tflite"] = True
                        logger.info(f"TFLite model saved: {tflite_path}")
                    
                    # Clean up temp ONNX file
                    onnx_path.unlink(missing_ok=True)
                    
            except Exception as e:
                logger.error(f"TFLite export failed: {e}")
            
            return results
            
        except Exception as e:
            logger.error(f"Mobile format export failed: {e}")
            return results
    
    def _convert_onnx_to_tflite(self, onnx_path: str, tflite_path: str) -> bool:
        """Convert ONNX model to TensorFlow Lite"""
        try:
            import onnx
            import tensorflow as tf
            from onnx_tf.backend import prepare
            
            # Load ONNX model
            onnx_model = onnx.load(onnx_path)
            
            # Convert to TensorFlow
            tf_rep = prepare(onnx_model)
            
            # Export to TensorFlow SavedModel format
            with tempfile.TemporaryDirectory() as temp_dir:
                saved_model_path = os.path.join(temp_dir, "saved_model")
                tf_rep.export_graph(saved_model_path)
                
                # Convert to TensorFlow Lite
                converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_path)
                converter.optimizations = [tf.lite.Optimize.DEFAULT]
                tflite_model = converter.convert()
                
                # Save TFLite model
                with open(tflite_path, 'wb') as f:
                    f.write(tflite_model)
            
            return True
            
        except ImportError:
            logger.warning("TensorFlow or ONNX-TF not available for TFLite conversion")
            return False
        except Exception as e:
            logger.error(f"ONNX to TFLite conversion failed: {e}")
            return False
    
    def get_model_info(self, model_path: str) -> Dict[str, Any]:
        """Get detailed information about a model file"""
        try:
            model_path = Path(model_path)
            
            if not model_path.exists():
                return {"error": "Model file not found"}
            
            info = {
                "file_path": str(model_path),
                "file_size_mb": model_path.stat().st_size / (1024 * 1024),
                "format": model_path.suffix
            }
            
            if model_path.suffix == '.onnx':
                try:
                    model = onnx.load(str(model_path))
                    info.update({
                        "opset_version": model.opset_import[0].version,
                        "inputs": [(inp.name, [d.dim_value for d in inp.type.tensor_type.shape.dim]) 
                                 for inp in model.graph.input],
                        "outputs": [(out.name, [d.dim_value for d in out.type.tensor_type.shape.dim]) 
                                  for out in model.graph.output]
                    })
                except Exception as e:
                    info["onnx_error"] = str(e)
            
            return info
            
        except Exception as e:
            logger.error(f"Failed to get model info: {e}")
            return {"error": str(e)}
