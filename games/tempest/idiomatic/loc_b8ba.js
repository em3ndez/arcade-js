// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, DEPTH_LO, DEPTH_HI, PROJ_OFS_X_LO, PROJ_OFS_X_HI,
  PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI, VG_RECORD_HEADER, DRAW_CURSOR_ALT_LO, DRAW_CURSOR_ALT_HI, loc_9e,
  PLAYER_SHOT_DEPTH, OBJECT_AXIS1_POS, ENEMY_SLOT_FLAGS, ENEMY_POS2,
} from "./names.js";
import { loc_df39 } from "./loc_df39.js";
import { loc_df4a } from "./loc_df4a.js";
import { loc_df4c } from "./loc_df4c.js";
import { loc_df6a } from "./loc_df6a.js";
import { loc_df6c } from "./loc_df6c.js";
import { loc_df09 } from "./loc_df09.js";
import { loc_b56a } from "./loc_b56a.js";
import { loc_b944 } from "./loc_b944.js";
import { loc_b955 } from "./loc_b955.js";
import { loc_b967 } from "./loc_b967.js";
import { loc_c098 } from "./loc_c098.js";
import { loc_c3ba } from "./loc_c3ba.js";
import { loc_c772 } from "./loc_c772.js";

// Reset the accumulators and seeds, cache the base pointer pair, then for each active
// slot from the top down: integrate its deltas, emit its record with header and shadow,
// and close the frame by swapping pointers back and drawing the base list.
export function loc_b8ba(m) {
  const { mem8 } = m;
  loc_df39(m, 0x3f, 0xf2);
  mem8[PREV_Y_LO] = 0x00;
  mem8[PREV_Y_HI] = 0x00;
  mem8[PREV_X_LO] = 0x00;
  mem8[PREV_X_HI] = 0x00;
  mem8[PLAYER_SHOT_DEPTH] = 0x00;
  mem8[PROJ_OFS_X_LO] = 0x00;
  mem8[PROJ_OFS_X_HI] = 0x00;
  mem8[DEPTH_HI] = 0xe0;
  mem8[DEPTH_LO] = 0xff;
  {
    const [a, x] = loc_b967(m);
    mem8[DRAW_CURSOR_ALT_HI] = a;
    mem8[DRAW_CURSOR_ALT_LO] = x;
  }
  mem8[SLOT_LOOP_INDEX] = 0x0f;
  do {
    const x = mem8[SLOT_LOOP_INDEX];
    const active = mem8[u16(ENEMY_SLOT_FLAGS + x)];
    if (active !== 0) {
      mem8[OBJ_DEPTH] = active;
      mem8[PROJ_PT_Y] = mem8[u16(OBJECT_AXIS1_POS + x)];
      mem8[PROJ_PT_X] = mem8[u16(ENEMY_POS2 + x)];
      loc_c098(m);
      mem8[VG_RECORD_HEADER] = 0x00;
      loc_b944(m);
      loc_c3ba(m);
      loc_b56a(m, 0xa0);
      loc_b944(m);
      loc_c772(m, 0x61);
      const [pa, py] = loc_b955(m);
      loc_df6c(m, pa, py);
      let phase = mem8[SLOT_LOOP_INDEX] & 0x07;
      if (phase === 0x07) phase = 0x00;
      mem8[loc_9e] = phase;
      loc_df4c(m, 0x08, phase);
      loc_df4a(m, 0x00);
      const [ha, hx] = loc_b967(m);
      loc_df39(m, ha, hx);
    }
    const next = (mem8[SLOT_LOOP_INDEX] - 1) & 0xff;
    mem8[SLOT_LOOP_INDEX] = next;
    if (next & 0x80) break;
  } while (true);
  loc_b944(m);
  loc_df6a(m, 0x01);
  loc_df09(m);
  return loc_b944(m);
}
