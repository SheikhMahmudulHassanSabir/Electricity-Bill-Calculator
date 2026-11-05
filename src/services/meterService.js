import {
  supabase,
  hasActiveSupabaseSession,
  readLocalDb,
  writeLocalDb,
  generateUuid,
} from '../lib/supabaseClient.js';

/**
 * Fetches active meters for a workspace along with their latest saved reading
 * (used for auto-filling Previous reading).
 */
export async function fetchWorkspaceMetersWithLatest(workspaceId) {
  if (!workspaceId) return [];

  if (await hasActiveSupabaseSession()) {
    const { data: meters, error: mErr } = await supabase
      .from('meters')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (mErr) throw new Error(mErr.message);

    const { data: latestRows, error: lErr } = await supabase
      .from('meter_latest_readings')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (lErr) throw new Error(lErr.message);

    const latestByMeter = new Map();
    (latestRows || []).forEach((row) => {
      latestByMeter.set(row.meter_id, row);
    });

    return (meters || []).map((m) => {
      const latest = latestByMeter.get(m.id);
      return {
        ...m,
        initial_reading: Number(m.initial_reading ?? 0),
        latest_reading:
          latest && latest.latest_reading !== null && latest.latest_reading !== undefined
            ? Number(latest.latest_reading)
            : null,
        latest_bill_date: latest?.latest_bill_date || null,
      };
    });
  }

  const db = readLocalDb();
  const activeMeters = db.meters
    .filter((m) => m.workspace_id === workspaceId && m.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Compute latest reading per meter from saved bills ordered by bill_date DESC, created_at DESC
  const workspaceBills = db.bills
    .filter((b) => b.workspace_id === workspaceId)
    .sort((a, b) => {
      if (b.bill_date !== a.bill_date) {
        return String(b.bill_date).localeCompare(String(a.bill_date));
      }
      return String(b.created_at).localeCompare(String(a.created_at));
    });

  const billMap = new Map(workspaceBills.map((b) => [b.id, b]));
  const latestByMeter = new Map();

  for (const bill of workspaceBills) {
    const items = db.bill_items.filter((bi) => bi.bill_id === bill.id);
    for (const item of items) {
      if (item.meter_id && !latestByMeter.has(item.meter_id)) {
        latestByMeter.set(item.meter_id, {
          meter_id: item.meter_id,
          latest_reading: Number(item.current_reading),
          latest_bill_date: billMap.get(item.bill_id)?.bill_date || null,
        });
      }
    }
  }

  return activeMeters.map((m) => {
    const latest = latestByMeter.get(m.id);
    return {
      ...m,
      initial_reading:
        m.initial_reading !== null && m.initial_reading !== undefined && m.initial_reading !== ''
          ? Number(m.initial_reading)
          : null,
      latest_reading: latest ? latest.latest_reading : null,
      latest_bill_date: latest ? latest.latest_bill_date : null,
    };
  });
}

export async function createMeter({
  workspaceId,
  name,
  initialReading = null,
  sortOrder = 0,
}) {
  const cleanName = String(name || '').trim() || 'Room 1';
  let parsedInitial = 0;
  let hasInitial = false;
  if (
    initialReading !== null &&
    initialReading !== undefined &&
    String(initialReading).trim() !== ''
  ) {
    const n = Number(String(initialReading).trim());
    if (!Number.isFinite(n) || n < 0) {
      throw new Error('Initial reading must be a non-negative number.');
    }
    parsedInitial = n;
    hasInitial = true;
  }

  if (await hasActiveSupabaseSession()) {
    const { data, error } = await supabase
      .from('meters')
      .insert({
        workspace_id: workspaceId,
        name: cleanName,
        initial_reading: parsedInitial,
        sort_order: sortOrder,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return {
      ...data,
      initial_reading: hasInitial ? Number(data.initial_reading) : null,
      latest_reading: null,
      latest_bill_date: null,
    };
  }

  const db = readLocalDb();
  const now = new Date().toISOString();
  const newMeter = {
    id: generateUuid(),
    workspace_id: workspaceId,
    name: cleanName,
    initial_reading: hasInitial ? parsedInitial : null,
    sort_order: sortOrder,
    is_active: true,
    created_at: now,
  };

  db.meters.push(newMeter);
  writeLocalDb(db, {
    table: 'meters',
    type: 'INSERT',
    workspace_id: workspaceId,
  });

  return {
    ...newMeter,
    latest_reading: null,
    latest_bill_date: null,
  };
}

export async function updateMeter({ meterId, name, initialReading }) {
  const updates = {};
  if (name !== undefined) {
    updates.name = String(name || '').trim() || 'Meter';
  }
  if (initialReading !== undefined) {
    const str = String(initialReading ?? '').trim();
    if (str === '') {
      updates.initial_reading = 0;
    } else {
      const n = Number(str);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error('Initial reading must be a non-negative number.');
      }
      updates.initial_reading = n;
    }
  }

  if (await hasActiveSupabaseSession()) {
    const { data, error } = await supabase
      .from('meters')
      .update(updates)
      .eq('id', meterId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  const idx = db.meters.findIndex((m) => m.id === meterId);
  if (idx === -1) throw new Error('Meter not found.');

  db.meters[idx] = {
    ...db.meters[idx],
    ...updates,
  };

  writeLocalDb(db, {
    table: 'meters',
    type: 'UPDATE',
    workspace_id: db.meters[idx].workspace_id,
  });

  return db.meters[idx];
}

/**
 * Soft-deletes a meter by setting is_active = false so saved bill history remains intact.
 */
export async function softDeleteMeter(meterId) {
  if (await hasActiveSupabaseSession()) {
    const { data, error } = await supabase
      .from('meters')
      .update({ is_active: false })
      .eq('id', meterId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const db = readLocalDb();
  const idx = db.meters.findIndex((m) => m.id === meterId);
  if (idx === -1) throw new Error('Meter not found.');

  db.meters[idx] = {
    ...db.meters[idx],
    is_active: false,
  };

  writeLocalDb(db, {
    table: 'meters',
    type: 'DELETE',
    workspace_id: db.meters[idx].workspace_id,
  });

  return db.meters[idx];
}
