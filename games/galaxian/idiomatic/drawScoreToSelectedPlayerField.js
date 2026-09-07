// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawScoreToSelectedPlayerField — paint a BCD score column into one of the two player digit fields.
 *
 * WHAT IT IS
 *   Chooses which of the two on-screen score fields to draw into from a one-byte selector, then paints
 *   the caller's packed-BCD number there. The machine keeps two fixed digit fields in the character map,
 *   one per player position; the selector says which cursor to load before the shared number painter runs.
 *
 * ROLE IN THE MACHINE
 *   The field-selecting front door onto drawBcdNumberColumn (0x2261):
 *     - selector 0  -> DIGIT_FIELD_PRIMARY (0x5381), the primary player's score field.
 *     - any other   -> DIGIT_FIELD_ALT (0x5121), the alternate player's field. (In the two-player case
 *       drawScoreFieldByIndex passes the live-flag value itself as the selector, so a nonzero flag both
 *       selects the alt field and gates the draw on.)
 *   With the cursor chosen, drawBcdNumberColumn walks three packed-BCD bytes down from `source` and
 *   stamps six digit tiles up that VRAM column. No work-RAM write; VRAM only.
 *
 * ROM 0x2256.  Grounding: [seen].
 *
 * LIVE-OUT: whatever drawBcdNumberColumn returns (the six score digits repainted into the chosen field).
 */
import { drawBcdNumberColumn } from "./drawBcdNumberColumn.js";
import { DIGIT_FIELD_PRIMARY, DIGIT_FIELD_ALT } from "./names.js";

export function drawScoreToSelectedPlayerField(m, field = m.regs.a, source = m.regs.de) {
  // Selector 0 targets the primary field; anything else targets the alternate field.
  const cursor = field === 0 ? DIGIT_FIELD_PRIMARY : DIGIT_FIELD_ALT;
  // Paint six packed-BCD digits from `source` up the chosen VRAM digit column.
  return drawBcdNumberColumn(m, source, cursor);
}
