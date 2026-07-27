import { WavedromPreview } from './WavedromPreview';
import { useDiagramCode } from './useDiagramCode';
import styles from './CodePanel.module.css';

export function RenderPanel() {
  const { previewCode, format, error } = useDiagramCode();

  return (
    <div className={styles.panel}>
      <div className={styles.renderBody}>
        <WavedromPreview code={previewCode} format={format} error={error} />
      </div>
    </div>
  );
}
