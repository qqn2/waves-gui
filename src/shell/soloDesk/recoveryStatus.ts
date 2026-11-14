import { create } from 'zustand';

export interface RecoveryState {
  status: 'pending' | 'saved' | 'unavailable';
  savedAt: number | null;
  restored: boolean;
}

/** Browser recovery is separate from the document's confirmed disk savepoint. */
export const useRecoveryStatus = create<RecoveryState>(() => ({
  status: 'pending',
  savedAt: null,
  restored: false,
}));
