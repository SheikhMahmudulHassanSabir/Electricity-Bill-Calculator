import { useState, useEffect, useCallback } from 'react';
import {
  fetchWorkspaceBills,
  saveWorkspaceBill,
  deleteWorkspaceBill,
} from '../services/billService.js';
import { useRealtime } from './useRealtime.js';

export function useBills(workspaceId) {
  const [bills, setBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [billError, setBillError] = useState(null);

  const loadBills = useCallback(async () => {
    if (!workspaceId) {
      setBills([]);
      return;
    }

    setLoadingBills(true);
    setBillError(null);
    try {
      const data = await fetchWorkspaceBills(workspaceId);
      setBills(data);
    } catch (err) {
      setBillError(err.message || 'Could not load saved bills.');
    } finally {
      setLoadingBills(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  useRealtime(
    workspaceId,
    ['bills', 'bill_items'],
    useCallback(() => {
      loadBills();
    }, [loadBills])
  );

  const saveBill = useCallback(
    async ({
      billDate,
      ratePerUnit,
      totalUnits,
      totalAmount,
      userId,
      userName,
      items,
    }) => {
      const saved = await saveWorkspaceBill({
        workspaceId,
        billDate,
        ratePerUnit,
        totalUnits,
        totalAmount,
        userId,
        userName,
        items,
      });
      await loadBills();
      return saved;
    },
    [workspaceId, loadBills]
  );

  const deleteBill = useCallback(
    async (billId) => {
      await deleteWorkspaceBill({ billId, workspaceId });
      setBills((prev) => prev.filter((b) => b.id !== billId));
    },
    [workspaceId]
  );

  // Latest saved bill date across the workspace (for date warning check)
  const latestBillDate = bills.length > 0 ? bills[0].bill_date : null;

  return {
    bills,
    latestBillDate,
    loadingBills,
    billError,
    saveBill,
    deleteBill,
    refreshBills: loadBills,
  };
}
