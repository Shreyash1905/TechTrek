import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  KeyRound,
  FileText,
  MapPin,
  Users,
  Settings,
  History,
  LogOut,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Edit,
  ArrowUp,
  ArrowDown,
  Eye,
  Download,
  AlertTriangle,
  QrCode,
  ShieldAlert,
  Compass,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Lock,
  Search,
  Loader2,
  Route,
  Milestone,
  Flag,
} from 'lucide-react';

export default function AdminDashboard({ token, onLogout, onNavigateHome }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [teamsData, setTeamsData] = useState([]);
  const [hintsData, setHintsData] = useState([]);
  const [checkpointsData, setCheckpointsData] = useState([]);
  const [settingsData, setSettingsData] = useState(null);
  const [logsData, setLogsData] = useState([]);
  const [logsPagination, setLogsPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Team Routes data states
  const [routesData, setRoutesData] = useState([]);
  const [selectedRouteTeamId, setSelectedRouteTeamId] = useState('');
  const [routeDetail, setRouteDetail] = useState(null);
  const [routeSaving, setRouteSaving] = useState(false);
  const [previewRouteModal, setPreviewRouteModal] = useState(null);
  const [routeHintModal, setRouteHintModal] = useState(null);
  const [assignExistingModal, setAssignExistingModal] = useState(false);
  const [selectedExistingHintIds, setSelectedExistingHintIds] = useState([]);

  // Dialog & Modal states
  const [newKeyModal, setNewKeyModal] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [hintModal, setHintModal] = useState(null);
  const [previewHintModal, setPreviewHintModal] = useState(null);
  const [checkpointModal, setCheckpointModal] = useState(null);
  const [qrModal, setQrModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [renameInput, setRenameInput] = useState('');
  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideSlotId, setOverrideSlotId] = useState('');

  // Custom key modal
  const [customKeyModal, setCustomKeyModal] = useState(null); // { slotId, slotNumber }
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [showCustomKey, setShowCustomKey] = useState(false);
  const [customKeyError, setCustomKeyError] = useState('');

  // Allocate team modal
  const [allocateModal, setAllocateModal] = useState(false);
  const [allocateTeamName, setAllocateTeamName] = useState('');
  const [allocateSlotId, setAllocateSlotId] = useState('');
  const [allocateKeyOption, setAllocateKeyOption] = useState('generate'); // 'generate' | 'custom' | 'none'
  const [allocateCustomKey, setAllocateCustomKey] = useState('');

  // Delete team modal
  const [deleteModal, setDeleteModal] = useState(null); // { slotId, slotNumber, teamName, hasProgress }

  // Search & filter for keys tab
  const [keysSearch, setKeysSearch] = useState('');
  const [keysStatusFilter, setKeysStatusFilter] = useState('all');
  const [keysKeyFilter, setKeysKeyFilter] = useState('all');

  // Password change in settings
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Centralized admin fetch with 401 interceptor
  // ─────────────────────────────────────────────────────────────────────────

  const adminFetch = useCallback(async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'x-admin-token': token,
      ...(options.headers || {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'PASSWORD_CHANGE_REQUIRED') {
        showToast('Password change required. Please log in again.', 'error');
      } else {
        showToast('Session expired. Please log in again.', 'error');
      }
      localStorage.removeItem('techtrek_admin_token');
      onLogout();
      return null;
    }

    return res;
  }, [token, onLogout]);

  // ─────────────────────────────────────────────────────────────────────────
  // Tab data fetching
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchTabData(activeTab);
  }, [activeTab]);

  const fetchTabData = async (tab, isSync = false) => {
    setLoading(true);
    setFetchError(null);
    try {
      if (tab === 'overview') {
        const res = await adminFetch('/api/admin/overview');
        if (!res) return;
        const data = await res.json();
        if (data.success) setOverviewData(data);
        else setFetchError(data.message || 'Failed to load overview.');
      } else if (tab === 'keys' || tab === 'progress') {
        const res = await adminFetch('/api/admin/teams');
        if (!res) return;
        const data = await res.json();
        if (data.success) setTeamsData(data.teams);
        else setFetchError(data.message || 'Failed to load teams.');
      } else if (tab === 'hints') {
        const [hintsRes, cpRes] = await Promise.all([
          adminFetch('/api/admin/hints'),
          adminFetch('/api/admin/checkpoints'),
        ]);
        if (!hintsRes || !cpRes) return;
        const hData = await hintsRes.json();
        const cData = await cpRes.json();
        if (hData.success) setHintsData(hData.hints);
        if (cData.success) setCheckpointsData(cData.checkpoints);
      } else if (tab === 'checkpoints') {
        const [cpRes, teamsRes] = await Promise.all([
          adminFetch('/api/admin/checkpoints'),
          adminFetch('/api/admin/teams'),
        ]);
        if (!cpRes || !teamsRes) return;
        const cData = await cpRes.json();
        const tData = await teamsRes.json();
        if (cData.success) setCheckpointsData(cData.checkpoints);
        if (tData.success) setTeamsData(tData.teams);
      } else if (tab === 'routes') {
        const [routesRes, cpRes, hintsRes] = await Promise.all([
          adminFetch('/api/admin/routes'),
          adminFetch('/api/admin/checkpoints'),
          adminFetch('/api/admin/hints'),
        ]);
        if (!routesRes || !cpRes || !hintsRes) return;
        const rData = await routesRes.json();
        const cData = await cpRes.json();
        const hData = await hintsRes.json();
        if (rData.success) {
          setRoutesData(rData.routes || []);
          if (rData.routes?.length > 0 && !selectedRouteTeamId) {
            setSelectedRouteTeamId(rData.routes[0].teamId);
          }
        }
        if (cData.success) setCheckpointsData(cData.checkpoints || []);
        if (hData.success) setHintsData(hData.hints || []);
      } else if (tab === 'settings') {
        const res = await adminFetch('/api/admin/settings');
        if (!res) return;
        const data = await res.json();
        if (data.success) setSettingsData(data.settings);
        else setFetchError(data.message || 'Failed to load settings.');
      } else if (tab === 'logs') {
        fetchLogs(1);
        return; // fetchLogs handles setLoading
      }
      if (isSync) showToast('Data synchronized with server.');
    } catch (err) {
      console.error('Data fetch failed:', err);
      setFetchError('Network error loading tab data.');
      showToast('Network error loading tab data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/audit-logs?page=${page}&limit=25`);
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        setLogsData(data.logs);
        setLogsPagination({ page: data.page, totalPages: data.totalPages, total: data.total });
      }
    } catch (err) {
      console.error('Audit logs fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading & Error UI helpers
  // ─────────────────────────────────────────────────────────────────────────

  const LoadingSpinner = () => (
    <div className="admin-loading-state">
      <Loader2 size={28} className="spin" />
      <span>Loading data…</span>
    </div>
  );

  const ErrorRetry = ({ message }) => (
    <div className="admin-error-state">
      <AlertTriangle size={24} />
      <p>{message || 'Failed to load data.'}</p>
      <button onClick={() => fetchTabData(activeTab)} className="btn-admin-action">
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );

  const EmptyState = ({ icon: Icon, title, description }) => (
    <div className="admin-card empty-state-card">
      <Icon size={40} className="empty-icon" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers: Team Slots & Access Keys
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreateSlot = async () => {
    try {
      const res = await adminFetch('/api/admin/teams/create-slot', {
        method: 'POST',
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('New team slot created successfully.');
        fetchTabData('keys');
      } else {
        showToast(data.message || 'Failed to create slot.', 'error');
      }
    } catch (err) {
      showToast('Network error creating team slot.', 'error');
    }
  };

  const handleGenerateKey = async (slotId) => {
    try {
      const res = await adminFetch('/api/admin/teams/generate-key', {
        method: 'POST',
        body: JSON.stringify({ slotId }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        setNewKeyModal({ key: data.key, slotNumber: data.slotNumber });
        setCopiedKey(false);
        fetchTabData('keys');
      } else {
        showToast(data.message || 'Failed to generate key.', 'error');
      }
    } catch (err) {
      showToast('Network error generating key.', 'error');
    }
  };

  const handleCustomKey = async (e) => {
    e.preventDefault();
    const cleanKey = customKeyInput.trim();
    setCustomKeyError('');

    if (cleanKey.length < 4 || cleanKey.length > 32) {
      setCustomKeyError('Access key must be between 4 and 32 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(cleanKey)) {
      setCustomKeyError('Only letters, numbers, hyphens (-), and underscores (_) are allowed.');
      return;
    }

    try {
      const res = await adminFetch('/api/admin/teams/custom-key', {
        method: 'POST',
        body: JSON.stringify({
          slotId: customKeyModal.slotId,
          customKey: cleanKey,
          replaceActive: true,
        }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Custom access key saved.');
        setCustomKeyModal(null);
        setCustomKeyInput('');
        fetchTabData('keys');
      } else {
        setCustomKeyError(data.message || 'Failed to set custom key.');
      }
    } catch (err) {
      setCustomKeyError('Network error setting custom key.');
    }
  };

  const handleAllocateTeam = async (e) => {
    e.preventDefault();
    try {
      const body = {
        teamName: allocateTeamName.trim() || undefined,
        keyOption: allocateKeyOption,
      };
      if (allocateSlotId) body.slotId = allocateSlotId;
      if (allocateKeyOption === 'custom') body.customKey = allocateCustomKey.trim();

      const res = await adminFetch('/api/admin/teams/allocate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        setAllocateModal(false);
        setAllocateTeamName('');
        setAllocateSlotId('');
        setAllocateKeyOption('generate');
        setAllocateCustomKey('');
        if (data.key) {
          setNewKeyModal({ key: data.key, slotNumber: data.slotNumber });
          setCopiedKey(false);
        } else {
          showToast(data.message || 'Team allocated successfully.');
        }
        fetchTabData('keys');
      } else {
        showToast(data.message || 'Failed to allocate team.', 'error');
      }
    } catch (err) {
      showToast('Network error allocating team.', 'error');
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteModal) return;
    try {
      const res = await adminFetch('/api/admin/teams/delete', {
        method: 'POST',
        body: JSON.stringify({ slotId: deleteModal.slotId }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Team deleted and slot reset.');
        setDeleteModal(null);
        fetchTabData('keys');
      } else {
        showToast(data.message || 'Failed to delete team.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting team.', 'error');
    }
  };

  const handleRevokeKey = async (slotId) => {
    if (!window.confirm('Are you sure you want to revoke this access key? Active participants will be disconnected.')) {
      return;
    }
    try {
      const res = await adminFetch('/api/admin/teams/revoke-key', {
        method: 'POST',
        body: JSON.stringify({ slotId }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Access key revoked.');
        fetchTabData('keys');
      }
    } catch (err) {
      showToast('Failed to revoke key.', 'error');
    }
  };

  const handleRenameTeam = async (e) => {
    e.preventDefault();
    if (!renameInput.trim()) return;
    try {
      const res = await adminFetch('/api/admin/teams/rename', {
        method: 'POST',
        body: JSON.stringify({ slotId: renameModal.slotId, newTeamName: renameInput.trim() }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Team name updated.');
        setRenameModal(null);
        fetchTabData('keys');
      } else {
        showToast(data.message || 'Failed to rename team.', 'error');
      }
    } catch (err) {
      showToast('Error updating team name.', 'error');
    }
  };

  const handleResetProgress = async (slotId) => {
    if (!window.confirm('Reset this team\u2019s hunt progress back to Checkpoint 1?')) return;
    try {
      const res = await adminFetch('/api/admin/teams/reset-progress', {
        method: 'POST',
        body: JSON.stringify({ slotId }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Team progress reset to beginning.');
        fetchTabData('keys');
      }
    } catch (err) {
      showToast('Failed to reset progress.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers: Hints
  // ─────────────────────────────────────────────────────────────────────────

  const handleSaveHint = async (e) => {
    e.preventDefault();
    const { mode, hint } = hintModal;
    const url = mode === 'create' ? '/api/admin/hints' : `/api/admin/hints/${hint.id}`;
    const method = mode === 'create' ? 'POST' : 'PUT';

    try {
      const res = await adminFetch(url, {
        method,
        body: JSON.stringify(hint),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast(`Clue ${mode === 'create' ? 'created' : 'updated'} successfully.`);
        setHintModal(null);
        fetchTabData('hints');
      } else {
        showToast(data.message || 'Error saving clue.', 'error');
      }
    } catch (err) {
      showToast('Network error saving clue.', 'error');
    }
  };

  const handleDeleteHint = async (id, title) => {
    if (!window.confirm(`Delete clue "${title}"?`)) return;
    try {
      const res = await adminFetch(`/api/admin/hints/${id}`, {
        method: 'DELETE',
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Clue deleted.');
        fetchTabData('hints');
      }
    } catch (err) {
      showToast('Failed to delete clue.', 'error');
    }
  };

  const handleTogglePublishHint = async (id) => {
    try {
      const res = await adminFetch(`/api/admin/hints/${id}/publish`, {
        method: 'POST',
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast(`Clue is now ${data.status}.`);
        fetchTabData('hints');
      }
    } catch (err) {
      showToast('Failed to toggle publication.', 'error');
    }
  };

  const handleMoveHint = async (index, direction) => {
    const newHints = [...hintsData];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newHints.length) return;

    const temp = newHints[index];
    newHints[index] = newHints[targetIdx];
    newHints[targetIdx] = temp;

    setHintsData(newHints);

    try {
      await adminFetch('/api/admin/hints/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds: newHints.map((h) => h.id) }),
      });
      showToast('Sequence updated.');
    } catch (err) {
      showToast('Failed to save sequence order.', 'error');
      fetchTabData('hints');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers: Checkpoints
  // ─────────────────────────────────────────────────────────────────────────

  const handleSaveCheckpoint = async (e) => {
    e.preventDefault();
    const { mode, cp } = checkpointModal;
    const url = mode === 'create' ? '/api/admin/checkpoints' : `/api/admin/checkpoints/${cp.id}`;
    const method = mode === 'create' ? 'POST' : 'PUT';

    try {
      const res = await adminFetch(url, {
        method,
        body: JSON.stringify(cp),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast(`Checkpoint ${mode === 'create' ? 'created' : 'updated'}.`);
        setCheckpointModal(null);
        fetchTabData('checkpoints');
      } else {
        showToast(data.message || 'Error saving checkpoint.', 'error');
      }
    } catch (err) {
      showToast('Network error saving checkpoint.', 'error');
    }
  };

  const handleDeleteCheckpoint = async (id, name) => {
    if (!window.confirm(`Delete checkpoint "${name}"?`)) return;
    try {
      const res = await adminFetch(`/api/admin/checkpoints/${id}`, {
        method: 'DELETE',
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Checkpoint removed.');
        fetchTabData('checkpoints');
      }
    } catch (err) {
      showToast('Failed to delete checkpoint.', 'error');
    }
  };

  const handleOverrideCheckpoint = async (e) => {
    e.preventDefault();
    if (!overrideSlotId) return;
    try {
      const res = await adminFetch(`/api/admin/checkpoints/${overrideModal.cpId}/override`, {
        method: 'POST',
        body: JSON.stringify({ slotId: overrideSlotId }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        setOverrideModal(null);
        fetchTabData('checkpoints');
      }
    } catch (err) {
      showToast('Override failed.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers: Team Routes & Route Hints
  // ─────────────────────────────────────────────────────────────────────────

  const handleSelectRouteTeam = (teamId) => {
    setSelectedRouteTeamId(teamId);
  };

  const handleUpdateRouteMeta = async (teamId, patch) => {
    try {
      setRouteSaving(true);
      const res = await adminFetch(`/api/admin/routes/${teamId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Route updated successfully.');
        fetchTabData('routes');
      } else {
        showToast(data.message || 'Failed to update route.', 'error');
      }
    } catch (err) {
      showToast('Network error saving route.', 'error');
    } finally {
      setRouteSaving(false);
    }
  };

  const handleSaveRouteHint = async (e) => {
    e.preventDefault();
    if (!routeHintModal || !selectedRouteTeamId) return;
    const { mode, hint } = routeHintModal;

    if (!hint.title?.trim() || !hint.content?.trim()) {
      showToast('Title and content are required.', 'error');
      return;
    }

    try {
      if (mode === 'create') {
        const res = await adminFetch(`/api/admin/routes/${selectedRouteTeamId}/hints`, {
          method: 'POST',
          body: JSON.stringify(hint),
        });
        if (!res) return;
        const data = await res.json();
        if (data.success) {
          showToast('Clue added to route.');
          setRouteHintModal(null);
          fetchTabData('routes');
        } else {
          showToast(data.message || 'Error adding clue.', 'error');
        }
      } else {
        // Edit existing hint
        const res = await adminFetch(`/api/admin/hints/${hint.id}`, {
          method: 'PUT',
          body: JSON.stringify(hint),
        });
        if (!res) return;
        const data = await res.json();
        if (data.success) {
          showToast('Clue updated.');
          setRouteHintModal(null);
          fetchTabData('routes');
        } else {
          showToast(data.message || 'Error updating clue.', 'error');
        }
      }
    } catch (err) {
      showToast('Network error saving clue.', 'error');
    }
  };

  const handleDeleteRouteHint = async (hintId, hintTitle) => {
    if (!selectedRouteTeamId) return;
    if (!window.confirm(`Delete clue "${hintTitle}" from this team's route?`)) return;

    try {
      const res = await adminFetch(`/api/admin/routes/${selectedRouteTeamId}/hints/${hintId}`, {
        method: 'DELETE',
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Clue deleted from route.');
        fetchTabData('routes');
      } else {
        showToast(data.message || 'Error deleting clue.', 'error');
      }
    } catch (err) {
      showToast('Network error deleting clue.', 'error');
    }
  };

  const handleMoveRouteHint = async (index, direction) => {
    const selectedRoute = routesData.find((r) => r.teamId === selectedRouteTeamId);
    if (!selectedRoute || !selectedRoute.hints) return;

    const newHints = [...selectedRoute.hints];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newHints.length) return;

    // Swap
    const temp = newHints[index];
    newHints[index] = newHints[targetIndex];
    newHints[targetIndex] = temp;

    const orderedHintIds = newHints.map((h) => h.id);

    try {
      const res = await adminFetch(`/api/admin/routes/${selectedRouteTeamId}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ orderedHintIds }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Route sequence updated.');
        fetchTabData('routes');
      }
    } catch (err) {
      showToast('Failed to reorder clues.', 'error');
    }
  };

  const handleTogglePublishRouteHint = async (hintId) => {
    try {
      const res = await adminFetch(`/api/admin/hints/${hintId}/publish`, {
        method: 'POST',
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast(`Clue status changed to ${data.status}.`);
        fetchTabData('routes');
      }
    } catch (err) {
      showToast('Error changing clue status.', 'error');
    }
  };

  const handleAssignExistingHints = async () => {
    if (!selectedRouteTeamId || selectedExistingHintIds.length === 0) return;
    try {
      const res = await adminFetch(`/api/admin/routes/${selectedRouteTeamId}/assign-existing`, {
        method: 'POST',
        body: JSON.stringify({ hintIds: selectedExistingHintIds }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Assigned selected clues to route.');
        setAssignExistingModal(false);
        setSelectedExistingHintIds([]);
        fetchTabData('routes');
      }
    } catch (err) {
      showToast('Error assigning clues.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers: Settings & Password
  // ─────────────────────────────────────────────────────────────────────────

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsData),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Settings saved.');
        setSettingsData(data.settings);
      } else {
        showToast(data.message || 'Failed to save settings.', 'error');
      }
    } catch (err) {
      showToast('Network error updating settings.', 'error');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPw.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('New password and confirmation do not match.', 'error');
      return;
    }

    try {
      const res = await adminFetch('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        showToast('Password updated successfully.');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        showToast(data.message || 'Password update failed.', 'error');
      }
    } catch (err) {
      showToast('Network error changing password.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Filtered teams for keys tab
  // ─────────────────────────────────────────────────────────────────────────

  const filteredTeams = teamsData.filter((slot) => {
    // Search filter
    if (keysSearch) {
      const q = keysSearch.toLowerCase();
      const matchesSearch =
        (slot.teamName && slot.teamName.toLowerCase().includes(q)) ||
        `slot #${slot.slotNumber}`.includes(q) ||
        slot.id.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    // Status filter
    if (keysStatusFilter !== 'all' && slot.status !== keysStatusFilter) return false;
    // Key filter
    if (keysKeyFilter === 'active' && !(slot.hasKey && slot.keyActive)) return false;
    if (keysKeyFilter === 'revoked' && !(slot.hasKey && !slot.keyActive)) return false;
    if (keysKeyFilter === 'none' && slot.hasKey) return false;
    return true;
  });

  return (
    <div className="admin-dashboard-root">
      {/* Toast Notification */}
      {notification && (
        <div className={`admin-toast admin-toast-${notification.type}`} role="alert">
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ── Top Bar ── */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <div className="admin-brand-pill" onClick={onNavigateHome} title="View public site">
            <img src="/images/sdmit_logo_white.png" alt="SDMIT Emblem" className="admin-mini-logo" />
            <div className="admin-brand-titles">
              <span className="brand-gold-text">SPARDHAM 2026</span>
              <span className="brand-main-text">TECH TREK CONTROL</span>
            </div>
          </div>
        </div>

        <div className="admin-topbar-right">
          <button onClick={onNavigateHome} className="btn-topbar-tool" title="Open public participant site">
            <ExternalLink size={15} />
            <span className="desktop-only">Public Site</span>
          </button>
          <button
            onClick={() => fetchTabData(activeTab, true)}
            className="btn-topbar-tool"
            title="Refresh live data"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span className="desktop-only">Sync</span>
          </button>
          <button onClick={onLogout} className="btn-topbar-tool btn-logout" title="Sign out of administration">
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ── Main Layout: Sidebar + Workspace ── */}
      <div className="admin-layout-body">
        {/* Sidebar Nav */}
        <nav className="admin-sidebar" aria-label="Administrator navigation">
          <div className="sidebar-group">
            <span className="sidebar-group-label">EVENT CONTROL</span>
            <button
              className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <LayoutDashboard size={17} />
              <span>Overview</span>
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'keys' ? 'active' : ''}`}
              onClick={() => setActiveTab('keys')}
            >
              <KeyRound size={17} />
              <span>Access Keys</span>
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'hints' ? 'active' : ''}`}
              onClick={() => setActiveTab('hints')}
            >
              <FileText size={17} />
              <span>Manage Hints</span>
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'routes' ? 'active' : ''}`}
              onClick={() => setActiveTab('routes')}
            >
              <Route size={17} />
              <span>Team Routes</span>
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'checkpoints' ? 'active' : ''}`}
              onClick={() => setActiveTab('checkpoints')}
            >
              <MapPin size={17} />
              <span>Checkpoints</span>
            </button>
          </div>

          <div className="sidebar-group">
            <span className="sidebar-group-label">OPERATIONS & AUDIT</span>
            <button
              className={`sidebar-nav-item ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              <Users size={17} />
              <span>Team Progress</span>
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={17} />
              <span>Settings</span>
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <History size={17} />
              <span>Audit Logs</span>
            </button>
          </div>
        </nav>

        {/* ── Main Workspace ── */}
        <main className="admin-workspace">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="admin-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Dashboard Overview</h2>
                  <p className="view-subtitle">Live status of Tech Trek 2026 event arena</p>
                </div>
              </div>

              {loading && !overviewData ? (
                <LoadingSpinner />
              ) : fetchError && !overviewData ? (
                <ErrorRetry message={fetchError} />
              ) : overviewData ? (
                <>
                  {/* Event Status Banner */}
                  <div className="admin-card" style={{ marginBottom: '20px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <span className="metric-label" style={{ marginBottom: '4px', display: 'block' }}>EVENT</span>
                      <strong style={{ fontSize: '16px', color: 'var(--gold-accent)' }}>
                        {overviewData.metrics.eventName}
                      </strong>
                    </div>
                    <span className={`status-pill status-${overviewData.metrics.eventStatus}`}>
                      {(overviewData.metrics.eventStatus || 'preparation').toUpperCase()}
                    </span>
                  </div>

                  {/* Metric Cards Grid */}
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <span className="metric-label">TEAM CAPACITY</span>
                      <div className="metric-value-wrap">
                        <strong className="metric-number">{overviewData.metrics.occupiedSlots}</strong>
                        <span className="metric-denom">/ {overviewData.metrics.maxTeamCapacity}</span>
                      </div>
                      <span className="metric-sub">
                        {overviewData.metrics.availableSlots} Available Slots
                      </span>
                    </div>

                    <div className="metric-card">
                      <span className="metric-label">REGISTERED TEAMS</span>
                      <strong className="metric-number gold-highlight">{overviewData.metrics.registeredTeams}</strong>
                      <span className="metric-sub">{overviewData.metrics.keysIssued} Keys Issued</span>
                    </div>

                    <div className="metric-card">
                      <span className="metric-label">PUBLISHED CLUES</span>
                      <div className="metric-value-wrap">
                        <strong className="metric-number">{overviewData.metrics.publishedHints}</strong>
                        <span className="metric-denom">/ {overviewData.metrics.totalHints}</span>
                      </div>
                      <span className="metric-sub">Mode: {overviewData.metrics.progressionMode}</span>
                    </div>

                    <div className="metric-card">
                      <span className="metric-label">CHECKPOINT VISITS</span>
                      <strong className="metric-number">{overviewData.metrics.totalCompletedCheckpoints}</strong>
                      <span className="metric-sub">{overviewData.metrics.totalCheckpoints} Total Checkpoints</span>
                    </div>
                  </div>

                  {/* Teams Status Table */}
                  <div className="admin-card">
                    <div className="card-header">
                      <h3 className="card-title">Participating Team Status</h3>
                    </div>
                    {overviewData.teams.length === 0 ? (
                      <div className="empty-state-inline">
                        <Users size={20} className="text-muted" />
                        <span className="text-muted">No teams allocated yet. Visit Access Keys to set up team slots.</span>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Slot</th>
                              <th>Team Name</th>
                              <th>Status</th>
                              <th>Access Key</th>
                              <th>Current Clue</th>
                              <th>Checkpoints</th>
                              <th>Last Activity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overviewData.teams.map((t) => (
                              <tr key={t.id}>
                                <td><strong>Slot #{t.slotNumber}</strong></td>
                                <td>{t.teamName || <span className="text-muted">Unregistered</span>}</td>
                                <td>
                                  <span className={`status-pill status-${t.status}`}>{t.status.toUpperCase()}</span>
                                </td>
                                <td>
                                  {t.hasKey ? (
                                    t.keyActive ? (
                                      <span className="badge-active">ACTIVE</span>
                                    ) : (
                                      <span className="badge-inactive">REVOKED</span>
                                    )
                                  ) : (
                                    <span className="text-muted">None</span>
                                  )}
                                </td>
                                <td>Clue #{t.currentHintIndex + 1}</td>
                                <td>{t.completedCheckpointsCount} verified</td>
                                <td>
                                  {t.lastActivityAt ? (
                                    new Date(t.lastActivityAt).toLocaleTimeString()
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div className="admin-card">
                    <div className="card-header">
                      <h3 className="card-title">Recent Event Activity</h3>
                    </div>
                    {overviewData.recentActivity.length === 0 ? (
                      <div className="empty-state-inline">
                        <History size={20} className="text-muted" />
                        <span className="text-muted">No event activity logged yet.</span>
                      </div>
                    ) : (
                      <div className="recent-activity-list">
                        {overviewData.recentActivity.map((log) => (
                          <div key={log.id} className="activity-item">
                            <span className={`activity-status-dot dot-${log.status}`} />
                            <div className="activity-details">
                              <span className="activity-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                              <strong className="activity-type">{log.eventType}</strong>
                              <p className="activity-desc">{log.details}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* TAB 2: ACCESS KEYS */}
          {activeTab === 'keys' && (
            <div className="admin-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Team Slots & Access Keys</h2>
                  <p className="view-subtitle">Issue, revoke, and manage team credentials</p>
                </div>
                <div className="view-header-actions">
                  <button
                    onClick={() => {
                      setAllocateModal(true);
                      setAllocateTeamName('');
                      setAllocateSlotId('');
                      setAllocateKeyOption('generate');
                      setAllocateCustomKey('');
                    }}
                    className="btn-admin-action"
                  >
                    <Plus size={16} />
                    <span>Allocate Team</span>
                  </button>
                  <button onClick={handleCreateSlot} className="btn-admin-action btn-admin-action-secondary">
                    <Plus size={16} />
                    <span>Add Slot</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="admin-card keys-toolbar">
                <div className="keys-toolbar-row">
                  <div className="keys-search-wrap">
                    <Search size={14} className="keys-search-icon" />
                    <input
                      type="text"
                      placeholder="Search teams or slots…"
                      value={keysSearch}
                      onChange={(e) => setKeysSearch(e.target.value)}
                      className="keys-search-input"
                    />
                  </div>
                  <select value={keysStatusFilter} onChange={(e) => setKeysStatusFilter(e.target.value)} className="keys-filter-select">
                    <option value="all">All Statuses</option>
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="registered">Registered</option>
                  </select>
                  <select value={keysKeyFilter} onChange={(e) => setKeysKeyFilter(e.target.value)} className="keys-filter-select">
                    <option value="all">All Key States</option>
                    <option value="active">Active Key</option>
                    <option value="revoked">Revoked Key</option>
                    <option value="none">No Key</option>
                  </select>
                </div>
              </div>

              {loading && teamsData.length === 0 ? (
                <LoadingSpinner />
              ) : (
                <div className="admin-card">
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Slot</th>
                          <th>Team Name</th>
                          <th>Registration</th>
                          <th>Key State</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeams.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                              {keysSearch || keysStatusFilter !== 'all' || keysKeyFilter !== 'all'
                                ? 'No teams match the current filter criteria.'
                                : 'No team slots configured yet.'}
                            </td>
                          </tr>
                        ) : (
                          filteredTeams.map((slot) => (
                            <tr key={slot.id}>
                              <td><strong>Slot #{slot.slotNumber}</strong></td>
                              <td>
                                <div className="name-with-edit">
                                  <span>{slot.teamName || <i className="text-muted">Unregistered</i>}</span>
                                  <button
                                    onClick={() => {
                                      setRenameModal({ slotId: slot.id, currentName: slot.teamName || '' });
                                      setRenameInput(slot.teamName || '');
                                    }}
                                    className="btn-icon-subtle"
                                    title="Coordinator Rename"
                                  >
                                    <Edit size={13} />
                                  </button>
                                </div>
                              </td>
                              <td>
                                <span className={`status-pill status-${slot.status}`}>{slot.status.toUpperCase()}</span>
                              </td>
                              <td>
                                {slot.hasKey ? (
                                  slot.keyActive ? (
                                    <span className="badge-active">ACTIVE KEY</span>
                                  ) : (
                                    <span className="badge-inactive">REVOKED KEY</span>
                                  )
                                ) : (
                                  <span className="text-muted">No Key Generated</span>
                                )}
                              </td>
                              <td>
                                <div className="table-action-btns">
                                  <button
                                    onClick={() => handleGenerateKey(slot.id)}
                                    className="btn-table-action btn-gold"
                                    title="Generate fresh access key"
                                  >
                                    <KeyRound size={13} />
                                    <span>{slot.hasKey ? 'Replace' : 'Generate'}</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCustomKeyModal({ slotId: slot.id, slotNumber: slot.slotNumber });
                                      setCustomKeyInput('');
                                      setCustomKeyError('');
                                      setShowCustomKey(false);
                                    }}
                                    className="btn-table-action btn-subtle"
                                    title="Enter custom access key"
                                  >
                                    <Lock size={13} />
                                    <span>Custom</span>
                                  </button>
                                  {slot.hasKey && slot.keyActive && (
                                    <button
                                      onClick={() => handleRevokeKey(slot.id)}
                                      className="btn-table-action btn-danger"
                                      title="Revoke active key"
                                    >
                                      Revoke
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleResetProgress(slot.id)}
                                    className="btn-table-action btn-subtle"
                                    title="Reset clues to 1"
                                  >
                                    Reset
                                  </button>
                                  {slot.status !== 'available' && (
                                    <button
                                      onClick={() =>
                                        setDeleteModal({
                                          slotId: slot.id,
                                          slotNumber: slot.slotNumber,
                                          teamName: slot.teamName,
                                          hasProgress:
                                            (slot.currentHintIndex || 0) > 0 ||
                                            (slot.completedCheckpoints || []).length > 0,
                                        })
                                      }
                                      className="btn-table-action btn-danger"
                                      title="Delete team allocation"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANAGE HINTS */}
          {activeTab === 'hints' && (
            <div className="admin-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Manage Clues & Hints</h2>
                  <p className="view-subtitle">Author sequential clues for the technical treasure hunt</p>
                </div>
                <button
                  onClick={() =>
                    setHintModal({
                      mode: 'create',
                      hint: { title: '', content: '', checkpointId: '', status: 'draft' },
                    })
                  }
                  className="btn-admin-action"
                >
                  <Plus size={16} />
                  <span>Create Clue</span>
                </button>
              </div>

              {loading && hintsData.length === 0 ? (
                <LoadingSpinner />
              ) : hintsData.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No Clues Configured Yet"
                  description='Click "Create Clue" to author your first treasure hunt clue.'
                />
              ) : (
                <div className="hints-sequence-list">
                  {hintsData.map((hint, idx) => (
                    <div key={hint.id} className="hint-item-card">
                      <div className="hint-order-col">
                        <button
                          onClick={() => handleMoveHint(idx, 'up')}
                          disabled={idx === 0}
                          className="btn-arrow-order"
                          title="Move up in sequence"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <span className="hint-seq-number">#{hint.sequenceNumber}</span>
                        <button
                          onClick={() => handleMoveHint(idx, 'down')}
                          disabled={idx === hintsData.length - 1}
                          className="btn-arrow-order"
                          title="Move down in sequence"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      <div className="hint-body-col">
                        <div className="hint-top-meta">
                          <span className={`status-pill status-${hint.status}`}>{hint.status.toUpperCase()}</span>
                          {hint.checkpointId && (
                            <span className="checkpoint-assigned-pill">
                              <MapPin size={12} />
                              <span>
                                {checkpointsData.find((c) => c.id === hint.checkpointId)?.name || 'Checkpoint linked'}
                              </span>
                            </span>
                          )}
                        </div>
                        <h4 className="hint-title-text">{hint.title}</h4>
                        <p className="hint-snippet-text">{hint.content}</p>
                      </div>

                      <div className="hint-actions-col">
                        <button
                          onClick={() => setPreviewHintModal(hint)}
                          className="btn-icon-action"
                          title="Preview clue as participants see it"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleTogglePublishHint(hint.id)}
                          className={`btn-table-action ${hint.status === 'published' ? 'btn-subtle' : 'btn-gold'}`}
                          title={hint.status === 'published' ? 'Unpublish clue' : 'Publish clue to live feed'}
                        >
                          {hint.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => setHintModal({ mode: 'edit', hint: { ...hint } })}
                          className="btn-icon-action"
                          title="Edit clue"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteHint(hint.id, hint.title)}
                          className="btn-icon-action btn-danger-icon"
                          title="Delete clue"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: TEAM ROUTES & HINTS */}
          {activeTab === 'routes' && (
            <div className="admin-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Team Routes & Clues</h2>
                  <p className="view-subtitle">Author, order, publish, and inspect independent treasure hunt sequences per team</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const sel = routesData.find((r) => r.teamId === selectedRouteTeamId);
                      if (sel) setPreviewRouteModal(sel);
                    }}
                    disabled={!selectedRouteTeamId || !routesData.find((r) => r.teamId === selectedRouteTeamId)?.hints?.length}
                    className="btn-admin-action btn-subtle"
                    title="Preview complete route as participants experience it"
                  >
                    <Eye size={16} />
                    <span>Preview Route</span>
                  </button>
                  <button
                    onClick={() => setAssignExistingModal(true)}
                    disabled={!selectedRouteTeamId || hintsData.length === 0}
                    className="btn-admin-action btn-subtle"
                    title="Copy/assign existing global clues into this team's route"
                  >
                    <Copy size={16} />
                    <span>Assign Global Clues</span>
                  </button>
                  <button
                    onClick={() =>
                      setRouteHintModal({
                        mode: 'create',
                        hint: { title: '', content: '', checkpointId: '', status: 'draft' },
                      })
                    }
                    disabled={!selectedRouteTeamId}
                    className="btn-admin-action"
                  >
                    <Plus size={16} />
                    <span>Add Clue to Route</span>
                  </button>
                </div>
              </div>

              {/* Team Selector Strip */}
              <div className="routes-team-selector-strip" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
                {routesData.map((route) => {
                  const isSelected = route.teamId === selectedRouteTeamId;
                  return (
                    <button
                      key={route.teamId}
                      onClick={() => handleSelectRouteTeam(route.teamId)}
                      className={`route-team-pill ${isSelected ? 'active' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '1px solid #e5a968' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: isSelected ? 'rgba(229, 169, 104, 0.14)' : 'rgba(15, 23, 42, 0.6)',
                        color: isSelected ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <strong style={{ color: isSelected ? '#e5a968' : '#e2e8f0' }}>Slot #{route.slotNumber}</strong>
                      <span>{route.teamName || <i style={{ opacity: 0.6 }}>Unregistered</i>}</span>
                      <span
                        className={`status-pill status-${route.status}`}
                        style={{ fontSize: '10px', padding: '2px 6px' }}
                      >
                        {route.status.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {loading && routesData.length === 0 ? (
                <LoadingSpinner />
              ) : routesData.length === 0 ? (
                <EmptyState
                  icon={Route}
                  title="No Team Slots Created"
                  description="Create team slots in the Access Keys tab before authoring routes."
                />
              ) : (
                (() => {
                  const selectedRoute = routesData.find((r) => r.teamId === selectedRouteTeamId) || routesData[0];
                  if (!selectedRoute) return null;

                  return (
                    <div className="route-workspace-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
                      {/* Left: Route Configuration Card */}
                      <div className="admin-card" style={{ height: 'fit-content' }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                          <Compass size={18} />
                          <span>Route Settings</span>
                        </h3>

                        <div className="form-group" style={{ marginBottom: '14px' }}>
                          <label className="input-label">ASSIGNED TEAM</label>
                          <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <strong style={{ color: '#e5a968' }}>Slot #{selectedRoute.slotNumber}</strong>
                            <div style={{ fontSize: '13px', color: '#e2e8f0' }}>{selectedRoute.teamName || 'Unregistered Team'}</div>
                          </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '14px' }}>
                          <label className="input-label">ROUTE NAME</label>
                          <input
                            type="text"
                            value={selectedRoute.routeName || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRoutesData((prev) =>
                                prev.map((r) => (r.teamId === selectedRoute.teamId ? { ...r, routeName: val } : r))
                              );
                            }}
                            onBlur={() => handleUpdateRouteMeta(selectedRoute.teamId, { routeName: selectedRoute.routeName })}
                            className="modal-input"
                            placeholder="e.g. Route Alpha — Circuit & Logic"
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: '14px' }}>
                          <label className="input-label">PUBLICATION STATUS</label>
                          <select
                            value={selectedRoute.status}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              setRoutesData((prev) =>
                                prev.map((r) => (r.teamId === selectedRoute.teamId ? { ...r, status: newStatus } : r))
                              );
                              handleUpdateRouteMeta(selectedRoute.teamId, { status: newStatus });
                            }}
                            className="modal-input"
                          >
                            <option value="draft">Draft (Hidden from team)</option>
                            <option value="published">Published (Live for team)</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: '14px' }}>
                          <label className="input-label">FINAL DESTINATION / PRIZE VAULT</label>
                          <input
                            type="text"
                            value={selectedRoute.finalDestination || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRoutesData((prev) =>
                                prev.map((r) => (r.teamId === selectedRoute.teamId ? { ...r, finalDestination: val } : r))
                              );
                            }}
                            onBlur={() => handleUpdateRouteMeta(selectedRoute.teamId, { finalDestination: selectedRoute.finalDestination })}
                            className="modal-input"
                            placeholder="e.g. Server Room Vault / Seminar Hall Podium"
                          />
                          <span className="input-note">Shown to this team upon solving all route clues.</span>
                        </div>

                        <div className="form-group" style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <label className="input-label">LIVE TEAM PROGRESS</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                            <div>Current Clue Index: <strong style={{ color: '#ffffff' }}>#{selectedRoute.currentProgress.currentHintIndex + 1}</strong></div>
                            <div>Verified Locations: <strong style={{ color: '#ffffff' }}>{selectedRoute.currentProgress.completedCheckpointsCount}</strong></div>
                            <div>Total Route Clues: <strong style={{ color: '#ffffff' }}>{selectedRoute.hintsCount}</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Ordered Hints Sequence for this Route */}
                      <div className="route-hints-panel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h3 style={{ fontSize: '15px', color: '#e2e8f0', margin: 0 }}>
                            Clues Sequence ({selectedRoute.hints?.length || 0})
                          </h3>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                            {selectedRoute.publishedHintsCount} of {selectedRoute.hintsCount} published
                          </span>
                        </div>

                        {selectedRoute.hints?.length === 0 ? (
                          <div className="admin-card empty-state-card">
                            <FileText size={36} className="empty-icon" />
                            <h3>No Clues in this Route</h3>
                            <p>Add fresh clues or assign existing global clues to build this team's journey.</p>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                              <button
                                onClick={() => setAssignExistingModal(true)}
                                className="btn-admin-action btn-subtle"
                              >
                                <Copy size={14} /> Assign Existing
                              </button>
                              <button
                                onClick={() =>
                                  setRouteHintModal({
                                    mode: 'create',
                                    hint: { title: '', content: '', checkpointId: '', status: 'draft' },
                                  })
                                }
                                className="btn-admin-action"
                              >
                                <Plus size={14} /> Add New Clue
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="hints-sequence-list">
                            {selectedRoute.hints.map((hint, idx) => (
                              <div key={hint.id} className="hint-item-card">
                                <div className="hint-order-col">
                                  <button
                                    onClick={() => handleMoveRouteHint(idx, 'up')}
                                    disabled={idx === 0}
                                    className="btn-arrow-order"
                                    title="Move up in sequence"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <span className="hint-seq-number">#{idx + 1}</span>
                                  <button
                                    onClick={() => handleMoveRouteHint(idx, 'down')}
                                    disabled={idx === selectedRoute.hints.length - 1}
                                    className="btn-arrow-order"
                                    title="Move down in sequence"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                </div>

                                <div className="hint-body-col">
                                  <div className="hint-top-meta">
                                    <span className={`status-pill status-${hint.status}`}>
                                      {hint.status.toUpperCase()}
                                    </span>
                                    {hint.checkpointId && (
                                      <span className="checkpoint-assigned-pill">
                                        <MapPin size={12} />
                                        <span>{hint.checkpointName || 'Checkpoint linked'}</span>
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="hint-title-text">{hint.title}</h4>
                                  <p className="hint-snippet-text">{hint.content}</p>
                                </div>

                                <div className="hint-actions-col">
                                  <button
                                    onClick={() => setPreviewHintModal(hint)}
                                    className="btn-icon-action"
                                    title="Preview clue"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleTogglePublishRouteHint(hint.id)}
                                    className={`btn-table-action ${hint.status === 'published' ? 'btn-subtle' : 'btn-gold'}`}
                                  >
                                    {hint.status === 'published' ? 'Unpublish' : 'Publish'}
                                  </button>
                                  <button
                                    onClick={() => setRouteHintModal({ mode: 'edit', hint: { ...hint } })}
                                    className="btn-icon-action"
                                    title="Edit clue"
                                  >
                                    <Edit size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRouteHint(hint.id, hint.title)}
                                    className="btn-icon-action btn-danger-icon"
                                    title="Remove from route"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* TAB 4: CHECKPOINTS */}
          {activeTab === 'checkpoints' && (
            <div className="admin-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Physical Campus Checkpoints</h2>
                  <p className="view-subtitle">Generate QR codes and validation tokens for campus locations</p>
                </div>
                <button
                  onClick={() =>
                    setCheckpointModal({
                      mode: 'create',
                      cp: { name: '', locationHint: '', customCode: '' },
                    })
                  }
                  className="btn-admin-action"
                >
                  <Plus size={16} />
                  <span>Add Checkpoint</span>
                </button>
              </div>

              {loading && checkpointsData.length === 0 ? (
                <LoadingSpinner />
              ) : checkpointsData.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="No Checkpoints Created"
                  description='Click "Add Checkpoint" to create physical campus verification points.'
                />
              ) : (
                <div className="admin-card">
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Checkpoint</th>
                          <th>Location Hint</th>
                          <th>Code</th>
                          <th>QR Code</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {checkpointsData.map((cp) => (
                          <tr key={cp.id}>
                            <td><strong>{cp.name}</strong></td>
                            <td>{cp.locationHint || <span className="text-muted">—</span>}</td>
                            <td>
                              <code className="checkpoint-code-tag">{cp.code}</code>
                            </td>
                            <td>
                              {cp.qrDataUrl && (
                                <button
                                  onClick={() => setQrModal(cp)}
                                  className="btn-table-action btn-subtle"
                                  title="View & Print QR code"
                                >
                                  <QrCode size={14} />
                                  <span>View QR</span>
                                </button>
                              )}
                            </td>
                            <td>
                              <span className={cp.isActive ? 'badge-active' : 'badge-inactive'}>
                                {cp.isActive ? 'ACTIVE' : 'DISABLED'}
                              </span>
                            </td>
                            <td>
                              <div className="table-action-btns">
                                <button
                                  onClick={() => {
                                    setOverrideModal({ cpId: cp.id, cpName: cp.name });
                                    setOverrideSlotId(teamsData[0]?.id || '');
                                  }}
                                  className="btn-table-action btn-gold"
                                  title="Manual coordinator verification"
                                >
                                  Manual Override
                                </button>
                                <button
                                  onClick={() => handleDeleteCheckpoint(cp.id, cp.name)}
                                  className="btn-icon-action btn-danger-icon"
                                  title="Delete checkpoint"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: TEAM PROGRESS */}
          {activeTab === 'progress' && (
            <div className="admin-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Team Progress & Leaderboard</h2>
                  <p className="view-subtitle">Track real-time checkpoint completions</p>
                </div>
              </div>

              {loading && teamsData.length === 0 ? (
                <LoadingSpinner />
              ) : teamsData.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Teams Registered"
                  description="Progress will appear here once teams are allocated and begin the hunt."
                />
              ) : (
                <div className="admin-card">
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Slot</th>
                          <th>Team Name</th>
                          <th>Status</th>
                          <th>Current Clue</th>
                          <th>Verified Checkpoints</th>
                          <th>Registration Time</th>
                          <th>Last Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamsData.map((t) => (
                          <tr key={t.id}>
                            <td><strong>Slot #{t.slotNumber}</strong></td>
                            <td><strong>{t.teamName || <i className="text-muted">Unregistered</i>}</strong></td>
                            <td>
                              <span className={`status-pill status-${t.status}`}>{t.status.toUpperCase()}</span>
                            </td>
                            <td>
                              <span className="clue-progress-chip">Clue #{t.currentHintIndex + 1}</span>
                            </td>
                            <td>
                              <strong>{t.completedCheckpoints ? t.completedCheckpoints.length : 0}</strong> locations verified
                            </td>
                            <td>{t.registeredAt ? new Date(t.registeredAt).toLocaleTimeString() : '—'}</td>
                            <td>{t.lastActivityAt ? new Date(t.lastActivityAt).toLocaleTimeString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="admin-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Event Settings & Security</h2>
                  <p className="view-subtitle">Global configurations and password management</p>
                </div>
              </div>

              {loading && !settingsData ? (
                <LoadingSpinner />
              ) : fetchError && !settingsData ? (
                <ErrorRetry message={fetchError} />
              ) : settingsData ? (
                <div className="settings-grid">
                  <form onSubmit={handleSaveSettings} className="admin-card">
                    <h3 className="card-title">Event Configuration</h3>

                    <div className="form-group">
                      <label className="input-label">EVENT TITLE</label>
                      <input
                        type="text"
                        value={settingsData.eventName || ''}
                        onChange={(e) => setSettingsData({ ...settingsData, eventName: e.target.value })}
                        className="modal-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="input-label">DEFAULT PARTICIPANT USERNAME (READ-ONLY)</label>
                      <input
                        type="text"
                        value={settingsData.participantUsername}
                        disabled
                        readOnly
                        className="modal-input modal-input-readonly"
                      />
                      <span className="input-note">Fixed event identifier for all participating teams.</span>
                    </div>

                    <div className="form-group">
                      <label className="input-label">MAXIMUM TEAM CAPACITY</label>
                      <input
                        type="number"
                        min={2}
                        max={20}
                        value={settingsData.maxTeamCapacity}
                        onChange={(e) => setSettingsData({ ...settingsData, maxTeamCapacity: parseInt(e.target.value, 10) })}
                        className="modal-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="input-label">HINT PROGRESSION MODE</label>
                      <select
                        value={settingsData.progressionMode}
                        onChange={(e) => setSettingsData({ ...settingsData, progressionMode: e.target.value })}
                        className="modal-input"
                      >
                        <option value="manual">Manual Progression (Teams click "Next Hint" directly)</option>
                        <option value="checkpoint">Checkpoint Required (Must verify physical code to advance)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="input-label">EVENT STATUS</label>
                      <select
                        value={settingsData.eventStatus}
                        onChange={(e) => setSettingsData({ ...settingsData, eventStatus: e.target.value })}
                        className="modal-input"
                      >
                        <option value="preparation">Preparation (Staff setup only)</option>
                        <option value="active">Active (Participants can authenticate and hunt)</option>
                        <option value="finished">Finished (Event completed)</option>
                      </select>
                    </div>

                    <button type="submit" className="btn-portal-submit admin-submit">
                      Save Event Settings
                    </button>
                  </form>

                  {/* Password Change Form */}
                  <form onSubmit={handleChangePassword} className="admin-card">
                    <h3 className="card-title">Change Administrator Password</h3>

                    <div className="form-group">
                      <label className="input-label">CURRENT PASSWORD</label>
                      <input
                        type="password"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        required
                        className="modal-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="input-label">NEW PASSWORD (MIN 6 CHARACTERS)</label>
                      <input
                        type="password"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        required
                        className="modal-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="input-label">CONFIRM NEW PASSWORD</label>
                      <input
                        type="password"
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        required
                        className="modal-input"
                      />
                    </div>

                    <button type="submit" className="btn-portal-submit admin-submit">
                      Update Password
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 7: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="admin-view-container">
              <div className="view-header">
                <div>
                  <h2 className="view-title">Immutable Event Audit Trail</h2>
                  <p className="view-subtitle">Chronological record of logins, key issuances, hints, and overrides</p>
                </div>
                <a
                  href="/api/admin/audit-logs/export"
                  download
                  className="btn-admin-action"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={16} />
                  <span>Export CSV</span>
                </a>
              </div>

              {loading && logsData.length === 0 ? (
                <LoadingSpinner />
              ) : logsData.length === 0 && logsPagination.total === 0 ? (
                <EmptyState
                  icon={History}
                  title="No Audit Events Logged Yet"
                  description="Event activity will be recorded here as teams register and interact with the system."
                />
              ) : (
                <div className="admin-card">
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Event Type</th>
                          <th>Actor</th>
                          <th>Team</th>
                          <th>Status</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsData.map((log) => (
                          <tr key={log.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td>
                              <code className="event-tag">{log.eventType}</code>
                            </td>
                            <td>{log.actorType}</td>
                            <td>{log.teamId || '—'}</td>
                            <td>
                              <span className={`status-pill status-${log.status}`}>{log.status.toUpperCase()}</span>
                            </td>
                            <td>{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="pagination-bar">
                    <span>Page {logsPagination.page} of {logsPagination.totalPages} ({logsPagination.total} total events)</span>
                    <div className="pagination-btns">
                      <button
                        disabled={logsPagination.page <= 1}
                        onClick={() => fetchLogs(logsPagination.page - 1)}
                        className="btn-page-nav"
                      >
                        Previous
                      </button>
                      <button
                        disabled={logsPagination.page >= logsPagination.totalPages}
                        onClick={() => fetchLogs(logsPagination.page + 1)}
                        className="btn-page-nav"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 1: NEW KEY DISPLAY (Shown once with copy button)
      ═══════════════════════════════════════════════════════════════════════ */}
      {newKeyModal && (
        <div className="modal-backdrop" onClick={() => setNewKeyModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">Access Key Generated</h3>
            </div>
            <div className="modal-body">
              <div className="key-reveal-box">
                <span className="key-reveal-label">SLOT #{newKeyModal.slotNumber} ACCESS PASSCODE:</span>
                <strong className="key-reveal-code">{newKeyModal.key}</strong>
              </div>

              <div className="security-notice-card">
                <ShieldAlert size={18} className="warning-icon" />
                <p>
                  Copy this key now. For event security, access keys are stored only as cryptographic hashes and cannot be displayed again.
                </p>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(newKeyModal.key);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2500);
                }}
                className="btn-portal-submit"
              >
                {copiedKey ? (
                  <>
                    <Check size={16} />
                    <span>Key Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy Access Key</span>
                  </>
                )}
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-close" onClick={() => setNewKeyModal(null)}>
                Dismiss & Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: CUSTOM KEY INPUT
      ═══════════════════════════════════════════════════════════════════════ */}
      {customKeyModal && (
        <div className="modal-backdrop" onClick={() => setCustomKeyModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">Enter Custom Access Key</h3>
            </div>
            <form onSubmit={handleCustomKey} className="modal-body">
              <p className="modal-note" style={{ marginBottom: '14px' }}>
                Assign a custom access key for <strong>Slot #{customKeyModal.slotNumber}</strong>.
                The key will be stored as a SHA-256 hash and cannot be retrieved later.
              </p>

              {customKeyError && (
                <div className="portal-alert portal-alert-error" role="alert" style={{ marginBottom: '14px' }}>
                  <AlertTriangle size={14} />
                  <span>{customKeyError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="input-label">CUSTOM ACCESS KEY (4–32 CHARS)</label>
                <div className="input-with-toggle">
                  <input
                    type={showCustomKey ? 'text' : 'password'}
                    placeholder="e.g. TEAM-ALPHA-2026"
                    value={customKeyInput}
                    onChange={(e) => setCustomKeyInput(e.target.value)}
                    required
                    autoFocus
                    className="modal-input"
                    maxLength={32}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomKey(!showCustomKey)}
                    className="btn-toggle-visibility"
                    title={showCustomKey ? 'Hide key' : 'Show key'}
                  >
                    <Eye size={14} />
                  </button>
                </div>
                <span className="input-note">
                  Allowed characters: letters, numbers, hyphens (-), underscores (_). Length: {customKeyInput.trim().length}/32
                </span>
              </div>

              <div className="modal-footer" style={{ marginTop: '16px' }}>
                <button type="button" className="btn-modal-close" onClick={() => setCustomKeyModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-portal-submit" style={{ width: 'auto', padding: '9px 24px' }}>
                  Save Custom Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: ALLOCATE TEAM
      ═══════════════════════════════════════════════════════════════════════ */}
      {allocateModal && (
        <div className="modal-backdrop" onClick={() => setAllocateModal(false)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">Allocate Team Slot</h3>
            </div>
            <form onSubmit={handleAllocateTeam} className="modal-body">
              <div className="form-group">
                <label className="input-label">TARGET SLOT (OPTIONAL — AUTO-SELECTS FIRST AVAILABLE)</label>
                <select
                  value={allocateSlotId}
                  onChange={(e) => setAllocateSlotId(e.target.value)}
                  className="modal-input"
                >
                  <option value="">Auto-select first available slot</option>
                  {teamsData
                    .filter((t) => t.status === 'available')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        Slot #{t.slotNumber}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label className="input-label">TEAM NAME (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. Code Breakers"
                  value={allocateTeamName}
                  onChange={(e) => setAllocateTeamName(e.target.value)}
                  className="modal-input"
                  maxLength={30}
                />
              </div>

              <div className="form-group">
                <label className="input-label">ACCESS KEY</label>
                <select
                  value={allocateKeyOption}
                  onChange={(e) => setAllocateKeyOption(e.target.value)}
                  className="modal-input"
                >
                  <option value="generate">Auto-Generate (TT-XXXXXX)</option>
                  <option value="custom">Enter Custom Key</option>
                  <option value="none">No Key (Allocate Only)</option>
                </select>
              </div>

              {allocateKeyOption === 'custom' && (
                <div className="form-group">
                  <label className="input-label">CUSTOM KEY (4–32 CHARS)</label>
                  <input
                    type="text"
                    placeholder="e.g. TEAM-ALPHA-2026"
                    value={allocateCustomKey}
                    onChange={(e) => setAllocateCustomKey(e.target.value)}
                    className="modal-input"
                    maxLength={32}
                    required
                  />
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '16px' }}>
                <button type="button" className="btn-modal-close" onClick={() => setAllocateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-portal-submit" style={{ width: 'auto', padding: '9px 24px' }}>
                  Allocate Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: DELETE TEAM CONFIRMATION
      ═══════════════════════════════════════════════════════════════════════ */}
      {deleteModal && (
        <div className="modal-backdrop" onClick={() => setDeleteModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading" style={{ color: '#ef4444' }}>Delete Team Allocation</h3>
            </div>
            <div className="modal-body">
              <div className="security-notice-card" style={{ borderColor: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                <AlertTriangle size={20} className="warning-icon" style={{ color: '#ef4444' }} />
                <div>
                  <strong>This action cannot be undone.</strong>
                  <p style={{ marginTop: '6px' }}>
                    Deleting <strong>Slot #{deleteModal.slotNumber}</strong>
                    {deleteModal.teamName ? ` ("${deleteModal.teamName}")` : ''} will:
                  </p>
                  <ul style={{ marginTop: '6px', paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6' }}>
                    <li>Reset the slot to "Available"</li>
                    <li>Invalidate the team's access key and participant session</li>
                    <li>Clear all hint progression and checkpoint records</li>
                    {deleteModal.hasProgress && (
                      <li style={{ color: '#ef4444', fontWeight: 600 }}>⚠ This team has active hunt progress that will be lost</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-modal-close" onClick={() => setDeleteModal(null)}>
                Cancel
              </button>
              <button
                className="btn-portal-submit"
                style={{ width: 'auto', padding: '9px 24px', background: '#ef4444' }}
                onClick={handleDeleteTeam}
              >
                <Trash2 size={14} />
                <span>Delete Team</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 2: CREATE / EDIT HINT
      ═══════════════════════════════════════════════════════════════════════ */}
      {hintModal && (
        <div className="modal-backdrop" onClick={() => setHintModal(null)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">
                {hintModal.mode === 'create' ? 'Create New Clue' : 'Edit Clue'}
              </h3>
            </div>
            <form onSubmit={handleSaveHint} className="modal-body">
              <div className="form-group">
                <label className="input-label">CLUE TITLE</label>
                <input
                  type="text"
                  placeholder="e.g. The Cryptic Monolith"
                  value={hintModal.hint.title}
                  onChange={(e) => setHintModal({ ...hintModal, hint: { ...hintModal.hint, title: e.target.value } })}
                  required
                  className="modal-input"
                />
              </div>

              <div className="form-group">
                <label className="input-label">CLUE CONTENT / RIDDLE</label>
                <textarea
                  rows={4}
                  placeholder="Describe the technical riddle or architectural landmark..."
                  value={hintModal.hint.content}
                  onChange={(e) => setHintModal({ ...hintModal, hint: { ...hintModal.hint, content: e.target.value } })}
                  required
                  className="modal-input modal-textarea"
                />
              </div>

              <div className="form-group">
                <label className="input-label">LINK TO PHYSICAL CHECKPOINT (OPTIONAL)</label>
                <select
                  value={hintModal.hint.checkpointId || ''}
                  onChange={(e) =>
                    setHintModal({ ...hintModal, hint: { ...hintModal.hint, checkpointId: e.target.value } })
                  }
                  className="modal-input"
                >
                  <option value="">No checkpoint requirement (Free progression)</option>
                  {checkpointsData.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name} ({cp.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="input-label">PUBLICATION STATUS</label>
                <select
                  value={hintModal.hint.status}
                  onChange={(e) => setHintModal({ ...hintModal, hint: { ...hintModal.hint, status: e.target.value } })}
                  className="modal-input"
                >
                  <option value="draft">Draft (Hidden from participants)</option>
                  <option value="published">Published (Visible in active hunt feed)</option>
                </select>
              </div>

              <div className="modal-footer" style={{ marginTop: '16px' }}>
                <button type="button" className="btn-modal-close" onClick={() => setHintModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-portal-submit" style={{ width: 'auto', padding: '9px 24px' }}>
                  Save Clue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 3: PREVIEW HINT
      ═══════════════════════════════════════════════════════════════════════ */}
      {previewHintModal && (
        <div className="modal-backdrop" onClick={() => setPreviewHintModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">Participant View Preview</h3>
            </div>
            <div className="modal-body">
              <div className="clue-display-card preview-card">
                <span className="clue-step-badge">CLUE #{previewHintModal.sequenceNumber} PREVIEW</span>
                <h4 className="clue-title">{previewHintModal.title}</h4>
                <div className="clue-content-box">
                  <p className="clue-text">{previewHintModal.content}</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-close" onClick={() => setPreviewHintModal(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 4: CREATE / EDIT CHECKPOINT
      ═══════════════════════════════════════════════════════════════════════ */}
      {checkpointModal && (
        <div className="modal-backdrop" onClick={() => setCheckpointModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">
                {checkpointModal.mode === 'create' ? 'Add Campus Checkpoint' : 'Edit Checkpoint'}
              </h3>
            </div>
            <form onSubmit={handleSaveCheckpoint} className="modal-body">
              <div className="form-group">
                <label className="input-label">CHECKPOINT NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Ground Floor Courtyard / CCF Server Room"
                  value={checkpointModal.cp.name}
                  onChange={(e) =>
                    setCheckpointModal({ ...checkpointModal, cp: { ...checkpointModal.cp, name: e.target.value } })
                  }
                  required
                  className="modal-input"
                />
              </div>

              <div className="form-group">
                <label className="input-label">LOCATION HINT / NOTES</label>
                <input
                  type="text"
                  placeholder="e.g. Near the main entrance bulletin board"
                  value={checkpointModal.cp.locationHint}
                  onChange={(e) =>
                    setCheckpointModal({
                      ...checkpointModal,
                      cp: { ...checkpointModal.cp, locationHint: e.target.value },
                    })
                  }
                  className="modal-input"
                />
              </div>

              {checkpointModal.mode === 'create' && (
                <div className="form-group">
                  <label className="input-label">CUSTOM CODE (OPTIONAL, AUTO-GENERATED IF EMPTY)</label>
                  <input
                    type="text"
                    placeholder="e.g. CK-9812"
                    value={checkpointModal.cp.customCode || ''}
                    onChange={(e) =>
                      setCheckpointModal({
                        ...checkpointModal,
                        cp: { ...checkpointModal.cp, customCode: e.target.value },
                      })
                    }
                    className="modal-input"
                  />
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '16px' }}>
                <button type="button" className="btn-modal-close" onClick={() => setCheckpointModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-portal-submit" style={{ width: 'auto', padding: '9px 24px' }}>
                  Save Checkpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 5: QR CODE DISPLAY & PRINT
      ═══════════════════════════════════════════════════════════════════════ */}
      {qrModal && (
        <div className="modal-backdrop" onClick={() => setQrModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">Checkpoint QR Code</h3>
            </div>
            <div className="modal-body text-center" style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: '16px', display: 'block', marginBottom: '4px' }}>{qrModal.name}</strong>
              <span className="text-muted" style={{ fontSize: '13px', display: 'block', marginBottom: '16px' }}>
                {qrModal.locationHint || 'Physical verification token'}
              </span>

              <div className="qr-image-frame" style={{ display: 'inline-block', padding: '12px', background: '#fff', borderRadius: '8px' }}>
                <img src={qrModal.qrDataUrl} alt={`QR for ${qrModal.name}`} style={{ width: '200px', height: '200px', display: 'block' }} />
              </div>

              <div style={{ marginTop: '16px' }}>
                <span className="input-label">PHYSICAL VERIFICATION CODE</span>
                <strong style={{ fontSize: '20px', letterSpacing: '0.1em', color: 'var(--gold-accent)' }}>
                  {qrModal.code}
                </strong>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                className="btn-modal-close"
                onClick={() => {
                  const printWin = window.open('', '_blank');
                  printWin.document.write(`
                    <html>
                      <head><title>${qrModal.name} - QR Code</title></head>
                      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;font-family:sans-serif;">
                        <h2>Tech Trek 2026 - Checkpoint</h2>
                        <h1>${qrModal.name}</h1>
                        <img src="${qrModal.qrDataUrl}" width="300" height="300" />
                        <h2 style="letter-spacing:4px;margin-top:20px;">CODE: ${qrModal.code}</h2>
                      </body>
                    </html>
                  `);
                  printWin.document.close();
                  printWin.print();
                }}
              >
                Print Placard
              </button>
              <button className="btn-modal-close" onClick={() => setQrModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 6: RENAME TEAM
      ═══════════════════════════════════════════════════════════════════════ */}
      {renameModal && (
        <div className="modal-backdrop" onClick={() => setRenameModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">Coordinator Team Rename</h3>
            </div>
            <form onSubmit={handleRenameTeam} className="modal-body">
              <div className="form-group">
                <label className="input-label">NEW TEAM NAME</label>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  maxLength={30}
                  required
                  className="modal-input"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-modal-close" onClick={() => setRenameModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-portal-submit" style={{ width: 'auto', padding: '9px 20px' }}>
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 7: MANUAL CHECKPOINT OVERRIDE
      ═══════════════════════════════════════════════════════════════════════ */}
      {overrideModal && (
        <div className="modal-backdrop" onClick={() => setOverrideModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">Manual Checkpoint Override</h3>
            </div>
            <form onSubmit={handleOverrideCheckpoint} className="modal-body">
              <p className="modal-note" style={{ marginBottom: '14px' }}>
                Mark checkpoint <strong>"{overrideModal.cpName}"</strong> as physically verified for a team without requiring code entry.
              </p>
              <div className="form-group">
                <label className="input-label">SELECT TARGET TEAM</label>
                <select
                  value={overrideSlotId}
                  onChange={(e) => setOverrideSlotId(e.target.value)}
                  className="modal-input"
                >
                  {teamsData.map((t) => (
                    <option key={t.id} value={t.id}>
                      Slot #{t.slotNumber} {t.teamName ? `(${t.teamName})` : '(Unregistered)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-modal-close" onClick={() => setOverrideModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-portal-submit" style={{ width: 'auto', padding: '9px 20px' }}>
                  Verify Location for Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 8: ROUTE CLUE CREATE / EDIT
      ═══════════════════════════════════════════════════════════════════════ */}
      {routeHintModal && (
        <div className="modal-backdrop" onClick={() => setRouteHintModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-heading">
                {routeHintModal.mode === 'create' ? 'Add Clue to Team Route' : 'Edit Route Clue'}
              </h3>
            </div>
            <form onSubmit={handleSaveRouteHint} className="modal-body">
              <div className="form-group">
                <label className="input-label">CLUE TITLE</label>
                <input
                  type="text"
                  placeholder="e.g. The Silicon Gate Riddle"
                  value={routeHintModal.hint.title || ''}
                  onChange={(e) =>
                    setRouteHintModal({
                      ...routeHintModal,
                      hint: { ...routeHintModal.hint, title: e.target.value },
                    })
                  }
                  required
                  className="modal-input"
                />
              </div>

              <div className="form-group">
                <label className="input-label">CLUE DESCRIPTION / RIDDLE</label>
                <textarea
                  rows={4}
                  placeholder="Enter riddle or location coordinates to guide the team..."
                  value={routeHintModal.hint.content || ''}
                  onChange={(e) =>
                    setRouteHintModal({
                      ...routeHintModal,
                      hint: { ...routeHintModal.hint, content: e.target.value },
                    })
                  }
                  required
                  className="modal-input"
                />
              </div>

              <div className="form-group">
                <label className="input-label">LINKED PHYSICAL CHECKPOINT (OPTIONAL)</label>
                <select
                  value={routeHintModal.hint.checkpointId || ''}
                  onChange={(e) =>
                    setRouteHintModal({
                      ...routeHintModal,
                      hint: { ...routeHintModal.hint, checkpointId: e.target.value || null },
                    })
                  }
                  className="modal-input"
                >
                  <option value="">No physical checkpoint required</option>
                  {checkpointsData.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name} ({cp.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="input-label">STATUS</label>
                <select
                  value={routeHintModal.hint.status}
                  onChange={(e) =>
                    setRouteHintModal({
                      ...routeHintModal,
                      hint: { ...routeHintModal.hint, status: e.target.value },
                    })
                  }
                  className="modal-input"
                >
                  <option value="draft">Draft (Hidden from team until published)</option>
                  <option value="published">Published (Live for this team)</option>
                </select>
              </div>

              <div className="modal-footer" style={{ marginTop: '16px' }}>
                <button type="button" className="btn-modal-close" onClick={() => setRouteHintModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-portal-submit" style={{ width: 'auto', padding: '9px 24px' }}>
                  Save Clue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 9: ASSIGN EXISTING GLOBAL CLUES TO ROUTE
      ═══════════════════════════════════════════════════════════════════════ */}
      {assignExistingModal && (
        <div className="modal-backdrop" onClick={() => setAssignExistingModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-heading">Assign Existing Clues to Route</h3>
            </div>
            <div className="modal-body">
              <p className="modal-note" style={{ marginBottom: '14px' }}>
                Select global clues to copy into this team's custom journey:
              </p>
              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {hintsData.map((h) => {
                  const isChecked = selectedExistingHintIds.includes(h.id);
                  return (
                    <label
                      key={h.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: isChecked ? 'rgba(229, 169, 104, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                        border: isChecked ? '1px solid #e5a968' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExistingHintIds((prev) => [...prev, h.id]);
                          } else {
                            setSelectedExistingHintIds((prev) => prev.filter((id) => id !== h.id));
                          }
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: '#ffffff', display: 'block', fontSize: '13px' }}>
                          #{h.sequenceNumber} — {h.title}
                        </strong>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {h.content.slice(0, 60)}…
                        </span>
                      </div>
                      <span className={`status-pill status-${h.status}`} style={{ fontSize: '10px' }}>
                        {h.status.toUpperCase()}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="modal-footer" style={{ marginTop: '16px' }}>
                <button type="button" className="btn-modal-close" onClick={() => setAssignExistingModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignExistingHints}
                  disabled={selectedExistingHintIds.length === 0}
                  className="btn-portal-submit"
                  style={{ width: 'auto', padding: '9px 24px' }}
                >
                  Assign {selectedExistingHintIds.length} Clue(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 10: PREVIEW COMPLETE TEAM ROUTE
      ═══════════════════════════════════════════════════════════════════════ */}
      {previewRouteModal && (
        <div className="modal-backdrop" onClick={() => setPreviewRouteModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <span className="modal-badge" style={{ color: '#e5a968' }}>ROUTE INSPECTOR</span>
                <h3 className="modal-heading">{previewRouteModal.routeName}</h3>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>TEAM ASSIGNED</span>
                  <strong style={{ color: '#ffffff' }}>Slot #{previewRouteModal.slotNumber} ({previewRouteModal.teamName || 'Unregistered'})</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>PUBLICATION</span>
                  <span className={`status-pill status-${previewRouteModal.status}`}>{previewRouteModal.status.toUpperCase()}</span>
                </div>
              </div>

              <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {previewRouteModal.hints?.map((h, i) => (
                  <div key={h.id} style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ color: '#e5a968', fontSize: '13px' }}>Stage #{i + 1}: {h.title}</strong>
                      <span className={`status-pill status-${h.status}`} style={{ fontSize: '10px' }}>{h.status.toUpperCase()}</span>
                    </div>
                    <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>{h.content}</p>
                    {h.checkpointName && (
                      <span style={{ fontSize: '11px', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={11} /> Required Checkpoint: {h.checkpointName}
                      </span>
                    )}
                  </div>
                ))}

                {previewRouteModal.finalDestination && (
                  <div style={{ padding: '12px', background: 'rgba(217, 119, 6, 0.14)', border: '1px solid rgba(217, 119, 6, 0.4)', borderRadius: '8px', textAlign: 'center' }}>
                    <Flag size={20} style={{ color: '#f59e0b', margin: '0 auto 4px auto', display: 'block' }} />
                    <span style={{ fontSize: '11px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>Final Finish Condition</span>
                    <strong style={{ color: '#ffffff', fontSize: '14px' }}>{previewRouteModal.finalDestination}</strong>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ marginTop: '16px' }}>
                <button type="button" className="btn-modal-close" onClick={() => setPreviewRouteModal(null)}>
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
