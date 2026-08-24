// SPDX-License-Identifier: GPL-3.0-only
import { loc_5a8c } from "./loc_5a8c.js";
import { emitPresetSound } from "./emitPresetSound.js";
import { INPUT_PORT0, DRIP_RING_A } from "./names.js";
/**
 * loc_5a06 — per-frame accumulate step, variant A.
 * Each frame it rotates one input-port phase bit into the cadence ring. When the ring's low three
 * bits settle on the fire phase it emits the drip sound and adds one to the running total through
 * the shared accumulate tail; otherwise it leaves only the advanced ring behind.
 * LIVE-OUT: memory only — the cadence ring (and, on a fire, the accumulate tail's writes). The
 * caller reloads A before reading it, so no register survives.
 */
const PHASE_BIT = 2; // input-port bit sampled into the ring each frame
const RING_MASK = 0x07;
const FIRE_PHASE = 0x01;
const ACCUMULATE_STEP = 0x01; // amount added to the running total on a fire

export function loc_5a06(m) {
  const { mem8 } = m;
  const carry = (mem8[INPUT_PORT0] >> PHASE_BIT) & 1;
  const ring = ((mem8[DRIP_RING_A] << 1) | carry) & 0xff;
  mem8[DRIP_RING_A] = ring;
  if ((ring & RING_MASK) !== FIRE_PHASE) return; // off phase: ring advanced, nothing more
  emitPresetSound(m); // drip sound
  // The tail is reached through the marshalled call seam, which joins with A set to the
  // accumulate step, so load A before the call.
  m.regs.a = ACCUMULATE_STEP;
  return loc_5a8c(m); // tail: add one to the running total
}
