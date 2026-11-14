import type { SampleLearningNotes } from './learningTypes';

const REFERENCE = 'https://documentation-service.arm.com/static/63fe2c1356ea36189d4e79f3';
const clock = { name: 'PCLK', meaning: 'Clock. Read the values held during a cycle at the rising edge on its right.' };
const select = { name: 'PSEL', meaning: 'Requester selects this peripheral; high in both SETUP and ACCESS.' };
const enable = { name: 'PENABLE', meaning: 'Requester identifies ACCESS. It is low for every new SETUP cycle.' };
const ready = { name: 'PREADY', meaning: 'Peripheral is ready to finish ACCESS. It does not complete a transfer during SETUP.' };
const error = { name: 'PSLVERR', meaning: 'Peripheral error result, sampled only when PSEL, PENABLE, and PREADY are all high.' };
const writeSignals = [
  clock, select, enable,
  { name: 'PWRITE', meaning: 'Requester direction: 1 means write, 0 means read.' },
  { name: 'PADDR', meaning: 'Requester address, held from SETUP through the completion edge.' },
  { name: 'PWDATA', meaning: 'Requester write data, held from SETUP through the completion edge.' },
  ready, error,
];
const readSignals = [
  clock, select, enable,
  { name: 'PWRITE', meaning: 'Requester direction: 0 selects a read.' },
  { name: 'PADDR', meaning: 'Requester address, held from SETUP through the completion edge.' },
  { name: 'PRDATA', meaning: 'Peripheral read data. It must be valid for completion; x means unspecified in this teaching trace.' },
  ready, error,
];

/** Original teaching examples checked against the supplied APB IHI 0024E specification. */
export const APB_LESSONS: Record<string, SampleLearningNotes> = {
  'amba/apb/write': {
    protocol: 'APB', order: 1,
    summary: 'Write 0xDEADBEEF to 0x1000 using the two required phases of an APB transfer.',
    objective: 'Recognize SETUP, ACCESS, and the rising edge that completes a write.',
    stages: [
      { title: 'Present the request: SETUP', start: 2, end: 3, signals: ['PSEL', 'PENABLE', 'PWRITE', 'PADDR', 'PWDATA'],
        description: 'PSEL rises and PENABLE stays low. The requester presents address 0x1000, write direction, and data 0xDEADBEEF. This one-cycle SETUP is required even though PREADY is already high.' },
      { title: 'Accept the write: ACCESS', start: 3, end: 4, signals: ['PSEL', 'PENABLE', 'PREADY', 'PWDATA', 'PSLVERR'],
        description: 'PENABLE rises without changing the request. PSEL, PENABLE, and PREADY are all high, so the write completes at the right-hand rising edge of cycle 3. PSLVERR=0 reports success.' },
      { title: 'Return to idle', start: 4, end: 5, signals: ['PSEL', 'PENABLE', 'PADDR', 'PWDATA'],
        description: 'After completion, PENABLE and PSEL fall. The x regions mark address and data that this example no longer needs to specify; they do not represent another transfer.' },
    ],
    signals: writeSignals,
    takeaway: 'An APB transfer needs one SETUP cycle followed by at least one ACCESS cycle. PREADY alone is never an acceptance event.',
    exercise: { question: 'If PREADY went low in cycle 3, could the requester drop PSEL after cycle 3?', answer: 'No. ACCESS would continue, with PSEL and PENABLE high and the address, direction, and write data unchanged, until a later rising edge samples PREADY high.' },
    reference: { label: 'Arm APB IHI 0024E · §3.1.1, figure 3-1 · p. 20', url: `${REFERENCE}#page=20` },
  },
  'amba/apb/read': {
    protocol: 'APB', order: 2,
    summary: 'Read 0x5A5A from 0x2000. The request phases are unchanged, but the peripheral supplies the data.',
    objective: 'Separate the requester’s stable address from the peripheral’s read response.',
    stages: [
      { title: 'Select the read address', start: 2, end: 3, signals: ['PSEL', 'PENABLE', 'PWRITE', 'PADDR'],
        description: 'SETUP selects address 0x2000 with PWRITE=0. PSEL is high and PENABLE is low. The requester does not provide write data for this transaction.' },
      { title: 'Sample the read response', start: 3, end: 4, signals: ['PENABLE', 'PREADY', 'PRDATA', 'PSLVERR'],
        description: 'During ACCESS, the peripheral presents PRDATA=0x5A5A. With PSEL, PENABLE, and PREADY high, the right-hand rising edge of cycle 3 completes the read and samples that data with PSLVERR=0.' },
      { title: 'Release the transfer', start: 4, end: 5, signals: ['PSEL', 'PENABLE', 'PRDATA'],
        description: 'The requester returns to idle after the completion edge of cycle 3. PRDATA is unspecified outside the transfer in this trace; the captured value came from the completion edge.' },
    ],
    signals: readSignals,
    takeaway: 'For a read, PRDATA must be ready by completion. Unlike the address, it does not have to be valid throughout SETUP.',
    exercise: { question: 'Would valid PRDATA in cycle 2 make the read finish before ACCESS?', answer: 'No. Completion still requires PSEL=1, PENABLE=1, and PREADY=1 at a rising edge. A data value by itself is not a transfer.' },
    reference: { label: 'Arm APB IHI 0024E · §3.3.1, figure 3-4 · p. 23', url: `${REFERENCE}#page=23` },
  },
  'amba/apb/write-wait': {
    protocol: 'APB', order: 3,
    summary: 'Write 0x0000002A to 0x1000 while the peripheral inserts two wait cycles.',
    objective: 'See how PREADY extends ACCESS without restarting the request.',
    stages: [
      { title: 'Set up the write', start: 2, end: 3, signals: ['PSEL', 'PENABLE', 'PADDR', 'PWRITE', 'PWDATA'],
        description: 'The requester selects 0x1000 and presents 0x0000002A with PWRITE=1. PENABLE=0 marks SETUP. PREADY happens to be high here, but SETUP cannot complete the write.' },
      { title: 'Wait without changing the request', start: 3, end: 5, signals: ['PSEL', 'PENABLE', 'PREADY', 'PADDR', 'PWRITE', 'PWDATA'],
        description: 'PENABLE is high, but PREADY is low for cycles 3 and 4. The right-hand rising edges of cycles 3 and 4 do not complete a transfer. PSEL, PENABLE, address, direction, and write data all remain unchanged.' },
      { title: 'Complete once ready', start: 5, end: 6, signals: ['PSEL', 'PENABLE', 'PREADY', 'PWDATA', 'PSLVERR'],
        description: 'PREADY rises while the same ACCESS continues. At the right-hand rising edge of cycle 5, the peripheral accepts the original 0x0000002A write and returns PSLVERR=0. This is one transfer, not three.' },
      { title: 'Leave ACCESS', start: 6, end: 7, signals: ['PSEL', 'PENABLE'],
        description: 'After the completion edge, PSEL and PENABLE fall. No new request is pending, so the bus returns to idle.' },
    ],
    signals: writeSignals,
    takeaway: 'A wait state extends ACCESS. It does not add another SETUP or permit the requester to change the pending write.',
    exercise: { question: 'To add a third wait cycle, what must move one cycle later?', answer: 'Delay the PREADY rise and the completion edge by one cycle. Keep PSEL, PENABLE, PADDR, PWRITE, and PWDATA unchanged for that extra cycle; release them only after completion.' },
    reference: { label: 'Arm APB IHI 0024E · §3.1.2, figure 3-2 · p. 21', url: `${REFERENCE}#page=21` },
  },
  'amba/apb/read-wait': {
    protocol: 'APB', order: 4,
    summary: 'Read 0xA5A5 from 0x2000 after two wait cycles. The read data appears only when the peripheral is ready.',
    objective: 'Distinguish stable request signals from read data that is not yet valid.',
    stages: [
      { title: 'Request the read', start: 2, end: 3, signals: ['PSEL', 'PENABLE', 'PWRITE', 'PADDR'],
        description: 'SETUP selects address 0x2000 with PWRITE=0. The read-data lane is x because no response value is promised yet.' },
      { title: 'Wait for the peripheral', start: 3, end: 5, signals: ['PSEL', 'PENABLE', 'PREADY', 'PADDR', 'PRDATA'],
        description: 'ACCESS is active, but PREADY=0 blocks completion at the right-hand rising edges of cycles 3 and 4. The requester holds the address and control signals. PRDATA may remain unspecified while the peripheral is not ready.' },
      { title: 'Capture valid read data', start: 5, end: 6, signals: ['PREADY', 'PRDATA', 'PSLVERR'],
        description: 'The peripheral presents 0xA5A5 and drives PREADY high. The right-hand rising edge of cycle 5 completes the read with PSLVERR=0. PRDATA must be valid for this edge.' },
      { title: 'Return to idle', start: 6, end: 7, signals: ['PSEL', 'PENABLE', 'PRDATA'],
        description: 'The requester lowers PSEL and PENABLE after the completion edge of cycle 5. The data was already captured; later PRDATA values are not part of this transaction.' },
    ],
    signals: readSignals,
    takeaway: 'Do not apply the write-data stability rule to PRDATA during a wait. The peripheral must supply valid read data for the completing edge.',
    exercise: { question: 'Could PRDATA change while PREADY remains low in cycles 3 and 4?', answer: 'Yes. This trace uses x to leave that interval unspecified. The requester must not treat those values as a completed read; valid data is required at the eventual completion edge.' },
    reference: { label: 'Arm APB IHI 0024E · §3.3.2, figure 3-5 · pp. 23–24', url: `${REFERENCE}#page=23` },
  },
  'amba/apb/back-to-back': {
    protocol: 'APB', order: 5,
    summary: 'Write 0x11 to 0x1000, then 0x22 to 0x1004 in the same peripheral without an idle cycle between transfers.',
    objective: 'Understand why PSEL can stay high but PENABLE must fall for the next SETUP.',
    stages: [
      { title: 'First SETUP', start: 2, end: 3, signals: ['PSEL', 'PENABLE', 'PADDR', 'PWDATA'],
        description: 'PSEL selects the peripheral. PENABLE is low while the requester presents the first address, 0x1000, and data, 0x00000011.' },
      { title: 'First ACCESS completes', start: 3, end: 4, signals: ['PSEL', 'PENABLE', 'PREADY', 'PWDATA'],
        description: 'PENABLE and PREADY are high, so the right-hand rising edge of cycle 3 completes the first write. The next request cannot replace its address or data before this edge.' },
      { title: 'New SETUP, same peripheral', start: 4, end: 5, signals: ['PSEL', 'PENABLE', 'PADDR', 'PWDATA'],
        description: 'PSEL stays high because the second address belongs to the same peripheral. PENABLE falls for a new SETUP cycle, allowing PADDR to change to 0x1004 and PWDATA to 0x00000022.' },
      { title: 'Second ACCESS completes', start: 5, end: 6, signals: ['PSEL', 'PENABLE', 'PREADY', 'PWDATA'],
        description: 'PENABLE rises again. With PREADY high, the right-hand rising edge of cycle 5 completes the second write. There were two separate transfers and two separate SETUP cycles.' },
      { title: 'Finish the sequence', start: 6, end: 7, signals: ['PSEL', 'PENABLE'],
        description: 'After the second completion, no further transfer follows. Both PSEL and PENABLE fall and the bus becomes idle.' },
    ],
    signals: writeSignals,
    takeaway: 'Back-to-back APB transfers can skip IDLE, but they cannot skip SETUP. APB does not pipeline the next address into the current ACCESS.',
    exercise: { question: 'Why is keeping PENABLE high while changing PADDR after cycle 3 incorrect?', answer: 'A new transfer requires its own SETUP cycle with PENABLE low. Changing the address while remaining in ACCESS does not create a legal second APB request.' },
    reference: { label: 'Arm APB IHI 0024E · §4.1, figure 4-1 · p. 34; §3.1.1 · p. 20', url: `${REFERENCE}#page=34` },
  },
  'amba/apb/error': {
    protocol: 'APB', order: 6,
    summary: 'Attempt to write 0x00000055 to 0x3000. After one wait cycle, the peripheral completes the transfer with PSLVERR=1.',
    objective: 'Read an error as a completed response, separate from waiting or guaranteed rollback.',
    stages: [
      { title: 'Set up the attempted write', start: 2, end: 3, signals: ['PSEL', 'PENABLE', 'PWRITE', 'PADDR', 'PWDATA'],
        description: 'The requester starts a normal SETUP for address 0x3000 and data 0x00000055. An eventual error does not remove the need for the normal request phases.' },
      { title: 'Wait one cycle', start: 3, end: 4, signals: ['PENABLE', 'PREADY', 'PWDATA', 'PSLVERR'],
        description: 'ACCESS starts with PREADY=0, so the right-hand rising edge of cycle 3 does not complete the write. The request is held stable. PSLVERR is low here, but its value is not a valid result while the transfer is still waiting.' },
      { title: 'Complete with an error', start: 4, end: 5, signals: ['PSEL', 'PENABLE', 'PREADY', 'PSLVERR'],
        description: 'PREADY and PSLVERR are both high during the completing ACCESS. The right-hand rising edge of cycle 4 ends the transfer and reports an error. PREADY=1 does not mean success; PSLVERR distinguishes the result.' },
      { title: 'Release the bus', start: 5, end: 6, signals: ['PSEL', 'PENABLE', 'PSLVERR'],
        description: 'The requester returns to idle. The peripheral drives PSLVERR low outside completion in this example. Whether the failed write changed peripheral state depends on the peripheral; this trace makes no rollback promise.' },
    ],
    signals: writeSignals,
    takeaway: 'Sample PSLVERR only on a completing ACCESS. An error is a completed transfer result, and it does not guarantee that the peripheral was unchanged.',
    exercise: { question: 'After PSLVERR=1, is it always safe to retry this write?', answer: 'No. The peripheral might already have changed state. Retry behavior must follow that peripheral’s documented semantics, especially for writes with side effects.' },
    reference: { label: 'Arm APB IHI 0024E · §§3.4–3.4.1, figure 3-6 · p. 25', url: `${REFERENCE}#page=25` },
  },
};
