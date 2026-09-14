// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SAVED_INDEX2, ENEMY_SLOT_TOP, ENEMY_DEPTH, loc_29, loc_2a, TUBE_GEOM_FLAG, POKEY1_RANDOM,
  ENEMY_SEGMENT, ENEMY_PHASE, ENEMY_TIMER, COORD_LIST_PTR_LO, ENEMY_SLOT_DIR, COORD_LIST_PTR_HI, ENEMY_SCRIPT_CURSOR,
  ENEMY_TOTAL_COUNT, loc_2b, ENEMY_SLOT_FLAGS, LANE_ENEMY_COUNT_0,
} from "./names.js";

// Find a free slot in the active table by scanning a count index down to zero;
// on a hit, seed the slot's parallel per-entry arrays, bump the active count and
// a per-lane counter, and report 0x10. Report 0 when no slot is free.
export function spawnClimberInFreeSlot(m, y = m.regs.y, x = m.regs.x) {
  const { mem8 } = m;
  mem8[SAVED_INDEX2] = y;
  y = mem8[ENEMY_SLOT_TOP];
  while (mem8[u16(ENEMY_DEPTH + y)] !== 0) {
    y = u8(y - 1);
    if (y & 0x80) return (m.regs.a = 0x00); // scanned past index 0
  }
  mem8[u16(ENEMY_DEPTH + y)] = mem8[loc_29];
  let a = mem8[loc_2a];
  if (a === 0x0f && mem8[TUBE_GEOM_FLAG] & 0x80) a = mem8[POKEY1_RANDOM] & 0x0e;
  mem8[u16(ENEMY_SEGMENT + y)] = a;
  mem8[u16(ENEMY_PHASE + y)] = (a + 1) & 0x0f;
  mem8[u16(ENEMY_TIMER + y)] = 0x00;
  mem8[u16(ENEMY_SLOT_DIR + y)] = mem8[COORD_LIST_PTR_LO];
  mem8[u16(ENEMY_SCRIPT_CURSOR + y)] = mem8[COORD_LIST_PTR_HI];
  mem8[ENEMY_TOTAL_COUNT] = mem8[ENEMY_TOTAL_COUNT] + 1;
  mem8[u16(ENEMY_SLOT_FLAGS + y)] = mem8[loc_2b];
  const lane = mem8[loc_2b] & 0x07;
  mem8[SAVED_INDEX2] = x;
  mem8[u16(LANE_ENEMY_COUNT_0 + lane)] = mem8[u16(LANE_ENEMY_COUNT_0 + lane)] + 1;
  return (m.regs.a = 0x10);
}
