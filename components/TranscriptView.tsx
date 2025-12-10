import React, { useEffect, useRef } from 'react';
import { TranscriptSegment } from '../types';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  currentText: string;
}

const TranscriptView: React.FC<TranscriptViewProps> = ({ segments, currentText }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments, currentText]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar mask-gradient">
      {segments.length === 0 && !currentText && (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
            <p className="text-xl font-medium mb-2">Ready to Transcribe</p>
            <p className="text-sm text-center max-w-xs">Play your audiobook on speakers and tap the microphone button below.</p>
        </div>
      )}

      {segments.map((segment) => (
        <div key={segment.id} className="animate-fade-in text-lg md:text-xl text-gray-300 leading-relaxed font-light">
          {segment.text}
        </div>
      ))}
      
      {currentText && (
        <div className="text-xl md:text-2xl text-white font-medium leading-relaxed drop-shadow-md">
          {currentText}
          <span className="inline-block w-2 h-5 ml-1 bg-amber-450 animate-pulse align-middle" />
        </div>
      )}
      
      <div ref={bottomRef} className="h-4" />
    </div>
  );
};

export default TranscriptView;