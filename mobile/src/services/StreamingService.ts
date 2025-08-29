import RNFS from 'react-native-fs';
import {useApiRequest} from './AuthService';

export interface StreamSession {
  session_id: string;
  device_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  is_active: boolean;
}

export interface StreamChunk {
  chunk_type: 'audio' | 'video';
  data: Uint8Array;
  timestamp: number;
  session_id: string;
}

export class StreamingService {
  private makeRequest: ReturnType<typeof useApiRequest>['makeRequest'];
  private currentSession: StreamSession | null = null;
  private isStreaming = false;
  private chunkQueue: StreamChunk[] = [];
  private uploadInterval: NodeJS.Timeout | null = null;

  constructor() {
    const {makeRequest} = useApiRequest();
    this.makeRequest = makeRequest;
  }

  async startSession(deviceId: string): Promise<StreamSession> {
    try {
      const response = await this.makeRequest(`/streams/start-session/${deviceId}`, {
        method: 'POST',
      });

      this.currentSession = {
        session_id: response.session_id,
        device_id: deviceId,
        started_at: new Date().toISOString(),
        is_active: true,
      };

      this.isStreaming = true;
      this.startChunkUploader();

      console.log('Streaming session started:', this.currentSession.session_id);
      return this.currentSession;

    } catch (error) {
      console.error('Failed to start streaming session:', error);
      throw error;
    }
  }

  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      this.isStreaming = false;
      this.stopChunkUploader();

      await this.makeRequest(`/streams/end-session/${this.currentSession.session_id}`, {
        method: 'POST',
      });

      console.log('Streaming session ended:', this.currentSession.session_id);
      this.currentSession = null;

    } catch (error) {
      console.error('Failed to end streaming session:', error);
      throw error;
    }
  }

  async uploadChunk(chunkType: 'audio' | 'video', data: Uint8Array): Promise<void> {
    if (!this.currentSession || !this.isStreaming) {
      console.warn('No active session, chunk discarded');
      return;
    }

    const chunk: StreamChunk = {
      chunk_type: chunkType,
      data,
      timestamp: Date.now(),
      session_id: this.currentSession.session_id,
    };

    // Add to queue for batch uploading
    this.chunkQueue.push(chunk);

    // Limit queue size to prevent memory issues
    if (this.chunkQueue.length > 50) {
      this.chunkQueue.shift(); // Remove oldest chunk
    }
  }

  private startChunkUploader(): void {
    // Upload chunks every 2 seconds
    this.uploadInterval = setInterval(async () => {
      await this.processChunkQueue();
    }, 2000);
  }

  private stopChunkUploader(): void {
    if (this.uploadInterval) {
      clearInterval(this.uploadInterval);
      this.uploadInterval = null;
    }

    // Upload remaining chunks
    this.processChunkQueue();
  }

  private async processChunkQueue(): Promise<void> {
    if (this.chunkQueue.length === 0 || !this.currentSession) return;

    const chunksToUpload = this.chunkQueue.splice(0, 10); // Upload up to 10 chunks at once

    for (const chunk of chunksToUpload) {
      try {
        await this.uploadSingleChunk(chunk);
      } catch (error) {
        console.error('Failed to upload chunk:', error);
        // Re-add failed chunk to queue for retry (but limit retries)
        if (this.chunkQueue.length < 30) {
          this.chunkQueue.unshift(chunk);
        }
      }
    }
  }

  private async uploadSingleChunk(chunk: StreamChunk): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Create temporary file
      const tempPath = `${RNFS.TemporaryDirectoryPath}/chunk_${chunk.timestamp}.${chunk.chunk_type === 'audio' ? 'aac' : 'mp4'}`;
      
      // Write chunk data to file
      await RNFS.writeFile(tempPath, Buffer.from(chunk.data).toString('base64'), 'base64');

      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', {
        uri: `file://${tempPath}`,
        type: chunk.chunk_type === 'audio' ? 'audio/aac' : 'video/mp4',
        name: `chunk_${chunk.timestamp}.${chunk.chunk_type === 'audio' ? 'aac' : 'mp4'}`,
      } as any);

      // Upload chunk
      const response = await fetch(
        `http://localhost:8000/api/v1/streams/upload-chunk/${this.currentSession.session_id}?chunk_type=${chunk.chunk_type}`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      // Clean up temporary file
      await RNFS.unlink(tempPath);

    } catch (error) {
      console.error('Chunk upload failed:', error);
      throw error;
    }
  }

  async getSessions(): Promise<StreamSession[]> {
    try {
      return await this.makeRequest('/streams/sessions');
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  getCurrentSession(): StreamSession | null {
    return this.currentSession;
  }

  isSessionActive(): boolean {
    return this.isStreaming && this.currentSession !== null;
  }

  getQueueSize(): number {
    return this.chunkQueue.length;
  }

  // Audio processing utilities
  async processAudioBuffer(audioBuffer: ArrayBuffer): Promise<Uint8Array> {
    try {
      // Convert audio buffer to format suitable for streaming
      const audioData = new Uint8Array(audioBuffer);
      
      // Apply basic audio processing (noise reduction, normalization)
      const processedData = this.normalizeAudio(audioData);
      
      return processedData;
    } catch (error) {
      console.error('Audio processing failed:', error);
      return new Uint8Array(audioBuffer);
    }
  }

  private normalizeAudio(audioData: Uint8Array): Uint8Array {
    // Simple audio normalization
    const normalized = new Uint8Array(audioData.length);
    
    // Find peak value
    let peak = 0;
    for (let i = 0; i < audioData.length; i++) {
      peak = Math.max(peak, Math.abs(audioData[i] - 128));
    }
    
    // Normalize if peak is significant
    if (peak > 10) {
      const scaleFactor = 127 / peak;
      for (let i = 0; i < audioData.length; i++) {
        const sample = (audioData[i] - 128) * scaleFactor + 128;
        normalized[i] = Math.max(0, Math.min(255, sample));
      }
      return normalized;
    }
    
    return audioData;
  }

  // Video processing utilities
  async processVideoFrame(frameData: string): Promise<Uint8Array> {
    try {
      // Convert base64 frame to binary data
      const binaryData = atob(frameData);
      const uint8Array = new Uint8Array(binaryData.length);
      
      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }
      
      return uint8Array;
    } catch (error) {
      console.error('Video frame processing failed:', error);
      return new Uint8Array(0);
    }
  }

  // Network optimization
  private getOptimalChunkSize(): number {
    // Adjust chunk size based on network conditions
    // This is a simplified implementation
    return 8192; // 8KB chunks
  }

  // Error handling and retry logic
  private shouldRetryUpload(error: any): boolean {
    // Retry on network errors but not on authentication errors
    if (error.message?.includes('401') || error.message?.includes('403')) {
      return false;
    }
    
    return true;
  }

  // Cleanup method
  cleanup(): void {
    this.stopChunkUploader();
    this.chunkQueue = [];
    this.currentSession = null;
    this.isStreaming = false;
  }
}
