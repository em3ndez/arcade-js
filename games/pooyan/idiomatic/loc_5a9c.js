// SPDX-License-Identifier: GPL-3.0-only
import { COIN1_PULSE_COUNT, COIN1_PULSE_PHASE, COIN1_COUNTER_LATCH } from "./names.js";
/**
 * loc_5a9c — coin-counter 1 pulse generator: turn queued coin credits into a timed on/off
 * strobe on the mechanical coin-counter output.
 *
 * ROM address: 0x5a9c. Grounding tag: [seen].
 *
 * The cabinet carries a physical coin counter — a little electromechanical tally that clicks up
 * by one each time it is pulsed. It is wired to one bit of the board's write-only latch
 * (COIN1_COUNTER_LATCH, 0xa183; only bit 0 of a write to that address lands). To advance the
 * counter you must hold that bit HIGH for a while and then drop it LOW again — a single clean
 * pulse of a fixed width. Because the counter is a slow mechanical device, the pulse is timed
 * out across many game frames rather than done in one shot.
 *
 * The coin-acceptance code elsewhere does not drive the counter directly; it just records how
 * many counts are OWED in COIN1_PULSE_COUNT (0x8824) and lets this routine, called once per
 * frame, pay them off one strobe at a time. COIN1_PULSE_PHASE (0x8825) is the countdown timer
 * for the strobe currently in flight: 0 means "idle, none in flight".
 *
 * Each frame this routine does exactly one of:
 *   - Nothing, if no counts are owed.
 *   - START a fresh strobe (phase idle): seed the phase timer and raise the counter bit HIGH.
 *   - STEP an in-flight strobe: count the phase down; drop the bit LOW partway through so the
 *     high and low portions each get their share of the pulse width; and when the phase reaches
 *     zero, retire one owed count — the strobe is complete and the next frame can begin another.
 *
 * A structurally identical twin at 0x5ac0 drives coin counter 2 (latch bit at 0xa184, owed
 * count/phase at 0x8826/0x8827) the same way.
 *
 * LIVE-OUT: memory only — the owed-pulse count (COIN1_PULSE_COUNT), the strobe phase timer
 * (COIN1_PULSE_PHASE), and the write-only coin-counter latch bit (COIN1_COUNTER_LATCH).
 */

// The phase timer is a plain frame countdown, so these two values set the strobe's shape:
// PULSE_PHASE_SEED is the full pulse width (0x30 = 48 frames), and PULSE_DROP_PHASE (0x18 = 24
// frames) is the point on the way down where the output falls LOW — splitting the pulse into a
// ~24-frame HIGH portion followed by a ~24-frame LOW portion, one clean click of the counter.
const PULSE_PHASE_SEED = 0x30;
const PULSE_DROP_PHASE = 0x18;

export function loc_5a9c(m) {
  const { mem8 } = m;

  // Nothing owed -> no work this frame. The mechanical counter only moves when credits are
  // queued in COIN1_PULSE_COUNT.
  if (mem8[COIN1_PULSE_COUNT] === 0) return;

  const phase = mem8[COIN1_PULSE_PHASE];
  if (phase === 0) {
    // No strobe in flight and counts are owed: begin one. Load the phase timer with the full
    // pulse width and drive the coin-counter output HIGH (bit 0 of COIN1_COUNTER_LATCH). The
    // count is NOT retired here — it is only retired when this strobe finishes below.
    mem8[COIN1_PULSE_PHASE] = PULSE_PHASE_SEED;
    mem8[COIN1_COUNTER_LATCH] = 1;
    return;
  }

  // A strobe is in flight: advance it by one frame. The phase timer counts down (8-bit).
  const next = (phase - 1) & 0xff;
  mem8[COIN1_PULSE_PHASE] = next;
  if (next === 0) {
    // Timer exhausted: this strobe is complete. Pay off one owed count so the next frame can
    // start the following strobe (if more remain). The output bit is already LOW from the drop
    // point below, so nothing more to do to the latch.
    mem8[COIN1_PULSE_COUNT] = mem8[COIN1_PULSE_COUNT] - 1;
    return;
  }
  if (next === PULSE_DROP_PHASE) {
    // Halfway down: end the HIGH portion of the pulse and hold the output LOW for the rest of
    // the strobe's width. This gives the mechanical counter a defined-width click.
    mem8[COIN1_COUNTER_LATCH] = 0;
  }
}
