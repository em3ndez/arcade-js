// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageActorSpriteRecords — stage the current actor's two hardware sprite records
 * (its main body and its shadow "twin") into the sprite buffer.  ROM 0x3a4c.
 *
 * Every object mover funnels into this routine as its final act: after the
 * move/collision pass has updated the live object record, this builds the two
 * 4-byte sprite entries the display will show for it. The entries land in the last
 * two slots of the 32-byte sprite buffer at 0x8220, which the per-frame service
 * copies wholesale into sprite RAM — so what is written here is exactly what draws
 * next frame.
 *
 * Each of the two records is assembled the same way: the first three bytes of the
 * source object record are copied through unchanged, and the fourth byte (the
 * record's Y position) is copied with a shared offset added to it. The offset is a
 * dip-switch-configured constant (0 in normal play) that shifts every actor sprite
 * vertically by the same amount. The two sources are the primary object record and
 * its mirrored twin/shadow record.
 *
 * Touches only fixed work RAM (reads the two object records + the shared offset,
 * writes the two sprite-buffer slots); it takes nothing and returns nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3a4c.test.js.
 * GATE:     real captured dispatches (reached in attract from ~frame 675, the demo
 *           movers) + a crafted entry that pokes the offset nonzero on both sides,
 *           since attract only ever runs it with offset 0.
 * LIVE-OUT: memory-only — the two staged sprite records. The oracle's residual
 *           registers/flags are dead ABI; nothing downstream reads them.
 * NAMES:    ENEMY3_X/ENEMY3_Y (primary record base + its Y), ENEMY3_TWIN_X/ENEMY3_TWIN_Y (twin
 *           record base + its Y), ENEMY3_SPRITE_SLOT/ENEMY3_TWIN_SPRITE_SLOT (the two
 *           sprite-buffer slots 0x8238/0x823c) from ./ram.js. 0x8051 is SPRITE_COORD_BIAS,
 *           used raw here as the shared vertical-offset (end-bias) dip-switch param.
 */

import { ENEMY3_X, ENEMY3_TWIN_X, ENEMY3_SPRITE_SLOT, ENEMY3_TWIN_SPRITE_SLOT } from "./ram.js";

// The two destination slots ENEMY3_SPRITE_SLOT / ENEMY3_TWIN_SPRITE_SLOT are entries 6 and 7 of
// the 32-byte sprite buffer at 0x8220 that the per-frame service mirrors into sprite RAM.

// The shared vertical offset added to every staged sprite's Y (dip-switch param).
const SPRITE_Y_OFFSET = 0x8051;

/**
 * Build one 4-byte sprite record from an object record: three bytes verbatim, then
 * the fourth (the record's Y) with the shared offset added (kept to a byte).
 */
function stageRecord(m, srcBase, destSlot, yOffset) {
  const { mem8 } = m;
  mem8[destSlot] = mem8[srcBase];
  mem8[destSlot + 1] = mem8[srcBase + 1];
  mem8[destSlot + 2] = mem8[srcBase + 2];
  mem8[destSlot + 3] = mem8[srcBase + 3] + yOffset;
}

export function stageActorSpriteRecords(m) {
  const yOffset = m.mem8[SPRITE_Y_OFFSET];
  stageRecord(m, ENEMY3_X, ENEMY3_SPRITE_SLOT, yOffset); // primary body
  stageRecord(m, ENEMY3_TWIN_X, ENEMY3_TWIN_SPRITE_SLOT, yOffset); // shadow twin
}
