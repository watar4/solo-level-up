import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addSavingsEntry,
  deleteSavingsEntry,
  subscribeSavings,
} from '../lib/firestore';
import {
  entryHash,
  monthSpending,
  savingsTotal,
  thisMonthKey,
  type ParsedRow,
} from '../lib/savings';
import type { SavingsEntry, SavingsSource } from '../types';

export interface ImportResult {
  imported: number;
  duplicates: number;
}

export interface SavingsData {
  entries: SavingsEntry[];
  loading: boolean;
  // Real-yen aggregates (NOT game currency).
  total: number;              // lifetime saving balance (deposits − withdrawals)
  thisMonthSaved: number;     // saving delta for the current month
  thisMonthSpent: number;     // card spending for the current month
  addEntry: (args: {
    date: string;
    amount: number;
    kind: 'saving' | 'spending';
    memo: string;
    source?: SavingsSource;
  }) => Promise<SavingsEntry | null>;
  removeEntry: (id: string) => Promise<void>;
  // Batch-import parsed CSV rows; hash-dedups against existing entries and
  // within the batch. Returns how many landed vs. were skipped.
  importRows: (rows: ParsedRow[], source: SavingsSource) => Promise<ImportResult>;
}

export function useSavings(uid: string | null): SavingsData {
  const [entries, setEntries] = useState<SavingsEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeSavings(uid, (rows) => {
      setEntries(rows);
      setLoading(false);
    });
  }, [uid]);

  const addEntry = useCallback(
    async (args: {
      date: string;
      amount: number;
      kind: 'saving' | 'spending';
      memo: string;
      source?: SavingsSource;
    }): Promise<SavingsEntry | null> => {
      if (!uid) return null;
      const partial: Omit<SavingsEntry, 'id'> = {
        uid,
        date: args.date,
        amount: Math.round(args.amount),
        kind: args.kind,
        memo: args.memo.trim(),
        source: args.source ?? 'manual',
        createdAt: Date.now(),
      };
      const id = await addSavingsEntry(partial);
      return { ...partial, id };
    },
    [uid]
  );

  const removeEntry = useCallback(async (id: string): Promise<void> => {
    await deleteSavingsEntry(id);
  }, []);

  const importRows = useCallback(
    async (rows: ParsedRow[], source: SavingsSource): Promise<ImportResult> => {
      if (!uid) return { imported: 0, duplicates: 0 };
      const existing = new Set(entries.map((e) => e.hash).filter(Boolean) as string[]);
      let imported = 0;
      let duplicates = 0;
      const now = Date.now();
      // Sequential writes keep row order stable in createdAt; statement files
      // are small (tens of rows) so latency is fine.
      for (const row of rows) {
        const hash = entryHash(row);
        if (existing.has(hash)) {
          duplicates++;
          continue;
        }
        existing.add(hash);
        await addSavingsEntry({
          uid,
          date: row.date,
          amount: Math.round(row.amount),
          kind: row.kind,
          memo: row.memo,
          source,
          hash,
          createdAt: now + imported, // keep import order on equal dates
        });
        imported++;
      }
      return { imported, duplicates };
    },
    [uid, entries]
  );

  const total = useMemo(() => savingsTotal(entries), [entries]);
  const month = thisMonthKey();
  const thisMonthSaved = useMemo(
    () =>
      entries
        .filter((e) => e.kind === 'saving' && e.date.slice(0, 7) === month)
        .reduce((sum, e) => sum + e.amount, 0),
    [entries, month]
  );
  const thisMonthSpent = useMemo(() => monthSpending(entries, month), [entries, month]);

  return {
    entries,
    loading,
    total,
    thisMonthSaved,
    thisMonthSpent,
    addEntry,
    removeEntry,
    importRows,
  };
}
