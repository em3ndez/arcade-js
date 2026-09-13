// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, COORD_LIST_PTR_HI, TUBE_GEOM_FLAG, SPAWN_DEFICIT_C3, ENEMY_SEGMENT, ENEMY_PHASE, ENEMY_SLOT_DIR, LANE_LIMIT, POKEY2_RANDOM } from "./names.js";

// Pick a new segment for slot x: scan the 16-column depth table starting at a random
// column, keeping the column that holds the largest depth (an empty column counts as
// maximal). The last column is skipped while the gate is on. Record the winner and its
// successor for the slot and clear bit7 of the slot flag.
export function loc_a028(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[COORD_LIST_PTR_HI] = 0;
  mem8[SPAWN_DEFICIT_C3] = 0x0f;
  let y = mem8[POKEY2_RANDOM] & 0x0f;
  for (;;) {
    const gated = y === 0x0f && mem8[TUBE_GEOM_FLAG] !== 0;
    if (!gated) {
      let depth = mem8[u16(LANE_LIMIT + y)];
      if (depth === 0) depth = 0xff;
      if (depth >= mem8[COORD_LIST_PTR_HI]) {
        mem8[COORD_LIST_PTR_HI] = depth;
        mem8[loc_29] = y;
      }
    }
    y = (y - 1) & 0x0f;
    const cnt = (mem8[SPAWN_DEFICIT_C3] - 1) & 0xff;
    mem8[SPAWN_DEFICIT_C3] = cnt;
    if (cnt & 0x80) break;
  }
  const winner = mem8[loc_29];
  mem8[u16(ENEMY_SEGMENT + x)] = winner;
  mem8[u16(ENEMY_PHASE + x)] = (winner + 1) & 0x0f;
  const flag = u16(ENEMY_SLOT_DIR + x);
  mem8[flag] = mem8[flag] & 0x7f;
}
