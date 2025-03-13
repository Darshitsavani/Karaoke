import React, { useState, useEffect } from 'react';
import { View, Button, PermissionsAndroid, Platform } from 'react-native';
import { MediaStream, RTCPeerConnection, mediaDevices } from 'react-native-webrtc';
import Sound from 'react-native-sound';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import RNFS from 'react-native-fs';

const audioRecorderPlayer = new AudioRecorderPlayer();
const BACKGROUND_AUDIO_URL = 'https://download.samplelib.com/mp3/sample-9s.mp3';

const AudioProcessor = () => {
  const [state, setState] = useState('idle'); // 'idle', 'recording', 'merged'
  const [backgroundSound, setBackgroundSound] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [recordedPath, setRecordedPath] = useState(null);
  const [mergedPath, setMergedPath] = useState(null);
  const [mergedSound, setMergedSound] = useState(null);

  Sound.setCategory('Playback');

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
    return true; // iOS handles permissions via Info.plist
  };

  const initializeWebRTC = async () => {
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const pc = new RTCPeerConnection(configuration);
    
    const stream = await mediaDevices.getUserMedia({ audio: { echoCancellation: false } });
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    
    pc.ontrack = (event) => {
      console.log('Received audio track for pitch adjustment (+2 semitones)');
    };

    setPeerConnection(pc);
    return stream;
  };

  const ensureDirectoryExists = async (path) => {
    try {
      await RNFS.mkdir(path);
      console.log('Directory ensured:', path);
    } catch (error) {
      console.log('Directory already exists or created:', path);
    }
  };

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

  const startKaraoke = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      // Ensure cache directory exists
      const cacheDir = RNFS.CachesDirectoryPath;
      await ensureDirectoryExists(cacheDir);

      // Initialize WebRTC for real-time audio
      await initializeWebRTC();

      // Define recording path
      const recordingPath = `${cacheDir}/user_recording.wav`;
      await audioRecorderPlayer.startRecorder(recordingPath);
      audioRecorderPlayer.addRecordBackListener((e) => {
        console.log('Recording...', e.currentPosition);
      });
      setRecordedPath(recordingPath);
      console.log('Recording started at:', recordingPath);

      // Download background audio if not already present
      const bgAudioPath = await downloadBackgroundAudio();
      if (!bgAudioPath) {
        throw new Error('Failed to prepare background audio');
      }

      // Start background track from downloaded file
      const sound = new Sound(
        bgAudioPath,
        null,
        (error) => {
          if (error) {
            console.error('Failed to load sound:', error);
            return;
          }
          setBackgroundSound(sound);
          sound.play((success) => {
            if (!success) console.error('Playback failed');
          });
          console.log('Background audio playing from:', bgAudioPath);
        }
      );

      setState('recording');
      console.log('Started karaoke with WebRTC pitch adjustment');
    } catch (error) {
      console.error('Failed to start karaoke:', error);
    }
  };

  const mergeAudio = async (recordedAudioPath, bgAudioPath) => {
    try {
      const recordedExists = await RNFS.exists(recordedAudioPath);
      const bgExists = await RNFS.exists(bgAudioPath);
      console.log('Recorded file exists:', recordedExists, 'at:', recordedAudioPath);
      console.log('Background file exists:', bgExists, 'at:', bgAudioPath);

      if (!recordedExists || !bgExists) {
        throw new Error('One or both input files are missing');
      }

      // Generate unique output path with timestamp
      const timestamp = Date.now();
      const outputPath = `${RNFS.CachesDirectoryPath}/merged_karaoke_${timestamp}.m4a`;
      // Reduce background audio volume to 0.5 (-6 dB), mix with recorded audio, use shortest duration
      const command = `-i ${recordedAudioPath} -i ${bgAudioPath} -filter_complex [1:a]volume=0.5[bg];[0:a][bg]amix=inputs=2:duration=shortest -c:a aac ${outputPath}`;
      
      console.log('Executing FFmpeg command:', command);
      const session = await FFmpegKit.execute(command);
      
      const returnCode = await session.getReturnCode();
      const failStackTrace = await session.getFailStackTrace();
      const output = await session.getAllLogsAsString();

      console.log('FFmpeg return code:', returnCode);
      console.log('FFmpeg output:', output);
      if (failStackTrace) console.error('FFmpeg fail stack trace:', failStackTrace);

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
        console.log('Background sound stopped and released');
      }

      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
        console.log('WebRTC connection closed');
      }

      if (recordedPath) {
        const bgAudioPath = await downloadBackgroundAudio();
        if (bgAudioPath) {
          const mergedAudioPath = await mergeAudio(recordedPath, bgAudioPath);
          if (mergedAudioPath) {
            setMergedPath(mergedAudioPath);
            console.log('Merged audio available at:', mergedAudioPath);
          } else {
            console.error('Merge process returned no output path');
          }
        } else {
          console.error('Failed to get background audio path for merging');
        }
      } else {
        console.error('No recording path available for merging');
      }

      setState('merged');
      setRecordedPath(null);
    } catch (error) {
      console.error('Failed to stop karaoke:', error);
    }
  };

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

    const sound = new Sound(
      mergedPath,
      null,
      (error) => {
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
          setState('idle'); // Reset to idle after playback
        });
        console.log('Playing merged audio from:', mergedPath);
      }
    );
  };

  const handleButtonPress = () => {
    if (state === 'idle') {
      startKaraoke();
    } else if (state === 'recording') {
      stopKaraoke();
    } else if (state === 'merged') {
      playMergedAudio();
    }
  };

  useEffect(() => {
    return () => {
      if (peerConnection) peerConnection.close();
      if (backgroundSound) backgroundSound.release();
      if (mergedSound) mergedSound.release();
    };
  }, [peerConnection, backgroundSound, mergedSound]);

  const getButtonTitle = () => {
    switch (state) {
      case 'idle':
        return 'Start Karaoke'; // play background music and record audio
      case 'recording':
        return 'Stop Karaoke';
      case 'merged':
        return 'Play Merged Audio'; // play merged audio file
      default:
        return 'Start Karaoke';
    }
  };

  return (
    <View style={{marginBottom:40}}>
      <Button title={getButtonTitle()} onPress={handleButtonPress} />
    </View>
  );
};

export default AudioProcessor;