// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";

// drawThreeSprites — the sprite-list driver pinned to a run of exactly three glyphs.
//
// WHAT IT IS
//   A one-line front door: it seats the count to three and hands off to the general sprite-list driver,
//   which walks three consecutive 8x8 sprite ids starting at DE, drawing each as a glyph and letting the
//   returned screen pointer carry down to the next id — so a run renders as a short line of three glyphs.
//
// ROLE IN THE MACHINE
//   The count register (C) is seeded to 3 here; DE is the id-list source (defaulting to the caller's DE)
//   and the destination screen address rides in HL through drawSpriteList / drawSprite8x8. Its known
//   caller is the mystery-saucer score award (awardSaucerScore, 0x070c), which lays down the saucer's
//   three-digit bonus score this way. Each glyph is drawn via drawSprite8x8 (id -> port 6, eight-byte
//   source table, an eight-row column copy), and the pointer advances one glyph-cell per id.
//
// ROM 0x08f1.  Grounding: [seen].
//
// LIVE-OUT: inherited from drawSpriteList — HL/DE/C left where the three-glyph walk finished (the saucer
// score caller reads HL/DE/C back).
export function drawThreeSprites(m, de = m.regs.de) {
  // Seat count = 3 and drop into the shared list driver. The only thing this wrapper fixes is the run
  // length; everything else (glyph decode, per-id pointer advance, the OR/copy blit) is drawSpriteList's.
  return drawSpriteList(m, de, 0x03);
}
