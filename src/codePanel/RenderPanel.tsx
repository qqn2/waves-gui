import { WavedromPreview } from './WavedromPreview';
import { useDiagramCode } from './useDiagramCode';
import styles from './CodePanel.module.css';

export function RenderPanel() {
  const { previewCode, error } = useDiagramCode();

  return (
    <div className={styles.panel}>
      <div className={styles.renderBody}>
        <WavedromPreview code={previewCode} error={error} />
      </div>
    </div>
  );
}
