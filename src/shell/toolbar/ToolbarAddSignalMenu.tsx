import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PatternsMenu } from '../../patterns/PatternsMenu';
import styles from '../shell.module.css';

export interface ToolbarAddSignalMenuProps {
  onAddBit: () => void;
  onAddBus: () => void;
  onAddSpacer: () => void;
  onAddGroup: () => void;
  onCloseOtherMenus: () => void;
}

export function ToolbarAddSignalMenu({
  onAddBit,
  onAddBus,
  onAddSpacer,
  onAddGroup,
  onCloseOtherMenus,
}: ToolbarAddSignalMenuProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [patternsOpen, setPatternsOpen] = useState(false);

  return (
    <div className={styles.addWrap}>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => {
          setAddOpen((o) => !o);
          onCloseOtherMenus();
        }}
      >
        <Plus size={15} /> Signal
      </button>
      {addOpen && (
        <div className={styles.dropdown}>
          <button type="button" onClick={() => { onAddBit(); setAddOpen(false); }}>
            Bit
          </button>
          <button
            type="button"
            title="Vector / bus lane — paint spans with the paint tool"
            onClick={() => {
              onAddBus();
              setAddOpen(false);
            }}
          >
            Bus
          </button>
          <button type="button" onClick={() => { onAddSpacer(); setAddOpen(false); }}>
            Blank
          </button>
          <button
            type="button"
            onClick={() => {
              onAddGroup();
              setAddOpen(false);
            }}
          >
            Section
          </button>
          <button
            type="button"
            onClick={() => {
              setAddOpen(false);
              setPatternsOpen(true);
            }}
          >
            Pattern…
          </button>
        </div>
      )}
      {patternsOpen && (
        <div className={styles.patternsPopover}>
          <PatternsMenu
            onClose={() => setPatternsOpen(false)}
            onInserted={() => setPatternsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
