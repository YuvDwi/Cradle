import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import {RNCamera} from 'react-native-camera';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

import {useWebSocket} from '../services/WebSocketService';
import {StreamingService} from '../services/StreamingService';
import {useAuth} from '../services/AuthService';

const {width, height} = Dimensions.get('window');

const StreamScreen = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const cameraRef = useRef<RNCamera>(null);
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
  const streamingService = useRef(new StreamingService()).current;
  
  const {user} = useAuth();
  const {isConnected, sendMessage} = useWebSocket();

  useEffect(() => {
    requestPermissions();
    return () => {
      stopStreaming();
    };
  }, []);

  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  const requestPermissions = async () => {
    try {
      const cameraPermission = await request(PERMISSIONS.ANDROID.CAMERA);
      const audioPermission = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
      
      if (cameraPermission === RESULTS.GRANTED && audioPermission === RESULTS.GRANTED) {
        setPermissionsGranted(true);
      } else {
        Alert.alert(
          'Permissions Required',
          'Camera and microphone access are required for baby monitoring.',
          [{text: 'OK'}]
        );
      }
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  };

  const startStreaming = async () => {
    if (!permissionsGranted || !isConnected) {
      Alert.alert('Error', 'Please check permissions and internet connection');
      return;
    }

    try {
      setIsStreaming(true);
      
      // Start audio recording
      const audioPath = `${audioRecorderPlayer.mmrPlayerPath}/baby_monitor_audio.aac`;
      await audioRecorderPlayer.startRecorder(audioPath);
      setIsRecording(true);

      // Initialize streaming service
      await streamingService.startSession(user?.id || 'unknown');

      // Start video streaming
      if (cameraRef.current) {
        // This would normally start video capture and streaming
        console.log('Video streaming started');
      }

      // Set up audio chunk processing
      audioRecorderPlayer.addRecordBackListener((e) => {
        if (e.currentPosition > 0) {
          // Process audio chunk every 2 seconds
          if (Math.floor(e.currentPosition / 1000) % 2 === 0) {
            processAudioChunk();
          }
        }
      });

    } catch (error) {
      console.error('Failed to start streaming:', error);
      setIsStreaming(false);
      Alert.alert('Error', 'Failed to start streaming');
    }
  };

  const stopStreaming = async () => {
    try {
      setIsStreaming(false);
      
      if (isRecording) {
        await audioRecorderPlayer.stopRecorder();
        setIsRecording(false);
      }

      await streamingService.endSession();
      
    } catch (error) {
      console.error('Failed to stop streaming:', error);
    }
  };

  const processAudioChunk = async () => {
    try {
      // In a real implementation, this would capture and send audio data
      const audioData = new Uint8Array(1024); // Mock audio data
      
      sendMessage({
        type: 'audio_chunk',
        data: Array.from(audioData),
        timestamp: Date.now(),
        device_id: user?.deviceId
      });
    } catch (error) {
      console.error('Audio chunk processing failed:', error);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const options = {
          quality: 0.8,
          base64: true,
          skipProcessing: true,
        };
        
        const data = await cameraRef.current.takePictureAsync(options);
        
        sendMessage({
          type: 'video_frame',
          data: data.base64,
          timestamp: Date.now(),
          device_id: user?.deviceId
        });
        
      } catch (error) {
        console.error('Failed to take picture:', error);
      }
    }
  };

  if (!permissionsGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Icon name="camera-alt" size={80} color="#ccc" />
          <Text style={styles.permissionText}>
            Camera and microphone permissions are required
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermissions}>
            <Text style={styles.buttonText}>Grant Permissions</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraContainer}>
        <RNCamera
          ref={cameraRef}
          style={styles.camera}
          type={RNCamera.Constants.Type.front}
          flashMode={RNCamera.Constants.FlashMode.off}
          androidCameraPermissionOptions={{
            title: 'Permission to use camera',
            message: 'We need your permission to use your camera',
            buttonPositive: 'Ok',
            buttonNegative: 'Cancel',
          }}
        />
        
        {/* Connection Status Indicator */}
        <View style={[styles.statusIndicator, {backgroundColor: isConnected ? '#4CAF50' : '#F44336'}]}>
          <Text style={styles.statusText}>
            {connectionStatus.toUpperCase()}
          </Text>
        </View>
        
        {/* Recording Indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC</Text>
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.streamButton, isStreaming && styles.streamButtonActive]}
          onPress={isStreaming ? stopStreaming : startStreaming}
          disabled={!isConnected}>
          <Icon 
            name={isStreaming ? "stop" : "play-arrow"} 
            size={30} 
            color="white" 
          />
          <Text style={styles.streamButtonText}>
            {isStreaming ? 'Stop Monitor' : 'Start Monitor'}
          </Text>
        </TouchableOpacity>

        <View style={styles.secondaryControls}>
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={takePicture}
            disabled={!isStreaming}>
            <Icon name="photo-camera" size={24} color="#FF6B35" />
          </TouchableOpacity>
          
          <View style={styles.audioVisualizer}>
            <Text style={styles.audioText}>
              Audio: {isRecording ? 'ON' : 'OFF'}
            </Text>
            {isRecording && (
              <View style={styles.audioWaves}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View key={i} style={styles.audioWave} />
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: '#666',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  statusIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 6,
  },
  recordingText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  controlsContainer: {
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: 40,
  },
  streamButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 20,
  },
  streamButtonActive: {
    backgroundColor: '#F44336',
  },
  streamButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioVisualizer: {
    flex: 1,
    marginLeft: 20,
  },
  audioText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  audioWaves: {
    flexDirection: 'row',
    alignItems: 'end',
  },
  audioWave: {
    width: 3,
    height: 10,
    backgroundColor: '#FF6B35',
    marginRight: 2,
    borderRadius: 1.5,
  },
  button: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default StreamScreen;
