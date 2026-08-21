// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { SPRITE_DISPLAY_LIST } from "./names.js";
/**
 * mirrorSpriteListVertically — flip the 24-entry sprite display list for flip-screen.
 *
 * Walks the stride-4 list in place: each entry's two coordinate bytes are negated and offset
 * (-x - 0x10), and the attribute byte's two flip bits are toggled while its low nibble is kept.
 * Byte +0x03 of each entry is left untouched. A leaf: rewrites the list only, calls nothing.
 *
 * LIVE-OUT: memory only (the rewritten list). The caller rets straight after; no register survives.
 */
export function mirrorSpriteListVertically(m) {
  const { mem8 } = m;

  let rec = SPRITE_DISPLAY_LIST;
  for (let i = 0; i < 0x18; i++) {
    mem8[rec + 0x00] = u8(-mem8[rec + 0x00] - 0x10);
    const attr = mem8[rec + 0x01];
    mem8[rec + 0x01] = (attr & 0x0f) | ((attr & 0xc0) ^ 0xc0); // keep low nibble, flip the two flip bits
    mem8[rec + 0x02] = u8(-mem8[rec + 0x02] - 0x10);
    rec = u16(rec + 4);
  }
}
