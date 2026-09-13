// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { GAME_MODE, GAME_MODE_PENDING, MODE_DELAY_TIMER, DEPTH_ACCUM_LO, loc_9f, SPIKE_STEP_LO, SPIKE_STEP_HI, SPIKE_ACTIVE_FLAG, SPIKE_HEIGHT_LO, SPIKED_SEGMENT_COUNT, WAVE_PHASE_LATCH, LANE_LIMIT } from "./names.js";

// Reset a batch of state bytes, then count how many of the 16 entries are live.
// If any are live and the level is below seven, load the intro parameter block.
// Always mark the block ready at the end.
export function loc_a5cb(m) {
  const { mem8 } = m;
  mem8[GAME_MODE] = 0x20;
  mem8[SPIKE_ACTIVE_FLAG] = mem8[SPIKE_ACTIVE_FLAG] | 0x80;
  mem8[SPIKE_STEP_LO] = 0;
  mem8[SPIKE_HEIGHT_LO] = 0;
  mem8[DEPTH_ACCUM_LO] = 0;
  mem8[SPIKED_SEGMENT_COUNT] = 0;
  mem8[SPIKE_STEP_HI] = 0x02;
  for (let x = 0x0f; x >= 0; x--) {
    if (mem8[u16(LANE_LIMIT + x)] !== 0) mem8[SPIKED_SEGMENT_COUNT] = u8(mem8[SPIKED_SEGMENT_COUNT] + 1);
  }
  if (mem8[SPIKED_SEGMENT_COUNT] !== 0 && mem8[loc_9f] < 0x07) {
    mem8[MODE_DELAY_TIMER] = 0x1e;
    mem8[GAME_MODE] = 0x0a;
    mem8[GAME_MODE_PENDING] = 0x20;
    mem8[SPIKED_SEGMENT_COUNT] = 0x80;
  }
  mem8[WAVE_PHASE_LATCH] = 0xff;
}
