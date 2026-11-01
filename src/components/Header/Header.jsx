import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { Icon } from '../Icons/Icons.jsx';
import './Header.css';

export function Header() {
  const { user, logout } = useAuth();
  const { workspaces, activeWorkspaceId, selectWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const handleWorkspaceSwitch = (e) => {
    const val = e.target.value;
    if (val === '__manage__') {
      navigate('/workspaces');
      return;
    }
    selectWorkspace(val);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="top-header no-print">
      <div className="header-brand-zone">
        <NavLink to="/calculator" className="brand-link">
          <div className="brand-mark">
            <Icon name="zap" />
          </div>
          <span className="brand-title">Electricity Bill Calculator</span>
        </NavLink>
      </div>

      {user && (
        <nav className="header-nav" aria-label="Main navigation">
          <NavLink
            to="/calculator"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            Calculator
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            History
          </NavLink>
          <NavLink
            to="/members"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            Members
          </NavLink>
          <NavLink
            to="/workspaces"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            Workspaces
          </NavLink>
        </nav>
      )}

      {user && (
        <div className="header-actions">
          {workspaces.length > 0 && (
            <div className="ws-switcher">
              <label htmlFor="header-ws-select" className="sr-only">
                Active workspace
              </label>
              <select
                id="header-ws-select"
                aria-label="Switch workspace"
                value={activeWorkspaceId || ''}
                onChange={handleWorkspaceSwitch}
                className="ws-select"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
                <option value="__manage__">+ All Workspaces…</option>
              </select>
            </div>
          )}

          <span className="user-greeting" title={user.email}>
            {user.full_name}
          </span>

          <button
            type="button"
            className="btn ghost logout-btn"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <Icon name="logout" />
            <span>Log out</span>
          </button>
        </div>
      )}
    </header>
  );
}
