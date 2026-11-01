import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import {
  fetchUserWorkspaces,
  createWorkspace,
  joinWorkspaceByCode,
  updateWorkspaceRate,
  regenerateWorkspaceInviteCode,
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  deleteWorkspace,
} from '../services/workspaceService.js';
import { useRealtime } from '../hooks/useRealtime.js';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [workspaceError, setWorkspaceError] = useState(null);

  const storageKey = user ? `ebc_active_ws_${user.id}` : null;

  const refreshWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      setMembers([]);
      return [];
    }

    setLoadingWorkspaces(true);
    setWorkspaceError(null);
    try {
      const list = await fetchUserWorkspaces(user.id);
      setWorkspaces(list);

      const savedId =
        typeof window !== 'undefined' && storageKey
          ? window.localStorage.getItem(storageKey)
          : null;

      setActiveWorkspaceId((prevId) => {
        const candidate = prevId || savedId;
        if (candidate && list.some((w) => w.id === candidate)) {
          return candidate;
        }
        const firstId = list[0]?.id || null;
        if (typeof window !== 'undefined' && storageKey) {
          if (firstId) window.localStorage.setItem(storageKey, firstId);
          else window.localStorage.removeItem(storageKey);
        }
        return firstId;
      });

      return list;
    } catch (err) {
      setWorkspaceError(err.message || 'Could not load workspaces.');
      return [];
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [user, storageKey]);

  const refreshMembers = useCallback(async (wsId) => {
    const targetId = wsId || activeWorkspaceId;
    if (!targetId) {
      setMembers([]);
      return;
    }
    try {
      const mList = await fetchWorkspaceMembers(targetId);
      setMembers(mList);
    } catch {
      // Keep existing list on transient error
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    refreshWorkspaces();
  }, [refreshWorkspaces]);

  useEffect(() => {
    if (activeWorkspaceId) {
      refreshMembers(activeWorkspaceId);
    } else {
      setMembers([]);
    }
  }, [activeWorkspaceId, refreshMembers]);

  useRealtime(
    activeWorkspaceId,
    ['workspaces', 'workspace_members'],
    useCallback(() => {
      refreshWorkspaces();
      if (activeWorkspaceId) {
        refreshMembers(activeWorkspaceId);
      }
    }, [refreshWorkspaces, refreshMembers, activeWorkspaceId])
  );

  const selectWorkspace = useCallback(
    (workspaceId) => {
      setActiveWorkspaceId(workspaceId);
      if (typeof window !== 'undefined' && storageKey) {
        if (workspaceId) window.localStorage.setItem(storageKey, workspaceId);
        else window.localStorage.removeItem(storageKey);
      }
    },
    [storageKey]
  );

  const createNewWorkspace = useCallback(
    async ({ name, ratePerUnit = null }) => {
      if (!user) throw new Error('You must be logged in.');
      const created = await createWorkspace({
        name,
        ratePerUnit,
        userId: user.id,
      });
      await refreshWorkspaces();
      selectWorkspace(created.id);
      return created;
    },
    [user, refreshWorkspaces, selectWorkspace]
  );

  const joinByInviteCode = useCallback(
    async (inviteCode) => {
      if (!user) throw new Error('You must be logged in.');
      const joined = await joinWorkspaceByCode({
        inviteCode,
        userId: user.id,
      });
      await refreshWorkspaces();
      selectWorkspace(joined.id);
      return joined;
    },
    [user, refreshWorkspaces, selectWorkspace]
  );

  const saveWorkspaceRate = useCallback(
    async (ratePerUnit) => {
      if (!activeWorkspaceId) return null;
      const updated = await updateWorkspaceRate({
        workspaceId: activeWorkspaceId,
        ratePerUnit,
      });
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === activeWorkspaceId
            ? { ...w, rate_per_unit: updated.rate_per_unit }
            : w
        )
      );
      return updated;
    },
    [activeWorkspaceId]
  );

  const regenerateInviteCode = useCallback(async () => {
    if (!activeWorkspaceId || !user) return null;
    const newCode = await regenerateWorkspaceInviteCode({
      workspaceId: activeWorkspaceId,
      userId: user.id,
    });
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === activeWorkspaceId ? { ...w, invite_code: newCode } : w
      )
    );
    return newCode;
  }, [activeWorkspaceId, user]);

  const removeMember = useCallback(
    async (targetUserId) => {
      if (!activeWorkspaceId || !user) return;
      await removeWorkspaceMember({
        workspaceId: activeWorkspaceId,
        targetUserId,
        requesterId: user.id,
      });
      await refreshMembers(activeWorkspaceId);
    },
    [activeWorkspaceId, user, refreshMembers]
  );

  const removeActiveWorkspace = useCallback(async () => {
    if (!activeWorkspaceId || !user) return;
    const deletingId = activeWorkspaceId;
    await deleteWorkspace({
      workspaceId: deletingId,
      requesterId: user.id,
    });
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.removeItem(storageKey);
    }
    setActiveWorkspaceId(null);
    await refreshWorkspaces();
  }, [activeWorkspaceId, user, storageKey, refreshWorkspaces]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeWorkspaceId,
        members,
        loadingWorkspaces,
        workspaceError,
        selectWorkspace,
        createNewWorkspace,
        joinByInviteCode,
        saveWorkspaceRate,
        regenerateInviteCode,
        removeMember,
        removeActiveWorkspace,
        refreshWorkspaces,
        refreshMembers,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
