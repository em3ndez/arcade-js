// SPDX-License-Identifier: GPL-3.0-only
/** spawnEnemyIntoFreeSlotElseStepSearch — work one object slot in a downward search for a free one. A slot whose head byte is
 * already taken is left untouched and the turn is handed to the tail that steps to the next slot;
 * a free slot is claimed and stocked. Stocking draws a heading from the scroll angle jittered by a
 * random amount, reads a velocity pair from two chained tables through it, and seeds the record and
 * its paired entry with facing, script and a fresh animation. LIVE-OUT: the filled slot's record
 * and paired entry, or whatever the search tail leaves. At most one slot is filled per turn. */

import { closeOneTurnOfTheFreeSlotSearch } from "./closeOneTurnOfTheFreeSlotSearch.js";
import { drawRandomByte } from "./drawRandomByte.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { pickScriptAtRandomOrInTurn } from "./pickScriptAtRandomOrInTurn.js";
import { stepShapeAnimation } from "./stepShapeAnimation.js";
import { u8, u16 } from "../../../core/int.js";

const SCROLL_ANGLE = 0xa802;
const HEADING_TABLE = 0x39fb;
const VELOCITY_TABLE = 0x3a3b;
const SHARED_ZERO = 0xacc5;

const DIRECTION_MASK = 0x3f;
const JITTER_MASK = 0x0f;
const JITTER_BIAS = 0x08;
const VELOCITY_STRIDE = 4;

export function spawnEnemyIntoFreeSlotElseStepSearch(m, record = m.regs.ix, entry = m.regs.iy) {
  const { regs, mem8 } = m;

  if (mem8[record + 0x00] !== 0) return closeOneTurnOfTheFreeSlotSearch(m);
  mem8[record + 0x00] = 0xff; // claim the slot for this turn

  const base = mem8[SCROLL_ANGLE] >> 2;
  const jitter = (drawRandomByte(m) & JITTER_MASK) - JITTER_BIAS;
  regs.a = (base + jitter) & DIRECTION_MASK;

  regs.hl = HEADING_TABLE;
  regs.a = u8(fetchTableByte(m) * VELOCITY_STRIDE);
  regs.hl = VELOCITY_TABLE;
  mem8[entry + 0x31] = fetchTableByte(m);
  regs.hl = u16(regs.hl + 1);
  regs.a = mem8[regs.hl];
  mem8[entry + 0x00] = regs.a;

  regs.a = u8(mem8[SCROLL_ANGLE] + 0x80);
  mem8[record + 0x01] = regs.a;
  mem8[record + 0x02] = regs.a;

  mem8[record + 0x0a] = pickScriptAtRandomOrInTurn(m);
  regs.a = 0;
  mem8[SHARED_ZERO] = regs.a;
  mem8[record + 0x03] = 0x00;
  mem8[record + 0x05] = 0x00;
  mem8[record + 0x09] = 0x20;
  stepShapeAnimation(m, record);
  mem8[record + 0x0e] = 0x00;
}
