// SPDX-License-Identifier: GPL-3.0-only
/** spawnEnemyIntoFreeSlotElseStepSearch — work one object slot in a downward search for a free one. A slot whose head byte is
 * already taken is left untouched and the turn is handed to the tail that steps to the next slot;
 * a free slot is claimed and stocked. Stocking draws a heading from the scroll angle jittered by a
 * random amount, reads a velocity pair from two chained tables through it, and seeds the record and
 * its paired entry with facing, script and a fresh animation. LIVE-OUT: memory. Every register the
 * body touches is dead-after-return scratch — the table walk holds its cursor and index in JS
 * locals, every arm hands on to a callee that reseats what it needs, and the four callers each
 * tail-return this result and read no register back, so nothing survives. Only the two cursors ride
 * in as boundary-seated callee params (record and entry, defaulted off the register file). At most
 * one slot is filled per turn. */

import { closeOneTurnOfTheFreeSlotSearch } from "./closeOneTurnOfTheFreeSlotSearch.js";
import { drawRandomByte } from "./drawRandomByte.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { pickScriptAtRandomOrInTurn } from "./pickScriptAtRandomOrInTurn.js";
import { stepShapeAnimation } from "./stepShapeAnimation.js";
import { u8, u16 } from "../../../core/int.js";
import { PLAYER_HEADING, ENEMY_SPAWN_DIRECTION_INDEX_TABLE, ENEMY_SPAWN_RECORD_TABLE, loc_acc5 } from "./names.js";

const DIRECTION_MASK = 0x3f;
const JITTER_MASK = 0x0f;
const JITTER_BIAS = 0x08;
const VELOCITY_STRIDE = 4;
const FACING_BIAS = 0x80;

export function spawnEnemyIntoFreeSlotElseStepSearch(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;

  if (mem8[record + 0x00] !== 0) return closeOneTurnOfTheFreeSlotSearch(m);
  mem8[record + 0x00] = 0xff; // claim the slot for this turn

  // heading = scroll angle folded to a quadrant, jittered by a signed random amount, kept in range
  const base = mem8[PLAYER_HEADING] >> 2;
  const jitter = (drawRandomByte(m) & JITTER_MASK) - JITTER_BIAS;
  const heading = (base + jitter) & DIRECTION_MASK;

  // the heading picks a stride-four record index, then two consecutive bytes of the velocity pair
  const velocityIndex = u8(fetchTableByte(m, ENEMY_SPAWN_DIRECTION_INDEX_TABLE, heading) * VELOCITY_STRIDE);
  const velocityEntry = u16(ENEMY_SPAWN_RECORD_TABLE + velocityIndex);
  mem8[entry + 0x31] = fetchTableByte(m, ENEMY_SPAWN_RECORD_TABLE, velocityIndex);
  mem8[entry + 0x00] = mem8[u16(velocityEntry + 1)];

  const facing = u8(mem8[PLAYER_HEADING] + FACING_BIAS);
  mem8[record + 0x01] = facing;
  mem8[record + 0x02] = facing;

  mem8[record + 0x0a] = pickScriptAtRandomOrInTurn(m);
  mem8[loc_acc5] = 0x00;
  mem8[record + 0x03] = 0x00;
  mem8[record + 0x05] = 0x00;
  mem8[record + 0x09] = 0x20;
  stepShapeAnimation(m, record);
  mem8[record + 0x0e] = 0x00;
}
