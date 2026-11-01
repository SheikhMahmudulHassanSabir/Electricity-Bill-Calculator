import {
  supabase,
  isSupabaseConfigured,
  readLocalDb,
  writeLocalDb,
  readLocalSession,
  generateUuid,
} from '../lib/supabaseClient.js';

export async function fetchWorkspaceBills(workspaceId) {
  if (!workspaceId) return [];

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('bills')
      .select(
        `
        id,
        workspace_id,
        bill_date,
        rate_per_unit,
        total_units,
        total_amount,
        created_by,
        created_at,
        profiles (
          id,
          full_name
        ),
        bill_items (
          id,
          bill_id,
          meter_id,
          meter_name,
          previous_reading,
          current_reading,
          units,
          amount
        )
      `
      )
      .eq('workspace_id', workspaceId)
      .order('bill_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map((row) => ({
      id: row.id,
      workspace_id: row.workspace_id,
      bill_date: row.bill_date,
      rate_per_unit: Number(row.rate_per_unit),
      total_units: Number(row.total_units),
      total_amount: Number(row.total_amount),
      created_by: row.created_by,
      created_by_name: row.profiles?.full_name || 'Member',
      created_at: row.created_at,
      items: (row.bill_items || []).map((item) => ({
        ...item,
        previous_reading: Number(item.previous_reading),
        current_reading: Number(item.current_reading),
        units: Number(item.units),
        amount: Number(item.amount),
      })),
    }));
  }

  const db = readLocalDb();
  const session = readLocalSession();

  const bills = db.bills
    .filter((b) => b.workspace_id === workspaceId)
    .sort((a, b) => {
      if (b.bill_date !== a.bill_date) {
        return String(b.bill_date).localeCompare(String(a.bill_date));
      }
      return String(b.created_at).localeCompare(String(a.created_at));
    });

  return bills.map((b) => {
    const profile = db.profiles.find((p) => p.id === b.created_by);
    const userObj = db.users.find((u) => u.id === b.created_by);
    const createdByName =
      b.created_by_name ||
      profile?.full_name ||
      userObj?.full_name ||
      (b.created_by === session?.id ? session.full_name : 'Member');

    const items = db.bill_items
      .filter((bi) => bi.bill_id === b.id)
      .map((item) => ({
        ...item,
        previous_reading: Number(item.previous_reading),
        current_reading: Number(item.current_reading),
        units: Number(item.units),
        amount: Number(item.amount),
      }));

    return {
      ...b,
      rate_per_unit: Number(b.rate_per_unit),
      total_units: Number(b.total_units),
      total_amount: Number(b.total_amount),
      created_by_name: createdByName,
      items,
    };
  });
}

export async function saveWorkspaceBill({
  workspaceId,
  billDate,
  ratePerUnit,
  totalUnits,
  totalAmount,
  userId,
  userName,
  items,
}) {
  if (!workspaceId) throw new Error('Select a workspace first.');
  if (!billDate) throw new Error('Select a bill date.');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Add at least one valid meter before saving.');
  }

  if (isSupabaseConfigured) {
    const { data: billRow, error: billErr } = await supabase
      .from('bills')
      .insert({
        workspace_id: workspaceId,
        bill_date: billDate,
        rate_per_unit: Number(ratePerUnit),
        total_units: Number(totalUnits),
        total_amount: Number(totalAmount),
        created_by: userId,
      })
      .select('*')
      .single();

    if (billErr) throw new Error(billErr.message);

    const payloadItems = items.map((item) => ({
      bill_id: billRow.id,
      meter_id: item.meter_id || null,
      meter_name: item.meter_name,
      previous_reading: Number(item.previous_reading),
      current_reading: Number(item.current_reading),
      units: Number(item.units),
      amount: Number(item.amount),
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from('bill_items')
      .insert(payloadItems)
      .select('*');

    if (itemsErr) throw new Error(itemsErr.message);

    return {
      ...billRow,
      created_by_name: userName || 'Member',
      items: insertedItems || [],
    };
  }

  const db = readLocalDb();
  const now = new Date().toISOString();
  const billId = generateUuid();

  const newBill = {
    id: billId,
    workspace_id: workspaceId,
    bill_date: billDate,
    rate_per_unit: Number(ratePerUnit),
    total_units: Number(totalUnits),
    total_amount: Number(totalAmount),
    created_by: userId,
    created_by_name: userName || 'Member',
    created_at: now,
  };

  const newItems = items.map((item) => ({
    id: generateUuid(),
    bill_id: billId,
    meter_id: item.meter_id || null,
    meter_name: item.meter_name,
    previous_reading: Number(item.previous_reading),
    current_reading: Number(item.current_reading),
    units: Number(item.units),
    amount: Number(item.amount),
  }));

  db.bills.push(newBill);
  db.bill_items.push(...newItems);

  writeLocalDb(db, {
    table: 'bills',
    type: 'INSERT',
    workspace_id: workspaceId,
  });

  return {
    ...newBill,
    items: newItems,
  };
}

export async function deleteWorkspaceBill({ billId, workspaceId }) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('bills').delete().eq('id', billId);
    if (error) throw new Error(error.message);
    return;
  }

  const db = readLocalDb();
  db.bills = db.bills.filter((b) => b.id !== billId);
  db.bill_items = db.bill_items.filter((bi) => bi.bill_id !== billId);

  writeLocalDb(db, {
    table: 'bills',
    type: 'DELETE',
    workspace_id: workspaceId,
  });
}
