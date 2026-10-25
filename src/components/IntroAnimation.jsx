import React, { useEffect, useRef, useState } from 'react';
import './IntroAnimation.css';

export default function IntroAnimation({ onComplete }) {
  const [phase, setPhase] = useState(0); // 0 to 5
  const [isExiting, setIsExiting] = useState(false);
  const canvasRef = useRef(null);
  const timersRef = useRef([]);

  // Check prefers-reduced-motion
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      onComplete();
    }
  }, [onComplete]);

  // Stage timeline sequence
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);   // SPARDHAM reveal
    const t2 = setTimeout(() => setPhase(2), 2000);  // 2026 reveal
    const t3 = setTimeout(() => setPhase(3), 3200);  // Tagline reveal
    const t4 = setTimeout(() => setPhase(4), 4400);  // Powered by SDMIT / Complete frame
    const t5 = setTimeout(() => handleExit(), 5600); // Transition out

    timersRef.current = [t1, t2, t3, t4, t5];

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Graceful exit handler
  const handleExit = () => {
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 700); // duration of exit wipe/fade
  };

  // Subtle floating golden dust particles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // Generate 28 restrained golden ambient embers
    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.8 + 0.6,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -Math.random() * 0.45 - 0.15,
      alpha: Math.random() * 0.45 + 0.15,
      baseAlpha: Math.random() * 0.45 + 0.15,
      pulseSpeed: Math.random() * 0.02 + 0.01,
      angle: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.pulseSpeed;
        p.alpha = p.baseAlpha + Math.sin(p.angle) * 0.15;

        // Wrap around edges
        if (p.y < -10) p.y = height + 10;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230, 189, 121, ${Math.max(0, p.alpha)})`;
        ctx.shadowColor = '#C99A52';
        ctx.shadowBlur = 6;
        ctx.fill();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div
      className={`intro-overlay ${isExiting ? 'intro-exiting' : ''}`}
      role="region"
      aria-label="Spardham 2026 Intro Animation"
    >
      {/* Background ambient canvas for dust/embers */}
      <canvas ref={canvasRef} className="intro-particles-canvas" />

      {/* Cinematic sweeping light flare */}
      <div className="intro-light-sweep" aria-hidden="true" />
      <div className="intro-radial-glow" aria-hidden="true" />

      {/* Skip Button */}
      <button
        onClick={handleExit}
        className="intro-skip-btn"
        aria-label="Skip introduction animation"
      >
        <span>SKIP INTRO</span>
        <span className="skip-arrow">→</span>
      </button>

      {/* Central Cinematic Typography Composition */}
      <div className="intro-stage">
        {/* Scene 2: SPARDHAM Reveal */}
        <div className={`intro-title-wrap ${phase >= 1 ? 'phase-visible' : ''}`}>
          <h1 className="intro-spardham-text">
            SPARDHAM
          </h1>
        </div>

        {/* Scene 3: Year 2026 Reveal */}
        <div className={`intro-year-wrap ${phase >= 2 ? 'phase-visible' : ''}`}>
          <span className="intro-deco-line" aria-hidden="true" />
          <span className="intro-year-text">2026</span>
          <span className="intro-deco-line" aria-hidden="true" />
        </div>

        {/* Scene 4: Tagline Reveal */}
        <div className={`intro-tagline-wrap ${phase >= 3 ? 'phase-visible' : ''}`}>
          <p className="intro-tagline">
            “It’s where logic meets <span className="tagline-highlight">INNOVATION</span>”
          </p>
        </div>

        {/* Scene 5: Final Frame / Institution branding */}
        <div className={`intro-powered-wrap ${phase >= 4 ? 'phase-visible' : ''}`}>
          <img
            src="/images/sdmit_logo_white.png?v=2"
            alt="SDMIT Emblem"
            style={{ width: '30px', height: '30px', objectFit: 'contain', opacity: 0.9 }}
          />
          <span className="powered-text">POWERED BY SDMIT</span>
        </div>
      </div>
    </div>
  );
}
