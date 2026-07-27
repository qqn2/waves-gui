import { describe, expect, it } from 'vitest';
import { isReactDispatcherError } from './AppErrorBoundary';

describe('AppErrorBoundary recovery guidance', () => {
  it('recognizes Firefox and React invalid-hook dispatcher failures', () => {
    expect(isReactDispatcherError(
      new Error('can’t access property "useState", resolveDispatcher() is null'),
    )).toBe(true);
    expect(isReactDispatcherError(new Error('Invalid hook call.'))).toBe(true);
  });

  it('does not classify ordinary draft failures as React runtime failures', () => {
    expect(isReactDispatcherError(new Error('Invalid diagram data'))).toBe(false);
  });
});
