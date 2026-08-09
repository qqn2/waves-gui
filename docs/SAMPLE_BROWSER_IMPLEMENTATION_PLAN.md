# Sample Browser Phase 1 Status and Content Handoff

## Status

The Phase 1 browser foundation is implemented. This document is now a concise
record of the shipped architecture and the rules for continuing content work;
it is no longer an implementation checklist.

The active work is expanding and reviewing the template library. See
[`SAMPLE_BROWSER_PHASE_2_FULL_CATALOG.md`](./SAMPLE_BROWSER_PHASE_2_FULL_CATALOG.md)
for the catalog rollout, protocol inventory, and future metadata model.

## What is implemented

- A single `Browse samples...` modal replaces the nested sample flyout.
- The browser works with keyboard input and narrow layouts.
- Search, top-level categories, subcategories, result counts, empty states,
  and inline preview errors are available.
- The current catalog contains 37 stable entries across Fundamentals, AMBA,
  Undulate workflows, and compatibility fixtures.
- Selecting a result loads only that asset for preview. Preview requests are
  abortable and cached with a bounded six-entry LRU cache.
- Preview rendering is isolated from the open editor document.
- `Edit copy...` uses the existing dirty-document confirmation and opens a
  writable copy without reusing the bundled asset's file handle.
- Light and dark preview thumbnails are generated from the bundled assets.

## Current source of truth

| Area | Source |
| --- | --- |
| Sample tree and stable IDs | `src/shell/samples.ts` |
| Catalog categories and filtering | `src/sampleLibrary/catalog.ts` |
| Browser UI and responsive behavior | `src/sampleLibrary/SampleBrowser.tsx` |
| Preview loading, parsing, cancellation, and cache | `src/sampleLibrary/previewLoader.ts` |
| Source-format parsing options | `src/sampleLibrary/sampleSource.ts` |
| Waveform assets and generated thumbnails | `public/samples/` |
| Catalog and preview tests | `src/sampleLibrary/*.test.ts` |

The catalog is intentionally still a typed in-repository tree. A versioned
manifest and sharded metadata can be introduced when the library scale makes
that migration worthwhile; do not add a second catalog source in the meantime.

## Adding or updating a template

1. Add the source asset under `public/samples/` using a supported format.
2. Add one `SampleLeaf` in `src/shell/samples.ts` with a stable ID, concise
   title, accurate description, and explicit `format` when it is not JSON.
3. Use `support: 'future'` with a user-facing `supportNote` when an asset is
   intentionally retained before the parser can load it. Do not present it as
   an editable template.
4. Run `npm run samples:previews` to refresh light and dark thumbnails.
5. Extend catalog/content tests for IDs, paths, filtering, parsing, and any
   new source format.
6. Review the waveform and its explanation together before merging a content
   batch.

Keep IDs stable after publication. If an ID must change after local library
state exists, add an explicit migration or alias rather than silently renaming
it.

## Content rules for the population phase

Every template should have one primary teaching point or renderer feature. The
reviewer should be able to answer:

1. What rule, failure mode, or GUI capability does this demonstrate?
2. Which signal and time interval shows it?
3. Are the values and timing internally consistent?
4. Is the status accurately described as correct, incorrect, corner case, or
   conceptual?
5. Does the asset exercise a declared Waves GUI or Undulate feature?
6. Is the diagram understandable without excessive scrolling?

Protocol and standards references are context for the sample, not proof of
conformance. Incorrect or study-only entries must say what is wrong or what is
still modeled conceptually.

## Deferred work

These are deliberately outside the completed Phase 1 browser shell and belong
in the Phase 2 catalog plan:

- expanding the library beyond the current 37 entries;
- richer content metadata such as lifecycle status, difficulty, concepts,
  references, prerequisites, and correct/incorrect pairs;
- catalog sharding or a fetched versioned manifest;
- favorites, recents, related samples, and learning-path continuation;
- read-only lesson mode, assertions, quizzes, and progress tracking;
- virtualization or other performance work before profiling demonstrates a need.

Do not reintroduce the old hover flyout or create a live canvas for every
result row while adding content. Keep preview loading lazy and limited to the
selected entry.

## Verification for a content batch

At minimum, run:

```text
npm run samples:previews
npm test -- --run src/sampleLibrary
npm run lint
npm run build
```

The full project checks remain the release gate when a batch changes shared
parsing, rendering, or sample-loading behavior.
