// SPDX-License-Identifier: GPL-3.0-only
/** loc_3d25 — spawn one aimed enemy, but only when the spawn slot is free, the cooldown at
 * SPAWN_COOLDOWN is clear, the era count is live, and some object in the caller's two-slot bank sits
 * inside a doubled window. Draws a heading toward the player at ENEMY_STANDOFF_AIM_MAIN, alternates the aim's
 * side each spawn via SIDE_TOGGLE, then seats coords, the doubled velocity pair, a script and a
 * shape into the era's fixed record+sprite bank and reloads the cooldown. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { loc_565f } from "./loc_565f.js";
import { headingToward } from "./headingToward.js";
import { loc_59c5 } from "./loc_59c5.js";
import { ENEMY_STANDOFF_AIM_MAIN } from "./names.js";

const SPAWN_COOLDOWN = 0xa8f4;
const COOLDOWN_RELOAD = 0xa8f6;
const ERA_COUNT = 0xa8c6;
const SCAN_BANK_FLAG = 0xa8e0;
const BANK_A_FLAG = 0xa840;
const WINDOW_HALF = 0xa8d6;
const SIDE_TOGGLE = 0xa8d4;

const SLOT_FREE = 0xff;
const SEARCH_SLOTS = 2;
const RECORD_STRIDE = 0x10;
const ENTRY_STRIDE = 2;
const ENTRY_X = 0x00;
const ENTRY_Y = 0x31;
const X_ORIGIN = 0x84;
const Y_ORIGIN = 0x78;
const TURN = 0x18;

const BANK_A_RECORD = 0xa840;
const BANK_A_ENTRY = 0xaa18;
const BANK_B_RECORD = 0xa8e0;
const BANK_B_ENTRY = 0xaa2c;
const NEW_SCRIPT = 0x4d;
const NEW_SHAPE = 0x62;

// era count != 1 with the scan flag clear selects the second bank; the guard and the seat both ask.
const useSecondBank = (m) => m.mem8[ERA_COUNT] !== 1 && m.mem8[SCAN_BANK_FLAG] === 0;

export function loc_3d25(m) {
  const { regs, mem8 } = m;

  if (mem8[regs.ix] !== SLOT_FREE) return;
  if (mem8[SPAWN_COOLDOWN] !== 0) return;
  if (mem8[ERA_COUNT] === 0) return;
  if (!useSecondBank(m) && mem8[BANK_A_FLAG] !== 0) return;

  const half = mem8[WINDOW_HALF];
  regs.d = half;
  regs.e = u8(2 * half);
  regs.b = SEARCH_SLOTS;
  let hit = false;
  do {
    const x = u8(u8(X_ORIGIN - mem8[u16(regs.iy + ENTRY_X)]) + half);
    const y = u8(u8(Y_ORIGIN - mem8[u16(regs.iy + ENTRY_Y)]) + half);
    if (x >= regs.e || y >= regs.e) { hit = true; break; }
    regs.ix = u16(regs.ix + RECORD_STRIDE);
    regs.iy = u16(regs.iy + ENTRY_STRIDE);
    regs.b = u8(regs.b - 1);
  } while (regs.b !== 0);
  if (!hit) return;

  loc_565f(m);
  regs.hl = ENEMY_STANDOFF_AIM_MAIN;
  const heading = headingToward(m);
  mem8[SIDE_TOGGLE] = u8(mem8[SIDE_TOGGLE] + 1);
  const turn = mem8[SIDE_TOGGLE] & 1 ? TURN : u8(-TURN);
  const aimed = u8(turn + heading);

  regs.b = mem8[u16(regs.iy + ENTRY_Y)];
  regs.c = mem8[u16(regs.iy + ENTRY_X)];
  if (useSecondBank(m)) {
    regs.ix = BANK_B_RECORD;
    regs.iy = BANK_B_ENTRY;
  } else {
    regs.ix = BANK_A_RECORD;
    regs.iy = BANK_A_ENTRY;
  }

  mem8[regs.iy + ENTRY_Y] = regs.b;
  mem8[regs.iy + ENTRY_X] = regs.c;
  regs.a = aimed;
  loc_59c5(m); // fills regs d,e and b,c with the doubled velocity pair for the aimed heading
  mem8[regs.ix + 0x0a] = regs.e;
  mem8[regs.ix + 0x0b] = regs.d;
  mem8[regs.ix + 0x0c] = regs.c;
  mem8[regs.ix + 0x0d] = regs.b;
  mem8[regs.iy + 0x01] = NEW_SCRIPT;
  mem8[regs.iy + 0x30] = NEW_SHAPE;
  mem8[regs.ix] = u8(mem8[regs.ix] - 1);
  regs.a = mem8[COOLDOWN_RELOAD];
  mem8[SPAWN_COOLDOWN] = regs.a;
}
