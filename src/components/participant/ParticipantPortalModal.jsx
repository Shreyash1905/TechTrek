import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Eye,
  EyeOff,
  Compass,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Trophy,
  CheckCircle2,
  MapPin,
  Sparkles,
  LogOut,
  RefreshCw,
} from 'lucide-react';

export default function ParticipantPortalModal({ isOpen, onClose }) {
  // Stages: 'login', 'register', 'intro', 'hunt'
  const [stage, setStage] = useState('login');
  const [token, setToken] = useState(() => localStorage.getItem('techtrek_participant_token') || '');

  // Form states
  const [username, setUsername] = useState('SparDhaM2026');
  const [accessKey, setAccessKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [checkpointCodeInput, setCheckpointCodeInput] = useState('');

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Team & hint data
  const [teamData, setTeamData] = useState(null);
  const [currentHintData, setCurrentHintData] = useState(null);

  // Check active session on modal open
  useEffect(() => {
    if (isOpen && token) {
      fetchSession(token);
    }
  }, [isOpen, token]);

  const fetchSession = async (activeToken) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/participant/session', {
        headers: { 'x-participant-token': activeToken },
      });
      const data = await res.json();

      if (data.success && data.team) {
        setTeamData(data.team);
        if (data.allocation) {
          setAllocationInfo(data.allocation);
        }
        if (!data.team.teamName || data.team.status === 'reserved') {
          setStage('register');
        } else {
          setStage('hunt');
          loadCurrentHint(activeToken);
        }
      } else {
        // Token expired or invalid
        localStorage.removeItem('techtrek_participant_token');
        setToken('');
        setStage('login');
      }
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const [allocationInfo, setAllocationInfo] = useState(null);

  const loadCurrentHint = async (activeToken) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/participant/hint', {
        headers: { 'x-participant-token': activeToken },
      });
      const data = await res.json();
      if (res.status === 403 && data.isLate) {
        setAllocationInfo({ isLate: true, message: data.message });
      } else if (data.success) {
        setCurrentHintData(data);
        if (data.allocationSequence) {
          setAllocationInfo((prev) => ({ ...prev, sequence: data.allocationSequence, isLate: false }));
        }
      } else {
        setErrorMsg(data.message || 'Failed to retrieve current clue.');
      }
    } catch (err) {
      setErrorMsg('Network error fetching clue. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 1: Login with Access Key
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!accessKey.trim()) {
      setErrorMsg('Please enter your team access key.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/participant/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          accessKey: accessKey.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        const receivedToken = data.token;
        setToken(receivedToken);
        localStorage.setItem('techtrek_participant_token', receivedToken);
        setTeamData(data.team);
        if (data.allocation) {
          setAllocationInfo(data.allocation);
        }

        if (!data.team.teamName || data.team.status === 'reserved') {
          setStage('register');
        } else {
          setStage('intro');
        }
      } else {
        setErrorMsg(data.message || 'Access verification failed.');
      }
    } catch (err) {
      setErrorMsg('Connection error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Register Team Name
  const handleRegisterTeam = async (e) => {
    e.preventDefault();
    if (!teamNameInput.trim()) {
      setErrorMsg('Please provide a team name.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/participant/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-participant-token': token,
        },
        body: JSON.stringify({ teamName: teamNameInput.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setTeamData((prev) => ({ ...prev, teamName: data.teamName, status: 'registered' }));
        setStage('intro');
      } else {
        setErrorMsg(data.message || 'Registration failed.');
      }
    } catch (err) {
      setErrorMsg('Network error while registering team name.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Start Hunt from Intro
  const handleStartHunt = () => {
    setStage('hunt');
    loadCurrentHint(token);
  };

  // STEP 4: Next Hint Progression
  const handleNextHint = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      const res = await fetch('/api/participant/next-hint', {
        method: 'POST',
        headers: { 'x-participant-token': token },
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(data.message || 'Next clue unlocked!');
        await loadCurrentHint(token);
      } else {
        setErrorMsg(data.message || 'Could not advance to next hint.');
      }
    } catch (err) {
      setErrorMsg('Network error requesting next clue.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 4b: Verify Checkpoint Code / QR Token
  const handleVerifyCheckpoint = async (e) => {
    e.preventDefault();
    if (!checkpointCodeInput.trim()) {
      setErrorMsg('Please enter the checkpoint verification code found on site.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      const res = await fetch('/api/participant/verify-checkpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-participant-token': token,
        },
        body: JSON.stringify({ code: checkpointCodeInput.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg(data.message);
        setCheckpointCodeInput('');
        await loadCurrentHint(token);
      } else {
        setErrorMsg(data.message || 'Invalid checkpoint code.');
      }
    } catch (err) {
      setErrorMsg('Network error validating checkpoint.');
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/participant/logout', {
        method: 'POST',
        headers: { 'x-participant-token': token },
      });
    } catch (e) {}
    localStorage.removeItem('techtrek_participant_token');
    setToken('');
    setTeamData(null);
    setCurrentHintData(null);
    setAccessKey('');
    setStage('login');
    setErrorMsg('');
    setSuccessMsg('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card participant-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-badge">SPARDHAM 2026 // TECH TREK</span>
            <h3 className="modal-heading">
              {stage === 'login' && 'Player & Team Access'}
              {stage === 'register' && 'Team Registration'}
              {stage === 'intro' && 'Mission Briefing'}
              {stage === 'hunt' && (teamData?.teamName || 'Treasure Hunt Arena')}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {stage === 'hunt' && (
              <button
                className="btn-portal-action"
                onClick={handleLogout}
                title="Log out of team portal"
                aria-label="Log out"
              >
                <LogOut size={15} />
              </button>
            )}
            <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {errorMsg && (
            <div className="portal-alert portal-alert-error" role="alert">
              <AlertCircle size={16} className="alert-icon" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="portal-alert portal-alert-success" role="status">
              <CheckCircle2 size={16} className="alert-icon" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STAGE 1: LOGIN
          ═════════════════════════════════════════════════════════════════════ */}
          {stage === 'login' && (
            <form onSubmit={handleLogin} className="portal-form">
              <div className="info-callout">
                <ShieldCheck size={18} className="info-icon" />
                <p>
                  Official team decryptor keys are issued by event coordinators at the Main Academic Block control desk.
                </p>
              </div>

              <div className="form-group">
                <label className="input-label">EVENT IDENTIFIER (USERNAME)</label>
                <input
                  type="text"
                  value={username}
                  readOnly
                  disabled
                  className="modal-input modal-input-readonly"
                />
              </div>

              <div className="form-group">
                <label className="input-label">TEAM ACCESS KEY</label>
                <div className="input-password-wrap">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder="e.g. TT-7X9K2M"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    required
                    autoFocus
                    className="modal-input"
                  />
                  <button
                    type="button"
                    className="btn-toggle-eye"
                    onClick={() => setShowKey(!showKey)}
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <p className="modal-note">
                Only issued keys corresponding to official registered slots can unlock the live clue feed.
              </p>

              <button type="submit" disabled={loading} className="btn-portal-submit">
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Verifying Access…</span>
                  </>
                ) : (
                  <>
                    <Lock size={15} />
                    <span>AUTHENTICATE & ENTER</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STAGE 2: TEAM REGISTRATION
          ═════════════════════════════════════════════════════════════════════ */}
          {stage === 'register' && (
            <form onSubmit={handleRegisterTeam} className="portal-form">
              <div className="team-slot-badge-card">
                <span className="slot-badge-title">SLOT ALLOCATED</span>
                <strong className="slot-badge-number">Team Slot #{teamData?.slotNumber || 1}</strong>
                <span className="slot-badge-sub">Ready to register team identity.</span>
              </div>

              <div className="form-group">
                <label className="input-label">ENTER OFFICIAL TEAM NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Code Hunters / Binary Raiders"
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value)}
                  maxLength={30}
                  required
                  autoFocus
                  className="modal-input"
                />
                <span className="input-counter">{teamNameInput.trim().length} / 30 characters</span>
              </div>

              <p className="modal-note">
                Once confirmed, team names are permanently recorded on the server leaderboard and can only be altered by the head coordinator.
              </p>

              <button type="submit" disabled={loading} className="btn-portal-submit">
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Confirming Team…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>CONFIRM TEAM & PROCEED</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STAGE 3: HUNT INTRODUCTION SCREEN
          ═════════════════════════════════════════════════════════════════════ */}
          {stage === 'intro' && (
            <div className="portal-intro-view">
              <div className="intro-emblem-wrap">
                <Sparkles size={32} className="gold-sparkle" />
              </div>
              <span className="intro-meta-label">SPARDHAM 2026 // TECH TREK</span>
              <h2 className="intro-hero-heading">THE HUNT BEGINS</h2>
              <div className="intro-quote-card">
                <p className="intro-quote-text">
                  “Observe your surroundings. Follow the clues. Discover what’s hidden.”
                </p>
              </div>
              <div className="intro-team-confirmation">
                <span>Welcome,</span>
                <strong className="registered-team-name">{teamData?.teamName || 'Seekers'}</strong>
                <span>Your mission awaits across the SDMIT campus grounds.</span>
              </div>

              <button onClick={handleStartHunt} className="btn-portal-submit btn-start-hunt">
                <Compass size={18} />
                <span>START THE HUNT</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              STAGE 4: LIVE HUNT & CLUES SCREEN
          ═════════════════════════════════════════════════════════════════════ */}
          {stage === 'hunt' && (
            <div className="portal-hunt-view">
              {/* Top Team Progress Header */}
              <div className="hunt-progress-header">
                <div className="hunt-team-identity">
                  <span className="hunt-pill">SLOT #{teamData?.slotNumber}</span>
                  <strong className="hunt-team-title">{teamData?.teamName}</strong>
                  {allocationInfo?.sequence && (
                    <span
                      className="hunt-pill"
                      style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#fbbf24',
                        borderColor: 'rgba(245, 158, 11, 0.4)',
                        fontWeight: 600,
                      }}
                    >
                      FCFS #{allocationInfo.sequence}
                    </span>
                  )}
                </div>
                <div className="hunt-refresh-btn-wrap">
                  <button
                    onClick={() => loadCurrentHint(token)}
                    className="btn-hunt-refresh"
                    title="Refresh clue status"
                    disabled={loading}
                  >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                    <span>Sync</span>
                  </button>
                </div>
              </div>

              {/* Late Notice Gate Screen */}
              {allocationInfo?.isLate ? (
                <div className="late-notice-card" style={{ padding: '36px 20px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', margin: '14px 0' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                    <AlertCircle size={28} style={{ color: '#ef4444' }} />
                  </div>
                  <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#fca5a5', margin: '0 0 10px 0', letterSpacing: '-0.01em' }}>
                    You’re Late!
                  </h3>
                  <p style={{ fontSize: '15px', color: '#f87171', lineHeight: '1.5', maxWidth: '420px', margin: '0 auto 18px auto', fontWeight: 500 }}>
                    “Better luck next time. The available hint positions have already been claimed.”
                  </p>
                  <div style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', display: 'inline-block', fontSize: '12px', color: '#94a3b8' }}>
                    Clues for this event are allocated strictly on a First-Come, First-Served basis upon live hunt activation.
                  </div>
                </div>
              ) : currentHintData?.finished ? (
                <div className="final-stage-card">
                  <Trophy size={48} className="trophy-gold" />
                  <h3 className="final-title">Final Clue Reached!</h3>
                  <p className="final-desc">{currentHintData.message}</p>
                  {currentHintData.finalDestination && (
                    <div className="destination-badge-box" style={{ margin: '14px 0', padding: '12px', background: 'rgba(217, 119, 6, 0.12)', border: '1px solid rgba(217, 119, 6, 0.35)', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f59e0b', display: 'block', marginBottom: '4px' }}>Final Destination</span>
                      <strong style={{ fontSize: '16px', color: '#ffffff' }}>{currentHintData.finalDestination}</strong>
                    </div>
                  )}
                  <div className="final-tips">
                    <span>Inspect your last location carefully. The physical prize is within arm’s reach!</span>
                  </div>
                </div>
              ) : currentHintData?.hint ? (
                <div className="clue-display-card">
                  <div className="clue-card-top">
                    <span className="clue-step-badge">
                      CLUE {currentHintData.currentHintNumber} OF {currentHintData.totalHints}
                    </span>
                    {currentHintData.routeName && (
                      <span className="route-badge-pill" style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        {currentHintData.routeName}
                      </span>
                    )}
                    <span className="clue-checkpoint-tag">
                      <MapPin size={12} />
                      <span>{currentHintData.hint.checkpointName || 'Campus Checkpoint'}</span>
                    </span>
                  </div>

                  <h4 className="clue-title">{currentHintData.hint.title}</h4>
                  <div className="clue-content-box">
                    <p className="clue-text">{currentHintData.hint.content}</p>
                  </div>

                  {/* If Checkpoint Verification is required */}
                  {currentHintData.hint.requiresCheckpoint && (
                    <div className="checkpoint-box">
                      <div className="checkpoint-box-header">
                        <MapPin size={15} className="pin-icon" />
                        <span>Physical Checkpoint Verification</span>
                      </div>
                      {currentHintData.hint.isCheckpointCompleted ? (
                        <div className="checkpoint-verified-chip">
                          <CheckCircle2 size={16} />
                          <span>Location verified by coordinator!</span>
                        </div>
                      ) : (
                        <form onSubmit={handleVerifyCheckpoint} className="checkpoint-input-group">
                          <input
                            type="text"
                            placeholder="Enter Checkpoint Code (e.g. CK-3892)"
                            value={checkpointCodeInput}
                            onChange={(e) => setCheckpointCodeInput(e.target.value)}
                            className="modal-input checkpoint-code-input"
                          />
                          <button type="submit" disabled={loading} className="btn-verify-checkpoint">
                            Verify Location
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Action to reveal next hint */}
                  <div className="clue-action-footer">
                    <button
                      onClick={handleNextHint}
                      disabled={
                        loading ||
                        (currentHintData.hint.requiresCheckpoint && !currentHintData.hint.isCheckpointCompleted)
                      }
                      className="btn-next-hint"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={15} className="spin" />
                          <span>Unlocking Next Clue…</span>
                        </>
                      ) : (
                        <>
                          <span>GET THE NEXT HINT</span>
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-clues-state">
                  <Compass size={36} className="compass-icon" />
                  <h4>No Active Clues</h4>
                  <p>{currentHintData?.message || 'Check back once coordinators publish the first clue.'}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-modal-close" onClick={onClose}>
            Close Portal
          </button>
        </div>
      </div>
    </div>
  );
}
