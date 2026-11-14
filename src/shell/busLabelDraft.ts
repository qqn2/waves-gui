let commitDraft: (() => boolean) | null = null;

/** Save snapshots must include an in-progress toolbar edit, even before blur. */
export function registerBusLabelDraftCommit(commit: () => boolean): () => void {
  commitDraft = commit;
  return () => {
    if (commitDraft === commit) commitDraft = null;
  };
}

export function commitPendingBusLabelDraft(): boolean {
  return commitDraft?.() ?? true;
}
