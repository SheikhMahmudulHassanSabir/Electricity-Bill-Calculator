import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { Icon } from '../../components/Icons/Icons.jsx';
import { rateFmt } from '../../lib/format.js';
import './Workspaces.css';

export function Workspaces({ onToast }) {
  const {
    workspaces,
    activeWorkspaceId,
    loadingWorkspaces,
    selectWorkspace,
    createNewWorkspace,
    joinByInviteCode,
  } = useWorkspace();

  const navigate = useNavigate();

  const [wsName, setWsName] = useState('');
  const [wsRate, setWsRate] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [inviteCode, setInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const handleOpenWorkspace = (wsId) => {
    selectWorkspace(wsId);
    navigate('/calculator');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');

    const cleanName = wsName.trim();
    if (!cleanName) {
      setCreateError('Enter a workspace name (for example "Home" or "Flat 3B").');
      return;
    }

    const cleanRate = wsRate.trim();
    if (cleanRate !== '') {
      const r = Number(cleanRate);
      if (!Number.isFinite(r) || r < 0) {
        setCreateError('Enter a valid non-negative per-unit rate.');
        return;
      }
    }

    setCreating(true);
    try {
      const created = await createNewWorkspace({
        name: cleanName,
        ratePerUnit: cleanRate === '' ? null : cleanRate,
      });
      setWsName('');
      setWsRate('');
      if (onToast) onToast(`Workspace "${created.name}" created.`);
      navigate('/calculator');
    } catch (err) {
      setCreateError(err.message || 'Could not create workspace.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError('');

    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) {
      setJoinError('Enter an invite code.');
      return;
    }

    setJoining(true);
    try {
      const joined = await joinByInviteCode(cleanCode);
      setInviteCode('');
      if (onToast) onToast(`Joined workspace "${joined.name}".`);
      navigate('/calculator');
    } catch (err) {
      setJoinError(err.message || 'Could not join workspace.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="workspaces-page">
      <div className="ws-page-intro">
        <h1>Workspaces</h1>
        <p>
          Each workspace has its own shared meters, billing rate, and saved bill
          history. Switch between workspaces or invite flatmates with a code.
        </p>
      </div>

      <div className="ws-forms-grid">
        {/* Create Workspace */}
        <section className="panel" aria-labelledby="create-ws-title">
          <div className="panel-head">
            <div>
              <h2 id="create-ws-title">Create workspace</h2>
              <p>Start a shared space for your home, flat, or building.</p>
            </div>
          </div>
          <form className="panel-body ws-form" onSubmit={handleCreate} noValidate>
            <div className="field">
              <label htmlFor="ws-name">Workspace name</label>
              <div className={`input ${createError && !wsName.trim() ? 'bad' : ''}`}>
                <input
                  id="ws-name"
                  className="text"
                  placeholder="e.g. Home, Flat 3B"
                  value={wsName}
                  onChange={(e) => {
                    setWsName(e.target.value);
                    if (createError) setCreateError('');
                  }}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="ws-initial-rate">Per unit rate (optional)</label>
              <div className="input">
                <span className="fix">₹</span>
                <input
                  id="ws-initial-rate"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={wsRate}
                  onChange={(e) => {
                    setWsRate(e.target.value);
                    if (createError) setCreateError('');
                  }}
                />
                <span className="fix end">/ kWh</span>
              </div>
            </div>

            {createError && (
              <div className="err" role="alert">
                {createError}
              </div>
            )}

            <button type="submit" className="btn primary" disabled={creating}>
              <Icon name="plus" />
              <span>{creating ? 'Creating…' : 'Create workspace'}</span>
            </button>
          </form>
        </section>

        {/* Join Workspace */}
        <section className="panel" aria-labelledby="join-ws-title">
          <div className="panel-head">
            <div>
              <h2 id="join-ws-title">Join with invite code</h2>
              <p>Enter the 8-character code shared by a workspace owner.</p>
            </div>
          </div>
          <form className="panel-body ws-form" onSubmit={handleJoin} noValidate>
            <div className="field">
              <label htmlFor="ws-invite-code">Invite code</label>
              <div className={`input ${joinError ? 'bad' : ''}`}>
                <input
                  id="ws-invite-code"
                  placeholder="e.g. A1B2C3D4"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase());
                    if (joinError) setJoinError('');
                  }}
                />
              </div>
            </div>

            {joinError && (
              <div className="err" role="alert">
                {joinError}
              </div>
            )}

            <button type="submit" className="btn dark" disabled={joining}>
              <Icon name="users" />
              <span>{joining ? 'Joining…' : 'Join workspace'}</span>
            </button>
          </form>
        </section>
      </div>

      {/* Existing Workspaces List */}
      <section className="panel ws-list-section" aria-labelledby="your-ws-title">
        <div className="panel-head">
          <div>
            <h2 id="your-ws-title">Your workspaces</h2>
            <p>Select a workspace to open its electricity bill calculator.</p>
          </div>
        </div>
        <div className="panel-body">
          {loadingWorkspaces ? (
            <div className="empty" role="status">
              <b>Loading workspaces…</b>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="empty">
              <Icon name="home" />
              <b>No workspaces yet</b>
              Create your first workspace above or join one with an invite code.
            </div>
          ) : (
            <div className="ws-cards-grid">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                return (
                  <article
                    key={ws.id}
                    className={`ws-item-card ${isActive ? 'active' : ''}`}
                  >
                    <div className="ws-item-top">
                      <div>
                        <h3>{ws.name}</h3>
                        <p className="ws-meta">
                          <span>Role: {ws.my_role}</span>
                          <span aria-hidden="true"> · </span>
                          <span>
                            Rate:{' '}
                            {ws.rate_per_unit !== null && ws.rate_per_unit !== undefined
                              ? rateFmt(ws.rate_per_unit)
                              : 'Not set'}
                          </span>
                        </p>
                      </div>
                      <span className="ws-code-label" title="Invite code">
                        Code: {ws.invite_code}
                      </span>
                    </div>

                    <div className="ws-item-actions">
                      <button
                        type="button"
                        className={`btn ${isActive ? 'primary' : ''}`}
                        onClick={() => handleOpenWorkspace(ws.id)}
                      >
                        {isActive ? 'Open Calculator (Active)' : 'Switch & Open Calculator'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
