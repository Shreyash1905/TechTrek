import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ArrowLeft,
  RotateCcw,
  Expand,
  MousePointer2,
  Move3D,
  ZoomIn,
  LoaderCircle,
  MapPin,
  Box,
  Layers,
  HelpCircle,
  Smartphone,
  Maximize2,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   Camera framing: derived from model bounding box & screen aspect ratio.
   On mobile portrait (aspect < 1), we pull back proportionally so the
   entire campus model fits comfortably in the horizontal viewport.
───────────────────────────────────────────────────────────────────────────── */
function computeCameraDefaults(box, aspect = 1) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const horiz = Math.max(size.x, size.z) || 100;
  const vert = size.y || 12;

  // On portrait screens (aspect < 1), pull back further to prevent horizontal clipping
  const aspectMultiplier = aspect < 1 ? Math.min(2.1, 1.35 / aspect) : 1;
  const dist = horiz * 1.45 * aspectMultiplier;
  const elevation = dist * 0.70;
  const lateral = dist * 0.82;

  const position = new THREE.Vector3(
    center.x + lateral * 0.85,
    center.y + vert * 0.3 + elevation,
    center.z + lateral * 0.95
  );

  const target = new THREE.Vector3(center.x, center.y + vert * 0.05, center.z);

  return {
    position,
    target,
    near: Math.max(horiz / 8000, 0.05),
    far: horiz * 28,
    minDist: Math.max(horiz * 0.08, 1),
    maxDist: horiz * 10,
  };
}

export default function CampusViewer3D({ onNavigateHome, onOpen2DMap }) {
  const mountRef = useRef(null);
  const sceneApi = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false); // default closed on mobile to maximize view space
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    const initialAspect = w / h;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080b0f');

    // Camera
    const camera = new THREE.PerspectiveCamera(42, initialAspect, 0.1, 5000);
    camera.position.set(160, 140, 180);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    // Controls optimized for touch screens
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.enablePan = true;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // Lighting (natural architectural sunlight)
    const hemi = new THREE.HemisphereLight(0xd4e7fe, 0x243224, 1.8);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1dc, 2.9);
    sun.position.set(90, 220, 80);
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x76a7e5, 0.95);
    fill.position.set(-90, 70, -90);
    scene.add(fill);

    // Load model
    let modelRoot = null;
    const loader = new GLTFLoader();
    loader.load(
      '/models/sdmit_campus.glb',
      (gltf) => {
        modelRoot = gltf.scene;
        scene.add(modelRoot);

        const box = new THREE.Box3().setFromObject(modelRoot);
        const center = box.getCenter(new THREE.Vector3());

        modelRoot.position.x -= center.x;
        modelRoot.position.z -= center.z;

        const box2 = new THREE.Box3().setFromObject(modelRoot);
        const currentAspect = mount.clientWidth / mount.clientHeight;
        const defaults = computeCameraDefaults(box2, currentAspect);

        camera.position.copy(defaults.position);
        camera.near = defaults.near;
        camera.far = defaults.far;
        camera.updateProjectionMatrix();

        controls.target.copy(defaults.target);
        controls.minDistance = defaults.minDist;
        controls.maxDistance = defaults.maxDist;
        controls.update();

        const horiz = Math.max(
          box2.max.x - box2.min.x,
          box2.max.z - box2.min.z
        );
        scene.fog = new THREE.Fog('#080b0f', horiz * 5, horiz * 18);

        setLoading(false);

        sceneApi.current = {
          camera,
          controls,
          renderer,
          scene,
          box: box2,
          defaults,
        };
      },
      undefined,
      (err) => {
        console.error('GLB load error:', err);
        setError(
          'The campus model could not be loaded. Ensure public/models/sdmit_campus.glb exists.'
        );
        setLoading(false);
      }
    );

    // Animation loop
    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Responsive resize handler with portrait/landscape recalculation
    const onResize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      const aspect = width / height;

      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      // Re-update defaults if model is already loaded
      if (sceneApi.current?.box) {
        sceneApi.current.defaults = computeCameraDefaults(sceneApi.current.box, aspect);
      }
    };
    window.addEventListener('resize', onResize);

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(onResize, 150);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Complete cleanup on unmount
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
    };
  }, []);

  const resetView = () => {
    const api = sceneApi.current;
    if (!api) return;
    api.camera.position.copy(api.defaults.position);
    api.controls.target.copy(api.defaults.target);
    api.controls.update();
  };

  const toggleFullscreen = async () => {
    const el = mountRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.().catch(() => {});
    } else {
      await document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="campus-page-root mobile-optimized">
      {/* ── Top Bar of Dedicated 3D Page (Mobile-first layout) ── */}
      <header className="viewer-page-header">
        <div className="viewer-header-inner">
          <button
            onClick={onNavigateHome}
            className="btn-back-home"
            aria-label="Return to Tech Trek Home"
          >
            <ArrowLeft size={16} />
            <span className="btn-back-text">Back</span>
          </button>

          <div className="viewer-page-title-group">
            <img
              src="/images/sdmit_logo_white.png?v=2"
              alt="SDMIT Emblem"
              style={{ width: '24px', height: '24px', objectFit: 'contain', opacity: 0.9 }}
            />
            <div className="viewer-title-subgroup">
              <span className="viewer-page-badge">SPARDHAM 2026</span>
              <span className="viewer-page-title">SDMIT 3D CAMPUS</span>
            </div>
          </div>

          <div className="viewer-page-actions">
            <button
              onClick={onOpen2DMap}
              className="btn-viewer-tool btn-2d-map-pill"
              title="Open 2D architectural map"
              aria-label="Open 2D architectural map"
            >
              <Layers size={14} />
              <span className="btn-label-desktop">2D Map</span>
            </button>
            <button
              onClick={resetView}
              className="btn-viewer-tool"
              title="Reset camera to initial angle"
              aria-label="Reset camera view"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="btn-viewer-tool"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-label="Toggle fullscreen"
            >
              <Expand size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Viewport Area ── */}
      <main className="dedicated-viewport-container">
        <div className="dedicated-viewport" ref={mountRef}>
          {loading && (
            <div className="viewport-overlay loading-overlay">
              <LoaderCircle className="spinner" size={32} />
              <span>Loading SDMIT 3D Model…</span>
            </div>
          )}

          {error && (
            <div className="viewport-overlay error-overlay" role="alert">
              <strong>Campus Model Unavailable</strong>
              <span>{error}</span>
            </div>
          )}

          {/* Floating Mobile Tips Button */}
          {!loading && !error && (
            <button
              className={`mobile-hint-toggle ${showHelp ? 'active' : ''}`}
              onClick={() => setShowHelp(!showHelp)}
              aria-label="Toggle touch gesture controls help"
              title="Touch controls guide"
            >
              <HelpCircle size={15} />
              <span>Touch Guide</span>
            </button>
          )}

          {/* Touch Gesture Guide Overlay */}
          {!loading && !error && showHelp && (
            <div className="interaction-hint-floating mobile-touch-hint" role="note">
              <button
                className="hint-close"
                onClick={() => setShowHelp(false)}
                aria-label="Dismiss controls hint"
              >
                ×
              </button>
              <div className="hint-header">TOUCH CONTROLS</div>
              <div className="hint-row">
                <Smartphone size={14} className="touch-icon" />
                <span><b>1-Finger Drag:</b> Orbit campus</span>
              </div>
              <div className="hint-row">
                <Move3D size={14} className="touch-icon" />
                <span><b>2-Finger Drag:</b> Pan ground</span>
              </div>
              <div className="hint-row">
                <ZoomIn size={14} className="touch-icon" />
                <span><b>Pinch In/Out:</b> Zoom view</span>
              </div>
            </div>
          )}

          {/* Micro Campus Location Chip */}
          <div className="dedicated-location-chip" aria-hidden="true">
            <MapPin size={11} />
            <span>SDMIT · UJIRE</span>
          </div>

          {/* Live Twin Status Badge */}
          <div className="dedicated-badge-pill" aria-hidden="true">
            <Box size={12} />
            <span>3D TWIN</span>
          </div>
        </div>

        {/* ── Mobile Floating Quick-Action Dock (Convenient thumb reach) ── */}
        <div className="mobile-touch-dock" role="toolbar" aria-label="Mobile 3D Controls">
          <button
            onClick={resetView}
            className="dock-btn"
            title="Reset to default isometric angle"
            aria-label="Reset camera"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>

          <button
            onClick={onOpen2DMap}
            className="dock-btn dock-btn-highlight"
            title="Open 2D architectural floor plan"
            aria-label="Open 2D Map"
          >
            <Layers size={16} />
            <span>2D Map</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="dock-btn"
            title="Toggle fullscreen view"
            aria-label="Toggle fullscreen"
          >
            <Maximize2 size={16} />
            <span>Expand</span>
          </button>
        </div>
      </main>

      {/* ── Bottom Information Bar ── */}
      <footer className="viewer-page-bottom-bar">
        <div className="viewer-bottom-left">
          <span className="live-pulse-dot" />
          <span className="inst-title">SDM INSTITUTE OF TECHNOLOGY</span>
          <span className="v-divider" />
          <span className="text-muted-xs">Main Academic Block & Quadrangle</span>
        </div>
        <div className="viewer-bottom-right">
          <button onClick={resetView} className="btn-bottom-reset">
            <RotateCcw size={13} />
            <span>Reset View</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
