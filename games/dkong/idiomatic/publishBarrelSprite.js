// SPDX-License-Identifier: GPL-3.0-only
/**
 * publishBarrelSprite — swap the barrel walk's registers back in, copy one barrel's four sprite
 * fields into the sprite buffer, and hand on to the between-slots step.
 *
 * This is the join every motion arm of the walk arrives at, and here is where the record's four
 * sprite bytes are actually written. It reads four fields of the record the walk's index register
 * points at — OBJ_X, OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR, OBJ_Y — and writes them to four consecutive
 * bytes at the staging cursor, in the sprite record's own field order: SPRITE_X, SPRITE_CODE,
 * SPRITE_ATTR, SPRITE_Y. It is a PERMUTING GATHER, not a block copy — OBJ_Y is read after the two
 * sprite bytes, and the two record fields lying between them are never read — and the permutation
 * is the whole point, because it is what turns a barrel record into the byte layout the sprite
 * hardware reads. That is the PUBLISH in the name: after this, the barrel is what gets drawn.
 *
 * THE LEADING EXCHANGE IS A CONTRACT ACROSS THE WHOLE WALK, and it is why this cannot be written
 * as a plain gather. The arms that jump here have swapped the walk's registers out to get a
 * working set of their own, and none of them swaps back; this routine's first act is that swap
 * back, so the cursor, the record pointer, the stride and the remaining-slot count are the walk's
 * again by the time anything is read. It is done unconditionally, not per caller — the arms that
 * never swapped out reach here through arms that did.
 *
 * The cursor moves three of the four bytes it just wrote; the fourth move belongs to the
 * between-slots step, which this routine hands on to and which both halves of the walk converge
 * on. Only the cursor's low byte moves, so it can never leave the page it is in.
 *
 * WHAT THIS FILE DOES NOT CLAIM: what the arms upstream of it computed, and why so many entry
 * points converge on one short tail. That the staged bytes survive to the sprite blit unmodified
 * is likewise outside this routine — it writes them, and nothing here establishes that no later
 * pass rewrites them.
 *
 * LIVE-OUT: memory — the four staged bytes — plus the register state the exchange restores and the
 * cursor's advanced low byte, both kept in the registers because the continuation reads them
 * there, and that continuation's return value propagated unchanged. DROPPED: the accumulator, in
 * which the last gathered byte would otherwise be left. Flags need no argument either way: the
 * increments here leave the carry alone and the continuation's first act rebuilds every other flag
 * from the carry and the cursor it has just stepped.
 */

import { u8 } from "../../../core/int.js";
import {
  OBJ_SPRITE_ATTR, OBJ_SPRITE_CODE, OBJ_X, OBJ_Y,
  SPRITE_ATTR, SPRITE_CODE, SPRITE_X, SPRITE_Y,
} from "./names.js";

export function publishBarrelSprite(m) {
  const { regs, mem8 } = m;

  // Put the walk's own registers back in play. Whichever arm jumped here left its working set
  // active; from this point the record pointer, the staging cursor, the stride and the
  // remaining-slot count are the walk's again.
  regs.exx();

  const record = regs.ix;
  const page = regs.h * 256; // the cursor's high byte never moves
  const cursor = regs.l;

  // The permuting gather: four barrel-record fields into one hardware sprite record. Each store
  // lands on the cursor's page, so a cursor near the top of its page wraps rather than running
  // on into the next one.
  mem8[page + u8(cursor + SPRITE_X)] = mem8[record + OBJ_X];
  mem8[page + u8(cursor + SPRITE_CODE)] = mem8[record + OBJ_SPRITE_CODE];
  mem8[page + u8(cursor + SPRITE_ATTR)] = mem8[record + OBJ_SPRITE_ATTR];
  mem8[page + u8(cursor + SPRITE_Y)] = mem8[record + OBJ_Y];

  // Three of the four cursor steps; the fourth is the first thing the between-slots step does,
  // which is what leaves the cursor on a record boundary for the next slot.
  regs.l = cursor + 3;

  // The between-slots step, reached by a jump, so its result is this routine's result.
  return m.call(0x1f8d);
}
