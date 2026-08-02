// React 19 emits actionable async-update warnings unless the test runtime
// explicitly opts into its act() environment contract.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
