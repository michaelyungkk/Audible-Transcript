
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob } from '../utils/audioUtils';

// This service manages the WebSocket connection and audio stream
export class LiveClient {
  private client: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async connect(
    onTranscription: (text: string, isComplete: boolean) => void,
    onStatusChange: (status: string) => void,
    onError: (error: Error) => void
  ) {
    try {
      onStatusChange('connecting');

      // Initialize Audio Context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Request 16k if possible, otherwise we resample
      });

      // Get Microphone Stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // We WANT to hear the speaker
          noiseSuppression: false, // Don't suppress background audio (the book)
          autoGainControl: true
        }
      });

      // Connect to Gemini
      this.sessionPromise = this.client.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            onStatusChange('connected');
            this.startAudioStreaming();
          },
          onmessage: (message: LiveServerMessage) => {
            // We are primarily interested in inputTranscription (what the user/audiobook said)
            const transcription = message.serverContent?.inputTranscription;
            if (transcription) {
              // We receive partial updates. 
              // Note: inputTranscription doesn't always have a 'isComplete' flag in the same way output does,
              // but we can stream it.
              if (transcription.text) {
                onTranscription(transcription.text, false); 
              }
            }

            // If a turn completes, we can consider the segment "finalized"
            if (message.serverContent?.turnComplete) {
              onTranscription("", true);
            }
          },
          onclose: () => {
            onStatusChange('disconnected');
            this.cleanupAudio();
          },
          onerror: () => {
            onError(new Error("Connection error"));
            onStatusChange('error');
            this.cleanupAudio();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO], // Required, but we will ignore the audio output
          inputAudioTranscription: {}, // Enable transcription for input
          systemInstruction: "You are a silent transcriber. Your task is to listen to the audio input and transcribe it. Do not generate any spoken response or commentary. Just listen.",
        }
      });

    } catch (err) {
      onError(err instanceof Error ? err : new Error('Failed to connect'));
      onStatusChange('error');
    }
  }

  private startAudioStreaming() {
    if (!this.audioContext || !this.mediaStream || !this.sessionPromise) return;

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  disconnect() {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.close();
      });
      this.sessionPromise = null;
    }
    this.cleanupAudio();
  }

  private cleanupAudio() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const liveClient = new LiveClient();
