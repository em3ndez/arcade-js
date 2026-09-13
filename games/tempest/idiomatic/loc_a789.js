// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SLOT_FLAGS, SPAWN_BUDGET_TIMER, SPAWN_FOUND_FLAG, MODE_DISPATCH_SEL, PROJ_OFS_X_LO, PROJ_OFS_X_HI } from "./names.js";

// Init leaf: zero the 16-byte per-slot table, then re-seed a few scalar cells to
// their starting values (two to 0x20, one to 0x04, and a pair to 0).
export function loc_a789(m) {
  const { mem8 } = m;
  for (let x = 0x0f; x >= 0; x--) mem8[u16(ENEMY_SLOT_FLAGS + x)] = 0x00;
  mem8[SPAWN_BUDGET_TIMER] = 0x20;
  mem8[SPAWN_FOUND_FLAG] = 0x20;
  mem8[MODE_DISPATCH_SEL] = 0x04;
  mem8[PROJ_OFS_X_LO] = 0x00;
  mem8[PROJ_OFS_X_HI] = 0x00;
}
