
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Square, Mic, AlertCircle, Maximize2, Minimize2, Download } from 'lucide-react';
import { ConnectionStatus, TranscriptSegment } from './types';
import { liveClient } from './services/liveClient';
import TranscriptView from './components/TranscriptView';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Keep track of current text in a ref
  const currentTextRef = useRef('');

  // PWA Install Prompt Handler
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Wake Lock Manager
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const sentinel = await navigator.wakeLock.request('screen');
        setWakeLock(sentinel);
      }
    } catch (err) {
      console.error('Wake Lock error:', err);
    }
  };

  const releaseWakeLock = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
    }
  }, [wakeLock]);

  // Re-acquire wake lock if visibility changes (e.g. user tabs away and back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === ConnectionStatus.CONNECTED) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [status, releaseWakeLock]);

  const handleTranscription = useCallback((text: string, isComplete: boolean) => {
    if (isComplete) {
      if (currentTextRef.current.trim()) {
        const newSegment: TranscriptSegment = {
          id: Date.now().toString(),
          text: currentTextRef.current.trim(),
          timestamp: Date.now(),
          isFinal: true,
        };
        setSegments(prev => [...prev, newSegment]);
        setCurrentText('');
        currentTextRef.current = '';
      }
    } else {
      setCurrentText(prev => {
          const newVal = prev + text;
          currentTextRef.current = newVal;
          return newVal;
      });
    }
  }, []);

  const toggleConnection = async () => {
    if (status === ConnectionStatus.CONNECTED || status === ConnectionStatus.CONNECTING) {
      await liveClient.disconnect();
      setStatus(ConnectionStatus.DISCONNECTED);
      releaseWakeLock();
      
      if (currentText) {
         setSegments(prev => [...prev, {
          id: Date.now().toString(),
          text: currentText,
          timestamp: Date.now(),
          isFinal: true
         }]);
         setCurrentText('');
         currentTextRef.current = '';
      }
    } else {
      setError(null);
      await requestWakeLock(); // Keep screen on!
      await liveClient.connect(
        handleTranscription,
        (s) => setStatus(s as ConnectionStatus),
        (e) => {
          setError(e.message);
          releaseWakeLock();
        }
      );
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
          // Fallback for iOS Safari which doesn't support full standard fullscreen API on elements easily
          setIsFullscreen(!isFullscreen); 
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-950 text-white font-sans overflow-hidden safe-area-inset-bottom">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 shrink-0 z-10 safe-area-inset-top">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-gray-900 font-bold shadow-lg shadow-amber-900/20">
            <Mic size={18} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">Audiobook Scribe</h1>
            <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Real-time Transcription</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-1 text-xs bg-amber-900/40 text-amber-400 px-2 py-1 rounded border border-amber-800 hover:bg-amber-900/60 transition-colors"
              >
                <Download size={14} />
                <span>Install</span>
              </button>
            )}
            <Visualizer isActive={status === ConnectionStatus.CONNECTED} />
            <button 
                onClick={toggleFullscreen}
                className="p-2 text-gray-400 hover:text-white transition-colors hidden sm:block"
            >
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col min-h-0 bg-gray-950">
        
        {/* Error Banner */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-20 bg-red-900/50 border border-red-700/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-3 animate-fade-in backdrop-blur-sm shadow-xl">
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-200 hover:text-white">✕</button>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-4 right-6 z-10">
             <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider border backdrop-blur-md shadow-lg ${
                status === ConnectionStatus.CONNECTED 
                ? 'bg-green-900/30 text-green-400 border-green-800' 
                : status === ConnectionStatus.CONNECTING
                ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800'
                : 'bg-gray-800/80 text-gray-400 border-gray-700'
             }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-400 animate-pulse' : 'bg-current'}`} />
                {status === ConnectionStatus.CONNECTED ? 'LISTENING' : status.toUpperCase()}
             </span>
        </div>

        <TranscriptView segments={segments} currentText={currentText} />

        {/* Bottom Fade Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />
      </main>

      {/* Control Bar */}
      <div className="p-6 pb-8 bg-gray-900 border-t border-gray-800 shrink-0 flex flex-col items-center safe-area-inset-bottom">
        
        <div className="text-xs text-gray-500 mb-4 text-center">
            {status === ConnectionStatus.DISCONNECTED ? 
                "Tap mic to start. Audio must be on speakers." : 
                "Microphone is active. Screen will stay awake."}
        </div>

        <button
          onClick={toggleConnection}
          disabled={status === ConnectionStatus.CONNECTING}
          className={`
            relative group flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-xl
            ${status === ConnectionStatus.CONNECTED 
              ? 'bg-red-500 hover:bg-red-600 shadow-red-900/30' 
              : 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/30'
            }
            ${status === ConnectionStatus.CONNECTING ? 'opacity-80 cursor-wait' : ''}
          `}
        >
          {status === ConnectionStatus.CONNECTING ? (
             <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          ) : status === ConnectionStatus.CONNECTED ? (
            <>
                <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-30"></span>
                <Square className="fill-current text-white" size={28} />
            </>
          ) : (
            <Mic className="text-gray-900" size={32} strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  );
};

export default App;
