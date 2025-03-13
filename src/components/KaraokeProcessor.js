import React, { useState, useEffect } from 'react';
import { View, Button, PermissionsAndroid, Platform, Text } from 'react-native';
import { RTCPeerConnection, MediaStream, mediaDevices } from 'react-native-webrtc';
import Sound from 'react-native-sound';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import RNFS from 'react-native-fs';

const audioRecorderPlayer = new AudioRecorderPlayer();
const BACKGROUND_AUDIO_URL = 'https://download.samplelib.com/mp3/sample-9s.mp3';

const KaraokeProcessor = () => {
  const [state, setState] = useState('idle'); // 'idle', 'recording', 'merged'
  const [backgroundSound, setBackgroundSound] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [audioStream, setAudioStream] = useState(null);
  const [recordedPath, setRecordedPath] = useState(null);
  const [mergedPath, setMergedPath] = useState(null);
  const [mergedSound, setMergedSound] = useState(null);

  Sound.setCategory('Playback');

  // Request permissions
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.error('Permission error:', err);
        return false;
      }
    }
    return true; // iOS via Info.plist
  };

  // Download background audio
  const downloadBackgroundAudio = async () => {
    const filename = BACKGROUND_AUDIO_URL.split("/").pop(); // Extracts 'sample-9s.mp3'
    console.log(filename);
    const destPath = `${RNFS.CachesDirectoryPath}/${filename}`;
    try {
      const exists = await RNFS.exists(destPath);
      if (!exists) {
        console.log('Downloading background audio from:', BACKGROUND_AUDIO_URL);
        const result = await RNFS.downloadFile({
          fromUrl: BACKGROUND_AUDIO_URL,
          toFile: destPath,
        }).promise;
        if (result.statusCode !== 200) {
          throw new Error(`Download failed with status code: ${result.statusCode}`);
        }
        console.log('Background audio downloaded to:', destPath);
      } else {
        console.log('Background audio already exists at:', destPath);
      }
      return destPath;
    } catch (error) {
      console.error('Failed to download background audio:', error);
      return null;
    }
  };

  // Initialize WebRTC for real-time audio
  const initializeWebRTC = async () => {
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const pc = new RTCPeerConnection(configuration);

    try {
      const stream = await mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        console.log('Received audio track for pitch adjustment (+2 semitones)');
        // Placeholder: Native pitch shift module would process event.streams[0]
        setAudioStream(event.streams[0]);
      };

      setPeerConnection(pc);
      return stream;
    } catch (error) {
      console.error('WebRTC initialization failed:', error);
      return null;
    }
  };

  // Start karaoke: record and play background
  const startKaraoke = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.error('Permissions denied');
      return;
    }

    try {
      const cacheDir = RNFS.CachesDirectoryPath;
      await RNFS.mkdir(cacheDir); // Ensure cache directory exists

      const bgAudioPath = await downloadBackgroundAudio();
      if (!bgAudioPath) throw new Error('Failed to prepare background audio');

      const micStream = await initializeWebRTC();
      if (!micStream) throw new Error('Failed to initialize WebRTC');

      // Start recording
      const recordingPath = `${cacheDir}/user_recording.wav`;
      await audioRecorderPlayer.startRecorder(recordingPath);
      audioRecorderPlayer.addRecordBackListener((e) => {
        console.log('Recording...', e.currentPosition);
      });
      setRecordedPath(recordingPath);
      console.log('Recording started at:', recordingPath);

      // Play background track
      const sound = new Sound(bgAudioPath, null, (error) => {
        if (error) {
          console.error('Failed to load background sound:', error);
          return;
        }
        setBackgroundSound(sound);
        const startTime = Date.now();
        sound.play((success) => {
          if (!success) console.error('Background playback failed');
          console.log('Background playback finished');
        });
        console.log('Background audio started at:', startTime);
      });

      setState('recording');
      console.log('Karaoke started with real-time audio processing');
    } catch (error) {
      console.error('Failed to start karaoke:', error);
    }
  };

  // Merge recorded audio with background
  const mergeAudio = async (recordedAudioPath, bgAudioPath) => {
    try {
      const recordedExists = await RNFS.exists(recordedAudioPath);
      const bgExists = await RNFS.exists(bgAudioPath);
      console.log('Recorded file exists:', recordedExists, 'at:', recordedAudioPath);
      console.log('Background file exists:', bgExists, 'at:', bgAudioPath);

      if (!recordedExists || !bgExists) throw new Error('One or both input files are missing');

      const timestamp = Date.now();
      const outputPath = `${RNFS.CachesDirectoryPath}/merged_karaoke_${timestamp}.m4a`;
      const command = `-i ${recordedAudioPath} -i ${bgAudioPath} -filter_complex [0:a][1:a]amix=inputs=2:duration=shortest -c:a aac ${outputPath}`;

      console.log('Executing FFmpeg command:', command);
      const session = await FFmpegKit.execute(command);

      const returnCode = await session.getReturnCode();
      const output = await session.getAllLogsAsString();
      console.log('FFmpeg return code:', returnCode);
      console.log('FFmpeg output:', output);

      if (ReturnCode.isSuccess(returnCode)) {
        console.log('Audio merged successfully at:', outputPath);
        return outputPath;
      } else {
        throw new Error(`Merge failed with return code: ${returnCode}`);
      }
    } catch (error) {
      console.error('Audio merge failed:', error);
      return null;
    }
  };

  // Stop karaoke and merge
  const stopKaraoke = async () => {
    try {
      await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      console.log('Recording stopped');

      if (backgroundSound) {
        backgroundSound.stop(() => {
          backgroundSound.release();
          setBackgroundSound(null);
        });
        console.log('Background sound stopped');
      }

      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
        console.log('WebRTC connection closed');
      }

      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
        console.log('Microphone stream stopped');
      }

      if (recordedPath) {
        const bgAudioPath = await downloadBackgroundAudio();
        if (bgAudioPath) {
          const mergedAudioPath = await mergeAudio(recordedPath, bgAudioPath);
          if (mergedAudioPath) {
            setMergedPath(mergedAudioPath);
            console.log('Merged audio available at:', mergedAudioPath);
          } else {
            console.error('Merge process failed');
          }
        }
      }

      setState('merged');
      setRecordedPath(null);
    } catch (error) {
      console.error('Failed to stop karaoke:', error);
    }
  };

  // Play merged audio
  const playMergedAudio = () => {
    if (!mergedPath) {
      console.error('No merged audio available to play');
      return;
    }

    if (mergedSound) {
      mergedSound.stop(() => {
        mergedSound.release();
        setMergedSound(null);
      });
    }

    const sound = new Sound(mergedPath, null, (error) => {
      if (error) {
        console.error('Failed to load merged audio:', error);
        return;
      }
      setMergedSound(sound);
      sound.play((success) => {
        if (success) {
          console.log('Merged audio playback finished');
        } else {
          console.error('Merged audio playback failed');
        }
        sound.release();
        setMergedSound(null);
        setState('idle');
      });
      console.log('Playing merged audio from:', mergedPath);
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (backgroundSound) backgroundSound.release();
      if (peerConnection) peerConnection.close();
      if (audioStream) audioStream.getTracks().forEach(track => track.stop());
      if (mergedSound) mergedSound.release();
    };
  }, [backgroundSound, peerConnection, audioStream, mergedSound]);

  const handleButtonPress = () => {
    if (state === 'idle') startKaraoke();
    else if (state === 'recording') stopKaraoke();
    else if (state === 'merged') playMergedAudio();
  };

  const getButtonTitle = () => {
    switch (state) {
      case 'idle': return 'Start Karaoke';
      case 'recording': return 'Stop Karaoke';
      case 'merged': return 'Play Merged Audio';
      default: return 'Start Karaoke';
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ marginBottom: 10 }}>
        {state === 'recording' ? 'Karaoke Running...' : state === 'merged' ? 'Ready to Play!' : 'Ready to Sing!'}
      </Text>
      <Button title={getButtonTitle()} onPress={handleButtonPress} />
    </View>
  );
};

/*
Notes:
1. Pitch Adjustment: Simulated in WebRTC ontrack event. Requires native module (e.g., libsoundtouch) for real +2 semitone shift.
2. Sync: Background and recording start together; FFmpeg uses shortest duration for merge.
3. Dependencies: react-native-webrtc, react-native-sound, react-native-audio-recorder-player, ffmpeg-kit-react-native, react-native-fs
*/

export default KaraokeProcessor;