import React, { useEffect, useState } from 'react';

interface VisualizerProps {
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive }) => {
  const [bars, setBars] = useState<number[]>(new Array(5).fill(10));

  useEffect(() => {
    if (!isActive) {
      setBars(new Array(5).fill(10));
      return;
    }

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.floor(Math.random() * 40) + 10));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {bars.map((height, i) => (
        <div
          key={i}
          className={`w-2 rounded-full transition-all duration-100 ease-in-out ${isActive ? 'bg-amber-450' : 'bg-gray-700'}`}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  );
};

export default Visualizer;