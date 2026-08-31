// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
/**
 * advanceEagleDiveClimbToRetireAtLimit — the per-frame handler for an eagle bonus-wave record that
 * is in its dive/climb state (state 1).
 *
 * WHAT IT IS
 * ----------
 * The bonus stage runs its own little wave of eagle attackers, two eagles per wave. Each eagle is
 * an actor record (stride 0x18) living in ENEMY_ACTOR_TABLE, and each carries a small state machine
 * in its state byte at rec+0x02: state 0 is the approach (fly in and reach a grid slot), state 1 is
 * this dive-or-climb glide, and state 2 (despawnEagleAndSeedHoldOnWaveEmpty) retires the record.
 * dispatchActiveEagleRecordState reads rec+0x02 each frame and routes the record here while it holds
 * state 1.
 *
 * ROM 0x7395. Grounding tag: [seen].
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Once an eagle has arrived at its slot, it glides straight up or straight down the screen at a
 * fixed per-record speed until it leaves the play area, then hands itself off to the retire state.
 * Which way it goes is fixed by the record's parity: the two eagles of a wave sit at record
 * addresses that differ in bit 3 of their low address byte, so one dives (even) and one climbs
 * (odd). This handler does two things every frame: it steps the eagle's on-screen animation, then
 * it integrates the eagle's vertical position by its speed and checks whether it has reached the
 * limit row that ends the glide.
 *
 * The eagle's vertical position is a 16-bit fixed-point value split across two record fields: the
 * low byte rec+0x03 is the sub-row fraction and the high byte rec+0x04 is the on-screen tile row.
 * The per-record speed rec+0x09 is added to (dive) or subtracted from (climb) the fraction each
 * frame; the fraction's overflow (a carry when descending, a borrow when climbing) is what actually
 * moves the eagle a whole row up or down. When the row crosses the limit — the bottom row 0x1d for a
 * diver, the top row 0x04 for a climber — the record advances its state byte to state 2 and will be
 * retired next frame.
 *
 * LIVE-OUT: memory only — the eagle record's animation fields (touched by advanceObjectAnimationFrame),
 * its 16-bit vertical position (rec+0x03 fraction, rec+0x04 row), and, at the limit, its state byte
 * rec+0x02 bumped to the retire state. Nothing is returned to the caller.
 */

const BOTTOM_ROW = 0x1d; // a diving eagle retires once its row reaches (or passes) this bottom limit
const TOP_ROW = 0x04; // a climbing eagle retires once its row rises above (below the value of) this top limit

export function advanceEagleDiveClimbToRetireAtLimit(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step the eagle's on-screen picture. This shared animation stepper walks the record's little
  // animation script (pointer at rec+0x0c/0x0d, frame-hold at rec+0x0e), swapping in the next tile
  // and colour when the current frame's hold runs out — independent of the vertical motion below.
  advanceObjectAnimationFrame(m, rec);

  // Pick the glide direction from the record's parity. The two eagles of a wave are seeded at
  // record addresses that differ in bit 3 of the low address byte; a set bit 3 marks the climber
  // (rises up the screen), a clear bit 3 marks the diver (descends).
  const climbing = (rec & 0x08) !== 0;
  if (climbing) {
    // CLIMB: subtract the per-record speed rec+0x09 from the 16-bit position's fraction rec+0x03.
    const pos = mem8[rec + 0x03] - mem8[rec + 0x09];
    mem8[rec + 0x03] = pos; // store the new fraction (wraps mod 256 in the 8-bit record field)
    if (pos < 0) mem8[rec + 0x04] = mem8[rec + 0x04] - 1; // a borrow out of the fraction lifts the eagle one row up
    if (mem8[rec + 0x04] >= TOP_ROW) return; // still below the top row 0x04 — keep climbing, nothing else to do
    // Reached the top of the climb: advance the record's state byte so next frame retires it.
    mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
    return;
  }

  // DIVE: add the per-record speed rec+0x09 to the 16-bit position's fraction rec+0x03.
  const pos = mem8[rec + 0x03] + mem8[rec + 0x09];
  mem8[rec + 0x03] = pos; // store the new fraction (wraps mod 256 in the 8-bit record field)
  if (pos > 0xff) mem8[rec + 0x04] = mem8[rec + 0x04] + 1; // a carry out of the fraction drops the eagle one row down
  if (mem8[rec + 0x04] < BOTTOM_ROW) return; // still above the bottom row 0x1d — keep diving, nothing else to do
  // Reached the bottom of the dive: advance the record's state byte so next frame retires it.
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
}
