import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SAMPLE_LIBRARY, type SampleFolder, type SampleTreeNode } from '../samples';

import styles from '../shell.module.css';



export interface SampleLibraryMenuProps {

  onPick: (sampleId: string) => void;

}



const FLYOUT_CLOSE_MS = 200;



function useHoverFlyout() {

  const rowRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);

  const [rect, setRect] = useState<DOMRect | null>(null);

  const closeTimerRef = useRef<number | null>(null);



  const cancelClose = useCallback(() => {

    if (closeTimerRef.current !== null) {

      window.clearTimeout(closeTimerRef.current);

      closeTimerRef.current = null;

    }

  }, []);



  const openFlyout = useCallback(() => {

    cancelClose();

    const r = rowRef.current?.getBoundingClientRect();

    if (!r) return;

    setRect(r);

    setOpen(true);

  }, [cancelClose]);



  const scheduleClose = useCallback(() => {

    cancelClose();

    closeTimerRef.current = window.setTimeout(() => {

      setOpen(false);

      closeTimerRef.current = null;

    }, FLYOUT_CLOSE_MS);

  }, [cancelClose]);



  useEffect(() => () => cancelClose(), [cancelClose]);



  return { rowRef, open, rect, openFlyout, scheduleClose, cancelClose };

}



function SampleLeafButton({

  title,

  description,

  depth,

  onPick,

}: {

  title: string;

  description: string;

  depth: number;

  onPick: () => void;

}) {

  return (

    <button

      type="button"

      className={styles.sampleFlyoutBtn}

      style={{ paddingLeft: `${12 + depth * 12}px` }}

      title={description}

      onClick={onPick}

    >

      {title}

    </button>

  );

}



function SampleFlyoutPanel({

  rect,

  open,

  onPick,

  nodes,

  depth,

  onHoverEnter,

  onHoverLeave,

}: {

  rect: DOMRect | null;

  open: boolean;

  onPick: (sampleId: string) => void;

  nodes: SampleTreeNode[];

  depth: number;

  onHoverEnter: () => void;

  onHoverLeave: () => void;

}) {

  if (!open || !rect) return null;



  return createPortal(

    <div

      className={styles.sampleFlyout}

      style={{ top: rect.top, left: rect.right - 4 }}

      onMouseEnter={onHoverEnter}

      onMouseLeave={onHoverLeave}

    >

      <SampleFlyoutContent nodes={nodes} onPick={onPick} depth={depth} />

    </div>,

    document.body,

  );

}



function SampleFlyoutContent({

  nodes,

  onPick,

  depth,

}: {

  nodes: SampleTreeNode[];

  onPick: (sampleId: string) => void;

  depth: number;

}) {

  return (

    <>

      {nodes.map((node, index) => {

        if (node.kind === 'sample') {

          return (

            <SampleLeafButton

              key={node.id}

              title={node.title}

              description={node.description}

              depth={depth}

              onPick={() => onPick(node.id)}

            />

          );

        }

        return (

          <SampleFolderFlyoutItem

            key={`${node.label}-${index}`}

            folder={node}

            onPick={onPick}

            depth={depth}

          />

        );

      })}

    </>

  );

}



function SampleFolderFlyoutItem({

  folder,

  onPick,

  depth,

}: {

  folder: SampleFolder;

  onPick: (sampleId: string) => void;

  depth: number;

}) {

  const { rowRef, open, rect, openFlyout, scheduleClose, cancelClose } = useHoverFlyout();



  return (

    <>

      <div

        ref={rowRef}

        className={styles.sampleFlyoutFolder}

        style={{ paddingLeft: `${12 + depth * 12}px` }}

        onMouseEnter={openFlyout}

        onMouseLeave={scheduleClose}

      >

        <span>{folder.label}</span>

        <span className={styles.sampleFolderChevron} aria-hidden>

          ▸

        </span>

      </div>

      <SampleFlyoutPanel

        rect={rect}

        open={open}

        nodes={folder.children}

        onPick={onPick}

        depth={depth + 1}

        onHoverEnter={cancelClose}

        onHoverLeave={scheduleClose}

      />

    </>

  );

}



function TopLevelSampleFolder({

  folder,

  onPick,

}: {

  folder: SampleFolder;

  onPick: (sampleId: string) => void;

}) {

  const { rowRef, open, rect, openFlyout, scheduleClose, cancelClose } = useHoverFlyout();



  return (

    <>

      <div

        ref={rowRef}

        className={styles.sampleFolderRow}

        onMouseEnter={openFlyout}

        onMouseLeave={scheduleClose}

      >

        <span>{folder.label}</span>

        <span className={styles.sampleFolderChevron} aria-hidden>

          ▸

        </span>

      </div>

      <SampleFlyoutPanel

        rect={rect}

        open={open}

        nodes={folder.children}

        onPick={onPick}

        depth={0}

        onHoverEnter={cancelClose}

        onHoverLeave={scheduleClose}

      />

    </>

  );

}



export function SampleLibraryMenu({ onPick }: SampleLibraryMenuProps) {

  return (

    <>

      <div className={styles.menuSubheading}>Samples</div>

      {SAMPLE_LIBRARY.map((node, index) => {

        if (node.kind === 'sample') {

          return (

            <button

              key={node.id}

              type="button"

              title={node.description}

              onClick={() => onPick(node.id)}

            >

              {node.title}

            </button>

          );

        }

        return (

          <TopLevelSampleFolder key={`${node.label}-${index}`} folder={node} onPick={onPick} />

        );

      })}

    </>

  );

}
