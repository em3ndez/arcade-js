// SPDX-License-Identifier: GPL-3.0-only
import { COIN1_PULSE_COUNT, COIN1_PULSE_PHASE, COIN1_COUNTER_LATCH } from "./names.js";
/**
 * pulseCoinCounter1Latch — coin-counter 1 pulse generator: turn queued coin credits into a timed
 * on/off strobe on the mechanical coin-counter output.
 *
 * ROM 0x5a9c-0x5abf. Grounding: [seen].
 *
 * WHAT IT IS: the per-frame driver that pays off the cabinet's physical coin counter, one click at
 * a time. It is one link in the coin/credit service chain that the interrupt handler runs every
 * frame; here it owns two work-RAM bytes plus one hardware output bit and does at most one small
 * thing per frame.
 *
 * THE HARDWARE: the cabinet carries a physical coin counter — a little electromechanical tally that
 * ratchets up by one each time it is pulsed. It hangs off one line of the board's eight-bit control
 * latch: an LS259 whose write ADDRESS carries the bit index (addr & 7) while the data written is
 * just its low bit. Bit 3 of that latch is coin counter 1, so writes go to COIN1_COUNTER_LATCH
 * (0xa183) and only the low bit of the value lands — write 1 to drive the line HIGH, write 0 to
 * drive it LOW. To advance the counter you must hold the line HIGH for a while and then drop it
 * LOW again: one clean pulse of a fixed width. The counter is a slow mechanical device, so that
 * pulse is timed out across many game frames rather than done in a single instant.
 *
 * HOW IT'S DRIVEN: the coin-acceptance code elsewhere never touches the counter line directly. When
 * a coin is accepted it simply records how many clicks are OWED in COIN1_PULSE_COUNT (0x8824), and
 * lets this routine, called once per frame, pay them off one strobe at a time. COIN1_PULSE_PHASE
 * (0x8825) is the countdown timer for the strobe currently in flight — 0 means "idle, nothing in
 * flight".
 *
 * WHAT EACH FRAME DOES — exactly one of:
 *   - Nothing, if no clicks are owed.
 *   - START a fresh strobe (phase idle): seed the phase timer to its full width and raise the
 *     counter line HIGH. The owed count is NOT retired yet.
 *   - STEP an in-flight strobe: count the phase timer down by one; at the halfway mark drop the
 *     line back LOW (so the HIGH and LOW halves each get their share of the pulse width); and when
 *     the phase reaches zero, retire one owed click — the strobe is complete and the next frame is
 *     free to begin the following one.
 *
 * TWIN: a structurally identical generator at ROM 0x5ac0 drives coin counter 2 the same way — LS259
 * bit 4 (COIN2_COUNTER_LATCH 0xa184), owed count / phase at 0x8826 / 0x8827.
 *
 * A leaf: it writes only the owed-count cell, the phase timer, and the one latch bit, and calls
 * nothing.
 *
 * LIVE-OUT: memory only — the owed-pulse count (COIN1_PULSE_COUNT), the strobe phase timer
 * (COIN1_PULSE_PHASE), and the write-only coin-counter latch bit (COIN1_COUNTER_LATCH).
 */

// The phase timer is a plain frame countdown, so these two values fix the strobe's shape. The seed
// is the full pulse width (0x30 = 48 frames), and the drop phase (0x18 = 24 frames) is the point on
// the way down where the output falls LOW — splitting the strobe into a ~24-frame HIGH half followed
// by a ~24-frame LOW half, i.e. one clean, defined-width click of the mechanical counter.
const PULSE_PHASE_SEED = 0x30; // full pulse width in frames — loaded into the phase timer at strobe start
const PULSE_DROP_PHASE = 0x18; // phase value at which the HIGH half ends and the line falls LOW

export function pulseCoinCounter1Latch(m) {
  const { mem8 } = m;

  // Nothing owed -> no work this frame. The mechanical counter only moves when a coin accept has
  // queued a click in COIN1_PULSE_COUNT; on the common (idle) frame this is the whole routine.
  if (mem8[COIN1_PULSE_COUNT] === 0) return;

  // Clicks are owed. The phase timer tells us whether a strobe is already in flight (nonzero) or
  // whether the line is idle and we may start a new one (zero).
  const phase = mem8[COIN1_PULSE_PHASE];
  if (phase === 0) {
    // Idle with clicks owed -> BEGIN a strobe. Load the phase timer with the full pulse width and
    // drive the counter line HIGH (write 1 to COIN1_COUNTER_LATCH, LS259 bit 3 — only the low bit
    // lands). The owed count is deliberately NOT retired here; it is retired only when this strobe
    // finishes, below, so each click corresponds to one completed HIGH/LOW pulse.
    mem8[COIN1_PULSE_PHASE] = PULSE_PHASE_SEED;
    mem8[COIN1_COUNTER_LATCH] = 1;
    return;
  }

  // A strobe is in flight: advance it by one frame. The phase timer counts down and is an 8-bit
  // cell, so mask the decrement to a byte (it never actually underflows on this path).
  const next = (phase - 1) & 0xff;
  mem8[COIN1_PULSE_PHASE] = next;
  if (next === 0) {
    // Timer exhausted -> this strobe is COMPLETE. Retire exactly one owed click so the next frame
    // can start the following strobe (if any remain, or fall back to the idle path if not). The
    // counter line is already LOW from the drop point below, so the latch needs no further write.
    mem8[COIN1_PULSE_COUNT] = mem8[COIN1_PULSE_COUNT] - 1;
    return;
  }
  if (next === PULSE_DROP_PHASE) {
    // Halfway down -> end the HIGH half of the pulse: drive the counter line LOW (write 0 to
    // COIN1_COUNTER_LATCH). This is a one-frame edge; the line then stays LOW for the remainder of
    // the countdown, giving the mechanical counter its defined-width click.
    mem8[COIN1_COUNTER_LATCH] = 0;
  }
}
