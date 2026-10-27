import React, { useEffect, useState } from 'react';
import LandingPage from './components/LandingPage.jsx';
import CampusViewer3D from './components/CampusViewer3D.jsx';
import IntroAnimation from './components/IntroAnimation.jsx';

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.pathname;
  });

  const [map2DModalOpenFrom3D, setMap2DModalOpenFrom3D] = useState(false);

  // Intro state: check sessionStorage and prefers-reduced-motion
  const [showIntro, setShowIntro] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const hasPlayed = sessionStorage.getItem('spardham_intro_played');
        if (hasPlayed === 'true') return false;
        if (window.location.pathname === '/3d-campus') return false;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        return true;
      }
    } catch (e) {
      // Fallback
    }
    return false;
  });

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation helper
  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo(0, 0);
    }
  };

  const handleIntroComplete = () => {
    try {
      sessionStorage.setItem('spardham_intro_played', 'true');
    } catch (e) {}
    setShowIntro(false);
  };

  const is3DPage = currentPath === '/3d-campus';

  return (
    <>
      {/* Cinematic Intro Animation (plays once per session) */}
      {showIntro && (
        <IntroAnimation onComplete={handleIntroComplete} />
      )}

      {is3DPage ? (
        <CampusViewer3D
          onNavigateHome={() => navigate('/')}
          onOpen2DMap={() => setMap2DModalOpenFrom3D(true)}
        />
      ) : (
        <LandingPage
          onNavigate3D={() => navigate('/3d-campus')}
        />
      )}

      {/* 2D Map Modal when opened from 3D Campus page */}
      {map2DModalOpenFrom3D && (
        <div className="modal-backdrop" onClick={() => setMap2DModalOpenFrom3D(false)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-badge">ARCHITECTURAL SCHEMATIC</span>
                <h3 className="modal-heading">SDMIT Campus 2D Floor Plan</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setMap2DModalOpenFrom3D(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body modal-body-map">
              <p className="map-caption">
                Main Academic Building & Central Computing Facility floor layouts.
              </p>
              <div className="map-image-container">
                <img
                  src="/images/sdmit_2d_map.jpg?v=3"
                  alt="SDMIT Campus 2D Layout & Floor Map"
                  className="map-image"
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <a
                href="/images/sdmit_2d_map.jpg?v=3"
                target="_blank"
                rel="noreferrer"
                className="btn-modal-link"
                style={{ fontSize: '12px', color: 'var(--gold-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
              >
                Open Full Resolution ↗
              </a>
              <button
                className="btn-modal-close"
                onClick={() => setMap2DModalOpenFrom3D(false)}
              >
                Close Map
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
