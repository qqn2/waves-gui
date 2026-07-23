import { useStore } from '../shared/store';
import styles from './shell.module.css';

export function ExtensionsModeToggle() {
  const enabled = useStore(
    (state) => state.diagram.compatibility?.extensionsEnabled === true,
  );
  const setExtensionsEnabled = useStore((state) => state.setExtensionsEnabled);

  return (
    <label
      className={`${styles.extensionsMode} ${enabled ? styles.extensionsModeActive : ''}`}
      title="Enable additive Undulate-compatible document features"
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => setExtensionsEnabled(event.target.checked)}
        aria-label="Undulate extensions"
      />
      <span>Undulate</span>
    </label>
  );
}
