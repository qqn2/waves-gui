import { lazy, Suspense, type ReactNode } from 'react';
import type { DockPanelLayout, SidePanelId } from './codePanelLayout';
import { CodePanelChrome } from './CodePanelChrome';
import styles from './shell.module.css';

export interface DockPanelProps {
  panelId: SidePanelId;
  layout: DockPanelLayout;
  onLayoutChange: (patch: Partial<DockPanelLayout>) => void;
  children?: ReactNode;
  stackAxis?: 'x' | 'y';
  canMoveTowardCanvas?: boolean;
  canMoveAwayFromCanvas?: boolean;
  onMoveTowardCanvas?: () => void;
  onMoveAwayFromCanvas?: () => void;
}

const PANEL_TITLES: Record<SidePanelId, string> = {
  json: 'JSON',
  render: 'Render',
};

const CodePanel = lazy(() =>
  import('../codePanel/CodePanel').then((module) => ({ default: module.CodePanel })),
);
const RenderPanel = lazy(() =>
  import('../codePanel/RenderPanel').then((module) => ({ default: module.RenderPanel })),
);

export function DockPanel({
  panelId,
  layout,
  onLayoutChange,
  children,
  stackAxis,
  canMoveTowardCanvas,
  canMoveAwayFromCanvas,
  onMoveTowardCanvas,
  onMoveAwayFromCanvas,
}: DockPanelProps) {
  const body = children ?? (
    <Suspense fallback={<div className={styles.panelLoading}>Loading panel…</div>}>
      {panelId === 'json' ? <CodePanel /> : <RenderPanel />}
    </Suspense>
  );

  return (
    <div className={styles.codePanelStack}>
      <CodePanelChrome
        title={PANEL_TITLES[panelId]}
        layout={layout}
        onPlacementChange={(placement) => onLayoutChange({ placement })}
        stackAxis={stackAxis}
        canMoveTowardCanvas={canMoveTowardCanvas}
        canMoveAwayFromCanvas={canMoveAwayFromCanvas}
        onMoveTowardCanvas={onMoveTowardCanvas}
        onMoveAwayFromCanvas={onMoveAwayFromCanvas}
      />
      <div className={styles.codePanelBody}>{body}</div>
    </div>
  );
}
