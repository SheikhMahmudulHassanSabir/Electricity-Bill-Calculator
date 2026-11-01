import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchWorkspaceMetersWithLatest,
  createMeter,
  updateMeter,
  softDeleteMeter,
} from '../services/meterService.js';
import { useRealtime } from './useRealtime.js';

/**
 * Manages workspace meters and auto-fills each meter's Previous reading
 * from its latest saved bill (or its initial_reading if no bill is saved yet).
 */
export function useMeters(workspaceId) {
  const [meters, setMeters] = useState([]);
  const [loadingMeters, setLoadingMeters] = useState(false);
  const [meterError, setMeterError] = useState(null);
  const draftReadingsRef = useRef({});

  const buildMeterState = useCallback((dbMeter, existingDraft) => {
    const hasLatest =
      dbMeter.latest_reading !== null && dbMeter.latest_reading !== undefined;
    const hasInitial =
      dbMeter.initial_reading !== null &&
      dbMeter.initial_reading !== undefined &&
      dbMeter.initial_reading !== '';

    const defaultPrev = hasLatest
      ? String(dbMeter.latest_reading)
      : hasInitial
      ? String(dbMeter.initial_reading)
      : '';

    const autoFillDate = hasLatest ? dbMeter.latest_bill_date : null;
    const autoFillInitial = !hasLatest && hasInitial;

    if (existingDraft) {
      return {
        id: dbMeter.id,
        name: existingDraft.nameDirty ? existingDraft.name : dbMeter.name,
        prev: existingDraft.prevDirty ? existingDraft.prev : defaultPrev,
        cur: existingDraft.cur ?? '',
        initial_reading: dbMeter.initial_reading,
        latest_reading: dbMeter.latest_reading,
        latest_bill_date: autoFillDate,
        autoFillInitial,
        prevEdited: Boolean(existingDraft.prevDirty),
      };
    }

    return {
      id: dbMeter.id,
      name: dbMeter.name,
      prev: defaultPrev,
      cur: '',
      initial_reading: dbMeter.initial_reading,
      latest_reading: dbMeter.latest_reading,
      latest_bill_date: autoFillDate,
      autoFillInitial,
      prevEdited: false,
    };
  }, []);

  const loadMeters = useCallback(
    async (resetDrafts = false) => {
      if (!workspaceId) {
        setMeters([]);
        return;
      }

      if (resetDrafts) {
        draftReadingsRef.current = {};
      }

      setLoadingMeters(true);
      setMeterError(null);
      try {
        const rows = await fetchWorkspaceMetersWithLatest(workspaceId);
        const mapped = rows.map((row) =>
          buildMeterState(row, draftReadingsRef.current[row.id])
        );
        setMeters(mapped);
      } catch (err) {
        setMeterError(err.message || 'Could not load meters.');
      } finally {
        setLoadingMeters(false);
      }
    },
    [workspaceId, buildMeterState]
  );

  useEffect(() => {
    draftReadingsRef.current = {};
    loadMeters(true);
  }, [workspaceId, loadMeters]);

  useRealtime(
    workspaceId,
    ['meters', 'bills'],
    useCallback(() => {
      loadMeters(false);
    }, [loadMeters])
  );

  const addMeter = useCallback(
    async ({ name, initialReading = null } = {}) => {
      if (!workspaceId) return null;
      const nextNum = meters.length + 1;
      const meterName = name ? String(name).trim() : `Room ${nextNum}`;
      const created = await createMeter({
        workspaceId,
        name: meterName,
        initialReading,
        sortOrder: nextNum,
      });

      const stateItem = buildMeterState(created, null);
      setMeters((prev) => {
        if (prev.some((m) => m.id === stateItem.id)) return prev;
        return [...prev, stateItem];
      });
      return stateItem;
    },
    [workspaceId, meters.length, buildMeterState]
  );

  const updateLocalMeterField = useCallback((meterId, field, value) => {
    const prevDraft = draftReadingsRef.current[meterId] || {};
    draftReadingsRef.current[meterId] = {
      ...prevDraft,
      ...(field === 'name' ? { name: value, nameDirty: true } : {}),
      ...(field === 'prev' ? { prev: value, prevDirty: true } : {}),
      ...(field === 'cur' ? { cur: value } : {}),
    };

    setMeters((prev) =>
      prev.map((m) => {
        if (m.id !== meterId) return m;
        const next = { ...m, [field]: value };
        if (field === 'prev') {
          next.prevEdited = true;
        }
        return next;
      })
    );
  }, []);

  const persistMeterName = useCallback(async (meterId, name) => {
    const clean = String(name || '').trim() || 'Meter';
    await updateMeter({ meterId, name: clean });
    if (draftReadingsRef.current[meterId]) {
      draftReadingsRef.current[meterId].nameDirty = false;
    }
  }, []);

  const removeMeter = useCallback(
    async (meterId) => {
      if (meters.length <= 1) return null;
      const target = meters.find((m) => m.id === meterId);
      await softDeleteMeter(meterId);
      delete draftReadingsRef.current[meterId];
      setMeters((prev) => prev.filter((m) => m.id !== meterId));
      return target;
    },
    [meters]
  );

  const resetCalculatorReadings = useCallback(() => {
    draftReadingsRef.current = {};
    setMeters((prev) =>
      prev.map((m) => {
        const hasLatest =
          m.latest_reading !== null && m.latest_reading !== undefined;
        const hasInitial =
          m.initial_reading !== null &&
          m.initial_reading !== undefined &&
          m.initial_reading !== '';

        const autoPrev = hasLatest
          ? String(m.latest_reading)
          : hasInitial
          ? String(m.initial_reading)
          : '';

        return {
          ...m,
          prev: autoPrev,
          cur: '',
          prevEdited: false,
        };
      })
    );
  }, []);

  const applySavedBillReadings = useCallback((billDate, savedItems) => {
    const byMeter = new Map();
    (savedItems || []).forEach((item) => {
      if (item.meter_id) {
        byMeter.set(item.meter_id, Number(item.current_reading));
      }
    });

    draftReadingsRef.current = {};
    setMeters((prev) =>
      prev.map((m) => {
        if (!byMeter.has(m.id)) return { ...m, cur: '' };
        const nextPrev = byMeter.get(m.id);
        return {
          ...m,
          prev: String(nextPrev),
          cur: '',
          latest_reading: nextPrev,
          latest_bill_date: billDate,
          autoFillInitial: false,
          prevEdited: false,
        };
      })
    );
  }, []);

  return {
    meters,
    loadingMeters,
    meterError,
    addMeter,
    updateLocalMeterField,
    persistMeterName,
    removeMeter,
    resetCalculatorReadings,
    applySavedBillReadings,
    reloadMeters: loadMeters,
  };
}
