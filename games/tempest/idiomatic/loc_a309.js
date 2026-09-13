// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { COORD_LIST_PTR_HI, SLOT_LOOP_INDEX, ENEMY_SEGMENT, HIT_TALLY, POKEY2_RANDOM } from "./names.js";
import { loc_a3ca } from "./loc_a3ca.js";
import { loc_a06f } from "./loc_a06f.js";
import { loc_ca6c } from "./loc_ca6c.js";

// Spawn/award for enemy slot X on lane Y: mark slot X active (HIT_TALLY,x = 0xff), stash the
// (Y-4)-indexed geometry byte in COORD_LIST_PTR_HI, clamp the POKEY random register's low three bits to under 3 (else 0),
// run the insert+retire chain with that clamp+2, then award via the score-award helper indexed by clamp+5.
// X is saved in SLOT_LOOP_INDEX and left unchanged for the caller.
export function loc_a309(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;

  mem8[SLOT_LOOP_INDEX] = x;
  mem8[u16(HIT_TALLY + x)] = 0xff;

  const laneIndex = u8(y - 4);
  mem8[COORD_LIST_PTR_HI] = mem8[u16(ENEMY_SEGMENT + laneIndex)];

  const masked = mem8[POKEY2_RANDOM] & 0x07;
  const clamp = masked < 3 ? masked : 0;

  loc_a3ca(m, clamp + 2, x, laneIndex);
  loc_a06f(m, laneIndex, x);
  loc_ca6c(m, clamp + 5);
}
