// SPDX-License-Identifier: GPL-3.0-only
/**
 * cullSpriteObjectsAtTop — clear the X of any sprite-object that has risen to the
 * top of the screen.  ROM 0x176c.
 *
 * Runs over the ten-record sprite-object block (SPRITE_OBJ_BLOCK, 0x6908–0x692f,
 * four bytes per record: +0 X, +1 code, +2 attr, +3 Y). For each record it reads
 * the Y byte and, if Y is above the top line (Y < 0x19 — smaller Y is higher on
 * screen), zeroes that record's X byte, parking the sprite at the left edge. Y and
 * X of every other record are left untouched; each record is decided independently.
 *
 * This is the cull pass of the board-advance sprite-clear sequence (sub_1757): the
 * animation step animateSpriteObjectBlock (0x306f) scrolls the block's Y upward each
 * frame, this pass zeroes the X of every record that has scrolled off the top, and
 * the sibling scan sub_1783 (0x1783) then checks whether ALL ten Xs are now zero to
 * decide the sprites are fully swept and the sub-state may advance. sub_1757 bridges
 * the two: it takes the HL/DE this routine leaves, `inc hl`/`inc de`, and hands
 * sub_1783 the block-scan pointer 0x6908 and record stride 4 — which is why HL/DE
 * are live-out here (HL = block start − 1 = 0x6907, DE = 3 = stride − 1).
 *
 * A LEAF: reads/writes only the sprite-object block, calls nothing. In the oracle the
 * loop walks HL from the last record's Y downward (sbc hl,de then dec hl, −4/record),
 * but the memory effect is order-independent, so this reads records low-to-high.
 *
 * Memory-equivalent to the frozen oracle — equivalence-176c.test.js.
 * GATE:     crafted-entry — 0x176c is unreached in attract (0 dispatches / 3000
 *           frames; its board-advance caller never runs there). Seeded from real
 *           captured RAM with the block populated, then the ten Y bytes are swept
 *           across the 0x19 threshold (uniform + per-record mixed) vs the oracle on
 *           RAM − STACK_SCRATCH + pc + SP + HL + DE.
 * LIVE-OUT: memory + HL + DE — the zeroed X bytes, plus the scan pointer/stride the
 *           sibling sub_1783 consumes (via sub_1757's inc hl / inc de). A/B/F are
 *           dead: sub_1783 reloads B and A and overwrites F before reading them.
 * NAMES:    SPRITE_OBJ_BLOCK (ram.js). 0x19 top-line and the 4-byte record layout
 *           stay literal — screen geometry, no RAM address.
 */

import { SPRITE_OBJ_BLOCK } from "../optimized/ram.js";

const RECORD_COUNT = 10; // the block holds ten 4-byte sprite-object records
const RECORD_STRIDE = 4; // +0 X, +1 code, +2 attr, +3 Y
const TOP_Y = 0x19; // screen Y line; a record with Y below it has risen off the top

export function cullSpriteObjectsAtTop(m) {
  const { mem, regs } = m;

  for (let i = 0; i < RECORD_COUNT; i++) {
    const record = SPRITE_OBJ_BLOCK + i * RECORD_STRIDE;
    if (mem.read8(record + 3) < TOP_Y) {
      mem.write8(record, 0x00); // Y above the top line -> park X at the left edge
    }
  }

  // Live-out for the sibling scan: sub_1757 does inc hl / inc de on these to get
  // sub_1783's block-scan pointer (0x6908) and record stride (4).
  regs.hl = (SPRITE_OBJ_BLOCK - 1) & 0xffff; // 0x6907
  regs.de = RECORD_STRIDE - 1; // 0x0003
}
