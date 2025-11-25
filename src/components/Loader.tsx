'use client';

import { useEffect, useState } from 'react';

export default function Loader() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      id="loader"
      className="fixed inset-0 bg-black z-[10000] flex justify-center items-center flex-col"
      style={{
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        transition: 'opacity 1s ease-out',
      }}
    >
      <div className="loader-line"></div>
      <div className="text-2xl font-serif text-white mt-8 uppercase tracking-[0.5em] animate-pulse">
        Zurix
      </div>
    </div>
  );
}

