import {
  supabase,
  isSupabaseConfigured,
  readLocalDb,
  writeLocalDb,
  readLocalSession,
  generateUuid,
  generateInviteCode,
} from '../lib/supabaseClient.js';

export async function fetchUserWorkspaces(userId) {
  if (!userId) return [];

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(
        `
        role,
        joined_at,
        workspaces (
          id,
          name,
          rate_per_unit,
          invite_code,
          created_by,
          created_at
        )
      `
      )
      .eq('user_id', userId)
      .order('joined_at', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || [])
      .filter((row) => row.workspaces)
      .map((row) => ({
        ...row.workspaces,
        my_role: row.role,
        joined_at: row.joined_at,
      }));
  }

  const db = readLocalDb();
  const memberships = db.workspace_members.filter((wm) => wm.user_id === userId);
  return memberships
    .map((wm) => {
      const ws = db.workspaces.find((w) => w.id === wm.workspace_id);
      if (!ws) return null;
      return {
        ...ws,
        my_role: wm.role,
        joined_at: wm.joined_at,
      };
    })
    .filter(Boolean);
}

export async function createWorkspace({ name, ratePerUnit = null, userId }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) {
    throw new Error('Enter a workspace name (for example "Home" or "Flat 3B").');
  }

  let parsedRate = null;
  if (ratePerUnit !== null && ratePerUnit !== undefined && String(ratePerUnit).trim() !== '') {
    const r = Number(String(ratePerUnit).trim());
    if (!Number.isFinite(r) || r < 0) {
      throw new Error('Enter a valid non-negative per-unit rate.');
    }
    parsedRate = r;
  }

  if (isSupabaseConfigured) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        name: cleanName,
        rate_per_unit: parsedRate,
        invite_code: inviteCode,
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    // Ensure creator membership exists even if DB trigger wasn't run manually
    await supabase.from('workspace_members').upsert(
      {
        workspace_id: data.id,
        user_id: userId,
        role: 'owner',
      },
      { onConflict: 'workspace_id,user_id' }
    );

    // Create default first meter for the workspace
    await supabase.from('meters').insert({
      workspace_id: data.id,
      name: 'Room 1',
      initial_reading: 0,
      sort_order: 1,
      is_active: true,
    });

    return {
      ...data,
      my_role: 'owner',
    };
  }

  const db = readLocalDb();
  const now = new Date().toISOString();
  const newWorkspace = {
    id: generateUuid(),
    name: cleanName,
    rate_per_unit: parsedRate,
    invite_code: generateInviteCode(),
    created_by: userId,
    created_at: now,
  };

  db.workspaces.push(newWorkspace);
  db.workspace_members.push({
    workspace_id: newWorkspace.id,
    user_id: userId,
    role: 'owner',
    joined_at: now,
  });
  db.meters.push({
    id: generateUuid(),
    workspace_id: newWorkspace.id,
    name: 'Room 1',
    initial_reading: null,
    sort_order: 1,
    is_active: true,
    created_at: now,
  });

  writeLocalDb(db, {
    table: 'workspaces',
    type: 'INSERT',
    workspace_id: newWorkspace.id,
  });

  return {
    ...newWorkspace,
    my_role: 'owner',
    joined_at: now,
  };
}

export async function joinWorkspaceByCode({ inviteCode, userId }) {
  const cleanCode = String(inviteCode || '').trim().toUpperCase();
  if (!cleanCode) {
    throw new Error('Enter an invite code to join a workspace.');
  }

  if (isSupabaseConfigured) {
    const { data: workspaceId, error } = await supabase.rpc('join_workspace', {
      p_invite_code: cleanCode,
    });
    if (error) throw new Error(error.message);

    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (wsErr) throw new Error(wsErr.message);
    return ws;
  }

  const db = readLocalDb();
  const ws = db.workspaces.find(
    (w) => String(w.invite_code || '').toUpperCase() === cleanCode
  );
  if (!ws) {
    throw new Error('Invalid invite code. Please check the code and try again.');
  }

  const existing = db.workspace_members.find(
    (wm) => wm.workspace_id === ws.id && wm.user_id === userId
  );

  const now = new Date().toISOString();
  if (!existing) {
    db.workspace_members.push({
      workspace_id: ws.id,
      user_id: userId,
      role: 'member',
      joined_at: now,
    });
    writeLocalDb(db, {
      table: 'workspace_members',
      type: 'INSERT',
      workspace_id: ws.id,
    });
  }

  return {
    ...ws,
    my_role: existing ? existing.role : 'member',
  };
}

export async function updateWorkspaceRate({ workspaceId, ratePerUnit }) {
  const str = String(ratePerUnit ?? '').trim();
  let numericRate = null;
  if (str !== '') {
    const n = Number(str);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error('Enter a valid non-negative per-unit rate.');
    }
    numericRate = n;
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('workspaces')
      .update({ rate_per_unit: numericRate })
      .eq('id', workspaceId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  const idx = db.workspaces.findIndex((w) => w.id === workspaceId);
  if (idx === -1) throw new Error('Workspace not found.');

  db.workspaces[idx] = {
    ...db.workspaces[idx],
    rate_per_unit: numericRate,
  };

  writeLocalDb(db, {
    table: 'workspaces',
    type: 'UPDATE',
    workspace_id: workspaceId,
  });

  return db.workspaces[idx];
}

export async function regenerateWorkspaceInviteCode({ workspaceId, userId }) {
  if (isSupabaseConfigured) {
    const { data: newCode, error } = await supabase.rpc('regenerate_invite_code', {
      p_workspace_id: workspaceId,
    });
    if (error) throw new Error(error.message);
    return newCode;
  }

  const db = readLocalDb();
  const member = db.workspace_members.find(
    (wm) => wm.workspace_id === workspaceId && wm.user_id === userId
  );
  if (!member || member.role !== 'owner') {
    throw new Error('Only the workspace owner can regenerate the invite code.');
  }

  const idx = db.workspaces.findIndex((w) => w.id === workspaceId);
  if (idx === -1) throw new Error('Workspace not found.');

  const newCode = generateInviteCode();
  db.workspaces[idx] = {
    ...db.workspaces[idx],
    invite_code: newCode,
  };

  writeLocalDb(db, {
    table: 'workspaces',
    type: 'UPDATE',
    workspace_id: workspaceId,
  });

  return newCode;
}

export async function fetchWorkspaceMembers(workspaceId) {
  if (!workspaceId) return [];

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('workspace_members')
      .select(
        `
        workspace_id,
        user_id,
        role,
        joined_at,
        profiles (
          id,
          full_name
        )
      `
      )
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map((row) => ({
      workspace_id: row.workspace_id,
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at,
      full_name: row.profiles?.full_name || 'Member',
    }));
  }

  const db = readLocalDb();
  const session = readLocalSession();
  return db.workspace_members
    .filter((wm) => wm.workspace_id === workspaceId)
    .map((wm) => {
      const profile = db.profiles.find((p) => p.id === wm.user_id);
      const userObj = db.users.find((u) => u.id === wm.user_id);
      const fallbackName =
        wm.user_id === session?.id ? session.full_name : 'Workspace Member';
      return {
        ...wm,
        full_name: profile?.full_name || userObj?.full_name || fallbackName,
        email: userObj?.email || (wm.user_id === session?.id ? session.email : ''),
      };
    });
}

export async function removeWorkspaceMember({ workspaceId, targetUserId, requesterId }) {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId);

    if (error) throw new Error(error.message);
    return;
  }

  const db = readLocalDb();
  const requester = db.workspace_members.find(
    (wm) => wm.workspace_id === workspaceId && wm.user_id === requesterId
  );
  if (!requester || (requester.role !== 'owner' && requesterId !== targetUserId)) {
    throw new Error('Only the workspace owner can remove members.');
  }

  const target = db.workspace_members.find(
    (wm) => wm.workspace_id === workspaceId && wm.user_id === targetUserId
  );
  if (target?.role === 'owner' && requesterId === targetUserId) {
    throw new Error('The owner cannot remove themselves. Delete the workspace instead.');
  }

  db.workspace_members = db.workspace_members.filter(
    (wm) => !(wm.workspace_id === workspaceId && wm.user_id === targetUserId)
  );

  writeLocalDb(db, {
    table: 'workspace_members',
    type: 'DELETE',
    workspace_id: workspaceId,
  });
}

export async function deleteWorkspace({ workspaceId, requesterId }) {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);

    if (error) throw new Error(error.message);
    return;
  }

  const db = readLocalDb();
  const requester = db.workspace_members.find(
    (wm) => wm.workspace_id === workspaceId && wm.user_id === requesterId
  );
  if (!requester || requester.role !== 'owner') {
    throw new Error('Only the workspace owner can delete the workspace.');
  }

  const billIds = new Set(
    db.bills.filter((b) => b.workspace_id === workspaceId).map((b) => b.id)
  );

  db.workspaces = db.workspaces.filter((w) => w.id !== workspaceId);
  db.workspace_members = db.workspace_members.filter(
    (wm) => wm.workspace_id !== workspaceId
  );
  db.meters = db.meters.filter((m) => m.workspace_id !== workspaceId);
  db.bills = db.bills.filter((b) => b.workspace_id !== workspaceId);
  db.bill_items = db.bill_items.filter((bi) => !billIds.has(bi.bill_id));

  writeLocalDb(db, {
    table: 'workspaces',
    type: 'DELETE',
    workspace_id: workspaceId,
  });
}
