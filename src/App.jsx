import React, { useEffect, useState } from 'react';
import LandingPage from './components/LandingPage.jsx';
import CampusViewer3D from './components/CampusViewer3D.jsx';
import IntroAnimation from './components/IntroAnimation.jsx';
import AdminLogin from './components/admin/AdminLogin.jsx';
import AdminDashboard from './components/admin/AdminDashboard.jsx';

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.pathname;
  });

  const [adminToken, setAdminToken] = useState(() => {
    return localStorage.getItem('techtrek_admin_token') || '';
  });

  const [map2DModalOpenFrom3D, setMap2DModalOpenFrom3D] = useState(false);

  // Intro state: check sessionStorage and prefers-reduced-motion
  const [showIntro, setShowIntro] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const hasPlayed = sessionStorage.getItem('spardham_intro_played');
        if (hasPlayed === 'true') return false;
        if (window.location.pathname === '/3d-campus' || window.location.pathname === '/admin') return false;
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

  const isAdminPage = currentPath === '/admin';
  const is3DPage = currentPath === '/3d-campus';

  const [adminAuthChecked, setAdminAuthChecked] = useState(() => {
    return !localStorage.getItem('techtrek_admin_token');
  });
  const [adminMustChangePw, setAdminMustChangePw] = useState(false);

  // Validate admin token against backend on mount
  useEffect(() => {
    if (isAdminPage && adminToken) {
      fetch('/api/admin/me', {
        headers: { 'x-admin-token': adminToken },
      })
        .then((res) => {
          if (!res.ok) {
            localStorage.removeItem('techtrek_admin_token');
            setAdminToken('');
            setAdminMustChangePw(false);
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data && data.success) {
            setAdminMustChangePw(Boolean(data.mustChangePassword));
          }
        })
        .catch(() => {
          localStorage.removeItem('techtrek_admin_token');
          setAdminToken('');
          setAdminMustChangePw(false);
        })
        .finally(() => {
          setAdminAuthChecked(true);
        });
    } else {
      setAdminAuthChecked(true);
    }
  }, [isAdminPage, adminToken]);

  const handleAdminLogout = () => {
    localStorage.removeItem('techtrek_admin_token');
    setAdminToken('');
    setAdminMustChangePw(false);
    setAdminAuthChecked(true);
  };

  return (
    <>
      {/* Cinematic Intro Animation (plays once per session) */}
      {showIntro && (
        <IntroAnimation onComplete={handleIntroComplete} />
      )}

      {isAdminPage ? (
        !adminAuthChecked ? (
          <div style={{ minHeight: '100vh', background: '#0b1118', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a96e' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid rgba(201,169,110,0.2)', borderTopColor: '#c9a96e', borderRadius: '50%', margin: '0 auto 16px' }} />
              <span style={{ fontSize: '13px', letterSpacing: '0.1em' }}>VERIFYING CREDENTIALS…</span>
            </div>
          </div>
        ) : adminToken && !adminMustChangePw ? (
          <AdminDashboard
            token={adminToken}
            onLogout={handleAdminLogout}
            onNavigateHome={() => navigate('/')}
          />
        ) : (
          <AdminLogin
            initialMustChangePassword={adminMustChangePw}
            initialToken={adminToken}
            onLoginSuccess={({ token }) => {
              setAdminToken(token);
              setAdminMustChangePw(false);
              setAdminAuthChecked(true);
            }}
            onNavigateHome={() => navigate('/')}
          />
        )
      ) : is3DPage ? (
        <CampusViewer3D
          onNavigateHome={() => navigate('/')}
          onOpen2DMap={() => setMap2DModalOpenFrom3D(true)}
        />
      ) : (
        <LandingPage
          onNavigate3D={() => navigate('/3d-campus')}
          onNavigateAdmin={() => navigate('/admin')}
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
