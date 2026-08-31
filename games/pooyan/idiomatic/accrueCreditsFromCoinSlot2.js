// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { emitPresetSound } from "./emitPresetSound.js";
import { addFullWrapCreditAmount } from "./addFullWrapCreditAmount.js";
import { addCreditsAndQueueDisplay } from "./addCreditsAndQueueDisplay.js";
import {
  INPUT_PORT0,
  DRIP_RING_B,
  COIN2_PULSE_COUNT,
  DRIP_COORD_B,
  COINAGE_CONFIG_SLOT2,
} from "./names.js";
/**
 * accrueCreditsFromCoinSlot2 — the per-frame credit-accrual step for coin slot 2.
 *
 * WHAT IT IS
 * One of the three near-identical credit accumulators the coin subsystem runs every frame,
 * this one watching coin slot 2. ROM 0x5a1f-0x5a55. Grounding: [seen].
 *
 * ROLE IN THE MACHINE
 * The cabinet's coin inputs are active-low pins that the frame service samples, complements, and
 * parks at the head of the input edge-detect ring, INPUT_PORT0 (0x8810); within that byte bit 1 is
 * coin slot 2. A dropped coin is not a clean single pulse — it bounces across several frames — so
 * each accrual step runs a two-stage machine. First a software debounce: every frame it rotates the
 * watched input bit into a small cadence ring (DRIP_RING_B, 0x882d) and treats it as a single
 * accepted coin only on the exact frame the ring's low three bits settle on the accept phase (1).
 * Then the coinage arithmetic: an accumulate-and-compare against the slot-2 coinage descriptor that
 * realizes an "N coins per credit" rate and, when a group completes, hands the earned credits to the
 * shared score-accumulate tail. This step performs no coinage math while the coin is still bouncing;
 * it acts once, on acceptance.
 *
 * LIVE-OUT: memory only — the cadence ring (DRIP_RING_B), the queued-pulse counter
 * (COIN2_PULSE_COUNT), the accumulator/descriptor pair at 0x882e/0x882f, and, when a credit group
 * completes, whatever the shared score tail leaves in the credit count. No register survives.
 */
const FIRE_PHASE = 0x01;
const RING_MASK = 0x07;
const COORD_STEP = 0x10;

export function accrueCreditsFromCoinSlot2(m) {
  const { mem8 } = m;

  // --- Software debounce: rotate coin slot 2's input bit into the cadence ring ---
  // The accepted-coin signal is bit 1 of the complemented IN0 sample at INPUT_PORT0 (0x8810). The
  // ROM isolates it with two right-rotates so bit 1 lands in carry, then rolls that carry into the
  // low end of the ring. Here that reduces to reading bit 1 directly; `carry` is the fresh sample.
  const carry = (mem8[INPUT_PORT0] >> 1) & 1; // two rrca -> ring input is input-port bit1
  // Shift the ring one place left and drop the new sample into bit 0. The ring is the running
  // debounce history: a genuine coin walks a fixed bit pattern up through it over several frames.
  const ring = ((mem8[DRIP_RING_B] << 1) | carry) & 0xff; // rl (ring)
  mem8[DRIP_RING_B] = ring;
  // The accept event is a single frame: only when the ring's low three bits equal the accept phase
  // (1) is this counted as one clean coin. Every other frame the ring has merely advanced and there
  // is nothing more to do — this is what collapses a multi-frame bounce into exactly one credit.
  if ((ring & RING_MASK) !== FIRE_PHASE) return; // off phase: only the ring advanced

  // --- Acceptance: announce the coin and queue a physical-counter pulse ---
  // Play the coin-accept sound (emitPresetSound forwards the preset command to the audio CPU).
  emitPresetSound(m); // coin-accept sound
  // Bump the queued-pulse counter for slot 2. This is consumed later by the coin-counter-2 strobe,
  // which turns each queued pulse into one fixed-width electrical pulse to the cabinet's mechanical
  // coin meter, decoupled in time from the coin bounce itself.
  mem8[COIN2_PULSE_COUNT] = u8(mem8[COIN2_PULSE_COUNT] + 1);

  // --- Coinage arithmetic: accumulate 0x10 per coin, compare against the slot-2 descriptor ---
  // Each accepted coin adds one 0x10 step to the accumulator at DRIP_COORD_B (0x882e). The
  // descriptor's high nibble sets how many 0x10 steps make a group, so this counts coins toward the
  // next credit group.
  const coord1 = u8(mem8[DRIP_COORD_B] + COORD_STEP);
  mem8[DRIP_COORD_B] = coord1;

  // The comparison value is the slot-2 coinage descriptor in the neighbouring cell,
  // COINAGE_CONFIG_SLOT2 (0x882f) — the accumulator and descriptor form the adjacent pair the ROM
  // walks together. While the descriptor still stands at or above the accumulator the group is not
  // yet full, so nothing is credited this coin.
  const coord2 = mem8[COINAGE_CONFIG_SLOT2]; // second coord of the pair (shares the slot-2 cell)
  if (coord2 >= coord1) return; // first has not overtaken the second

  // --- Group complete: subtract the group off the accumulator and award the credits ---
  // A completed group is the descriptor's high nibble worth of 0x10 steps, plus the 0x10 just added.
  // Subtract exactly that much back off the accumulator so any overshoot carries into the next group
  // — the classic accumulate-and-wrap that keeps the coins-per-credit rate exact over time.
  const delta = u8((coord2 & 0xf0) + COORD_STEP);
  mem8[DRIP_COORD_B] = u8(u8(-delta) + coord1); // wrap the second coord back into the first

  // The credits this group buys are the descriptor's low nibble. A low nibble of 0x0f is the
  // full-wrap sentinel: instead of awarding 0x0f it seeds the cap amount (0x63) into the tail.
  const addend = coord2 & 0x0f;
  // Ordinary group: hand the low-nibble credit count to the shared accumulate tail, which adds it to
  // the credit count, clamps at 0x63, and queues a credit-display refresh.
  if (addend !== 0x0f) return addCreditsAndQueueDisplay(m, addend); // partial wrap
  // Full-wrap group (low nibble 0x0f): enter the same tail through the full-wrap door, which seeds
  // the award amount to 0x63 before the shared add/clamp/queue.
  return addFullWrapCreditAmount(m); // full wrap (tail seeds amount 0x63)
}
