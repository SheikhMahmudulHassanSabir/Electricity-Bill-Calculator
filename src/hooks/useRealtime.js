import { useEffect, useRef } from 'react';
import {
  supabase,
  isSupabaseConfigured,
  subscribeLocalRealtime,
} from '../lib/supabaseClient.js';

/**
 * Subscribes to realtime database changes for the given workspaceId and tables.
 * Uses Supabase Realtime when VITE_SUPABASE_URL is configured, and falls back
 * to cross-tab BroadcastChannel + storage sync in local collaborative mode.
 */
export function useRealtime(workspaceId, tables, onUpdate) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  const tablesKey = Array.isArray(tables) ? tables.sort().join(',') : '*';

  useEffect(() => {
    if (!workspaceId) return undefined;
    const watchedTables = tablesKey === '*' ? null : tablesKey.split(',');

    if (isSupabaseConfigured && supabase) {
      const channel = supabase.channel(`workspace-${workspaceId}-${tablesKey}`);

      const registerTable = (table) => {
        const filterObj =
          table === 'workspaces'
            ? { event: '*', schema: 'public', table, filter: `id=eq.${workspaceId}` }
            : table === 'bill_items'
            ? { event: '*', schema: 'public', table }
            : {
                event: '*',
                schema: 'public',
                table,
                filter: `workspace_id=eq.${workspaceId}`,
              };

        channel.on('postgres_changes', filterObj, (payload) => {
          if (callbackRef.current) {
            callbackRef.current({ table, payload });
          }
        });
      };

      (watchedTables || ['workspaces', 'workspace_members', 'meters', 'bills']).forEach(
        registerTable
      );

      channel.subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const unsubscribe = subscribeLocalRealtime((event) => {
      if (!event) return;
      const matchesTable =
        !watchedTables || event.table === '*' || watchedTables.includes(event.table);
      const matchesWorkspace =
        !event.workspace_id || event.workspace_id === workspaceId;

      if (matchesTable && matchesWorkspace && callbackRef.current) {
        callbackRef.current(event);
      }
    });

    return unsubscribe;
  }, [workspaceId, tablesKey]);
}
