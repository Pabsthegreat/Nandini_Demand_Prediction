import React, { useEffect, useRef, useState } from 'react';

const NUM_DOTS = 12;
const DOT_COLORS = [
  'var(--accent-primary)',
  'var(--accent-secondary)',
  'var(--accent-warning)',
  'var(--accent-purple)',
  'var(--accent-danger)',
  '#00d2ff'
];

export default function Cursor() {
  const [isVisible, setIsVisible] = useState(false);
  const mouse = useRef({ x: -100, y: -100 });
  const dotsRef = useRef(
    Array.from({ length: NUM_DOTS }).map(() => ({
      x: -100,
      y: -100,
      vx: 0,
      vy: 0,
      stiffness: 0.02 + Math.random() * 0.06, // Bounciness
      damping: 0.65 + Math.random() * 0.2, // Friction
      size: 3 + Math.random() * 5, // Random smaller size (3px to 8px)
      angle: Math.random() * Math.PI * 2,
      radius: 30 + Math.random() * 60, // Increased distance from cursor (spread)
      speed: 0.002 + Math.random() * 0.003 // Rotation speed
    }))
  );
  
  const dotElements = useRef([]);

  useEffect(() => {
    const onMouseMove = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      if (!isVisible) setIsVisible(true);
    };

    const onMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);

    let animationFrameId;
    
    const render = () => {
      const time = Date.now();
      
      dotsRef.current.forEach((dot, index) => {
        // Calculate an orbiting target point around the mouse
        const targetX = mouse.current.x + Math.cos(dot.angle + time * dot.speed) * dot.radius;
        const targetY = mouse.current.y + Math.sin(dot.angle + time * dot.speed) * dot.radius;

        // Spring physics towards the target
        const dx = targetX - dot.x;
        const dy = targetY - dot.y;
        
        dot.vx += dx * dot.stiffness;
        dot.vy += dy * dot.stiffness;
        
        dot.vx *= dot.damping;
        dot.vy *= dot.damping;
        
        dot.x += dot.vx;
        dot.y += dot.vy;

        if (dotElements.current[index]) {
          dotElements.current[index].style.transform = `translate3d(${dot.x - dot.size / 2}px, ${dot.y - dot.size / 2}px, 0)`;
        }
      });
      
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="cursor-container">
      {dotsRef.current.map((dot, index) => (
        <div
          key={index}
          ref={(el) => (dotElements.current[index] = el)}
          className="cursor-dot"
          style={{
            width: `${dot.size}px`,
            height: `${dot.size}px`,
            backgroundColor: DOT_COLORS[index % DOT_COLORS.length],
          }}
        />
      ))}
    </div>
  );
}
