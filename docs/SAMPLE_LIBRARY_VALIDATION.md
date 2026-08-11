# Validating and promoting a sample

Generated catalog files under `public/samples/catalog/` are not hand-edited.
They are rebuilt from the Phase 2 curriculum, the frozen legacy templates, and two
small registries:

- [`public/samples/draft-samples.v1.json`](../public/samples/draft-samples.v1.json)
  makes a local waveform visible as an explicitly unvalidated draft.
- [`public/samples/validated-samples.v1.json`](../public/samples/validated-samples.v1.json)
  promotes a checked waveform to `reviewed` or `featured`.

The validated registry takes precedence for a shared source number.

## Show an unvalidated waveform locally

1. Put the waveform below `public/samples/waveforms/<domain>/`.
2. Add exactly one minimal record to `entries` in
   `public/samples/draft-samples.v1.json`:

   ```json
   {
     "sourceNumber": 55,
     "asset": {
       "path": "waveforms/cdc/single-bit-two-flop-synchronizer.json",
       "format": "wavedrom-json"
     }
   }
   ```

   The source number is authoritative: it selects the title, category, and
   canonical catalog ID from the curriculum even when the filename intentionally
   differs from the title slug. Draft records cannot contain reviewer, date,
   evidence, status, or other lifecycle fields.
3. Run `npm run samples:validate`. This rebuilds the catalog and generated SVG
   previews so the browser's **Include unvalidated drafts** switch can show the
   waveform. It checks parsing/rendering consistency; it does not mark the
   sample reviewed.

Do not hand-author a `cdc.svg`: the command writes light and dark previews at
`public/samples/previews/<asset path with .light.svg/.dark.svg>`.

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
     "reviewedBy": "Validation reviewer",
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

For an unreviewed source file, keep it out of the validated registry and place
it in the draft registry instead. It remains a `draft` in the catalog and is
hidden by default; the browser shows it only after enabling **Include
unvalidated drafts**.

## Promoting a bundled legacy sample

The small published templates and Ludwig compatibility fixtures are already
reviewed through their parser, renderer, and compatibility coverage. Their
assets stay in the frozen `PUBLISHED_SAMPLES` migration map, so a legacy record
names only its stable ID—never a source number or duplicate asset path:

```json
{
  "legacyId": "undulate/ludwig/wavetest",
  "reviewedBy": "Waves GUI automated validation",
  "reviewedOn": "2026-08-10",
  "validationEvidence": "Bundled Undulate parser, renderer, and Ludwig compatibility-fixture checks pass for the frozen upstream case."
}
```

`legacyId` must exactly match a frozen published ID. The validator rejects
unknown IDs, duplicate records, source numbers on legacy records, or a copied
asset mapping. This keeps the built-in templates reviewed without making their
asset location a second piece of mutable metadata.
