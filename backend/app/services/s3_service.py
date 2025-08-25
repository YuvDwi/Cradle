import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import logging
from typing import Optional, Dict, Any
import uuid
from datetime import datetime
import io

from app.core.config import settings

logger = logging.getLogger(__name__)

class S3Service:
    def __init__(self):
        self.s3_client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize S3 client"""
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            logger.info("S3 client initialized successfully")
            
        except NoCredentialsError:
            logger.error("AWS credentials not found")
            self.s3_client = None
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {e}")
            self.s3_client = None
    
    async def upload_audio_chunk(self, device_id: str, session_id: str, audio_data: bytes) -> Optional[str]:
        """Upload audio chunk to S3"""
        if not self.s3_client:
            logger.error("S3 client not initialized")
            return None
        
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        chunk_id = str(uuid.uuid4())[:8]
        key = f"audio/{device_id}/{session_id}/{timestamp}_{chunk_id}.wav"
        
        try:
            self.s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=audio_data,
                ContentType='audio/wav',
                Metadata={
                    'device_id': device_id,
                    'session_id': session_id,
                    'timestamp': timestamp,
                    'chunk_id': chunk_id
                }
            )
            
            url = f"s3://{settings.S3_BUCKET_NAME}/{key}"
            logger.info(f"Audio chunk uploaded: {url}")
            return url
            
        except ClientError as e:
            logger.error(f"Failed to upload audio chunk: {e}")
            return None
    
    async def upload_video_chunk(self, device_id: str, session_id: str, video_data: bytes) -> Optional[str]:
        """Upload video chunk to S3"""
        if not self.s3_client:
            logger.error("S3 client not initialized")
            return None
        
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        chunk_id = str(uuid.uuid4())[:8]
        key = f"video/{device_id}/{session_id}/{timestamp}_{chunk_id}.mp4"
        
        try:
            self.s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=video_data,
                ContentType='video/mp4',
                Metadata={
                    'device_id': device_id,
                    'session_id': session_id,
                    'timestamp': timestamp,
                    'chunk_id': chunk_id
                }
            )
            
            url = f"s3://{settings.S3_BUCKET_NAME}/{key}"
            logger.info(f"Video chunk uploaded: {url}")
            return url
            
        except ClientError as e:
            logger.error(f"Failed to upload video chunk: {e}")
            return None
    
    async def upload_alert_media(self, alert_id: int, media_type: str, data: bytes) -> Optional[str]:
        """Upload alert-related media (audio/video snippets)"""
        if not self.s3_client:
            return None
        
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        extension = "wav" if media_type == "audio" else "mp4"
        key = f"alerts/{alert_id}/{timestamp}.{extension}"
        
        try:
            self.s3_client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=data,
                ContentType=f'{media_type}/{"wav" if media_type == "audio" else "mp4"}',
                Metadata={
                    'alert_id': str(alert_id),
                    'media_type': media_type,
                    'timestamp': timestamp
                }
            )
            
            return f"s3://{settings.S3_BUCKET_NAME}/{key}"
            
        except ClientError as e:
            logger.error(f"Failed to upload alert media: {e}")
            return None
    
    async def generate_presigned_url(self, s3_url: str, expiration: int = 3600) -> Optional[str]:
        """Generate presigned URL for S3 object"""
        if not self.s3_client:
            return None
        
        try:
            # Extract bucket and key from S3 URL
            if s3_url.startswith('s3://'):
                path = s3_url[5:]  # Remove 's3://'
                bucket, key = path.split('/', 1)
            else:
                return None
            
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=expiration
            )
            
            return url
            
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return None
    
    async def delete_object(self, s3_url: str) -> bool:
        """Delete object from S3"""
        if not self.s3_client:
            return False
        
        try:
            if s3_url.startswith('s3://'):
                path = s3_url[5:]
                bucket, key = path.split('/', 1)
            else:
                return False
            
            self.s3_client.delete_object(Bucket=bucket, Key=key)
            logger.info(f"Deleted S3 object: {s3_url}")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to delete S3 object: {e}")
            return False
    
    async def list_session_files(self, device_id: str, session_id: str) -> Dict[str, list]:
        """List all files for a session"""
        if not self.s3_client:
            return {"audio": [], "video": []}
        
        files = {"audio": [], "video": []}
        
        for media_type in ["audio", "video"]:
            prefix = f"{media_type}/{device_id}/{session_id}/"
            
            try:
                response = self.s3_client.list_objects_v2(
                    Bucket=settings.S3_BUCKET_NAME,
                    Prefix=prefix
                )
                
                if 'Contents' in response:
                    for obj in response['Contents']:
                        files[media_type].append({
                            'key': obj['Key'],
                            'size': obj['Size'],
                            'last_modified': obj['LastModified'].isoformat(),
                            's3_url': f"s3://{settings.S3_BUCKET_NAME}/{obj['Key']}"
                        })
                        
            except ClientError as e:
                logger.error(f"Failed to list {media_type} files: {e}")
        
        return files
