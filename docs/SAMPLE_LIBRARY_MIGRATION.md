# Sample library: incremental recovery

The library is for understanding a few useful waveforms, especially AMBA. A
large catalog is not a success metric. Each example should explain a distinct
concept, render clearly, and teach correct timing before another is added.

## Source work recovered

`origin/codex/sample-browser-library` at `093ddb4` is 18 commits ahead of the
shared base `c4c45c6`. Its 563-file change mixes browser UI, generated curriculum,
preview assets, and parser/renderer work. It is not suitable for a bulk merge.
Only the main checkout was registered when inspected on 2026-11-13.

The branch's 869 catalog records comprise 712 placeholders, 120 unvalidated
drafts, and 37 legacy entries marked reviewed. Of those legacy entries, 22 are
compatibility fixtures. Automated parse/render evidence does not establish
protocol accuracy. The handoff documents also describe an earlier architecture
than the manifest implementation at the branch tip.

## First slice

- Reuse the early browser's separation between catalog, selected preview, and
  opening a copy. Keep the existing 15 stable sample IDs and one catalog tree.
- Replace hover flyouts with a searchable dialog, protocol filters, real SVG
  previews, fit/actual-size controls, keyboard navigation, and a narrow layout.
- Make AMBA the initial category. Add concise learning notes and Arm references
  for the six existing APB/AHB/AXI examples; correct their timing before using
  them as lessons.
- Preview without touching editor state. Cancel pending work on close, protect
  later edits from asynchronous loads, and confirm dirty-document replacement
  only after the new waveform is ready.
- Preserve concurrent source-history, file-operation, and recovery work.

## Guided AMBA learning pass

The collection now has 19 samples: ten explained AMBA lessons plus the nine
existing fundamentals and Undulate examples. Four original APB traces add
write waits, read waits, back-to-back transfers, and an error after a wait.
The existing AHB and AXI traces gain staged explanations instead of duplicates.

- APB: write → read → write waits → read waits → back-to-back → error.
- AHB: separate address/data phases → burst pipelining with BUSY and a wait.
- AXI: read address/data handshakes → independent write address/data/response.

Each lesson includes an objective, cycle highlights, focused signals with a
full-signal toggle, signal definitions, a takeaway, a question with a revealed
answer, and an official Arm reference. Cycle numbers label columns; acceptance
is described at the right-hand rising edge. Preview projections never change
the source opened in the editor. Full-size previews retain authored hscale and
keep signal names visible while scrolling.

APB timing was checked against IHI 0024E §§3.1, 3.3, 3.4 and 4.1. In particular,
read data need only be valid for completion, PREADY alone does not finish a
transfer, each back-to-back access still needs SETUP, and an error does not
promise rollback. AHB and AXI lessons reference IHI 0033C and IHI 0022H.c.

All 19 assets were audited at their authored scales with browser font metrics:
57 bus labels fit without font compression or overflow slack. APB read and both
AHB examples now use hscale 4. The single AHB write uses 0x12345678 because the
previous 0xDEADBEEF did not fit one cell at the editor's maximum hscale. New APB
read-with-waits also uses 4; the other three additions use 2. Timings were not
stretched to make labels fit. The label-fit regression test uses real Node font
metrics and actual lane geometry; browser audit is still needed for font changes.

### Files for carrying this pass to another layout

Keep the existing browser integration from the first slice. The finalized
learning-pass files are:

- `src/shell/samples.ts` (catalog additions and AXI lesson order)
- `src/sampleLibrary/SampleBrowser.tsx`
- `src/sampleLibrary/SampleBrowser.module.css`
- `src/sampleLibrary/SamplePreview.tsx`
- `src/sampleLibrary/catalog.ts`
- `src/sampleLibrary/learningTypes.ts`
- `src/sampleLibrary/learningNotes.ts`
- `src/sampleLibrary/apbLessons.ts`
- `src/sampleLibrary/axiAhbLessons.ts`
- `src/sampleLibrary/lessonPreview.ts`
- `public/samples/amba-apb-read.json`
- `public/samples/amba-ahb-write.json`
- `public/samples/amba-ahb-transfer-types.json`
- `public/samples/amba-apb-write-wait.json`
- `public/samples/amba-apb-read-wait.json`
- `public/samples/amba-apb-back-to-back.json`
- `public/samples/amba-apb-error.json`
- `src/sampleLibrary/SampleBrowser.test.tsx`
- `src/sampleLibrary/catalog.test.ts`
- `src/sampleLibrary/ambaLessons.test.ts`
- `src/sampleLibrary/apbTransfers.test.ts`
- `src/sampleLibrary/lessonPreview.test.ts`
- `src/sampleLibrary/sampleLabelFit.test.ts`
- `tests/e2e/samples.spec.ts`
- `docs/SAMPLE_LIBRARY_MIGRATION.md`

The full validation run also exposed an unrelated existing React-root teardown
leak in `src/main.smoke.test.tsx`; the test now unmounts the real root under act.

## Later slices

1. Review this small learning experience with actual use. Improve explanation,
   readability, and ordering before adding samples.
2. Bring over one useful AMBA lesson at a time only when it teaches something
   missing: for example, AXI address/data independence or a burst under
   backpressure. Check the original specification and the trace together;
   parser success alone is insufficient.
3. Evaluate isolated Undulate/parser improvements separately, with their own
   compatibility and regression evidence. Compatibility fixtures belong in
   test coverage unless they are useful, explained learning examples.

Do not import the generated curriculum, planned lessons, review labels,
registries, or hundreds of thumbnails merely to fill the browser. Preserve the
old branch as source material, not as a list of promised features.
