// SPDX-License-Identifier: GPL-3.0-only
import { loc_3d } from "./names.js";
import { emitScaleWordIfChanged } from "./emitScaleWordIfChanged.js";
import { emitSlotIndexDigit } from "./emitSlotIndexDigit.js";

/**
 * emitCountDigitRun — publish a zero scale header, then emit the digit run for the slot
 * named by a scratch byte. ROM 0xaa97.
 *
 * Role in the machine: a small composite used when Tempest draws a counted value (a tally
 * shown as nibble digits) into the vector display list. It first commits a zero-valued scale
 * word — emitScaleWordIfChanged(0x00) writes the header only if the generator's current
 * scale differs — so the digits that follow are drawn at the baseline scale. It then emits
 * the one-byte digit run for whichever slot loc_3d currently names, turning that count into
 * on-screen nibble digits.
 *
 * Behavior: emitScaleWordIfChanged(m, 0x00); then tail-call emitSlotIndexDigit(m, mem8[loc_3d])
 * with the slot index read from the scratch byte loc_3d.
 *
 * Live-out: a possibly-emitted scale-header word and the digit-run bytes written by
 * emitSlotIndexDigit through the draw cursor. Grounding: [seen].
 */
export function emitCountDigitRun(m) {
  const { mem8 } = m;
  // Baseline the scale (header emitted only if it changed), then run the digits for loc_3d.
  emitScaleWordIfChanged(m, 0x00);
  return emitSlotIndexDigit(m, mem8[loc_3d]);
}
