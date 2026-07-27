// SPDX-License-Identifier: GPL-3.0-only
/**
 * stageObjectSpriteRecord — build the object's 4-byte deferral record at 0x8220, biasing its ends.  ROM 0x1b5b.
 *
 * Where the tile-under-object classifier lands when the object is sitting on a SOLID
 * (non-diggable) tile: rather than dig or collect, it defers the frame by writing a
 * fixed record for the object at 0x8220. The record is the object's own 4-byte probe
 * block — column, sprite code, a middle byte, row — copied across, with the two ends
 * pulled apart by the bias value in the dip-switch parameter block: the leading
 * (column) byte has the bias subtracted, the trailing (row) byte has it added, and the
 * middle two carry straight through. Both biased ends wrap within a byte.
 *
 * Reads five work-RAM bytes, writes four, touches nothing else, calls nothing. What the
 * downstream code does with this record is not yet pinned, so the name stays neutral.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1b5b.test.js.
 * GATE:     crafted-entry — reached via the classifier's solid-tile deferral; validated
 *           on real captured attract states plus crafted arithmetic-edge entries (the
 *           bias wraps on both the subtracted and the added end). It reads only its five
 *           inputs, so any realistic machine state is a valid entry.
 * LIVE-OUT: memory-only — the four record bytes at 0x8220-0x8223. The residual register
 *           values it leaves behind are dead ABI; the classifier's caller consumes no
 *           register from here (the record is the whole output, and it lives in RAM).
 * NAMES:    OBJ_X, SPRITE_CODE, OBJ_Y, OBJ_SPRITE_ATTR (the probe-block middle byte, 0x806a)
 *           from ram.js. The bias 0x8051 (a dip-switch-derived value, not yet individually
 *           named) and the record base 0x8220 stay hex — their roles are not yet grounded.
 */

import { OBJ_X, SPRITE_CODE, OBJ_Y, OBJ_SPRITE_ATTR } from "./ram.js";

const RECORD = 0x8220; // base of the 4-byte deferral record built for the object
const BIAS = 0x8051; // the end-bias, held in the dip-switch parameter block

export function stageObjectSpriteRecord(m) {
  const { mem8 } = m;

  const bias = mem8[BIAS];

  // Copy the object's probe block into the record, pushing the ends apart by the bias.
  // Each store truncates to a byte, so the two biased ends wrap.
  mem8[RECORD] = mem8[OBJ_X] - bias; // leading: column, bias removed
  mem8[RECORD + 1] = mem8[SPRITE_CODE]; // sprite/animation code, copied through
  mem8[RECORD + 2] = mem8[OBJ_SPRITE_ATTR]; // probe-block middle byte, copied through
  mem8[RECORD + 3] = mem8[OBJ_Y] + bias; // trailing: row, bias added
}
