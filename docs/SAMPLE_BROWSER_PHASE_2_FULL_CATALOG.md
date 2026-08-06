# Sample Browser Phase 2: Full Protocol Catalog and Content Rollout

## Relationship to the Phase 1 plan

[`SAMPLE_BROWSER_IMPLEMENTATION_PLAN.md`](./SAMPLE_BROWSER_IMPLEMENTATION_PLAN.md) defines the browser shell, metadata contract, lazy preview behavior, and the first 40 lessons. This document is the Phase 2 content and scale plan that follows it.

Phase 2 is intentionally much larger than the first vertical slice. The attached curriculum contains **832 candidate samples**. The target is to make all 832 discoverable through the manifest, while authoring and reviewing waveform assets in controlled batches. The UI must never render all 832 at once.

The catalog is a learning library. PCIe, IOMMU, CXL, UCIe, cache coherence, DDR training, networking, security, and multimedia entries must be labeled as study material until they have a reviewed implementation or supporting artifact.

## Phase 2 objectives

1. Expand the manifest from the initial 40 lessons to the complete 832-entry index.
2. Add enough real waveform assets to make each major protocol/domain useful, not just searchable.
3. Preserve the one-rule-per-sample curriculum discipline.
4. Add correct/incorrect pairs for the highest-value protocol rules.
5. Add learning paths, favorites, recents, related samples, and local continuation state.
6. Keep catalog loading, search, and preview responsive with hundreds of entries.
7. Add content provenance and review status so unfinished entries cannot appear as completed lessons.
8. Use the catalog to turn passive technical study into reusable design, verification, and documentation artifacts.

## Full catalog shape

### Catalog tiers

Every entry belongs to one of these tiers:

| Tier | Meaning | Browser treatment |
|---|---|---|
| Essential | Core rule required before later lessons | Shown first on a protocol page |
| Intermediate | Common implementation or integration case | Collapsed by default |
| Advanced | Multi-channel, performance, coherency, or system case | Collapsed and tagged |
| Failure | Deliberately invalid or unsafe trace | Separate warning section |
| Stress | Exercises Waves GUI rendering/editor behavior | Available through Verification/Stress |

Do not infer tier from number. The manifest owns the pedagogical order.

### Content status

Add a content lifecycle field to the Phase 1 manifest:

```ts
type ContentStatus =
  | 'index-only'       // searchable placeholder; no asset yet
  | 'draft'             // asset exists, not reviewed
  | 'reviewed'          // protocol and rendering review complete
  | 'featured'          // reviewed and selected for a learning path
  | 'deprecated';
```

Only `reviewed` and `featured` samples appear in normal protocol essentials. `index-only` entries appear only when the user explicitly enables `Include planned samples`.

Required Phase 2 fields:

- `contentStatus`, `owner`, and `lastReviewed`;
- `waveformFeatures` exercised by the asset;
- `prerequisites` and `next` for path navigation;
- `pairWith` for valid/failure relationships;
- `reviewNotes` for known modeling simplifications;
- `references` with specification name/edition/section;
- `artifactPrompt` describing a possible assertion, verification plan, or design note.

## Catalog sharding and loading

An 832-entry catalog should not be one large React constant or one eagerly parsed waveform bundle.

```text
public/samples/
  catalog.v1.json                 # categories, paths, shard manifest
  catalog/
    fundamentals.json             # metadata only
    clocking-reset.json
    cdc.json
    buffering.json
    amba.json
    axi-stream-other-buses.json
    cache-coherency-noc.json
    memory-ddr.json
    serial-peripherals.json
    pcie-chiplets.json
    networking-media.json
    power-security-safety.json
    firmware-verification-stress.json
  waveforms/
    <domain>/<sample-slug>.json    # loaded only for preview/open
```

Phase 2 loading rules:

1. Bootstrap loads no sample shard.
2. Opening the browser loads the small top-level index and the featured metadata.
3. Selecting a category loads only that category's metadata shard.
4. Search-all loads metadata shards progressively and shows `Searching more categories...` while incomplete.
5. A selected preview fetches one waveform asset; a second selection may cancel/ignore the first request.
6. Parsed preview cache is bounded (8-12 entries).
7. Learning-path navigation prefetches only the next sample metadata, not the next waveform.
8. Index-only entries never trigger a waveform request.

The search UI must state whether results are complete while shards are loading. A partial result list must not look final.

## Full curriculum domains

The 832 candidates are grouped into these 13 shards. Counts are approximate because some entries can be cross-tagged into more than one learning path, but each sample has exactly one canonical shard.

| Shard | Candidate numbers | Approx. count | Primary purpose |
|---|---:|---:|---|
| Fundamentals | 1-32 | 32 | Flip-flops, pipelines, handshakes, FSMs |
| Clocking and reset | 33-54 | 22 | Reset sequencing, clocks, jitter, pulse width |
| CDC | 55-80 | 26 | Synchronizers, pulses, buses, async FIFO pointers |
| FIFOs and buffering | 81-100 | 20 | FIFO boundaries, elastic buffers, reorder queues |
| AMBA | 101-192 | 92 | APB, AHB-Lite, AXI4-Lite, AXI4 |
| AXI-Stream and other buses | 193-235 | 43 | Streaming, Wishbone, TileLink |
| Cache, coherency, and NoC | 236-310 | 75 | Caches, MESI/ACE/CHI, arbitration, credits |
| SRAM and external memory | 311-364 | 54 | ROM/SRAM, ECC, DDR/LPDDR/HBM |
| Serial and peripherals | 365-515 | 151 | SPI, I²C/I3C, UART/LIN/CAN, debug, interrupts, DMA |
| PCIe and chiplets | 516-579 | 64 | PCIe, CXL, UCIe, die-to-die behavior |
| Networking and media | 580-647 | 68 | Ethernet, USB, SD/eMMC, MIPI, display timing |
| Power, security, safety | 648-695 | 48 | Power sequencing, secure flows, ASIL/fault behavior |
| Firmware, verification, stress | 696-832 | 137 | Assertions, MMIO races, invalid pairs, GUI stress |
| **Total** | 1-832 | **832** | Full candidate catalog |

## Phase 2 delivery waves

### Wave A: fundamentals through buffering (samples 41-100)

This wave completes the fundamentals/clocking/CDC/FIFO family around the first 40. It should be the first content pull request after the browser foundation.

| # | Sample | Primary tag |
|---:|---|---|
| 41 | Clock divider by four | clocking |
| 42 | Related clocks with phase offset | clocking |
| 43 | Generated-clock crossing | clocking/CDC |
| 44 | Clock mux switching incorrectly | failure/clocking |
| 45 | Glitch-free clock mux | clocking |
| 46 | Clock gating | clocking |
| 47 | Unsafe combinational clock gate | failure/clocking |
| 48 | Integrated clock-gating test enable | DFT/clocking |
| 49 | Clock startup and shutdown | integration |
| 50 | Dynamic frequency change | clocking |
| 51 | Clock-domain phase drift | CDC |
| 52 | Duty-cycle distortion | fine-timing |
| 53 | Clock jitter illustration | fine-timing |
| 54 | Minimum pulse-width violation | failure/fine-timing |
| 55 | Single-bit two-flop synchronizer | CDC |
| 56 | Two-flop synchronizer latency variation | CDC |
| 57 | Metastability conceptual example | CDC/conceptual |
| 58 | Pulse lost across a slow destination clock | failure/CDC |
| 59 | Pulse stretching | CDC |
| 60 | Pulse synchronizer using toggle | CDC |
| 61 | Toggle synchronizer failure with events too close | failure/CDC |
| 62 | Four-phase request/acknowledge CDC | CDC |
| 63 | Handshake with source backpressure | CDC |
| 64 | Multi-bit bus crossed independently | failure/CDC |
| 65 | Data plus synchronized valid | CDC |
| 66 | Mux-based data synchronizer | CDC |
| 67 | Gray counter crossing | CDC/FIFO |
| 68 | Binary counter crossing failure | failure/CDC |
| 69 | Asynchronous FIFO write | FIFO/CDC |
| 70 | Asynchronous FIFO read | FIFO/CDC |
| 71 | Asynchronous FIFO pointer synchronization | FIFO/CDC |
| 72 | FIFO full detection | FIFO |
| 73 | FIFO empty detection | FIFO |
| 74 | FIFO almost-full and almost-empty | FIFO |
| 75 | CDC reset mismatch | failure/CDC |
| 76 | Reconvergence hazard | failure/CDC |
| 77 | Related-clock transfer without handshake | corner-case/CDC |
| 78 | Related-clock transfer with conservative handshake | CDC |
| 79 | Mesochronous crossing | CDC |
| 80 | Plesiochronous crossing | CDC |
| 81 | Synchronous FIFO push | FIFO |
| 82 | Synchronous FIFO pop | FIFO |
| 83 | Simultaneous push and pop | FIFO |
| 84 | Push while full | failure/FIFO |
| 85 | Pop while empty | failure/FIFO |
| 86 | Show-ahead FIFO | FIFO |
| 87 | Registered-output FIFO | FIFO |
| 88 | FIFO occupancy counter | FIFO |
| 89 | Skid buffer capture | buffering |
| 90 | Skid buffer pass-through | buffering |
| 91 | One-entry elastic buffer | buffering |
| 92 | Two-entry elastic buffer | buffering |
| 93 | Credit-based buffer | buffering |
| 94 | Credit exhaustion | failure/credits |
| 95 | Credit return | credits |
| 96 | Packet FIFO with end-of-packet marker | buffering |
| 97 | Packet drop on overflow | failure/buffering |
| 98 | Store-and-forward buffering | buffering |
| 99 | Cut-through forwarding | buffering |
| 100 | Reorder buffer allocation and retirement | ordering |

### Wave B: APB, AHB-Lite, and AXI4-Lite (samples 101-150)

These are the highest-leverage protocol lessons for current subsystem integration work. Each protocol page should have a small essential set and a larger advanced/failure set.

| # | Sample | Primary tag |
|---:|---|---|
| 101 | APB write without wait states | APB |
| 102 | APB read without wait states | APB |
| 103 | APB write with wait states | APB/backpressure |
| 104 | APB read with wait states | APB/backpressure |
| 105 | Back-to-back APB transfers to the same peripheral | APB |
| 106 | Back-to-back APB transfers to different peripherals | APB/decode |
| 107 | APB error response | APB/errors |
| 108 | Illegal APB control mutation during access | failure/APB |
| 109 | APB bridge request | APB/bridge |
| 110 | APB peripheral register read/write | APB/MMIO |
| 111 | AHB-Lite single read | AHB |
| 112 | AHB-Lite single write | AHB |
| 113 | AHB address/data phase overlap | AHB/pipeline |
| 114 | AHB wait-state insertion | AHB/backpressure |
| 115 | AHB error response | AHB/errors |
| 116 | AHB back-to-back transfers | AHB |
| 117 | AHB incrementing burst | AHB/burst |
| 118 | AHB wrapping burst | AHB/burst |
| 119 | AHB BUSY transfer | AHB |
| 120 | AHB NONSEQ followed by SEQ | AHB |
| 121 | AHB pipeline stall | AHB |
| 122 | AHB slave selection and decode | AHB/decode |
| 123 | AHB default slave response | AHB/errors |
| 124 | AHB arbitration between two masters | arbitration |
| 125 | AHB bus ownership handover | arbitration |
| 126 | AHB locked sequence | ordering |
| 127 | AHB split/retry historical example | AHB/conceptual |
| 128 | AXI4-Lite write: AW and W together | AXI4-Lite |
| 129 | AXI4-Lite write: AW before W | AXI4-Lite/channels |
| 130 | AXI4-Lite write: W before AW | AXI4-Lite/channels |
| 131 | AXI4-Lite write response | AXI4-Lite |
| 132 | AXI4-Lite write with AW backpressure | AXI4-Lite/backpressure |
| 133 | AXI4-Lite write with W backpressure | AXI4-Lite/backpressure |
| 134 | AXI4-Lite write-response backpressure | AXI4-Lite/backpressure |
| 135 | AXI4-Lite read | AXI4-Lite |
| 136 | AXI4-Lite AR backpressure | AXI4-Lite/backpressure |
| 137 | AXI4-Lite R backpressure | AXI4-Lite/backpressure |
| 138 | Independent simultaneous read and write | AXI4-Lite/concurrency |
| 139 | Two outstanding read requests | AXI4-Lite/outstanding |
| 140 | Write strobe partial update | AXI4-Lite/registers |
| 141 | Misaligned address handling | AXI4-Lite/corner-case |
| 142 | DECERR response | AXI4-Lite/errors |
| 143 | SLVERR response | AXI4-Lite/errors |
| 144 | Register with write-one-to-clear bits | AXI4-Lite/MMIO |
| 145 | Read-clear status register | AXI4-Lite/MMIO |
| 146 | AXI-Lite bridge timeout | AXI4-Lite/timeout |
| 147 | Incorrect coupling of AWREADY and WREADY | failure/AXI4-Lite |
| 148 | Incorrect master dropping VALID early | failure/AXI4-Lite |
| 149 | Payload instability while VALID waits | failure/AXI4-Lite |
| 150 | AXI-Lite skid-buffered slave | AXI4-Lite/buffering |

### Wave C: full AXI4 and AXI-Stream (samples 151-215)

This wave turns the generic ready/valid lessons into realistic channel, burst, ID, and streaming behavior.

| # | Sample | Primary tag |
|---:|---|---|
| 151 | AXI single-beat read | AXI4 |
| 152 | AXI single-beat write | AXI4 |
| 153 | AXI incrementing read burst | AXI4/burst |
| 154 | AXI incrementing write burst | AXI4/burst |
| 155 | AXI fixed burst | AXI4/burst |
| 156 | AXI wrapping burst | AXI4/burst |
| 157 | AXI `RLAST` | AXI4 |
| 158 | AXI `WLAST` | AXI4 |
| 159 | Write-data burst backpressure | AXI4/backpressure |
| 160 | Read-data burst backpressure | AXI4/backpressure |
| 161 | Address-channel backpressure | AXI4/backpressure |
| 162 | Separate AW and W timing | AXI4/channels |
| 163 | Multiple outstanding reads with different IDs | AXI4/IDs |
| 164 | Interleaved read responses by ID | AXI4/IDs |
| 165 | Out-of-order read completion | AXI4/ordering |
| 166 | Multiple outstanding writes | AXI4/IDs |
| 167 | Write response associated with ID | AXI4/IDs |
| 168 | Burst crossing a 4 KiB boundary — illegal | failure/AXI4 |
| 169 | Narrow transfer on wider bus | AXI4/width |
| 170 | Unaligned transfer | AXI4/corner-case |
| 171 | Byte-lane `WSTRB` | AXI4/byte-enable |
| 172 | Exclusive read/write success | AXI4/atomic |
| 173 | Exclusive access failure | AXI4/atomic |
| 174 | Atomic operation conceptual sample | AXI4/conceptual |
| 175 | AXI QoS arbitration | AXI4/arbitration |
| 176 | AXI region signaling | AXI4/attributes |
| 177 | AXI protection attributes | AXI4/attributes |
| 178 | AXI cache attributes | AXI4/attributes |
| 179 | AXI user sideband | AXI4/sideband |
| 180 | AXI timeout and transaction abort policy | AXI4/errors |
| 181 | AXI width converter: 32-bit to 128-bit | AXI4/bridge |
| 182 | AXI width converter: 128-bit to 32-bit | AXI4/bridge |
| 183 | AXI clock converter | AXI4/CDC |
| 184 | AXI register slice | AXI4/timing |
| 185 | AXI crossbar arbitration | AXI4/interconnect |
| 186 | AXI decode error | AXI4/errors |
| 187 | AXI slave error | AXI4/errors |
| 188 | AXI outstanding-limit throttling | AXI4/flow-control |
| 189 | AXI write-data starvation | AXI4/performance |
| 190 | AXI read-data starvation | AXI4/performance |
| 191 | AXI deadlock caused by channel dependency | failure/AXI4 |
| 192 | Correct independent-channel implementation | AXI4/correctness |
| 193 | Single AXI-Stream beat | AXI-Stream |
| 194 | Continuous streaming | AXI-Stream |
| 195 | Backpressure | AXI-Stream/backpressure |
| 196 | Packet with `TLAST` | AXI-Stream/packet |
| 197 | Partial final beat with `TKEEP` | AXI-Stream/byte-enable |
| 198 | Byte qualification with `TSTRB` | AXI-Stream/byte-enable |
| 199 | Packet metadata with `TUSER` | AXI-Stream/sideband |
| 200 | Stream routing with `TDEST` | AXI-Stream/routing |
| 201 | Stream identification with `TID` | AXI-Stream/IDs |
| 202 | Source holds data stable during stall | AXI-Stream/correctness |
| 203 | Illegal source changing data under stall | failure/AXI-Stream |
| 204 | Packet bubble | AXI-Stream |
| 205 | Packet truncation | failure/AXI-Stream |
| 206 | Packet abort using `TUSER` | AXI-Stream/errors |
| 207 | AXI-Stream FIFO | AXI-Stream/buffering |
| 208 | AXI-Stream skid buffer | AXI-Stream/buffering |
| 209 | AXI-Stream width conversion | AXI-Stream/bridge |
| 210 | AXI-Stream clock conversion | AXI-Stream/CDC |
| 211 | Two-input stream arbiter | AXI-Stream/arbitration |
| 212 | Packet-level arbitration | AXI-Stream/arbitration |
| 213 | Beat-level arbitration problem | failure/AXI-Stream |
| 214 | Rate limiter | AXI-Stream/flow-control |
| 215 | Frame synchronizer | AXI-Stream |

### Wave D: other buses, cache/coherency, and NoC (samples 216-310)

The remaining entries in this wave should be authored as compact protocol lessons, with cache/coherency and NoC explicitly marked advanced.

| Range | Content to author |
|---:|---|
| 216-224 | Wishbone classic read/write, wait, error, retry, pipelining, burst, stall, and byte select |
| 225-235 | TileLink UL Get/Put, source IDs, denied/corrupt responses, multibeat, coherence concepts, and credit behavior |
| 236-253 | Cache hits/misses, write policies, eviction, refill, critical-word-first, MSHR, forwarding, store buffer, and fences |
| 254-261 | TLB hits/misses, page walks, refill/faults, IOMMU translation/faults, and coherent/noncoherent DMA |
| 262-285 | MESI transitions, sharing/invalidation, snoops, directories, retries, ACE snoops, and CHI request/data/response/credit concepts |
| 286-310 | Round-robin/fixed/weighted/aging arbitration, grant hold, split transactions, NoC flits, virtual channels, credits, HOL blocking, routing, retry, parity, poison, ordering, deadlock, and CDC bridge |

### Wave E: SRAM, DDR, and external-memory timing (samples 311-364)

Prioritize the SRAM/macro/ECC subset first because it maps directly to existing memory-macro, NVM, DFT, and safety experience. DDR/LPDDR/HBM entries are advanced study content and should use command-level diagrams before any electrical detail.

| Range | Content to author |
|---:|---|
| 311-318 | ROM and single-port SRAM reads/writes, collision modes, and byte enables |
| 319-328 | Dual-port access combinations, macro chip enable/sleep, ECC clean/corrected/uncorrectable, parity |
| 329-334 | Register-file read/write/bypass and CAM match/invalidation behavior |
| 335-349 | SDRAM activate/read/write/precharge, row hit/miss, bank conflict, refresh, turnaround, CAS latency, bursts |
| 350-364 | DQS timing, training, calibration, self-refresh, power-down, bank-group limits, queue reordering, arbitration, ECC scrub, LPDDR, HBM |

### Wave F: serial, debug, interrupts, and DMA (samples 365-515)

This is the largest practical peripheral wave. Use protocol families as separate browser protocols so SPI mode 0 does not sit beside every CAN error state in one list.

| Range | Content to author |
|---:|---|
| 365-384 | SPI modes, framing, flash commands, dual/quad SPI, dummy cycles, setup/hold failures |
| 385-408 | I²C START/STOP/ACK/NACK, repeated START, stretching, arbitration, stuck-low recovery, SMBus, I3C address/transfer/interrupt/legacy coexistence |
| 409-446 | UART framing/parity/oversampling/flow control, LIN schedule/checksum/wakeup, CAN arbitration/stuffing/CRC/errors/bus-off/CAN FD |
| 447-450 | Automotive watchdog challenge-response, safety-monitor disagreement, lockstep compare, end-to-end counter/CRC |
| 451-472 | JTAG/SWD/scan/MBIST/LBIST/debug-halt/trace flows |
| 473-495 | Interrupt levels/edges/synchronizers/pending/masks/priority/nesting/MSI/MSI-X/coalescing, timers, PWM, capture/compare, GPIO, encoder |
| 496-515 | Memory/peripheral DMA, request/ack, descriptors, chaining, scatter-gather, bursts, backpressure, errors, page boundaries, IOMMU, cancel/pause, ordering, coherence |

### Wave G: PCIe, CXL, UCIe, networking, and media (samples 516-647)

This wave is the main advanced-protocol study track. It should produce clear technical explanations and reusable documentation artifacts, but every entry must remain labeled study until implemented and verified independently.

| Range | Content to author |
|---:|---|
| 516-539 | PCIe memory/config/completion requests, errors, split completion, tags, outstanding reads, reordering, attributes, byte enables, payload/request sizing, credits, replay, sequence numbers |
| 540-555 | PCIe link power/retraining/reset/surprise-down, MSI/MSI-X/AER/FLR, SR-IOV, ATS, PASID, PRI, peer-to-peer |
| 556-567 | CXL.io/cache/mem transactions, poison/retry/coherency, HDM decoder, link initialization, IDE conceptual behavior |
| 568-579 | UCIe adapter/flits/credits/retry/CRC/link initialization/power, sideband reset, clock compensation, lane repair, containment |
| 580-606 | Ethernet MAC/PHY streams, VLAN/ARP/IP/UDP/TCP concepts, parser/checksum/classification, congestion/drop/PFC/PTP, cut-through/store-and-forward |
| 607-619 | USB reset/packets/control/bulk/interrupt/isochronous/NAK/STALL/suspend/toggle/power |
| 620-628 | SD/SDIO/eMMC command, block access, interrupt, boot, HS timing, command queueing |
| 629-647 | CSI-2 packets/errors/virtual channels, D-PHY transitions, DSI modes, display sync/blanking, sensor and pixel-pipeline backpressure |

### Wave H: power, security, safety, firmware, verification, and stress (samples 648-832)

This wave converts the implementation into a signoff-oriented learning tool. It is also where metadata, assertions, and GUI coverage become first-class rather than decorative.

| Range | Content to author |
|---:|---|
| 648-670 | Power shutdown/isolation/release, retention, power-good, regulators, DVFS, self-refresh, wakeup, always-on sequencing, dependencies, timeout, UPF, level shifters, brownout, thermal, PCIe/CXL low-power |
| 671-695 | Secure boot/key flows, crypto/entropy, privilege/firewall decisions, audit/tamper/zeroization, parity/ECC/fatal escalation, watchdog, safety heartbeat, lockstep, containment |
| 696-726 | Assertion pass/fail, latency/liveness, mutual exclusion, grants, reset/backpressure/FIFO/AXI/APB/I²C/clock/CDC assumptions, coverage, counterexamples, X behavior, debug force/release |
| 727-748 | Firmware MMIO, doorbells/mailboxes, producer/consumer rings, descriptor ownership, boot handoff, initialization, DMA cache maintenance, interrupts, polling comparison |
| 749-777 | Deliberately invalid READY/VALID/APB/AXI/FIFO/CDC/reset/clock/I²C/SPI/UART/CAN/SRAM/cache/interrupt/DMA/NoC/PCIe/coherency/power/security/watchdog samples |
| 778-832 | Long documents, vector/bus/group/edge stress, fine timing, analogue overlays, annotations, VCD/opaque data, duplicate names, empty/max-size, Unicode, themes, and narrow layout |

## Required correct/failure pair matrix

The full catalog should contain at least one reviewed failure companion for every high-value rule family:

| Correct family | Paired failure examples |
|---|---|
| Ready/valid | payload changes while stalled; VALID drops early; combinational loop |
| APB | controls change during wait; wrong error sampling |
| AXI | early/late `WLAST`/`RLAST`; burst crosses 4 KiB; wrong ID/response association; channel deadlock |
| AXI-Stream | source mutates stalled beat; truncated packet; beat-level arbitration |
| CDC | raw pulse lost; independent bus bits; async reset release; reconvergence |
| FIFO | push while full; pop while empty; pointer/credit underflow |
| Clocking | unsafe gate; mux runt pulse; minimum pulse-width violation |
| Serial | SPI wrong edge; I²C SDA changes while SCL high; UART baud mismatch; CAN dominant/recessive error |
| Memory | dual-write conflict; stale noncoherent DMA data; ECC uncorrectable escalation |
| DMA/IOMMU | descriptor ownership race; page fault ignored; crossing boundary without split |
| PCIe/NoC | tag reuse; credit underflow; wrong transaction ID; deadlock dependency |
| Power/safety/security | isolation released early; retention before power-good; key valid after reset; watchdog masks deadlock |
| Firmware/MMIO | read-modify-write race; status cleared before observation; interrupt acknowledgment race |

Every failure entry must point to a valid reviewed correction. Do not flood the browser with invalid samples that have no teaching path.

## Authoring and review pipeline

### Authoring package

Each new sample pull request contains:

1. one waveform JSON file;
2. one manifest entry;
3. a short rule explanation;
4. learning objectives;
5. correct/failure pairing and related IDs;
6. a specification reference and modeling assumptions;
7. a test fixture or parser validation;
8. an optional assertion-shaped check;
9. a screenshot only when visual review catches something tests cannot.

Keep individual waveforms small. If a sample needs more than one central idea, split it into two lessons and relate them.

### Review gates

Content status advances as follows:

```text
index-only -> draft -> protocol review -> rendering review -> reviewed
                                                       -> featured
```

Protocol review checks rule accuracy and edge timing. Rendering review checks WaveDrom/Undulate round-trip, labels, groups, annotations, and narrow-layout behavior. A technically correct sample can remain `reviewed` without becoming `featured` if it is too dense for the curriculum.

### Artifact conversion

For each domain batch, add a suggested output:

- fundamentals/CDC: assertion or design explanation;
- AMBA/AXI: protocol checklist and bridge design note;
- memory/DFT/safety: verification plan or fault-injection case;
- PCIe/IOMMU/DMA: microarchitecture diagram and formal properties;
- power/clocking: reset/clock/power sequencing checklist;
- GUI stress: regression fixture or visual conformance case.

This prevents 832 diagrams from becoming 832 passive reading tasks.

## Learning paths for the expanded catalog

Add path metadata now; add completion tracking after the catalog is stable.

### Digital design foundations

Clock/data -> flip-flop/reset -> enable -> pulse/edge detection -> pipeline -> valid/ready -> handshake -> FIFO -> arbiter -> reorder buffer.

### CDC and reset signoff

Two-flop level -> latency variation -> metastability model -> lost pulse -> toggle -> handshake -> multi-bit bus failure -> Gray counter -> async FIFO -> reset mismatch -> reconvergence -> mesochronous/plesiochronous.

### AMBA subsystem integrator

APB read/write -> wait/error -> AHB phases -> AXI-Lite independent channels -> register side effects -> AXI bursts/IDs -> crossbar -> clock converter -> AXI-Stream -> DMA.

### Memory and safety controller

SRAM collision -> ECC -> NVM/MMIO -> watchdog -> interrupt status race -> DMA coherence -> cache refill -> TLB/IOMMU fault -> fault escalation.

### PCIe/IOMMU/NBIO bridge

AXI IDs -> NoC credits -> PCIe memory read/completion -> tags -> outstanding/reordering -> credits/replay -> ATS/PASID/PRI -> IOMMU IO-TLB/page walk -> DMA descriptor chain.

### Low power and bring-up

Clock gate -> test enable -> reset sequencing -> isolation -> retention -> power-good -> DVFS -> self-refresh -> wakeup -> PCIe/CXL low-power coordination.

### Full interface survey

SPI -> I²C/I3C -> UART/LIN/CAN -> JTAG/SWD -> USB -> SD/eMMC -> Ethernet -> MIPI -> DDR/LPDDR/HBM.

Paths must declare prerequisites and skip planned/index-only content unless the user opts into it.

## UI additions required in Phase 2

- `Include planned samples` toggle, off by default;
- `Reviewed only` filter, on by default for Essentials;
- `Favorites`, `Recent`, and `Continue learning` sections stored in versioned local storage;
- related-sample links and correct/failure pair navigation;
- protocol page sections for Essential, Intermediate, Advanced, Failure, and Stress;
- learning-path view with current sample, next sample, and prerequisite warnings;
- optional `Artifact prompt` panel that can be copied into a technical note or checklist;
- catalog progress shown as content coverage, not individual productivity scoring.

Do not add a permanently visible 832-item tree. Even the full-catalog mode should use search, shards, filters, and progressive disclosure.

## Phase 2 implementation work packages

### P2.1 Manifest and shard infrastructure

- define shard/index schemas;
- add runtime validation and cross-shard relationship validation;
- add deterministic IDs and slug collision checks;
- add build-time file existence and parser checks;
- add content-status filtering;
- add catalog version migration handling.

### P2.2 Search at scale

- build per-shard token indexes;
- merge ranked results as shards arrive;
- preserve stable ranking across partial loads;
- add concept/protocol/status/path filters;
- add search instrumentation in tests only, not user telemetry;
- profile 832 metadata entries before adding virtualization.

### P2.3 Local library state

- store favorites, recents, and current path/sample in a versioned storage key;
- cap recents and handle removed/deprecated IDs;
- make state resilient to catalog version changes;
- add an explicit Clear local library action;
- keep user state local and optional.

### P2.4 Preview and thumbnails

- keep the single-canvas preview path as the default;
- add a build script for static thumbnails only after profiling;
- cache previews by ID with bounded memory;
- render an explicit placeholder for index-only entries;
- test dark/light and narrow previews.

### P2.5 Content production

- author Wave A/B/C first;
- review Wave D/E with an advanced-content checklist;
- author Wave F peripherals in protocol-family batches;
- author Wave G as advanced-protocol study with references;
- finish Wave H invalid/verification/stress coverage;
- promote only the strongest reviewed lessons into Featured/learning paths.

### P2.6 Verification and regression

- add manifest-wide parser and relationship tests;
- add representative visual golden fixtures per shard;
- add search/filter component tests at 832-entry scale;
- add lazy-loading and stale-request tests;
- add browser E2E tests for planned/reviewed/invalid/favorite/path flows;
- include catalog checks in the normal production `check` command.

## Definition of done for Phase 2

- All 832 candidate IDs are represented in versioned metadata, with index-only status allowed.
- At least 200 reviewed waveform assets exist across all major shards before calling the catalog broadly usable.
- At least 100 correct/failure pair relationships are reviewed.
- Search can find samples across unloaded shards and communicates partial results correctly.
- Essentials pages never show index-only content by default.
- Favorites, recents, and learning-path continuation survive reload and catalog version migration.
- Every advanced-protocol study sample is labeled as study/content, not an implementation claim.
- Each major shard has at least one Waves GUI stress/feature-tagged sample.
- Production builds remain client-only, base-path-safe, and within an acceptable initial-load budget.
- No sample browser view renders more than the visible result slice and one live preview.
- Content and UI tests pass before a domain batch is promoted to reviewed.

## Recommended execution order

1. Implement P2.1 and migrate the first 40 entries to the sharded schema.
2. Author/review samples 41-100, then 101-150, then 151-215.
3. Implement P2.2 and P2.3 before adding hundreds of index-only entries.
4. Add the remaining metadata in shard-sized commits, preserving `index-only` status.
5. Author and review 216-515 in protocol-family batches.
6. Author 516-579 as the PCIe/IOMMU/CXL/UCIe advanced-protocol study track.
7. Add 580-748 for networking, media, power, security, safety, and firmware.
8. Finish 749-832 as explicit failure, verification, and GUI stress coverage.
9. Promote reviewed samples into paths and Featured only after evidence exists.

The next concrete Phase 2 action is P2.1 plus Wave A: add the shard manifest and author samples 41-100 without changing the browser's public interaction model.
+
## Complete 832-entry source inventory

The following inventory is copied from the supplied curriculum input and is intentionally complete. Numbering is preserved so each entry can be traced back to the source request. The Phase 2 manifest should turn each row into one `SampleManifestEntry`; descriptions are authoring guidance, not claims that assets already exist.

### Mapping source entries into IDs

- Preserve the source number as `sourceNumber` in the manifest.
- Generate a stable slug from the title and prefix it with the canonical shard/category.
- Resolve duplicate slugs with a deterministic protocol/scenario suffix, never by silently renaming an existing published ID.
- Keep the original title and authoring notes verbatim in the content review record.


## Fundamentals (1–32)

### 1. Clock and synchronous data
- **Source number:** 1
- **Initial status:** `index-only`
- `clk`, `data`, `sampled_data`
- Show setup and hold around a rising edge.
- Exercises clocks, ordinary bits and timing annotations.

### 2. Positive-edge flip-flop
- **Source number:** 2
- **Initial status:** `index-only`
- `clk`, `d`, `q`
- Show one-cycle propagation.

### 3. Flip-flop with asynchronous reset
- **Source number:** 3
- **Initial status:** `index-only`
- Assert reset between clock edges.
- Deassert near a clock edge.

### 4. Synchronous reset
- **Source number:** 4
- **Initial status:** `index-only`
- Contrast with asynchronous reset.
- Reset only takes effect at the next active edge.

### 5. Active-low reset
- **Source number:** 5
- **Initial status:** `index-only`
- `rst_n`
- Common naming and polarity convention.

### 6. Clock enable
- **Source number:** 6
- **Initial status:** `index-only`
- `clk`, `en`, `d`, `q`
- Q holds while enable is low.

### 7. Registered pulse
- **Source number:** 7
- **Initial status:** `index-only`
- One-cycle pulse generated from a condition.

### 8. Level versus pulse
- **Source number:** 8
- **Initial status:** `index-only`
- Compare a persistent request with a one-cycle event.

### 9. Rising-edge detector
- **Source number:** 9
- **Initial status:** `index-only`
- `signal`, `signal_d`, `rise_pulse`

### 10. Falling-edge detector
- **Source number:** 10
- **Initial status:** `index-only`
- `signal`, `signal_d`, `fall_pulse`

### 11. Toggle detector
- **Source number:** 11
- **Initial status:** `index-only`
- Useful introduction to CDC toggle schemes.

### 12. Two-cycle pipeline
- **Source number:** 12
- **Initial status:** `index-only`
- `valid`, `data`, pipeline stages, output.

### 13. Pipeline with stalls
- **Source number:** 13
- **Initial status:** `index-only`
- Show valid data remaining stable during a stall.

### 14. Pipeline flush
- **Source number:** 14
- **Initial status:** `index-only`
- Insert bubbles after branch misprediction or cancellation.

### 15. Bubble propagation
- **Source number:** 15
- **Initial status:** `index-only`
- Explicit valid-bit pipeline.

### 16. Ready/valid transfer
- **Source number:** 16
- **Initial status:** `index-only`
- Transfer occurs only when both are asserted.

### 17. Ready before valid
- **Source number:** 17
- **Initial status:** `index-only`
- Receiver is already available.

### 18. Valid before ready
- **Source number:** 18
- **Initial status:** `index-only`
- Producer must hold payload stable.

### 19. Back-to-back ready/valid transfers
- **Source number:** 19
- **Initial status:** `index-only`
- One transfer per cycle.

### 20. Ready/valid backpressure
- **Source number:** 20
- **Initial status:** `index-only`
- Payload stability while `valid=1`, `ready=0`.

### 21. Illegal payload mutation under backpressure
- **Source number:** 21
- **Initial status:** `index-only`
- A deliberately incorrect sample.
- Excellent for teaching protocol assertions.

### 22. Request/acknowledge handshake
- **Source number:** 22
- **Initial status:** `index-only`
- Four-phase return-to-zero handshake.

### 23. Two-phase toggle handshake
- **Source number:** 23
- **Initial status:** `index-only`
- Request and acknowledge change state rather than pulse.

### 24. Fixed-latency request/response
- **Source number:** 24
- **Initial status:** `index-only`
- Response exactly N cycles after request.

### 25. Variable-latency request/response
- **Source number:** 25
- **Initial status:** `index-only`
- Request ID or tag is needed.

### 26. Timeout
- **Source number:** 26
- **Initial status:** `index-only`
- Request receives no response before a watchdog expires.

### 27. Retry
- **Source number:** 27
- **Initial status:** `index-only`
- Failed operation is reissued.

### 28. Counter rollover
- **Source number:** 28
- **Initial status:** `index-only`
- Exercise buses and boundary values.

### 29. Gray-code counter
- **Source number:** 29
- **Initial status:** `index-only`
- Only one bit changes per increment.

### 30. One-hot state machine
- **Source number:** 30
- **Initial status:** `index-only`
- State transitions and illegal-state recovery.

### 31. Encoded state machine
- **Source number:** 31
- **Initial status:** `index-only`
- IDLE, REQUEST, WAIT, DONE.

### 32. Mealy versus Moore output
- **Source number:** 32
- **Initial status:** `index-only`
- Demonstrate combinational versus registered output timing.
- # 2. Reset and clock-management samples
- These are highly relevant to ASIC integration and backend discussions.


## Clocking and reset (33–54)

### 33. Asynchronous assertion, synchronous deassertion
- **Source number:** 33
- **Initial status:** `index-only`
- Standard reset synchronizer pattern.

### 34. Reset synchronizer with two flops
- **Source number:** 34
- **Initial status:** `index-only`
- Show the deassertion pipeline.

### 35. Reset released while clock is stopped
- **Source number:** 35
- **Initial status:** `index-only`
- Output remains in reset until clocks resume.

### 36. Reset-domain crossing
- **Source number:** 36
- **Initial status:** `index-only`
- One block exits reset before another.

### 37. Reset sequencing between subsystems
- **Source number:** 37
- **Initial status:** `index-only`
- Power, PLL lock, bus reset, CPU reset.

### 38. Reset stretching
- **Source number:** 38
- **Initial status:** `index-only`
- Keep reset asserted for N cycles after lock.

### 39. PLL lock sequence
- **Source number:** 39
- **Initial status:** `index-only`
- `ref_clk`, `pll_enable`, `pll_lock`, `generated_clk`.

### 40. Clock divider by two
- **Source number:** 40
- **Initial status:** `index-only`
- Illustrates divided-clock CDC behavior.

### 41. Clock divider by four
- **Source number:** 41
- **Initial status:** `index-only`
- Show deterministic phase relation.

### 42. Related clocks with phase offset
- **Source number:** 42
- **Initial status:** `index-only`
- Same frequency but shifted clock edges.

### 43. Generated-clock crossing
- **Source number:** 43
- **Initial status:** `index-only`
- Parent clock to divided child clock.

### 44. Clock mux switching incorrectly
- **Source number:** 44
- **Initial status:** `index-only`
- Show a runt pulse or double edge.

### 45. Glitch-free clock mux
- **Source number:** 45
- **Initial status:** `index-only`
- Disable old clock before enabling new clock.

### 46. Clock gating
- **Source number:** 46
- **Initial status:** `index-only`
- Enable latched while clock is low.

### 47. Unsafe combinational clock gate
- **Source number:** 47
- **Initial status:** `index-only`
- Deliberately show a glitch.

### 48. Integrated clock-gating test enable
- **Source number:** 48
- **Initial status:** `index-only`
- Functional enable OR scan enable.

### 49. Clock startup and shutdown
- **Source number:** 49
- **Initial status:** `index-only`
- Quiesce transaction flow before stopping clock.

### 50. Dynamic frequency change
- **Source number:** 50
- **Initial status:** `index-only`
- Pause, reprogram divider/PLL, lock, resume.

### 51. Clock-domain phase drift
- **Source number:** 51
- **Initial status:** `index-only`
- Two nominally similar but asynchronous clocks.

### 52. Duty-cycle distortion
- **Source number:** 52
- **Initial status:** `index-only`
- Useful for fine-timing and Undulate rendering.

### 53. Clock jitter illustration
- **Source number:** 53
- **Initial status:** `index-only`
- Fine-timed edge placement.

### 54. Minimum pulse-width violation
- **Source number:** 54
- **Initial status:** `index-only`
- Very narrow high or low phase.
- # 3. CDC examples
- This section should demonstrate core CDC concepts with clear, focused examples.


## CDC (55–80)

### 55. Single-bit two-flop synchronizer
- **Source number:** 55
- **Initial status:** `index-only`
- Source level remains stable long enough.

### 56. Two-flop synchronizer latency variation
- **Source number:** 56
- **Initial status:** `index-only`
- Destination sees the change in two or three cycles depending on phase.

### 57. Metastability conceptual example
- **Source number:** 57
- **Initial status:** `index-only`
- Use an `X` or metastability annotation at the first synchronizer stage.

### 58. Pulse lost across a slow destination clock
- **Source number:** 58
- **Initial status:** `index-only`
- Deliberately incorrect.

### 59. Pulse stretching
- **Source number:** 59
- **Initial status:** `index-only`
- Extend the pulse until destination captures it.

### 60. Pulse synchronizer using toggle
- **Source number:** 60
- **Initial status:** `index-only`
- Source toggles state for every event.

### 61. Toggle synchronizer failure with events too close
- **Source number:** 61
- **Initial status:** `index-only`
- Two source events occur before destination observes the first.

### 62. Four-phase request/acknowledge CDC
- **Source number:** 62
- **Initial status:** `index-only`
- Reliable single transaction transfer.

### 63. Handshake with source backpressure
- **Source number:** 63
- **Initial status:** `index-only`
- Source cannot issue another request until acknowledgement.

### 64. Multi-bit bus crossed independently
- **Source number:** 64
- **Initial status:** `index-only`
- Deliberately incorrect incoherent capture.

### 65. Data plus synchronized valid
- **Source number:** 65
- **Initial status:** `index-only`
- Data held stable around the valid crossing.

### 66. Mux-based data synchronizer
- **Source number:** 66
- **Initial status:** `index-only`
- Source holds data until destination acknowledges.

### 67. Gray counter crossing
- **Source number:** 67
- **Initial status:** `index-only`
- Typical asynchronous FIFO pointer technique.

### 68. Binary counter crossing failure
- **Source number:** 68
- **Initial status:** `index-only`
- Multiple bits transition and destination captures an impossible value.

### 69. Asynchronous FIFO write
- **Source number:** 69
- **Initial status:** `index-only`
- Write clock, write enable, write pointer, full.

### 70. Asynchronous FIFO read
- **Source number:** 70
- **Initial status:** `index-only`
- Read clock, read enable, read pointer, empty.

### 71. Asynchronous FIFO pointer synchronization
- **Source number:** 71
- **Initial status:** `index-only`
- Binary-to-Gray, synchronizer, Gray-to-binary.

### 72. FIFO full detection
- **Source number:** 72
- **Initial status:** `index-only`
- Inverted high Gray-pointer bits.

### 73. FIFO empty detection
- **Source number:** 73
- **Initial status:** `index-only`
- Synchronized write pointer equals read pointer.

### 74. FIFO almost-full and almost-empty
- **Source number:** 74
- **Initial status:** `index-only`
- Threshold-based flow control.

### 75. CDC reset mismatch
- **Source number:** 75
- **Initial status:** `index-only`
- One pointer resets while the other domain continues.

### 76. Reconvergence hazard
- **Source number:** 76
- **Initial status:** `index-only`
- Two synchronized bits reconverge into logic.

### 77. Related-clock transfer without handshake
- **Source number:** 77
- **Initial status:** `index-only`
- Show valid timing assumptions.

### 78. Related-clock transfer with conservative handshake
- **Source number:** 78
- **Initial status:** `index-only`
- Compare latency and implementation cost.

### 79. Mesochronous crossing
- **Source number:** 79
- **Initial status:** `index-only`
- Same nominal frequency, unknown phase.

### 80. Plesiochronous crossing
- **Source number:** 80
- **Initial status:** `index-only`
- Slightly different frequencies causing elastic-buffer drift.
- # 4. FIFOs, queues and buffering


## FIFOs and buffering (81–100)

### 81. Synchronous FIFO push
- **Source number:** 81
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 82. Synchronous FIFO pop
- **Source number:** 82
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 83. Simultaneous push and pop
- **Source number:** 83
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 84. Push while full
- **Source number:** 84
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 85. Pop while empty
- **Source number:** 85
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 86. Show-ahead FIFO
- **Source number:** 86
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 87. Registered-output FIFO
- **Source number:** 87
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 88. FIFO occupancy counter
- **Source number:** 88
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 89. Skid buffer capture
- **Source number:** 89
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 90. Skid buffer pass-through
- **Source number:** 90
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 91. One-entry elastic buffer
- **Source number:** 91
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 92. Two-entry elastic buffer
- **Source number:** 92
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 93. Credit-based buffer
- **Source number:** 93
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 94. Credit exhaustion
- **Source number:** 94
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 95. Credit return
- **Source number:** 95
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 96. Packet FIFO with end-of-packet marker
- **Source number:** 96
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 97. Packet drop on overflow
- **Source number:** 97
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 98. Store-and-forward buffering
- **Source number:** 98
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 99. Cut-through forwarding
- **Source number:** 99
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 100. Reorder buffer allocation and retirement
- **Source number:** 100
- **Initial status:** `index-only`
- # 5. APB
- APB is an excellent first real bus protocol because the phases are visually clean.


## AMBA (101–192)

### 101. APB write without wait states
- **Source number:** 101
- **Initial status:** `index-only`
- `PCLK`, `PSEL`, `PENABLE`, `PWRITE`, `PADDR`, `PWDATA`, `PREADY`.

### 102. APB read without wait states
- **Source number:** 102
- **Initial status:** `index-only`
- Add `PRDATA`.

### 103. APB write with wait states
- **Source number:** 103
- **Initial status:** `index-only`
- Hold address and control stable while `PREADY=0`.

### 104. APB read with wait states
- **Source number:** 104
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 105. Back-to-back APB transfers to the same peripheral
- **Source number:** 105
- **Initial status:** `index-only`
- Return to setup phase.

### 106. Back-to-back APB transfers to different peripherals
- **Source number:** 106
- **Initial status:** `index-only`
- Change `PSELx`.

### 107. APB error response
- **Source number:** 107
- **Initial status:** `index-only`
- `PSLVERR` sampled at completion.

### 108. Illegal APB control mutation during access
- **Source number:** 108
- **Initial status:** `index-only`
- Deliberately invalid.

### 109. APB bridge request
- **Source number:** 109
- **Initial status:** `index-only`
- Upstream bus transaction converted into APB setup/access phases.

### 110. APB peripheral register read/write
- **Source number:** 110
- **Initial status:** `index-only`
- Add internal register side effects.
- # 6. AMBA AHB/AHB-Lite

### 111. AHB-Lite single read
- **Source number:** 111
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 112. AHB-Lite single write
- **Source number:** 112
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 113. AHB address/data phase overlap
- **Source number:** 113
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 114. AHB wait-state insertion
- **Source number:** 114
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 115. AHB error response
- **Source number:** 115
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 116. AHB back-to-back transfers
- **Source number:** 116
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 117. AHB incrementing burst
- **Source number:** 117
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 118. AHB wrapping burst
- **Source number:** 118
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 119. AHB BUSY transfer
- **Source number:** 119
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 120. AHB NONSEQ followed by SEQ
- **Source number:** 120
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 121. AHB pipeline stall
- **Source number:** 121
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 122. AHB slave selection and decode
- **Source number:** 122
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 123. AHB default slave response
- **Source number:** 123
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 124. AHB arbitration between two masters
- **Source number:** 124
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 125. AHB bus ownership handover
- **Source number:** 125
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 126. AHB locked sequence
- **Source number:** 126
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 127. AHB split/retry historical example
- **Source number:** 127
- **Initial status:** `index-only`
- Useful conceptually even if focusing mostly on AHB-Lite.
- # 7. AXI4-Lite
- This should be a major gallery category.

### 128. AXI4-Lite write: AW and W together
- **Source number:** 128
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 129. AXI4-Lite write: AW before W
- **Source number:** 129
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 130. AXI4-Lite write: W before AW
- **Source number:** 130
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 131. AXI4-Lite write response
- **Source number:** 131
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 132. AXI4-Lite write with AW backpressure
- **Source number:** 132
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 133. AXI4-Lite write with W backpressure
- **Source number:** 133
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 134. AXI4-Lite write-response backpressure
- **Source number:** 134
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 135. AXI4-Lite read
- **Source number:** 135
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 136. AXI4-Lite AR backpressure
- **Source number:** 136
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 137. AXI4-Lite R backpressure
- **Source number:** 137
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 138. Independent simultaneous read and write
- **Source number:** 138
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 139. Two outstanding read requests
- **Source number:** 139
- **Initial status:** `index-only`
- Useful to discuss what a specific slave supports, even though many simple slaves limit outstanding depth.

### 140. Write strobe partial update
- **Source number:** 140
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 141. Misaligned address handling
- **Source number:** 141
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 142. DECERR response
- **Source number:** 142
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 143. SLVERR response
- **Source number:** 143
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 144. Register with write-one-to-clear bits
- **Source number:** 144
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 145. Read-clear status register
- **Source number:** 145
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 146. AXI-Lite bridge timeout
- **Source number:** 146
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 147. Incorrect coupling of AWREADY and WREADY
- **Source number:** 147
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 148. Incorrect master dropping VALID early
- **Source number:** 148
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 149. Payload instability while VALID waits
- **Source number:** 149
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 150. AXI-Lite skid-buffered slave
- **Source number:** 150
- **Initial status:** `index-only`
- # 8. Full AXI4
- Break AXI into many small samples. A single giant AXI sample will teach less.

### 151. AXI single-beat read
- **Source number:** 151
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 152. AXI single-beat write
- **Source number:** 152
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 153. AXI incrementing read burst
- **Source number:** 153
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 154. AXI incrementing write burst
- **Source number:** 154
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 155. AXI fixed burst
- **Source number:** 155
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 156. AXI wrapping burst
- **Source number:** 156
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 157. AXI `RLAST`
- **Source number:** 157
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 158. AXI `WLAST`
- **Source number:** 158
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 159. Write-data burst backpressure
- **Source number:** 159
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 160. Read-data burst backpressure
- **Source number:** 160
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 161. Address-channel backpressure
- **Source number:** 161
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 162. Separate AW and W timing
- **Source number:** 162
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 163. Multiple outstanding reads with different IDs
- **Source number:** 163
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 164. Interleaved read responses by ID
- **Source number:** 164
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 165. Out-of-order read completion
- **Source number:** 165
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 166. Multiple outstanding writes
- **Source number:** 166
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 167. Write response associated with ID
- **Source number:** 167
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 168. Burst crossing a 4 KiB boundary â€” illegal
- **Source number:** 168
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 169. Narrow transfer on wider bus
- **Source number:** 169
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 170. Unaligned transfer
- **Source number:** 170
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 171. Byte-lane `WSTRB`
- **Source number:** 171
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 172. Exclusive read/write success
- **Source number:** 172
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 173. Exclusive access failure
- **Source number:** 173
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 174. Atomic operation conceptual sample
- **Source number:** 174
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 175. AXI QoS arbitration
- **Source number:** 175
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 176. AXI region signaling
- **Source number:** 176
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 177. AXI protection attributes
- **Source number:** 177
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 178. AXI cache attributes
- **Source number:** 178
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 179. AXI user sideband
- **Source number:** 179
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 180. AXI timeout and transaction abort policy
- **Source number:** 180
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 181. AXI width converter: 32-bit to 128-bit
- **Source number:** 181
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 182. AXI width converter: 128-bit to 32-bit
- **Source number:** 182
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 183. AXI clock converter
- **Source number:** 183
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 184. AXI register slice
- **Source number:** 184
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 185. AXI crossbar arbitration
- **Source number:** 185
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 186. AXI decode error
- **Source number:** 186
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 187. AXI slave error
- **Source number:** 187
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 188. AXI outstanding-limit throttling
- **Source number:** 188
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 189. AXI write-data starvation
- **Source number:** 189
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 190. AXI read-data starvation
- **Source number:** 190
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 191. AXI deadlock caused by channel dependency
- **Source number:** 191
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 192. Correct independent-channel implementation
- **Source number:** 192
- **Initial status:** `index-only`
- # 9. AXI-Stream


## AXI-Stream and other buses (193–235)

### 193. Single AXI-Stream beat
- **Source number:** 193
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 194. Continuous streaming
- **Source number:** 194
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 195. Backpressure
- **Source number:** 195
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 196. Packet with `TLAST`
- **Source number:** 196
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 197. Partial final beat with `TKEEP`
- **Source number:** 197
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 198. Byte qualification with `TSTRB`
- **Source number:** 198
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 199. Packet metadata with `TUSER`
- **Source number:** 199
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 200. Stream routing with `TDEST`
- **Source number:** 200
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 201. Stream identification with `TID`
- **Source number:** 201
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 202. Source holds data stable during stall
- **Source number:** 202
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 203. Illegal source changing data under stall
- **Source number:** 203
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 204. Packet bubble
- **Source number:** 204
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 205. Packet truncation
- **Source number:** 205
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 206. Packet abort using `TUSER`
- **Source number:** 206
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 207. AXI-Stream FIFO
- **Source number:** 207
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 208. AXI-Stream skid buffer
- **Source number:** 208
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 209. AXI-Stream width conversion
- **Source number:** 209
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 210. AXI-Stream clock conversion
- **Source number:** 210
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 211. Two-input stream arbiter
- **Source number:** 211
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 212. Packet-level arbitration
- **Source number:** 212
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 213. Beat-level arbitration problem
- **Source number:** 213
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 214. Rate limiter
- **Source number:** 214
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 215. Frame synchronizer
- **Source number:** 215
- **Initial status:** `index-only`
- # 10. Wishbone and TileLink
- These add protocol diversity without being as enormous as AXI.

### 216. Wishbone classic read
- **Source number:** 216
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 217. Wishbone classic write
- **Source number:** 217
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 218. Wishbone wait states
- **Source number:** 218
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 219. Wishbone error
- **Source number:** 219
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 220. Wishbone retry
- **Source number:** 220
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 221. Wishbone pipelined transfer
- **Source number:** 221
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 222. Wishbone burst
- **Source number:** 222
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 223. Wishbone stall
- **Source number:** 223
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 224. Wishbone byte select
- **Source number:** 224
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 225. TileLink UL Get
- **Source number:** 225
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 226. TileLink UL PutFullData
- **Source number:** 226
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 227. TileLink UL PutPartialData
- **Source number:** 227
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 228. TileLink request/response source ID
- **Source number:** 228
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 229. TileLink denied response
- **Source number:** 229
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 230. TileLink corrupt response
- **Source number:** 230
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 231. TileLink multibeat transfer
- **Source number:** 231
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 232. TileLink Acquire/Grant conceptual coherence flow
- **Source number:** 232
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 233. TileLink Release
- **Source number:** 233
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 234. TileLink Probe
- **Source number:** 234
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 235. TileLink credit/backpressure behavior
- **Source number:** 235
- **Initial status:** `index-only`
- # 11. Cache and coherency
- These are highly relevant to CPU, NoC, IOMMU and interconnect work.


## Cache, coherency, and NoC (236–310)

### 236. CPU cache hit
- **Source number:** 236
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 237. Read miss
- **Source number:** 237
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 238. Write hit
- **Source number:** 238
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 239. Write miss with write allocate
- **Source number:** 239
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 240. Write-through cache
- **Source number:** 240
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 241. Write-back cache
- **Source number:** 241
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 242. Dirty-line eviction
- **Source number:** 242
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 243. Clean-line eviction
- **Source number:** 243
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 244. Cache-line refill
- **Source number:** 244
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 245. Critical-word-first refill
- **Source number:** 245
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 246. Nonblocking cache with multiple misses
- **Source number:** 246
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 247. MSHR allocation
- **Source number:** 247
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 248. MSHR merge
- **Source number:** 248
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 249. Load after store forwarding
- **Source number:** 249
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 250. Store buffer drain
- **Source number:** 250
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 251. Memory ordering fence
- **Source number:** 251
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 252. Instruction-cache invalidation
- **Source number:** 252
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 253. Data-cache clean
- **Source number:** 253
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 254. TLB hit
- **Source number:** 254
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 255. TLB miss and page-table walk
- **Source number:** 255
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 256. TLB refill
- **Source number:** 256
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 257. Page fault
- **Source number:** 257
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 258. IOMMU translation
- **Source number:** 258
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 259. IOMMU fault response
- **Source number:** 259
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 260. DMA coherent read
- **Source number:** 260
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 261. DMA noncoherent cache-maintenance sequence
- **Source number:** 261
- **Initial status:** `index-only`
- ### Coherence-state samples

### 262. MESI: Invalid to Shared
- **Source number:** 262
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 263. MESI: Invalid to Exclusive
- **Source number:** 263
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 264. MESI: Exclusive to Modified
- **Source number:** 264
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 265. MESI: Shared to Modified upgrade
- **Source number:** 265
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 266. MESI: Snoop read of Modified line
- **Source number:** 266
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 267. MESI: Modified-line writeback
- **Source number:** 267
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 268. Two-core read sharing
- **Source number:** 268
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 269. Two-core write invalidation
- **Source number:** 269
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 270. False sharing
- **Source number:** 270
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 271. Snoop response latency
- **Source number:** 271
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 272. Snoop filter hit
- **Source number:** 272
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 273. Snoop filter miss
- **Source number:** 273
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 274. Directory lookup
- **Source number:** 274
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 275. Coherence retry
- **Source number:** 275
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 276. Coherence race between eviction and snoop
- **Source number:** 276
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 277. ACE read shared
- **Source number:** 277
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 278. ACE read unique
- **Source number:** 278
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 279. ACE clean unique
- **Source number:** 279
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 280. ACE snoop channels
- **Source number:** 280
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 281. CHI request/data/response conceptual transaction
- **Source number:** 281
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 282. CHI retry acknowledge
- **Source number:** 282
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 283. CHI data separated from response
- **Source number:** 283
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 284. CHI transaction ID reuse constraints
- **Source number:** 284
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 285. CHI credit flow
- **Source number:** 285
- **Initial status:** `index-only`
- # 12. Network-on-Chip and arbitration

### 286. Two-request round-robin arbiter
- **Source number:** 286
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 287. Fixed-priority arbiter
- **Source number:** 287
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 288. Priority starvation
- **Source number:** 288
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 289. Aging-based arbitration
- **Source number:** 289
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 290. Weighted round robin
- **Source number:** 290
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 291. Grant hold until transaction completion
- **Source number:** 291
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 292. One-hot grant
- **Source number:** 292
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 293. Request withdrawal
- **Source number:** 293
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 294. Locking an arbiter
- **Source number:** 294
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 295. Split transaction request/response
- **Source number:** 295
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 296. NoC packet header and payload flits
- **Source number:** 296
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 297. Start-of-packet/end-of-packet
- **Source number:** 297
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 298. Virtual channel assignment
- **Source number:** 298
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 299. Virtual-channel credits
- **Source number:** 299
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 300. Credit exhaustion
- **Source number:** 300
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 301. Head-of-line blocking
- **Source number:** 301
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 302. Wormhole routing
- **Source number:** 302
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 303. Store-and-forward routing
- **Source number:** 303
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 304. NoC retry
- **Source number:** 304
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 305. NoC parity error
- **Source number:** 305
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 306. NoC poison propagation
- **Source number:** 306
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 307. NoC ordering domain
- **Source number:** 307
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 308. NoC transaction reordering
- **Source number:** 308
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 309. NoC deadlock dependency cycle
- **Source number:** 309
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 310. NoC clock-domain bridge
- **Source number:** 310
- **Initial status:** `index-only`
- # 13. SRAM, ROM and register files


## SRAM and external memory (311–364)

### 311. Asynchronous ROM read
- **Source number:** 311
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 312. Synchronous ROM read
- **Source number:** 312
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 313. Single-port SRAM read
- **Source number:** 313
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 314. Single-port SRAM write
- **Source number:** 314
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 315. Read-first SRAM collision
- **Source number:** 315
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 316. Write-first SRAM collision
- **Source number:** 316
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 317. No-change SRAM collision
- **Source number:** 317
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 318. Byte-enable SRAM write
- **Source number:** 318
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 319. Dual-port SRAM independent access
- **Source number:** 319
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 320. Dual-port same-address read/read
- **Source number:** 320
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 321. Dual-port same-address read/write
- **Source number:** 321
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 322. Dual-port same-address write/write conflict
- **Source number:** 322
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 323. Memory macro chip-enable
- **Source number:** 323
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 324. Memory sleep and wakeup
- **Source number:** 324
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 325. ECC read without error
- **Source number:** 325
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 326. ECC corrected single-bit error
- **Source number:** 326
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 327. ECC uncorrectable double-bit error
- **Source number:** 327
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 328. Parity error
- **Source number:** 328
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 329. Register-file two-read one-write
- **Source number:** 329
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 330. Register-file write/read same address
- **Source number:** 330
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 331. Register-file bypass
- **Source number:** 331
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 332. CAM lookup
- **Source number:** 332
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 333. CAM multiple match
- **Source number:** 333
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 334. Content invalidation
- **Source number:** 334
- **Initial status:** `index-only`
- # 14. DDR and external memory
- You do not need to model every electrical detail initially. Start with command-level timing.

### 335. SDRAM activate-read-precharge
- **Source number:** 335
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 336. SDRAM activate-write-precharge
- **Source number:** 336
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 337. Row hit
- **Source number:** 337
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 338. Row miss
- **Source number:** 338
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 339. Bank conflict
- **Source number:** 339
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 340. Auto-precharge
- **Source number:** 340
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 341. Refresh
- **Source number:** 341
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 342. Refresh postponement
- **Source number:** 342
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 343. Read-to-read timing
- **Source number:** 343
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 344. Write-to-write timing
- **Source number:** 344
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 345. Read-to-write turnaround
- **Source number:** 345
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 346. Write-to-read turnaround
- **Source number:** 346
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 347. CAS latency
- **Source number:** 347
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 348. Burst read
- **Source number:** 348
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 349. Burst write
- **Source number:** 349
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 350. DDR DQS-centered write data
- **Source number:** 350
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 351. DDR DQS-aligned read data
- **Source number:** 351
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 352. Write leveling
- **Source number:** 352
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 353. Read training
- **Source number:** 353
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 354. ZQ calibration
- **Source number:** 354
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 355. Self-refresh entry and exit
- **Source number:** 355
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 356. Power-down entry and exit
- **Source number:** 356
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 357. DDR bank-group restriction
- **Source number:** 357
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 358. DDR command queue reordering
- **Source number:** 358
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 359. Memory-controller arbitration
- **Source number:** 359
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 360. ECC scrub
- **Source number:** 360
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 361. LPDDR deep-power-down conceptual sample
- **Source number:** 361
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 362. LPDDR data-bus inversion
- **Source number:** 362
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 363. HBM pseudo-channel transaction
- **Source number:** 363
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 364. HBM multiple-bank parallelism
- **Source number:** 364
- **Initial status:** `index-only`
- These will heavily exercise fine timing, phases, grouped signals and annotations.
- # 15. SPI and QSPI


## Serial and peripherals (365–515)

### 365. SPI mode 0 transfer
- **Source number:** 365
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 366. SPI mode 1 transfer
- **Source number:** 366
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 367. SPI mode 2 transfer
- **Source number:** 367
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 368. SPI mode 3 transfer
- **Source number:** 368
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 369. SPI full-duplex byte
- **Source number:** 369
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 370. SPI chip-select framing
- **Source number:** 370
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 371. SPI multiple bytes under one chip select
- **Source number:** 371
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 372. SPI chip-select gap between words
- **Source number:** 372
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 373. SPI variable word length
- **Source number:** 373
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 374. SPI read command followed by data
- **Source number:** 374
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 375. SPI flash JEDEC ID read
- **Source number:** 375
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 376. SPI flash page program
- **Source number:** 376
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 377. SPI flash write-enable sequence
- **Source number:** 377
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 378. SPI flash busy polling
- **Source number:** 378
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 379. Dual-SPI read
- **Source number:** 379
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 380. Quad-SPI read
- **Source number:** 380
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 381. QSPI command/address/dummy/data phases
- **Source number:** 381
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 382. QSPI mode switch
- **Source number:** 382
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 383. SPI clock too fast for data setup
- **Source number:** 383
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 384. SPI chip-select setup/hold violation
- **Source number:** 384
- **Initial status:** `index-only`
- # 16. IÂ²C and I3C

### 385. IÂ²C START
- **Source number:** 385
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 386. IÂ²C STOP
- **Source number:** 386
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 387. IÂ²C repeated START
- **Source number:** 387
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 388. IÂ²C address plus write
- **Source number:** 388
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 389. IÂ²C address plus read
- **Source number:** 389
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 390. IÂ²C ACK
- **Source number:** 390
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 391. IÂ²C NACK
- **Source number:** 391
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 392. IÂ²C register write
- **Source number:** 392
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 393. IÂ²C register read with repeated START
- **Source number:** 393
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 394. IÂ²C clock stretching
- **Source number:** 394
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 395. IÂ²C arbitration between two masters
- **Source number:** 395
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 396. IÂ²C arbitration loss
- **Source number:** 396
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 397. IÂ²C stuck-low bus
- **Source number:** 397
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 398. IÂ²C bus recovery with nine clocks
- **Source number:** 398
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 399. IÂ²C 7-bit address
- **Source number:** 399
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 400. IÂ²C 10-bit address
- **Source number:** 400
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 401. IÂ²C general call
- **Source number:** 401
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 402. IÂ²C SMBus timeout
- **Source number:** 402
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 403. I3C dynamic address assignment
- **Source number:** 403
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 404. I3C SDR private transfer
- **Source number:** 404
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 405. I3C in-band interrupt
- **Source number:** 405
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 406. I3C legacy IÂ²C-device coexistence
- **Source number:** 406
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 407. I3C push-pull versus open-drain phases
- **Source number:** 407
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 408. I3C common command code
- **Source number:** 408
- **Initial status:** `index-only`
- These are especially good for open-drain behavior, bidirectional signals and annotations.
- # 17. UART, LIN and serial links

### 409. UART 8N1 byte
- **Source number:** 409
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 410. UART start bit
- **Source number:** 410
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 411. UART parity
- **Source number:** 411
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 412. UART two stop bits
- **Source number:** 412
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 413. UART framing error
- **Source number:** 413
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 414. UART parity error
- **Source number:** 414
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 415. UART break condition
- **Source number:** 415
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 416. UART oversampling
- **Source number:** 416
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 417. UART baud-rate mismatch
- **Source number:** 417
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 418. UART FIFO interrupt
- **Source number:** 418
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 419. UART RTS/CTS flow control
- **Source number:** 419
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 420. UART XON/XOFF conceptual sample
- **Source number:** 420
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 421. LIN break and sync
- **Source number:** 421
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 422. LIN protected identifier
- **Source number:** 422
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 423. LIN header and response
- **Source number:** 423
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 424. LIN checksum
- **Source number:** 424
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 425. LIN master schedule
- **Source number:** 425
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 426. LIN slave response timeout
- **Source number:** 426
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 427. LIN wakeup pulse
- **Source number:** 427
- **Initial status:** `index-only`
- # 18. CAN and automotive buses

### 428. CAN standard data frame
- **Source number:** 428
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 429. CAN extended identifier
- **Source number:** 429
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 430. CAN arbitration
- **Source number:** 430
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 431. CAN dominant versus recessive
- **Source number:** 431
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 432. CAN arbitration loss
- **Source number:** 432
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 433. CAN remote frame
- **Source number:** 433
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 434. CAN acknowledgment slot
- **Source number:** 434
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 435. CAN bit stuffing
- **Source number:** 435
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 436. CAN bit-stuff error
- **Source number:** 436
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 437. CAN CRC error
- **Source number:** 437
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 438. CAN error frame
- **Source number:** 438
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 439. CAN overload frame
- **Source number:** 439
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 440. CAN retransmission
- **Source number:** 440
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 441. CAN error-active node
- **Source number:** 441
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 442. CAN error-passive node
- **Source number:** 442
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 443. CAN bus-off
- **Source number:** 443
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 444. CAN FD arbitration/data-rate switch
- **Source number:** 444
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 445. CAN FD extended payload
- **Source number:** 445
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 446. CAN FD error
- **Source number:** 446
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 447. Automotive watchdog challenge-response
- **Source number:** 447
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 448. ASIL safety monitor disagreement
- **Source number:** 448
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 449. Lockstep-core error indication
- **Source number:** 449
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 450. End-to-end protection counter and CRC
- **Source number:** 450
- **Initial status:** `index-only`
- # 19. JTAG, SWD and debug

### 451. JTAG TAP reset using five TMS clocks
- **Source number:** 451
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 452. JTAG state-machine path
- **Source number:** 452
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 453. JTAG Shift-IR
- **Source number:** 453
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 454. JTAG Shift-DR
- **Source number:** 454
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 455. JTAG IDCODE read
- **Source number:** 455
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 456. JTAG BYPASS
- **Source number:** 456
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 457. JTAG boundary scan
- **Source number:** 457
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 458. JTAG capture-shift-update
- **Source number:** 458
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 459. JTAG TDO turnaround
- **Source number:** 459
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 460. Scan enable and scan shift
- **Source number:** 460
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 461. Scan capture
- **Source number:** 461
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 462. Scan compression conceptual sample
- **Source number:** 462
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 463. MBIST start/done/fail
- **Source number:** 463
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 464. LBIST sequence
- **Source number:** 464
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 465. SWD line reset
- **Source number:** 465
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 466. SWD request
- **Source number:** 466
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 467. SWD ACK
- **Source number:** 467
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 468. SWD read turnaround
- **Source number:** 468
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 469. SWD parity error
- **Source number:** 469
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 470. Debug halt request and acknowledge
- **Source number:** 470
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 471. Breakpoint hit
- **Source number:** 471
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 472. Trace packet output
- **Source number:** 472
- **Initial status:** `index-only`
- # 20. Interrupts, timers and peripherals

### 473. Level-sensitive interrupt
- **Source number:** 473
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 474. Edge-sensitive interrupt
- **Source number:** 474
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 475. Interrupt pulse lost
- **Source number:** 475
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 476. Interrupt synchronizer
- **Source number:** 476
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 477. Interrupt pending and clear
- **Source number:** 477
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 478. Interrupt mask
- **Source number:** 478
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 479. Interrupt priority
- **Source number:** 479
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 480. Nested interrupts
- **Source number:** 480
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 481. Interrupt aggregation
- **Source number:** 481
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 482. MSI generation
- **Source number:** 482
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 483. MSI-X table lookup
- **Source number:** 483
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 484. Interrupt coalescing
- **Source number:** 484
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 485. Timer expiry
- **Source number:** 485
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 486. Periodic timer
- **Source number:** 486
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 487. Watchdog warning and reset
- **Source number:** 487
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 488. PWM output
- **Source number:** 488
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 489. PWM duty-cycle change
- **Source number:** 489
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 490. Input capture
- **Source number:** 490
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 491. Output compare
- **Source number:** 491
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 492. Debounced GPIO input
- **Source number:** 492
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 493. GPIO edge interrupt
- **Source number:** 493
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 494. Quadrature encoder
- **Source number:** 494
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 495. Pulse-width measurement
- **Source number:** 495
- **Initial status:** `index-only`
- # 21. DMA

### 496. Simple memory-to-memory DMA
- **Source number:** 496
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 497. Peripheral-to-memory DMA
- **Source number:** 497
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 498. Memory-to-peripheral DMA
- **Source number:** 498
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 499. DMA request and acknowledge
- **Source number:** 499
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 500. DMA descriptor fetch
- **Source number:** 500
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 501. DMA descriptor chaining
- **Source number:** 501
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 502. Scatter-gather DMA
- **Source number:** 502
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 503. DMA burst generation
- **Source number:** 503
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 504. DMA backpressure
- **Source number:** 504
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 505. DMA completion interrupt
- **Source number:** 505
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 506. DMA error interrupt
- **Source number:** 506
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 507. DMA unaligned transfer
- **Source number:** 507
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 508. DMA crossing a page boundary
- **Source number:** 508
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 509. DMA IOMMU translation
- **Source number:** 509
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 510. DMA page fault
- **Source number:** 510
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 511. DMA cancellation
- **Source number:** 511
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 512. DMA pause/resume
- **Source number:** 512
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 513. DMA outstanding-read queue
- **Source number:** 513
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 514. DMA reorder buffer
- **Source number:** 514
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 515. DMA coherent versus noncoherent sequence
- **Source number:** 515
- **Initial status:** `index-only`
- # 22. PCIe
- PCIe is enormous, so diagrams should focus on transaction-layer concepts first.


## PCIe and chiplets (516–579)

### 516. PCIe Memory Read Request
- **Source number:** 516
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 517. PCIe Completion with Data
- **Source number:** 517
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 518. PCIe Memory Write posted transaction
- **Source number:** 518
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 519. PCIe Configuration Read
- **Source number:** 519
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 520. PCIe Configuration Write
- **Source number:** 520
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 521. PCIe Completion without Data
- **Source number:** 521
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 522. PCIe Unsupported Request
- **Source number:** 522
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 523. PCIe Completer Abort
- **Source number:** 523
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 524. PCIe split completion
- **Source number:** 524
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 525. PCIe tag allocation
- **Source number:** 525
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 526. PCIe tag reuse
- **Source number:** 526
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 527. PCIe multiple outstanding reads
- **Source number:** 527
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 528. PCIe completion reordering
- **Source number:** 528
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 529. PCIe relaxed ordering
- **Source number:** 529
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 530. PCIe no-snoop attribute
- **Source number:** 530
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 531. PCIe byte enables
- **Source number:** 531
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 532. PCIe maximum payload segmentation
- **Source number:** 532
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 533. PCIe maximum read-request size
- **Source number:** 533
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 534. PCIe flow-control credits
- **Source number:** 534
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 535. Posted-header credit exhaustion
- **Source number:** 535
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 536. Nonposted credit exhaustion
- **Source number:** 536
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 537. Completion credit exhaustion
- **Source number:** 537
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 538. PCIe replay after missing acknowledgment
- **Source number:** 538
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 539. PCIe sequence number
- **Source number:** 539
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 540. PCIe L0 to L0s
- **Source number:** 540
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 541. PCIe L0 to L1
- **Source number:** 541
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 542. PCIe link retraining
- **Source number:** 542
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 543. PCIe hot reset
- **Source number:** 543
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 544. PCIe fundamental reset
- **Source number:** 544
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 545. PCIe surprise-down
- **Source number:** 545
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 546. PCIe MSI
- **Source number:** 546
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 547. PCIe MSI-X
- **Source number:** 547
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 548. PCIe AER correctable error
- **Source number:** 548
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 549. PCIe AER uncorrectable error
- **Source number:** 549
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 550. PCIe Function-Level Reset
- **Source number:** 550
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 551. PCIe SR-IOV VF transaction
- **Source number:** 551
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 552. PCIe ATS translation request
- **Source number:** 552
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 553. PCIe PASID-tagged request
- **Source number:** 553
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 554. PCIe PRI page request
- **Source number:** 554
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 555. PCIe peer-to-peer transaction
- **Source number:** 555
- **Initial status:** `index-only`
- The PCIe + IOMMU + ATS/PASID/PRI group provides valuable advanced-protocol coverage.
- # 23. CXL, UCIe and chiplet-oriented samples
- Start conceptually rather than pretending to encode every flit field.

### 556. CXL.io transaction
- **Source number:** 556
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 557. CXL.cache host request
- **Source number:** 557
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 558. CXL.cache device response
- **Source number:** 558
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 559. CXL.mem read
- **Source number:** 559
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 560. CXL.mem write
- **Source number:** 560
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 561. CXL.mem media response
- **Source number:** 561
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 562. CXL poison response
- **Source number:** 562
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 563. CXL retry
- **Source number:** 563
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 564. CXL device coherency flow
- **Source number:** 564
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 565. CXL HDM decoder request
- **Source number:** 565
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 566. CXL link initialization conceptual sample
- **Source number:** 566
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 567. CXL IDE security setup conceptual sample
- **Source number:** 567
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 568. UCIe adapter request/response
- **Source number:** 568
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 569. UCIe flit transfer
- **Source number:** 569
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 570. UCIe credit flow
- **Source number:** 570
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 571. UCIe retry
- **Source number:** 571
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 572. UCIe CRC error
- **Source number:** 572
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 573. UCIe link initialization
- **Source number:** 573
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 574. UCIe power-state transition
- **Source number:** 574
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 575. UCIe protocol-layer stall
- **Source number:** 575
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 576. Chiplet sideband reset sequence
- **Source number:** 576
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 577. Die-to-die clock compensation
- **Source number:** 577
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 578. Die-to-die lane repair
- **Source number:** 578
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 579. Chiplet error containment
- **Source number:** 579
- **Initial status:** `index-only`
- # 24. Ethernet and packet processing


## Networking and media (580–647)

### 580. Ethernet preamble and SFD
- **Source number:** 580
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 581. Ethernet MAC frame
- **Source number:** 581
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 582. Ethernet interpacket gap
- **Source number:** 582
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 583. Ethernet CRC error
- **Source number:** 583
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 584. Ethernet pause frame
- **Source number:** 584
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 585. Ethernet transmit ready/valid
- **Source number:** 585
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 586. Ethernet receive ready/valid
- **Source number:** 586
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 587. MII transmit nibble stream
- **Source number:** 587
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 588. RMII transfer
- **Source number:** 588
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 589. RGMII double-data-rate transfer
- **Source number:** 589
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 590. GMII transfer
- **Source number:** 590
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 591. XGMII control and data
- **Source number:** 591
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 592. Ethernet frame with VLAN tag
- **Source number:** 592
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 593. ARP request and response conceptual timeline
- **Source number:** 593
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 594. IPv4 packet streaming
- **Source number:** 594
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 595. UDP packet streaming
- **Source number:** 595
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 596. TCP acknowledgment conceptual sequence
- **Source number:** 596
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 597. Packet parser stages
- **Source number:** 597
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 598. Header extraction
- **Source number:** 598
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 599. Checksum offload
- **Source number:** 599
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 600. Packet classification
- **Source number:** 600
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 601. Packet queue congestion
- **Source number:** 601
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 602. Packet drop
- **Source number:** 602
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 603. Priority flow control
- **Source number:** 603
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 604. PTP timestamp capture
- **Source number:** 604
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 605. Cut-through switch
- **Source number:** 605
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 606. Store-and-forward switch
- **Source number:** 606
- **Initial status:** `index-only`
- # 25. USB and common peripheral interfaces

### 607. USB reset
- **Source number:** 607
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 608. USB packet SYNC/PID/data/CRC conceptual sequence
- **Source number:** 608
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 609. USB SETUP transaction
- **Source number:** 609
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 610. USB control transfer
- **Source number:** 610
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 611. USB bulk OUT
- **Source number:** 611
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 612. USB bulk IN
- **Source number:** 612
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 613. USB interrupt transfer
- **Source number:** 613
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 614. USB isochronous transfer
- **Source number:** 614
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 615. USB NAK and retry
- **Source number:** 615
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 616. USB STALL
- **Source number:** 616
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 617. USB suspend and resume
- **Source number:** 617
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 618. USB endpoint data toggle
- **Source number:** 618
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 619. USB link power-state transition
- **Source number:** 619
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 620. SD card command/response
- **Source number:** 620
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 621. SD card single-block read
- **Source number:** 621
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 622. SD card single-block write
- **Source number:** 622
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 623. SD multi-block read
- **Source number:** 623
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 624. SDIO interrupt
- **Source number:** 624
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 625. eMMC command and response
- **Source number:** 625
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 626. eMMC boot sequence
- **Source number:** 626
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 627. eMMC HS timing
- **Source number:** 627
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 628. eMMC command queueing
- **Source number:** 628
- **Initial status:** `index-only`
- # 26. MIPI and display/camera interfaces

### 629. MIPI CSI-2 frame start/end
- **Source number:** 629
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 630. MIPI CSI-2 line start/end
- **Source number:** 630
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 631. CSI-2 short packet
- **Source number:** 631
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 632. CSI-2 long packet
- **Source number:** 632
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 633. CSI-2 ECC error
- **Source number:** 633
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 634. CSI-2 CRC error
- **Source number:** 634
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 635. CSI-2 virtual channels
- **Source number:** 635
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 636. D-PHY low-power to high-speed transition
- **Source number:** 636
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 637. D-PHY high-speed data burst
- **Source number:** 637
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 638. D-PHY turnaround
- **Source number:** 638
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 639. MIPI DSI command mode
- **Source number:** 639
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 640. MIPI DSI video mode
- **Source number:** 640
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 641. Display horizontal sync
- **Source number:** 641
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 642. Display vertical sync
- **Source number:** 642
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 643. Pixel-valid and pixel-data
- **Source number:** 643
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 644. Frame blanking
- **Source number:** 644
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 645. Camera exposure and frame-valid
- **Source number:** 645
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 646. Image-sensor line-valid
- **Source number:** 646
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 647. Pixel pipeline backpressure
- **Source number:** 647
- **Initial status:** `index-only`
- # 27. Power management and low-power design


## Power, security, and safety (648–695)

### 648. Power-domain shutdown
- **Source number:** 648
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 649. Isolation before power-off
- **Source number:** 649
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 650. Power-on before isolation release
- **Source number:** 650
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 651. State retention save
- **Source number:** 651
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 652. State retention restore
- **Source number:** 652
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 653. Retention failure
- **Source number:** 653
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 654. Power-good sequence
- **Source number:** 654
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 655. Voltage regulator enable
- **Source number:** 655
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 656. Dynamic voltage and frequency scaling
- **Source number:** 656
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 657. Clock stop before voltage change
- **Source number:** 657
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 658. Memory self-refresh before sleep
- **Source number:** 658
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 659. Wakeup request
- **Source number:** 659
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 660. Wakeup acknowledgment
- **Source number:** 660
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 661. Always-on controller sequence
- **Source number:** 661
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 662. Power-domain dependency
- **Source number:** 662
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 663. Low-power handshake timeout
- **Source number:** 663
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 664. UPF isolation control conceptual example
- **Source number:** 664
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 665. Level shifter direction
- **Source number:** 665
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 666. Power-aware reset sequence
- **Source number:** 666
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 667. Brownout detection
- **Source number:** 667
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 668. Thermal throttling
- **Source number:** 668
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 669. Power-state machine
- **Source number:** 669
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 670. PCIe/CXL low-power coordination
- **Source number:** 670
- **Initial status:** `index-only`
- # 28. Security and fault-management samples

### 671. Secure boot state sequence
- **Source number:** 671
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 672. Key-loading handshake
- **Source number:** 672
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 673. Key-valid and key-zeroization
- **Source number:** 673
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 674. Authentication success
- **Source number:** 674
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 675. Authentication failure
- **Source number:** 675
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 676. AES block request/response
- **Source number:** 676
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 677. Crypto pipeline with backpressure
- **Source number:** 677
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 678. Random-number generator valid
- **Source number:** 678
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 679. Entropy health-test failure
- **Source number:** 679
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 680. Privilege-check failure
- **Source number:** 680
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 681. Firewall allow transaction
- **Source number:** 681
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 682. Firewall deny transaction
- **Source number:** 682
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 683. Secure/nonsecure transaction attribute
- **Source number:** 683
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 684. Access-control audit event
- **Source number:** 684
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 685. Tamper detection
- **Source number:** 685
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 686. Tamper-triggered zeroization
- **Source number:** 686
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 687. Fault injection
- **Source number:** 687
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 688. Parity fault propagation
- **Source number:** 688
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 689. ECC correction
- **Source number:** 689
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 690. Fatal-error escalation
- **Source number:** 690
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 691. Watchdog reset escalation
- **Source number:** 691
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 692. Safety island heartbeat
- **Source number:** 692
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 693. Dual-core lockstep compare
- **Source number:** 693
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 694. Lockstep divergence
- **Source number:** 694
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 695. Error containment and subsystem reset
- **Source number:** 695
- **Initial status:** `index-only`
- # 29. Verification and assertion-oriented samples
- These are extremely useful because they can demonstrate why a waveform is wrong, not only how a protocol works.


## Firmware, verification, and GUI stress (696–832)

### 696. Assertion pass: request followed by acknowledgment
- **Source number:** 696
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 697. Assertion fail: missing acknowledgment
- **Source number:** 697
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 698. Bounded response latency
- **Source number:** 698
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 699. Unbounded liveness request
- **Source number:** 699
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 700. Mutual exclusion
- **Source number:** 700
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 701. One-hot grant assertion
- **Source number:** 701
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 702. Stable payload under backpressure
- **Source number:** 702
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 703. No request while reset
- **Source number:** 703
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 704. No response without request
- **Source number:** 704
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 705. FIFO overflow assertion
- **Source number:** 705
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 706. FIFO underflow assertion
- **Source number:** 706
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 707. AXI `VALID` held until `READY`
- **Source number:** 707
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 708. AXI `WLAST` at correct beat
- **Source number:** 708
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 709. AXI burst length mismatch
- **Source number:** 709
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 710. APB stable controls during wait
- **Source number:** 710
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 711. IÂ²C SDA stable while SCL high
- **Source number:** 711
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 712. Clock-gating glitch assertion
- **Source number:** 712
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 713. CDC pulse-width assumption
- **Source number:** 713
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 714. Reset release assumption
- **Source number:** 714
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 715. Counter monotonicity
- **Source number:** 715
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 716. Deadlock detector
- **Source number:** 716
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 717. Timeout assertion
- **Source number:** 717
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 718. Coverage sequence hit
- **Source number:** 718
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 719. Coverage sequence missed
- **Source number:** 719
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 720. Formal counterexample trace
- **Source number:** 720
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 721. Unknown/X propagation
- **Source number:** 721
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 722. Uninitialized register
- **Source number:** 722
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 723. X optimism example
- **Source number:** 723
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 724. X pessimism example
- **Source number:** 724
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 725. Contention producing X
- **Source number:** 725
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 726. Force/release debug example
- **Source number:** 726
- **Initial status:** `index-only`
- These could be annotated with red failure markers and links between cause and consequence.
- # 30. Firmware/hardware interaction

### 727. Firmware register write starts hardware
- **Source number:** 727
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 728. Busy polling
- **Source number:** 728
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 729. Interrupt-driven completion
- **Source number:** 729
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 730. Write-one-to-clear interrupt
- **Source number:** 730
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 731. Read-modify-write race
- **Source number:** 731
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 732. Hardware sets status while firmware clears it
- **Source number:** 732
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 733. Doorbell register
- **Source number:** 733
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 734. Mailbox request/response
- **Source number:** 734
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 735. Shared-memory producer/consumer
- **Source number:** 735
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 736. Firmware descriptor ring
- **Source number:** 736
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 737. Head/tail pointer update
- **Source number:** 737
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 738. Descriptor ownership bit
- **Source number:** 738
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 739. Firmware timeout and reset
- **Source number:** 739
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 740. Boot ROM to firmware handoff
- **Source number:** 740
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 741. CPU reset release
- **Source number:** 741
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 742. Peripheral initialization
- **Source number:** 742
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 743. Clock enable before register access
- **Source number:** 743
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 744. Power enable before MMIO
- **Source number:** 744
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 745. Firmware-triggered DMA
- **Source number:** 745
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 746. Firmware cache maintenance before DMA
- **Source number:** 746
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 747. Interrupt acknowledgment race
- **Source number:** 747
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 748. Polling versus interrupt comparison
- **Source number:** 748
- **Initial status:** `index-only`
- # 31. Deliberately broken protocol examples
- A dedicated â€œWhat is wrong here?â€ category would be excellent for learning and app demonstrations.

### 749. READY/VALID payload changes while stalled
- **Source number:** 749
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 750. VALID drops before handshake
- **Source number:** 750
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 751. Combinational READY/VALID loop
- **Source number:** 751
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 752. APB address changes during wait state
- **Source number:** 752
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 753. AXI burst crosses 4 KiB boundary
- **Source number:** 753
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 754. AXI `WLAST` asserted early
- **Source number:** 754
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 755. AXI `RLAST` asserted late
- **Source number:** 755
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 756. AXI write response before complete data burst
- **Source number:** 756
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 757. FIFO read while empty
- **Source number:** 757
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 758. FIFO write while full
- **Source number:** 758
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 759. CDC bus synchronized bit-by-bit
- **Source number:** 759
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 760. CDC pulse narrower than destination period
- **Source number:** 760
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 761. Reset deasserted asynchronously
- **Source number:** 761
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 762. Clock-gate glitch
- **Source number:** 762
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 763. IÂ²C SDA changes while SCL is high
- **Source number:** 763
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 764. SPI sampling on wrong edge
- **Source number:** 764
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 765. UART baud mismatch
- **Source number:** 765
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 766. CAN arbitration incorrectly drives recessive over dominant
- **Source number:** 766
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 767. SRAM dual-write conflict
- **Source number:** 767
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 768. Cache stale data after noncoherent DMA
- **Source number:** 768
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 769. Interrupt cleared before software observes it
- **Source number:** 769
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 770. DMA descriptor ownership race
- **Source number:** 770
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 771. NoC credit underflow
- **Source number:** 771
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 772. PCIe tag reused before completion
- **Source number:** 772
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 773. Coherence response sent with wrong transaction ID
- **Source number:** 773
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 774. Power isolation released too early
- **Source number:** 774
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 775. Retention restored before power-good
- **Source number:** 775
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 776. Security key remains valid after reset
- **Source number:** 776
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 777. Watchdog kicked by a deadlocked task
- **Source number:** 777
- **Initial status:** `index-only`
- # 32. Samples designed specifically to stress Waves GUI
- These may be less important as protocols, but they are essential regression/demo documents.

### 778. Very long digital waveform
- **Source number:** 778
- **Initial status:** `index-only`
- Hundreds or thousands of steps.

### 779. Many short vector segments
- **Source number:** 779
- **Initial status:** `index-only`
- Stress segment editing and labels.

### 780. Long vector label
- **Source number:** 780
- **Initial status:** `index-only`
- Test label fitting and `hscale`.

### 781. Multiple buses with different colors
- **Source number:** 781
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 782. Nested groups
- **Source number:** 782
- **Initial status:** `index-only`
- Three or four levels deep.

### 783. Collapsed groups
- **Source number:** 783
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 784. Large number of dependency edges
- **Source number:** 784
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 785. Crossing dependency edges
- **Source number:** 785
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 786. Curved edge controls
- **Source number:** 786
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 787. Many node anchors
- **Source number:** 787
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 788. Node anchors with duplicate-looking labels
- **Source number:** 788
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 789. Fine timing with nonuniform periods
- **Source number:** 789
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 790. Fine timing with negative phase
- **Source number:** 790
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 791. Fine timing with positive phase
- **Source number:** 791
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 792. Fine timing with duty-cycle changes
- **Source number:** 792
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 793. Fine timing plus glitches
- **Source number:** 793
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 794. Legacy WaveDrom `period` and `phase`
- **Source number:** 794
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 795. Mixed normal and legacy-period lanes
- **Source number:** 795
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 796. Native-timed bit lane
- **Source number:** 796
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 797. Native-timed vector lane
- **Source number:** 797
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 798. Multiple clock domains
- **Source number:** 798
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 799. Clock macros next to static cells
- **Source number:** 799
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 800. Selection across a partial clock macro
- **Source number:** 800
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 801. Gaps at beginning, middle and end
- **Source number:** 801
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 802. Additive gap painting
- **Source number:** 802
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 803. Glitches adjacent to gaps
- **Source number:** 803
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 804. Analogue step waveform
- **Source number:** 804
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 805. Analogue linear ramp
- **Source number:** 805
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 806. Analogue sampled waveform
- **Source number:** 806
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 807. Analogue overlays
- **Source number:** 807
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 808. Analogue plus digital control
- **Source number:** 808
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 809. Voltage droop during digital activity
- **Source number:** 809
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 810. Power-up analogue rail and reset release
- **Source number:** 810
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 811. Text annotations at every anchor mode
- **Source number:** 811
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 812. Vertical and horizontal line annotations
- **Source number:** 812
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 813. Global compression annotations
- **Source number:** 813
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 814. Structured arrows
- **Source number:** 814
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 815. Unknown opaque Undulate fields
- **Source number:** 815
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 816. Event-compressed VCD import
- **Source number:** 816
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 817. Mixed bus/scalar read-only lane
- **Source number:** 817
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 818. Duplicate signal names
- **Source number:** 818
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 819. Duplicate vector labels
- **Source number:** 819
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 820. Duplicate annotations
- **Source number:** 820
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 821. Empty document
- **Source number:** 821
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 822. Single-step document
- **Source number:** 822
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 823. Maximum-step document
- **Source number:** 823
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 824. Extremely narrow rows
- **Source number:** 824
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 825. Extremely tall analogue rows
- **Source number:** 825
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 826. Long Unicode signal names
- **Source number:** 826
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 827. Unicode bus labels
- **Source number:** 827
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 828. RTL-style names
- **Source number:** 828
- **Initial status:** `index-only`
- `u_dma/i_axi_mst_awvalid`

### 829. Escaped or punctuation-heavy names
- **Source number:** 829
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 830. Light-mode visual regression gallery
- **Source number:** 830
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 831. Dark-mode visual regression gallery
- **Source number:** 831
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.

### 832. Mobile/narrow-width gallery
- **Source number:** 832
- **Initial status:** `index-only`
- **Authoring note:** Define one focused rule, corner case, or GUI feature before promoting this entry to `draft`.
