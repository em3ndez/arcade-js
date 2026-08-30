// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { SPRITE_DISPLAY_LIST } from "./names.js";
/**
 * mirrorSpriteListVertically — reflect all 24 sprite records for a flipped screen. [seen]
 *
 * ROM 0x0378-0x039a.
 *
 * WHAT IT IS
 *   When the machine runs upside-down — a cocktail cabinet's second player, or the
 *   flip-screen configuration DIP — every sprite has to be reflected so it still lands in
 *   the right place on the mirrored raster. This routine performs that reflection for the
 *   whole sprite display list in one pass, in place.
 *
 * ROLE IN THE MACHINE
 *   The list lives at SPRITE_DISPLAY_LIST (0x8840), 24 records of 4 bytes each. It is rebuilt
 *   every frame (byte +0 of the base record is the first sprite's live Y coordinate, per the
 *   [seen] grounding of SPRITE_DISPLAY_LIST), and this routine is the fixup applied afterward
 *   when the screen is flipped. Each record's layout used here:
 *     +0  a coordinate byte (the sprite's Y at the list base)  — reflected
 *     +1  the sprite attribute byte                            — flip bits toggled
 *     +2  the other coordinate byte                            — reflected
 *     +3  the tile/code byte                                   — left untouched
 *
 * MECHANISM
 *   A coordinate is reflected by negating it and then backing off by 0x10 (the ROM does
 *   NEG then SUB 0x10) — the -0x10 accounts for the sprite's own extent so the reflected
 *   sprite still registers against the same edge. Both coordinate bytes are treated the same
 *   way; the code/tile byte at +3 needs no change and is skipped.
 *
 *   The attribute byte carries the hardware's two flip bits in the top two bits (0xc0) and
 *   the color in the low nibble (0x0f). Reflecting the sprite means toggling BOTH flip bits
 *   (XOR 0xc0) so its own pixels mirror, while the color must be preserved untouched.
 *
 * A pure leaf: it rewrites the list and calls nothing.
 *
 * LIVE-OUT: memory only (the rewritten list). The caller rets straight after; no register survives.
 */
export function mirrorSpriteListVertically(m) {
  const { mem8 } = m;

  // Walk the 24 (0x18) stride-4 records of the sprite display list from its base.
  let rec = SPRITE_DISPLAY_LIST;
  for (let i = 0; i < 0x18; i++) {
    // First coordinate byte (+0): reflect it — negate, then back off 0x10 for the sprite's
    // own width/height so it registers against the mirrored edge. u8 keeps it 8-bit (wraps).
    mem8[rec + 0x00] = u8(-mem8[rec + 0x00] - 0x10);

    // Attribute byte (+1): toggle the two hardware flip bits (0xc0) so the sprite's own
    // pixels mirror, and preserve the color in the low nibble (0x0f) unchanged.
    const attr = mem8[rec + 0x01];
    mem8[rec + 0x01] = (attr & 0x0f) | ((attr & 0xc0) ^ 0xc0); // keep low nibble, flip the two flip bits

    // Second coordinate byte (+2): reflect it the same way as +0.
    mem8[rec + 0x02] = u8(-mem8[rec + 0x02] - 0x10);

    // Advance to the next record; +3 (the tile/code byte) is left as it was. u16 keeps the
    // pointer 16-bit.
    rec = u16(rec + 4);
  }
}
