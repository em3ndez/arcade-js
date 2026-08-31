// SPDX-License-Identifier: GPL-3.0-only
import { BLINK_PHASE } from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { fillByteRun } from "./fillByteRun.js";
/**
 * advancePairedDescendingObjectStep — advance a paired (ix / iy) descending object one step.
 *
 * Returns immediately unless the ix record is active (+0) and its sub-state (+2) is idle. Runs
 * the animation sequencer for the ix record, then lowers each record's 16-bit position (+6:+5)
 * by its per-record delta (+9), borrowing from the low byte into the high byte. Finally, on the
 * ix high byte: value 6 bumps the blink-phase gate once (only while it reads zero); value 0
 * retires both records by wiping their 0x18 bytes; any other value just leaves them descending.
 *
 * LIVE-OUT: memory only — the stepped positions, the gate, or the wiped records. A caller sweep
 * reloads ix / iy per pair and consumes no register result.
 */

const RECORD_SIZE = 0x18; //  bytes per record (also the wipe length)
const HIGH_AT_GATE = 0x06; // ix high byte value that bumps the blink-phase gate
const WIPE_FILL = 0x00;

/** Lower a record's 16-bit position (+6:+5) by its 8-bit delta (+9), borrowing into the high byte. */
function stepPositionDown(mem8, rec) {
  const diff = mem8[rec + 5] - mem8[rec + 9];
  if (diff < 0) mem8[rec + 6] = mem8[rec + 6] - 1; // borrow into the high byte
  mem8[rec + 5] = diff; //                            Uint8Array truncates to the low byte
}

export function advancePairedDescendingObjectStep(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;

  if (mem8[ix + 0] === 0) return; //  record inactive
  if (mem8[ix + 2] !== 0) return; //  sub-state busy

  advanceObjectAnimationFrame(m, ix);

  stepPositionDown(mem8, iy);
  stepPositionDown(mem8, ix);

  const high = mem8[ix + 6];
  if (high === HIGH_AT_GATE) {
    if (mem8[BLINK_PHASE] === 0) mem8[BLINK_PHASE] = mem8[BLINK_PHASE] + 1;
    return;
  }
  if (high !== 0) return; // still descending

  fillByteRun(m, ix, WIPE_FILL, RECORD_SIZE);
  fillByteRun(m, iy, WIPE_FILL, RECORD_SIZE);
}
