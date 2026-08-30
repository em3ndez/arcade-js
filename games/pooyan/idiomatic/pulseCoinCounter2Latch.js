// SPDX-License-Identifier: GPL-3.0-only
import { COIN2_PULSE_COUNT, COIN2_PULSE_PHASE, COIN2_COUNTER_LATCH } from "./names.js";
/**
 * pulseCoinCounter2Latch — the pulse generator for the SECOND physical coin counter. [seen]
 *
 * ROM 0x5ac0 (reached from the per-frame coin housekeeping step). The cabinet's coin counters
 * are electromechanical: a counter advances one tick each time its drive line is held high for
 * a stretch and then released, so software cannot just "add one" — it must shape a timed pulse,
 * raising the drive line, holding it, and dropping it, all spread across many frames. This
 * routine is the state machine that shapes ONE such pulse per queued coin and, when several are
 * queued, spaces them out so the mechanism registers each one separately. It is the structural
 * twin of the coin-counter 1 pulse generator; only the cells and the latch bit differ.
 *
 * Three cells carry the state:
 *   - COIN2_PULSE_COUNT (0x8826): how many coin pulses are still owed to the mechanism. The
 *     per-frame coin step bumps this when a coin is accepted; this routine drains it one per
 *     completed pulse.
 *   - COIN2_PULSE_PHASE (0x8827): the countdown timer WITHIN a single pulse. Zero means "no
 *     pulse in flight". A live pulse counts down from the seed toward zero.
 *   - COIN2_COUNTER_LATCH (0xa184): LS259 addressable-latch bit 4, wired to the coin-2 drive
 *     line. Write-only; only bit 0 of the written value reaches the latch, so 1 raises the line
 *     and 0 lowers it.
 *
 * The pulse shape, in phase ticks counting DOWN from the seed 0x30 (48) to 0:
 *   - phase 0x30 .. 0x19 : line HELD HIGH (raised when the pulse was armed)
 *   - phase 0x18 (24)    : line DROPPED — the high stretch is 0x30-0x18 = 24 frames long
 *   - phase 0x17 .. 0x01 : line stays low, spacing this pulse from the next
 *   - phase 0x00         : pulse complete — one owed pulse retired
 *
 * LIVE-OUT: memory only — the owed-pulse count, the in-pulse phase timer, and the write-only
 * coin-counter latch bit. No registers, no return value.
 */

// Seed for the phase timer: the pulse begins 0x30 (48) frames from completion. The line is held
// high from here down to the drop point.
const PULSE_PHASE_SEED = 0x30;
// Phase value at which the drive line is dropped, ending the high stretch (24 frames after the
// seed). The remaining ticks down to zero space this pulse from any that follow.
const PULSE_DROP_PHASE = 0x18;

export function pulseCoinCounter2Latch(m) {
  const { mem8 } = m;

  // Nothing owed to the mechanism -> nothing to do. This is the common per-frame case.
  if (mem8[COIN2_PULSE_COUNT] === 0) return;

  const phase = mem8[COIN2_PULSE_PHASE];
  if (phase === 0) {
    // fresh pulse: start the phase timer and raise the latch
    // Phase idle with a pulse owed means this is the leading edge of a new pulse: arm the
    // countdown at the seed and drive the coin-2 line HIGH. The line will be held until the
    // phase counts down to the drop point.
    mem8[COIN2_PULSE_PHASE] = PULSE_PHASE_SEED;
    mem8[COIN2_COUNTER_LATCH] = 1;
    return;
  }

  // A pulse is already in flight: advance its timer by one frame (8-bit, though the seed keeps
  // it well clear of wrap).
  const next = (phase - 1) & 0xff;
  mem8[COIN2_PULSE_PHASE] = next;
  if (next === 0) {
    // Timer fully elapsed: this pulse is done. Retire one owed pulse; the next frame that finds
    // count>0 and phase==0 will arm the following pulse, giving the mechanism a clean gap.
    mem8[COIN2_PULSE_COUNT] = mem8[COIN2_PULSE_COUNT] - 1;
    return;
  }
  if (next === PULSE_DROP_PHASE) {
    // Reached the drop point: lower the drive line, ending the 24-frame high stretch. The
    // electromechanical counter registers the tick on this falling edge.
    mem8[COIN2_COUNTER_LATCH] = 0;
  }
}
