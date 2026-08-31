// SPDX-License-Identifier: GPL-3.0-only
import { addCreditsAndQueueDisplay } from "./addCreditsAndQueueDisplay.js";
import { emitPresetSound } from "./emitPresetSound.js";
import { INPUT_PORT0, DRIP_RING_A } from "./names.js";
/**
 * accrueCreditFromDripRingA — per-frame service-credit accumulator, variant A.
 *
 * WHAT IT IS
 *   One of three near-identical credit accumulators run during the coin/credit
 *   service pass, one per input bit. This variant watches the SERVICE button —
 *   bit 2 of the inverted IN0 sample INPUT_PORT0 (0x8810) — and debounces it
 *   through the cadence ring DRIP_RING_A (0x8829). On a clean pulse it awards
 *   exactly one credit. Unlike the two coin-slot variants there is no coinage
 *   arithmetic and no physical coin-counter strobe: service credits are free.
 *
 * ROLE IN THE MACHINE
 *   Runs every frame as one link in the coin/credit service chain. The whole point
 *   of the debounce ring is to convert a *level* — the button may be held down for
 *   many frames in a row — into a single one-shot *event*, so holding SERVICE down
 *   cannot pour in an endless stream of credits; each press counts once.
 *
 * ROM: 0x5a06-0x5a1e.
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only.
 *   - Every frame: the cadence ring DRIP_RING_A (0x8829) is advanced one position.
 *   - On a fire: the drip sound is queued, and one credit is added to the running
 *     credit count CREDIT_COUNT (0x8802) with a credit-display refresh queued, both
 *     by way of the shared accumulate tail. No register survives the routine — the
 *     caller reloads A before reading it, so everything meaningful is in memory.
 */
// Bit 2 of the inverted IN0 sample is the SERVICE button; this is the bit sampled
// into the ring each frame.
const PHASE_BIT = 2;
// The debounce ring is only three bits wide — its low three positions hold the
// last three frames of the sampled SERVICE bit.
const RING_MASK = 0x07;
// A clean rising edge reads as binary 001 across those three bits: two frames idle
// (0, 0) followed by one frame pressed (1). Requiring exactly this pattern means a
// press is counted on the single frame it first goes high, and never again while
// it stays held.
const FIRE_PHASE = 0x01;
// Amount added to the running credit count on an accepted service pulse: one credit.
const ACCUMULATE_STEP = 0x01;

export function accrueCreditFromDripRingA(m) {
  const { mem8 } = m;
  // Sample the SERVICE button for this frame: isolate bit 2 of the inverted IN0
  // sample at INPUT_PORT0 (0x8810). The value is 1 while the button is held.
  const carry = (mem8[INPUT_PORT0] >> PHASE_BIT) & 1;
  // Feed the sample into the debounce ring DRIP_RING_A (0x8829): rotate the ring
  // left one place and bring this frame's sample in at bit 0, so the low bits hold
  // a sliding window of the last few frames' samples. The & 0xff keeps the ring a
  // single byte.
  const ring = ((mem8[DRIP_RING_A] << 1) | carry) & 0xff;
  mem8[DRIP_RING_A] = ring;
  // Off phase: the low three bits are not the clean-edge pattern 001 — this frame
  // is idle, a button already counted while still held, or the release. Leave the
  // advanced ring behind and award nothing this frame.
  if ((ring & RING_MASK) !== FIRE_PHASE) return; // off phase: ring advanced, nothing more
  // A clean SERVICE pulse was accepted this frame. Play the coin/credit
  // acknowledgement ("drip") sound.
  emitPresetSound(m); // drip sound
  // Award the credit through the shared accumulate tail on which all three drips
  // converge: it adds the award amount to CREDIT_COUNT (0x8802), clamps to the
  // maximum, and queues a credit-display refresh. The tail reads its award amount
  // from register A, so A carries the accumulate step — one credit — as the tail is
  // entered.
  return addCreditsAndQueueDisplay(m, ACCUMULATE_STEP); // tail: add one to the running total
}
