// SPDX-License-Identifier: GPL-3.0-only
/**
 * publishBarrelSprite — the join every motion arm of the barrel walk reaches: swap the walk's
 * registers back in, then write one barrel's four sprite fields into the sprite buffer.
 * It is a PERMUTING GATHER, not a block copy: OBJ_X, OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR, OBJ_Y are
 * read from the record and stored in the sprite record's field order (SPRITE_X, SPRITE_CODE,
 * SPRITE_ATTR, SPRITE_Y) — the permutation is what turns a barrel record into the sprite hardware's
 * byte layout. That is the PUBLISH: after this the barrel is what gets drawn.
 * THE LEADING EXCHANGE IS A CONTRACT: the arms that jump here swapped the walk's registers out and
 * none swaps back, so this routine's first act restores the cursor, record pointer, stride and
 * remaining-slot count. It is unconditional — arms that never swapped out arrive through arms that
 * did, so making it conditional corrupts the walk. Hands on to the between-slots step.
 */

import { u8 } from "../../../core/int.js";
import {
  OBJ_SPRITE_ATTR, OBJ_SPRITE_CODE, OBJ_X, OBJ_Y,
  SPRITE_ATTR, SPRITE_CODE, SPRITE_X, SPRITE_Y,
} from "./names.js";

export function publishBarrelSprite(m) {
  const { regs, mem8 } = m;

  regs.exx();

  const record = regs.ix;
  const page = regs.h * 256; // the cursor's high byte never moves
  const cursor = regs.l;

  // Each store lands on the cursor's page, so a cursor near the top wraps rather than crossing.
  mem8[page + u8(cursor + SPRITE_X)] = mem8[record + OBJ_X];
  mem8[page + u8(cursor + SPRITE_CODE)] = mem8[record + OBJ_SPRITE_CODE];
  mem8[page + u8(cursor + SPRITE_ATTR)] = mem8[record + OBJ_SPRITE_ATTR];
  mem8[page + u8(cursor + SPRITE_Y)] = mem8[record + OBJ_Y];

  regs.l = cursor + 3;

  return m.call(0x1f8d);
}
