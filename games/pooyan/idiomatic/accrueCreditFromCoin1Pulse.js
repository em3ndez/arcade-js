// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { emitPresetSound } from "./emitPresetSound.js";
import { addFullWrapCreditAmount } from "./addFullWrapCreditAmount.js";
import { addCreditsAndQueueDisplay } from "./addCreditsAndQueueDisplay.js";
import {
  INPUT_PORT0,
  DRIP_RING_C,
  COIN1_PULSE_COUNT,
  SCORE_DRIP_ACCUM,
  COINAGE_CONFIG,
} from "./names.js";
/**
 * accrueCreditFromCoin1Pulse — the coin-slot-1 arm of the coin/credit subsystem, run once per frame.
 * ROM 0x5a56. Grounding: [seen].
 *
 * WHAT IT IS
 *   One of three near-identical per-frame credit accumulators (this one watches coin slot 1; siblings
 *   watch the service button and coin slot 2). The coin, service and start buttons all arrive on a
 *   single active-low hardware port whose complemented sample lives at INPUT_PORT0; in that byte bit 0
 *   is coin slot 1. A real coin pulse is electrically noisy and spans several frames, so a coin is not
 *   accepted the instant its bit is high — it is fed through a software debounce and only "accepted"
 *   once per clean pulse.
 *
 * ITS ROLE IN THE MACHINE
 *   On each accepted slot-1 coin this step does three things: (1) plays the coin-accept sound, (2)
 *   queues one pulse for the cabinet's mechanical coin-counter-1 meter, and (3) runs the coinage
 *   arithmetic that turns "N coins" into "M credits" according to the operator's DIP coinage setting.
 *   The whole coin subsystem is only reached on a pay-to-play machine (the dispatcher short-circuits
 *   the entire chain when either coinage descriptor reads the free-play sentinel), so every call here
 *   is on a machine that actually charges for play.
 *
 * LIVE-OUT
 *   None in registers — a void per-frame step. Its effect is entirely in memory:
 *     - DRIP_RING_C        : always rotated one bit left (the running debounce shift register).
 *   and, only on an accepted coin:
 *     - COIN1_PULSE_COUNT  : incremented (one more pulse owed to the physical meter).
 *     - SCORE_DRIP_ACCUM   : advanced +0x10, and wrapped back down when a coin group completes.
 *     - the credit count   : bumped, clamped and re-displayed via the shared accumulate tail
 *                            (addCreditsAndQueueDisplay / addFullWrapCreditAmount) when a group awards
 *                            credits. (The "score"/"drip" wording on these cells is a misnomer; the
 *                            cell the tail accumulates into is the credit count, not a score.)
 */
export function accrueCreditFromCoin1Pulse(m) {
  const { mem8 } = m;

  // --- Debounce shift + accept-phase gate ---------------------------------------------------------
  // Shift coin-slot-1's input level into a small ring (shift register) and act only when the ring
  // settles on the single "accept" phase. Isolate bit 0 (coin slot 1) of the complemented input
  // sample at INPUT_PORT0 (0x8810); this is the bit that will be shifted in this frame.
  const ringCarry = mem8[INPUT_PORT0] & 1; // rrca: carry := bit0 of the input
  // Rotate DRIP_RING_C (0x882a) left by one, injecting that coin bit at the bottom. The ring is a
  // rolling history of the last several frames of the coin line.
  mem8[DRIP_RING_C] = u8((mem8[DRIP_RING_C] << 1) | ringCarry); // rl (hl)
  // The low three bits of the ring encode the debounce phase. Exactly one pattern — value 1, a lone
  // freshly-shifted-in high bit trailing zeros — counts as a clean coin accept; every other phase is
  // idle line, contact bounce, or a still-held coin, and does nothing this frame.
  if ((mem8[DRIP_RING_C] & 0x07) !== 1) return; // only phase 1 acts

  // --- On accept: coin sound + physical-meter pulse ----------------------------------------------
  // A coin has been accepted. Play the coin-accept sound (emitPresetSound, ROM 0x0f09, hands a preset
  // command to the audio processor).
  emitPresetSound(m);
  // Owe one pulse to the mechanical coin-counter-1 meter: bump COIN1_PULSE_COUNT (0x8824). A separate
  // per-frame strobe step drains this count, driving one fixed-width electrical pulse to the cabinet's
  // meter per coin — decoupled in time from the coin pulse itself.
  mem8[COIN1_PULSE_COUNT] = u8(mem8[COIN1_PULSE_COUNT] + 1);

  // --- Coinage accumulate + threshold compare ----------------------------------------------------
  // Classic accumulate-and-compare against the slot-1 coinage descriptor COINAGE_CONFIG (0x882c),
  // whose high nibble sets how many coins make a group and whose low nibble sets how many credits that
  // group buys. Each accepted coin advances the accumulator SCORE_DRIP_ACCUM (0x882b) by 0x10 — i.e.
  // one coin == one high-nibble step.
  const stepped = u8(mem8[SCORE_DRIP_ACCUM] + 0x10);
  mem8[SCORE_DRIP_ACCUM] = stepped;
  const cfg = mem8[COINAGE_CONFIG];
  // Until the accumulator overtakes the descriptor, not enough coins have arrived to complete a group,
  // so no credit is awarded — return and wait for the next coin. (Z80: sub (hl),b then ret nc; no
  // borrow, meaning config >= accumulator, means the group is not yet full.)
  if (cfg >= stepped) return; // sub (hl),b -> ret nc: no borrow means nothing to carry

  // --- Group complete: peel one group off the accumulator ----------------------------------------
  // A coin group just completed. Subtract one whole group — (high nibble of the descriptor) plus one
  // more 0x10 step — back off the accumulator, so the leftover carries forward toward the next group.
  const carry = u8(u8(-u8((cfg & 0xf0) + 0x10)) + mem8[SCORE_DRIP_ACCUM]);
  mem8[SCORE_DRIP_ACCUM] = carry;

  // --- Award the group's credits -----------------------------------------------------------------
  // The descriptor's low nibble is how many credits this completed group buys.
  const nibble = cfg & 0x0f;
  // Normal case: hand that credit count to the shared accumulate tail, which adds it to the credit
  // count, clamps to the 0x63 (99) maximum, and queues a credit-HUD refresh.
  if (nibble !== 0x0f) return addCreditsAndQueueDisplay(m, nibble); // add the nibble to the score byte
  // Sentinel case: a low nibble of 0x0f is a full wrap that awards the cap amount — seed 0x63 into the
  // same accumulate tail instead of the nibble.
  return addFullWrapCreditAmount(m); // full wrap -> seed 0x63 into the accumulate tail
}
