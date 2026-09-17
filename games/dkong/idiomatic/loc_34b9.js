// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_34b9 — seed an object record's paired position fields from one of two template tables;
 * skipped entirely on board 3. Picks the table by bit 7 of MARIO_X (Mario's screen half) and the
 * 2-byte entry by the spin counter's bits 1-2. Stamps the entry's X byte into OBJ_X and its
 * companion, the Y byte into OBJ_Y and its companion, then clears three record bytes. The object
 * record pointer arrives in a register.
 *
 * LIVE-OUT: memory-only — the seeded and cleared record fields.
 */

import { BOARD, MARIO_X, SPIN_COUNT, OBJ_X, OBJ_Y, OBJ_STATE } from "./names.js";

const TABLE_BIT7_CLEAR = 0x3ac4;
const TABLE_BIT7_SET = 0x3ad4;

const OBJ_X_COMPANION = 0x0e; // gets the same byte as OBJ_X
const OBJ_Y_COMPANION = 0x0f; // gets the same byte as OBJ_Y
const OBJ_CLEAR_18 = 0x18;
const OBJ_CLEAR_1C = 0x1c;

export function loc_34b9(m, ix = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[BOARD] === 0x03) return;

  const table = (mem8[MARIO_X] & 0x80) !== 0 ? TABLE_BIT7_SET : TABLE_BIT7_CLEAR;
  const entry = table + (mem8[SPIN_COUNT] & 0x06);
  const posX = mem8[entry];
  const posY = mem8[entry + 1];

  const objBase = ix;

  mem8[(objBase + OBJ_X) & 0xffff] = posX;
  mem8[(objBase + OBJ_X_COMPANION) & 0xffff] = posX;
  mem8[(objBase + OBJ_Y) & 0xffff] = posY;
  mem8[(objBase + OBJ_Y_COMPANION) & 0xffff] = posY;

  mem8[(objBase + OBJ_STATE) & 0xffff] = 0x00;
  mem8[(objBase + OBJ_CLEAR_18) & 0xffff] = 0x00;
  mem8[(objBase + OBJ_CLEAR_1C) & 0xffff] = 0x00;
}
