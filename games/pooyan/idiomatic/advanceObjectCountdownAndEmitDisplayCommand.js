// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { advanceObjectDwellThenBlankBand } from "./advanceObjectDwellThenBlankBand.js";
import { COUNTDOWN_EXPIRE_DISPLAY_CMD } from "./names.js";
/**
 * advanceObjectCountdownAndEmitDisplayCommand — countdown step for the object record based at IX.
 *
 * Advances the record's animation, then counts the (rec+0x11) timer down; while it is still
 * non-zero the object holds and the routine returns. On expiry it enqueues a display command
 * (type 0x03, low byte offset by the record's adjusted (rec+0x16) — one less when non-zero),
 * re-seats the timer to 1, stores (rec+0x16)+1 into rec+0x13, sets rec+0x02 to 2, and tails into
 * the per-object dwell-then-dispatch handler (which blanks the band this frame).
 *
 * LIVE-OUT: none — a shared object-state tail; all effect is in memory (record fields + the
 * enqueued command). No caller reads a register back.
 */
const TIMER_FIELD = 0x11; //  the countdown gating the expiry work
const SEED_FIELD = 0x16; //   source of the command low-byte offset and the rec+0x13 value
const CMD_LOW = COUNTDOWN_EXPIRE_DISPLAY_CMD & 0xff;
const CMD_HIGH = (COUNTDOWN_EXPIRE_DISPLAY_CMD >> 8) << 8; // the command's type byte, low byte cleared

export function advanceObjectCountdownAndEmitDisplayCommand(m, rec = m.regs.ix) {
  const { mem8 } = m;

  advanceObjectAnimationFrame(m, rec); // advance the record's animation

  mem8[rec + TIMER_FIELD] = mem8[rec + TIMER_FIELD] - 1;
  if (mem8[rec + TIMER_FIELD] !== 0) return; // still counting down

  const seed = mem8[rec + SEED_FIELD];
  const adjusted = seed === 0 ? 0 : (seed - 1) & 0xff; // non-zero seeds bias down by one
  const cmd = CMD_HIGH | ((CMD_LOW + adjusted) & 0xff);
  enqueueDisplayCommand(m, cmd);

  mem8[rec + TIMER_FIELD] = 0x01;
  mem8[rec + 0x13] = seed + 1;
  mem8[rec + 0x02] = 0x02;

  return advanceObjectDwellThenBlankBand(m, rec);
}
