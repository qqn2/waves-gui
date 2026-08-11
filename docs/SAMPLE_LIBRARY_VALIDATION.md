# Validating and promoting a sample

Generated catalog files under `public/samples/catalog/` are not hand-edited.
They are rebuilt from the Phase 2 curriculum, the frozen legacy templates, and the small
validation registry at
[`public/samples/validated-samples.v1.json`](../public/samples/validated-samples.v1.json).

## Promote a reviewed waveform

1. Put the source waveform below `public/samples/waveforms/<domain>/`. Use the
   source number's canonical domain from the Phase 2 catalog; for example,
   CDC lesson 55 uses
   `public/samples/waveforms/cdc/single-bit-two-flop-synchronizer.json`.
2. Add exactly one record to `entries` in `public/samples/validated-samples.v1.json`:

   ```json
   {
     "sourceNumber": 55,
     "asset": {
       "path": "waveforms/cdc/single-bit-two-flop-synchronizer.json",
       "format": "wavedrom-json"
     },
     "reviewedBy": "Samy Rekioua",
     "reviewedOn": "2026-08-10",
     "validationEvidence": "Checked source timing and both generated SVG themes against the lesson description."
   }
   ```

   `status` is optional and defaults to `reviewed`. Add `"status": "featured"`
   only after a reviewed lesson is deliberately selected for a learning path.
3. Rebuild and verify the generated catalog and previews:

   ```powershell
   npm run samples:validate
   ```

`samples:validate` rebuilds the catalog, creates both light and dark SVG
previews, and checks that the registry, generated metadata, waveform source,
and both previews agree. Do not manually add a `cdc.svg`: previews are
generated at `public/samples/previews/<asset path with .light.svg/.dark.svg>`.

## What the record controls

The registry is the only source for `reviewed` and `featured` lifecycle data:
the generated entry receives its asset path and format, status, reviewer,
review date, validation evidence reference, and validation note from this
record. A duplicate source number, unsafe path, unsupported format, invalid
date, missing evidence, stale generated catalog, or missing preview fails the
command.

For an unreviewed source file, keep it out of this registry. It remains an
unpublished local file and its curriculum item stays index-only in the
committed catalog.
