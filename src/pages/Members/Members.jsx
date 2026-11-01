import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { Icon } from '../../components/Icons/Icons.jsx';
import { formatDateIN } from '../../lib/format.js';
import './Members.css';

export function Members({ onToast }) {
  const { user } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    members,
    loadingWorkspaces,
    regenerateInviteCode,
    removeMember,
    removeActiveWorkspace,
  } = useWorkspace();
  const navigate = useNavigate();

  const [regenerating, setRegenerating] = useState(false);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState(null);
  const [removingUser, setRemovingUser] = useState(false);
  const [confirmDeleteWs, setConfirmDeleteWs] = useState(false);
  const [deletingWs, setDeletingWs] = useState(false);

  if (loadingWorkspaces) {
    return (
      <div className="panel empty" role="status">
        <b>Loading workspace members…</b>
      </div>
    );
  }

  if (workspaces.length === 0 || !activeWorkspace) {
    return <Navigate to="/workspaces" replace />;
  }

  const isOwner = activeWorkspace.my_role === 'owner';

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(activeWorkspace.invite_code);
        if (onToast) onToast('Invite code copied to clipboard.');
      }
    } catch {
      if (onToast) onToast(`Invite code: ${activeWorkspace.invite_code}`);
    }
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    try {
      const nextCode = await regenerateInviteCode();
      if (onToast) onToast(`Invite code regenerated: ${nextCode}`);
    } catch (err) {
      if (onToast) onToast(err.message || 'Could not regenerate code.', true);
    } finally {
      setRegenerating(false);
    }
  };

  const handleConfirmRemoveMember = async (targetUserId) => {
    setRemovingUser(true);
    try {
      await removeMember(targetUserId);
      setConfirmRemoveUserId(null);
      if (onToast) onToast('Member removed from workspace.');
    } catch (err) {
      if (onToast) onToast(err.message || 'Could not remove member.', true);
    } finally {
      setRemovingUser(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    setDeletingWs(true);
    try {
      const deletedName = activeWorkspace.name;
      await removeActiveWorkspace();
      if (onToast) onToast(`Workspace "${deletedName}" deleted.`);
      navigate('/workspaces');
    } catch (err) {
      if (onToast) onToast(err.message || 'Could not delete workspace.', true);
    } finally {
      setDeletingWs(false);
    }
  };

  return (
    <main className="members-page">
      <div className="members-intro">
        <h1>Members & Invite Code — {activeWorkspace.name}</h1>
        <p>
          Share the invite code below so flatmates or family members can join
          this workspace and collaborate on meters and bills in real time.
        </p>
      </div>

      {/* Invite Code Panel */}
      <section className="panel" aria-labelledby="invite-code-heading">
        <div className="panel-head">
          <div>
            <h2 id="invite-code-heading">Workspace invite code</h2>
            <p>Anyone with this code can join {activeWorkspace.name} as a member.</p>
          </div>
        </div>
        <div className="panel-body invite-box-row">
          <div className="invite-code-display" aria-label="Invite code">
            {activeWorkspace.invite_code}
          </div>
          <div className="invite-actions">
            <button type="button" className="btn primary" onClick={handleCopyCode}>
              <Icon name="copy" />
              <span>Copy code</span>
            </button>
            {isOwner && (
              <button
                type="button"
                className="btn"
                onClick={handleRegenerateCode}
                disabled={regenerating}
              >
                <Icon name="reset" />
                <span>
                  {regenerating ? 'Regenerating…' : 'Regenerate invite code'}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Member List Panel */}
      <section className="panel" aria-labelledby="member-list-heading">
        <div className="panel-head">
          <div>
            <h2 id="member-list-heading">Workspace members ({members.length})</h2>
            <p>
              Both owners and members can manage meters, update the billing rate,
              and save bills.
            </p>
          </div>
        </div>

        <div className="table-scroll members-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isMe = m.user_id === user?.id;
                const canRemove = isOwner && !isMe && m.role !== 'owner';
                const isConfirming = confirmRemoveUserId === m.user_id;

                return (
                  <tr key={m.user_id}>
                    <td>
                      <strong>{m.full_name}</strong>
                      {isMe ? ' (You)' : ''}
                    </td>
                    <td className="role-cell">{m.role}</td>
                    <td>{formatDateIN(m.joined_at)}</td>
                    <td className="actions-cell">
                      {canRemove ? (
                        isConfirming ? (
                          <div className="inline-confirm">
                            <span className="confirm-label">Remove {m.full_name}?</span>
                            <button
                              type="button"
                              className="btn danger btn-sm"
                              onClick={() => handleConfirmRemoveMember(m.user_id)}
                              disabled={removingUser}
                            >
                              {removingUser ? 'Removing…' : 'Confirm remove'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => setConfirmRemoveUserId(null)}
                              disabled={removingUser}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setConfirmRemoveUserId(m.user_id)}
                            aria-label={`Remove ${m.full_name}`}
                          >
                            Remove member
                          </button>
                        )
                      ) : (
                        <span className="muted-dash">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Owner-only Workspace Deletion */}
      {isOwner && (
        <section className="panel danger-zone" aria-labelledby="delete-ws-heading">
          <div className="panel-head">
            <div>
              <h2 id="delete-ws-heading">Delete workspace</h2>
              <p>
                Permanently delete "{activeWorkspace.name}" and all of its meters
                and saved bills. Only the workspace owner can perform this action.
              </p>
            </div>
          </div>
          <div className="panel-body">
            {confirmDeleteWs ? (
              <div className="inline-confirm">
                <span className="confirm-label">
                  Permanently delete "{activeWorkspace.name}"?
                </span>
                <button
                  type="button"
                  className="btn danger"
                  onClick={handleDeleteWorkspace}
                  disabled={deletingWs}
                >
                  {deletingWs ? 'Deleting workspace…' : 'Yes, delete workspace'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setConfirmDeleteWs(false)}
                  disabled={deletingWs}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn danger"
                onClick={() => setConfirmDeleteWs(true)}
              >
                <Icon name="trash" />
                <span>Delete workspace</span>
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
