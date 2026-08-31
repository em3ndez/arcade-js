// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { advanceObjectDwellThenBlankBand } from "./advanceObjectDwellThenBlankBand.js";
import { COUNTDOWN_EXPIRE_DISPLAY_CMD } from "./names.js";
/**
 * advanceObjectCountdownAndEmitDisplayCommand — one state of an object record's per-frame machine.
 *
 * WHAT IT IS
 *   Every animated object in the arena lives in a 0x18-byte record based at IX. Each frame the
 *   record's state byte (rec+0x02, masked to five bits) selects one handler from the object's
 *   state machine; this routine is the handler for the "counting down to a display event" state.
 *   While the countdown at rec+0x11 is still running the object simply holds and animates in place.
 *   When it lapses, the object emits one display command, re-arms its timers, and steps to the
 *   next state.
 *
 * ROLE IN THE MACHINE
 *   The display it drives is the on-screen strip painted by the display-command driver. A command
 *   pushed here is a two-byte word (type byte 0x03 in the high byte, a low byte that selects which
 *   variant of the strip to draw); it lands in the display-command ring (DISPLAY_CMD_RING_BUFFER
 *   at 0x88C0), which the main loop drains each frame and hands to the matching draw handler. So
 *   this routine turns "the countdown finished" into "paint the next thing", then hands the object
 *   to the shared dwell/dispatch tail that blanks the object's sprite band for the frame.
 *
 * ROM: 0x418D-0x41B0.
 * Grounding: [seen].
 *
 * LIVE-OUT: none. This is a shared object-state tail — every effect is left in memory (the object
 * record's fields and the newly enqueued display command); no caller reads a register back.
 */
const TIMER_FIELD = 0x11; //  rec+0x11 — the frame-delay countdown that gates the expiry work
const SEED_FIELD = 0x16; //   rec+0x16 — the armed byte: source of the command low-byte offset and the rec+0x13 value
// The two halves of the base display command COUNTDOWN_EXPIRE_DISPLAY_CMD (0x0312, from names.js).
// CMD_HIGH is the command's type byte (0x03) sitting in the high byte with the low byte cleared;
// CMD_LOW (0x12) is the base low byte, the offset that the record's seed biases below.
const CMD_LOW = COUNTDOWN_EXPIRE_DISPLAY_CMD & 0xff;
const CMD_HIGH = (COUNTDOWN_EXPIRE_DISPLAY_CMD >> 8) << 8; // the command's type byte, low byte cleared

export function advanceObjectCountdownAndEmitDisplayCommand(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step the object's animation first, exactly as every state handler does: this walks the
  // record's own tile/attribute script (pointer at rec+0x0c/0x0d) whenever the frame-hold at
  // rec+0x0e has expired, so the object keeps animating even while it waits out the countdown.
  advanceObjectAnimationFrame(m, rec); // advance the record's animation

  // Tick the countdown at rec+0x11 down by one. While it is still non-zero the object stays in
  // this state and holds — return with nothing else changed and let the sweep move on.
  mem8[rec + TIMER_FIELD] = mem8[rec + TIMER_FIELD] - 1;
  if (mem8[rec + TIMER_FIELD] !== 0) return; // still counting down

  // Countdown lapsed. Build the display command from the base word: its low byte is CMD_LOW
  // biased down by the record's armed seed at rec+0x16 — a zero seed leaves the base offset
  // untouched, and a non-zero seed subtracts one before adding it in, so successive seed values
  // pick successive variants of the strip to paint. Then enqueue the two-byte command into the
  // display-command ring at 0x88C0, where the main loop's driver will pick it up and draw it.
  const seed = mem8[rec + SEED_FIELD];
  const adjusted = seed === 0 ? 0 : (seed - 1) & 0xff; // non-zero seeds bias down by one
  const cmd = CMD_HIGH | ((CMD_LOW + adjusted) & 0xff);
  enqueueDisplayCommand(m, cmd);

  // Re-arm the record for the state it is about to enter: seat the countdown at rec+0x11 to 1 so
  // the next state animates from the very next frame, store seed+1 into the phase field rec+0x13,
  // and advance the state index rec+0x02 to 2 so next frame's dispatch routes to state 2.
  mem8[rec + TIMER_FIELD] = 0x01;
  mem8[rec + 0x13] = seed + 1;
  mem8[rec + 0x02] = 0x02;

  // Tail into the shared per-object dwell-then-dispatch handler for the rest of this frame; it
  // animates the object, ticks its dwell timer, and blanks the object's sprite band this frame.
  return advanceObjectDwellThenBlankBand(m, rec);
}
