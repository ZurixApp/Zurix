'use client';

import { useEffect } from 'react';

export default function CustomCursor() {
  useEffect(() => {
    const dot = document.getElementById('cursor-dot');
    const circle = document.getElementById('cursor-circle');
    
    if (!dot || !circle) return;

    let mouseX = 0;
    let mouseY = 0;
    let circleX = 0;
    let circleY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      if (dot) {
        dot.style.left = `${mouseX}px`;
        dot.style.top = `${mouseY}px`;
      }
    };

    const animateCursor = () => {
      const dx = mouseX - circleX;
      const dy = mouseY - circleY;
      circleX += dx * 0.15;
      circleY += dy * 0.15;
      
      if (circle) {
        circle.style.left = `${circleX}px`;
        circle.style.top = `${circleY}px`;
      }
      requestAnimationFrame(animateCursor);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animateCursor();

    const interactables = document.querySelectorAll('a, button, input, select, .holo-card, .luxury-card');
    interactables.forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (circle) {
          circle.style.width = '60px';
          circle.style.height = '60px';
          circle.style.borderColor = 'rgba(166, 28, 49, 0.5)';
          circle.style.backgroundColor = 'rgba(166, 28, 49, 0.05)';
        }
      });
      el.addEventListener('mouseleave', () => {
        if (circle) {
          circle.style.width = '40px';
          circle.style.height = '40px';
          circle.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          circle.style.backgroundColor = 'transparent';
        }
      });
    });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <>
      <div className="cursor-dot" id="cursor-dot"></div>
      <div className="cursor-circle" id="cursor-circle"></div>
    </>
  );
}

