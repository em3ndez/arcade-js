// SPDX-License-Identifier: GPL-3.0-only
/**
 * publishBarrelSprite — the join every motion arm of the barrel walk reaches: write one barrel's
 * four sprite fields into the sprite buffer at the walk's staging cursor.
 * It is a PERMUTING GATHER, not a block copy: OBJ_X, OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR, OBJ_Y are
 * read from the record and stored in the sprite record's field order (SPRITE_X, SPRITE_CODE,
 * SPRITE_ATTR, SPRITE_Y) — the permutation is what turns a barrel record into the sprite hardware's
 * byte layout. That is the PUBLISH: after this the barrel is what gets drawn.
 * The staging cursor (page + low byte) arrives in `cur`; the walk owns it as a plain value and
 * advances it four bytes per slot. The record base is the slot the loop pointed at.
 */

import { u8 } from "../../../core/int.js";
import {
  OBJ_SPRITE_ATTR, OBJ_SPRITE_CODE, OBJ_X, OBJ_Y,
  SPRITE_ATTR, SPRITE_CODE, SPRITE_X, SPRITE_Y,
} from "./names.js";

export function publishBarrelSprite(m, cur, record = m.regs.ix) {
  const { mem8 } = m;
  const { page, cursor } = cur;

  // Each store lands on the cursor's page, so a cursor near the top wraps rather than crossing.
  mem8[page + u8(cursor + SPRITE_X)] = mem8[record + OBJ_X];
  mem8[page + u8(cursor + SPRITE_CODE)] = mem8[record + OBJ_SPRITE_CODE];
  mem8[page + u8(cursor + SPRITE_ATTR)] = mem8[record + OBJ_SPRITE_ATTR];
  mem8[page + u8(cursor + SPRITE_Y)] = mem8[record + OBJ_Y];
}
