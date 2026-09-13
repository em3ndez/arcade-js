// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { FRAME_COUNTER, PHASE_COUNTER, DSW1_SNAPSHOT, DSW2_SNAPSHOT, HEARTBEAT_ACCUM_HI, SCORE_DISPLAY_TIMER, DRAW_SLOT_TABLE, OVERLAY_VEC_WORD_B, OVERLAY_VEC_WORD_A } from "./names.js";
import { loc_ab14 } from "./loc_ab14.js";
import { loc_aeca } from "./loc_aeca.js";
import { loc_af77 } from "./loc_af77.js";
import { loc_df39 } from "./loc_df39.js";

// Per-frame draw driver: pick a slot by phase, tick a timer, draw the shared or the
// alternate panel, redraw two fixed slots, clamp a level index, then post an optional word.
export function loc_aaa8(m) {
  const { mem8 } = m;
  loc_ab14(m, mem8[u16(DRAW_SLOT_TABLE + (mem8[DSW1_SNAPSHOT] & 0x03))]);
  mem8[SCORE_DISPLAY_TIMER]--;
  // Draw the alternate slot only when the phase gate is set and the mode flag is clear.
  if ((mem8[DSW2_SNAPSHOT] & 0x01) !== 0 && (mem8[FRAME_COUNTER] & 0x20) === 0) {
    loc_ab14(m, 0x32);
  } else {
    loc_aeca(m);
  }
  loc_ab14(m, 0x2c);
  loc_ab14(m, 0x2e);
  if (mem8[PHASE_COUNTER] >= 0x28) mem8[PHASE_COUNTER] = 0x28; // clamp to the ceiling
  loc_af77(m, mem8[PHASE_COUNTER]);
  if (mem8[HEARTBEAT_ACCUM_HI] !== 0) loc_df39(m, mem8[OVERLAY_VEC_WORD_A], mem8[OVERLAY_VEC_WORD_B]);
}
