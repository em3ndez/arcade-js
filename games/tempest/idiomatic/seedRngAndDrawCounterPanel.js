// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_11f, POKEY1_RANDOM, POKEY2_RANDOM } from "./names.js";
import { buildTextOverlayList } from "./buildTextOverlayList.js";
import { drawCounterPair } from "./drawCounterPair.js";
import { drawHighlightedGlyphRowList } from "./drawHighlightedGlyphRowList.js";

/**
 * seedRngAndDrawCounterPanel — reseed a scratch RNG byte, then draw the counter panel. ROM 0xae1c.
 *
 * Role in the machine: this drives the attract/counter panel and, on the way in, stirs the
 * software RNG scratch that other draw routines pull from. It samples the two POKEY hardware
 * random registers and folds them into a scratch byte $29 and a stored nibble $11f, so the
 * displayed panel and any RNG-driven choices vary run to run, then paints the panel by
 * building the text overlay, drawing the counter pair, and drawing the highlighted glyph rows.
 *
 * Behavior: first build the text overlay list. Read POKEY1 random into $29, then XOR in that
 * same sample shifted right by four (folding its high nibble down). Take two POKEY2 samples:
 * fold the first, masked to its high nibble, into $29; and store the second, shifted left by
 * four (byte-clamped), XORed with $29, into $11f. Then draw the counter pair and tail-call
 * the glyph-row list draw with argument 0xff, returning its result.
 *
 * Live-out: scratch RNG byte $29 and stored nibble $11f (both reseeded), plus the drawn
 * counter panel / overlay / glyph rows. Grounding: [seen].
 */
export function seedRngAndDrawCounterPanel(m) {
  const { mem8 } = m;
  buildTextOverlayList(m);
  const r0 = mem8[POKEY1_RANDOM];                       // first POKEY1 random sample
  mem8[loc_29] = mem8[POKEY1_RANDOM];                   // seed scratch $29 from POKEY1
  mem8[loc_29] = (r0 >> 4) ^ mem8[loc_29];              // fold the sample's high nibble in
  const r1 = mem8[POKEY2_RANDOM];                       // POKEY2 sample for the high-nibble fold
  const r1shift = mem8[POKEY2_RANDOM];                  // POKEY2 sample destined for $11f
  mem8[loc_29] = ((r1 ^ mem8[loc_29]) & 0xf0) ^ mem8[loc_29]; // fold r1's high nibble into $29
  mem8[loc_11f] = ((r1shift << 4) & 0xff) ^ mem8[loc_29];     // stored nibble: r1shift<<4 XOR $29
  drawCounterPair(m);
  return drawHighlightedGlyphRowList(m, 0xff);
}
