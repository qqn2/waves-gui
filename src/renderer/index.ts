export { WaveformCanvas } from './WaveformCanvas';
export { EdgeOverlay } from './EdgeOverlay';
export { EdgeToolOverlay } from './EdgeToolOverlay';
export { PointerMarker } from './PointerMarker';
export type { WaveformCanvasProps, CanvasScrollSync } from './WaveformCanvas';
export { hitTest } from './hitTest';
export type { HitTestResult } from './hitTest';
export { buildRowLayout, totalContentHeight } from './rowLayout';
export type { RowLayoutEntry } from './rowLayout';
export {
  buildNodeIndex,
  parseEdge,
  parseEdgeString,
  parseEdgePath,
  parsePathEndpoints,
  resolveNodeAnchor,
  resolveEdgeAnchors,
} from './edgeLayout';
export type { NodeAnchor, ParsedEdge, CanvasAnchor } from './edgeLayout';
export { CanvasRenderer } from './CanvasRenderer';
export { renderHeadFoot, measureHeadFoot, buildStepLabels, getWaveformTopInsetPx } from './renderHeadFoot';
export type { HeadFootLayout } from './renderHeadFoot';
