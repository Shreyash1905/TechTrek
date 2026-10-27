import React, { useEffect, useState } from 'react';
import {
  Menu,
  X,
  ArrowUpRight,
  Box,
  MapPin,
  Lock,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

export default function LandingPage({ onNavigate3D }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [map2DModalOpen, setMap2DModalOpen] = useState(false);

  /* ── IntersectionObserver for typography & section reveals ─────────────── */
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach((el) => {
        el.classList.add('is-revealed');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const elements = document.querySelectorAll('[data-reveal]');
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <div className="page landing-page-root">
      {/* ════════════════════════════════════════════════════════════════════
          HEADER (Minimal techfest navigation)
      ═════════════════════════════════════════════════════════════════════ */}
      <header className="site-header">
        <div className="header-inner">
          <div className="brand-group" onClick={scrollToTop} role="button" tabIndex={0}>
            <div className="brand-logo-frame">
              <img
                src="/images/sdmit_logo_white.png?v=2"
                alt="SDMIT Emblem"
                className="brand-logo-img"
              />
            </div>
            <div className="brand-divider" aria-hidden="true" />
            <div className="brand-text">
              <span className="brand-title">SDMIT · UJIRE</span>
              <span className="brand-subtitle">AICTE APPROVED · VTU BELAGAVI</span>
            </div>
          </div>

          <div className="header-nav-desktop">
            <button onClick={scrollToTop} className="nav-item">
              <span className="nav-indicator" />
              <span>Home</span>
            </button>
            <button onClick={() => setMap2DModalOpen(true)} className="nav-item">
              <span className="nav-indicator" />
              <span>2D Map</span>
            </button>
            <button onClick={onNavigate3D} className="nav-item">
              <span className="nav-indicator" />
              <span>3D Campus</span>
            </button>
            <button onClick={() => setLoginModalOpen(true)} className="nav-btn-portal">
              <Lock size={12} />
              <span>Login & Play</span>
            </button>
          </div>

          <button
            className="menu-toggle-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu drawer */}
        {menuOpen && (
          <nav className="mobile-menu-drawer" aria-label="Mobile Navigation">
            <button onClick={scrollToTop} className="menu-link">Home</button>
            <button onClick={() => { setMap2DModalOpen(true); setMenuOpen(false); }} className="menu-link">
              Explore 2D Map
            </button>
            <button onClick={() => { onNavigate3D(); setMenuOpen(false); }} className="menu-link">
              Explore 3D Campus
            </button>
            <button onClick={() => { setLoginModalOpen(true); setMenuOpen(false); }} className="menu-link menu-link-highlight">
              <Lock size={14} />
              <span>Login & Play</span>
            </button>
            <a
              href="https://www.sdmit.in/"
              target="_blank"
              rel="noreferrer"
              className="menu-link external"
            >
              SDMIT Official Site ↗
            </a>
          </nav>
        )}
      </header>

      {/* ════════════════════════════════════════════════════════════════════
          HERO SECTION (High-contrast, mobile-first, 3 prominent actions)
      ═════════════════════════════════════════════════════════════════════ */}
      <section className="hero-section" aria-label="Event Introduction">
        <div className="hero-content">
          {/* Top meta strip */}
          <div className="hero-meta-strip animate-hero-1">
            <span className="badge-pill">
              <span className="status-live-dot" />
              SPARDHAM 2026 PRESENTS
            </span>
            <span className="meta-tag">TECH FESTIVAL ARENA</span>
          </div>

          {/* Heading */}
          <h1 className="hero-title animate-hero-2">
            TECH <span className="highlight-gold">TREK</span>
          </h1>

          {/* Tagline */}
          <p className="hero-tagline animate-hero-3">
            Decode. Discover. Conquer.
          </p>

          {/* Subtext description */}
          <p className="hero-subtext animate-hero-4">
            A technical treasure hunt across the SDMIT campus.
          </p>

          {/* Approved Poster Event Meta Matrix */}
          <div className="event-info-matrix animate-hero-5">
            <div className="matrix-chip">
              <span className="matrix-label">DATE</span>
              <span className="matrix-val">29/10/2026</span>
            </div>
            <div className="matrix-chip">
              <span className="matrix-label">VENUE</span>
              <span className="matrix-val">SDMIT Campus, Ujire</span>
            </div>
            <div className="matrix-chip">
              <span className="matrix-label">TEAM SIZE</span>
              <span className="matrix-val">3–4 Members per Team</span>
            </div>
          </div>

          {/* Three Prominent Action Buttons */}
          <div className="action-buttons-grid animate-hero-6">
            <button
              className="btn-action btn-action-primary"
              onClick={() => setLoginModalOpen(true)}
              aria-label="Login and play treasure hunt"
            >
              <Lock size={16} className="btn-icon" />
              <div className="btn-text-group">
                <span className="btn-title">LOGIN & PLAY</span>
                <span className="btn-sub">Team Portal Access</span>
              </div>
              <ChevronRight size={16} className="btn-arrow" />
            </button>

            <button
              className="btn-action btn-action-secondary"
              onClick={() => setMap2DModalOpen(true)}
              aria-label="Explore 2D architectural map"
            >
              <Layers size={16} className="btn-icon" />
              <div className="btn-text-group">
                <span className="btn-title">EXPLORE 2D MAP</span>
                <span className="btn-sub">Floor Plans & Layout</span>
              </div>
              <ArrowUpRight size={15} className="btn-arrow" />
            </button>

            <button
              className="btn-action btn-action-tertiary"
              onClick={onNavigate3D}
              aria-label="Explore interactive 3D campus model"
            >
              <Box size={16} className="btn-icon" />
              <div className="btn-text-group">
                <span className="btn-title">EXPLORE 3D CAMPUS</span>
                <span className="btn-sub">Dedicated 3D Model Page</span>
              </div>
              <ArrowUpRight size={15} className="btn-arrow" />
            </button>
          </div>
        </div>

        {/* Hero Architectural Campus Showcase with real photograph */}
        <div className="hero-photo-showcase animate-hero-7">
          <div className="hero-photo-wrap">
            <img
              src="/images/main-building.jpg"
              alt="SDMIT Main Academic Block at Ujire, Karnataka"
              className="hero-campus-photo"
              loading="eager"
            />
            {/* Smooth top and bottom gradient fades */}
            <div className="photo-fade-top" aria-hidden="true" />
            <div className="photo-fade-bottom" aria-hidden="true" />

            {/* Architectural Pin Callouts */}
            <div className="photo-hotspot hotspot-left" title="Main Entrance & Academic Block">
              <span className="hotspot-pulse" />
              <span className="hotspot-label">MAIN ACADEMIC BLOCK</span>
            </div>

            <div className="photo-hotspot hotspot-center" title="Central Courtyard Arena">
              <span className="hotspot-pulse" />
              <span className="hotspot-label">CLUES AROUND EVERY CORNER</span>
            </div>

            <div className="photo-hotspot hotspot-right" title="Central Computing Facility">
              <span className="hotspot-pulse" />
              <span className="hotspot-label">LOGIC & INNOVATION</span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          CAMPUS EXPLORATION PREVIEW BANNER (Navigates to dedicated page)
      ═════════════════════════════════════════════════════════════════════ */}
      <section className="campus-preview-section" data-reveal>
        <div className="preview-card">
          <div className="preview-content">
            <div className="preview-eyebrow-wrap">
              <span className="eyebrow-accent-bar" aria-hidden="true" />
              <span className="preview-eyebrow">DIGITAL TWIN ARENA</span>
            </div>
            <h2 className="preview-heading">
              Experience SDMIT <span className="highlight-gold">in Full 3D</span>
            </h2>
            <p className="preview-desc">
              Launch the dedicated interactive viewer to inspect building levels, central courtyards, and navigation checkpoints in real-time 3D.
            </p>
          </div>

          <div className="preview-actions">
            <button onClick={onNavigate3D} className="btn-launch-3d">
              <Box size={16} />
              <span>LAUNCH 3D CAMPUS VIEWER</span>
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => setMap2DModalOpen(true)} className="btn-launch-2d">
              <Layers size={15} />
              <span>View 2D Layout Map</span>
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 1: LOGIN & PLAY
      ═════════════════════════════════════════════════════════════════════ */}
      {loginModalOpen && (
        <div className="modal-backdrop" onClick={() => setLoginModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-badge">SPARDHAM 2026</span>
                <h3 className="modal-heading">Player & Team Access</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setLoginModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="info-callout">
                <Info size={18} className="info-icon" />
                <p>
                  Team credentials and decryptor tokens are issued by event coordinators upon physical check-in at the Main Academic Block on competition day.
                </p>
              </div>

              <div className="form-group-dummy">
                <label className="input-label">TEAM REGISTRATION ID</label>
                <input
                  type="text"
                  placeholder="e.g. TT-SPARDHAM-2026"
                  disabled
                  className="modal-input"
                />
              </div>

              <div className="form-group-dummy">
                <label className="input-label">PASSCODE / ACCESS KEY</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  disabled
                  className="modal-input"
                />
              </div>

              <p className="modal-note">
                Online registration validation is handled at the coordinator control desk. Check back once your team is verified.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn-modal-close" onClick={() => setLoginModalOpen(false)}>
                Back to Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL 2: 2D ARCHITECTURAL MAP
      ═════════════════════════════════════════════════════════════════════ */}
      {map2DModalOpen && (
        <div className="modal-backdrop" onClick={() => setMap2DModalOpen(false)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-badge">ARCHITECTURAL SCHEMATIC</span>
                <h3 className="modal-heading">SDMIT Campus 2D Floor Plan</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setMap2DModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body modal-body-map">
              <p className="map-caption">
                Main Academic Building (Ground to 4th Floor) & Central Computing Facility schematic layout.
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
              <button className="btn-modal-close" onClick={() => setMap2DModalOpen(false)}>
                Close Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          COMPACT FOOTER (Approved Institution Details)
      ═════════════════════════════════════════════════════════════════════ */}
      <footer className="site-footer" data-reveal>
        <div className="footer-content">
          <div className="footer-col-main">
            <div className="footer-brand-wrap" style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
              <img
                src="/images/sdmit_logo_white.png?v=2"
                alt="SDMIT Emblem"
                style={{ width: '38px', height: '38px', objectFit: 'contain', opacity: 0.95 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="footer-society">SDM EDUCATIONAL SOCIETY (R)</span>
                <strong className="footer-inst">SDM INSTITUTE OF TECHNOLOGY</strong>
              </div>
            </div>
            <span className="footer-affiliation">
              Approved by AICTE, New Delhi · Affiliated to VTU, Belagavi · Ujire, Karnataka
            </span>
          </div>
          <div className="footer-col-side">
            <span className="footer-event-tag">SPARDHAM 2026 // TECH TREK</span>
            <span className="footer-copyright">© 2026 SDMIT. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
