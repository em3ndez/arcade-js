// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2a, loc_2b, SLOT_LOOP_INDEX, ACTIVE_OBJECT_COUNT, TARGET_SEG, SLOT_STATE, HIT_TALLY, LANE_TARGET_FLAG, LANE_LIMIT } from "./names.js";
import { requestSegmentHitSound } from "./requestSegmentHitSound.js";
import { addBcdScoreAndAwardAtThreshold } from "./addBcdScoreAndAwardAtThreshold.js";

// Advance a slot's counter toward its per-target limit; on reaching a nonzero limit, clamp/clear
// the limit cell, bump the hit tally, flag the target, chime, and award. After two hits, reset the
// counter and drop a life. Returns the slot index live at exit.
export function advanceShotAndScoreLaneHit(m, x = m.regs.x) {
  const { mem8 } = m;
  const y = mem8[u16(TARGET_SEG + x)];
  const limit = mem8[u16(LANE_LIMIT + y)];
  if (limit === 0) return x;

  let xEff = x;
  const counter = mem8[u16(SLOT_STATE + x)];
  if (counter >= limit) {
    mem8[u16(LANE_LIMIT + y)] = counter < 0xf0 ? counter : 0x00; // clamp: clear unless already saturated
    mem8[u16(HIT_TALLY + x)] = mem8[u16(HIT_TALLY + x)] + 1;      // bump hit tally
    mem8[u16(LANE_TARGET_FLAG + y)] = 0xc0;                            // flag the target
    requestSegmentHitSound(m, x, y);                                        // chime
    mem8[loc_2a] = 0x00;
    mem8[loc_2b] = 0x00;
    mem8[loc_29] = 0x01;
    addBcdScoreAndAwardAtThreshold(m, 0xff);                                        // award
    xEff = mem8[SLOT_LOOP_INDEX];
  }

  if (mem8[u16(HIT_TALLY + xEff)] >= 0x02) {                    // second hit: reset + drop a life
    mem8[u16(SLOT_STATE + xEff)] = 0x00;
    mem8[ACTIVE_OBJECT_COUNT] = mem8[ACTIVE_OBJECT_COUNT] - 1;
  }
  return xEff;
}
