// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { STATUS_FLAGS, WAVE_PHASE_LATCH, PLAYER_FINE_ANGLE, SWEEP_STAGE, INPUT_EDGE_FLAGS, ATTRACT_TIMER_LIMIT_TABLE } from "./names.js";
import { loc_a888 } from "./loc_a888.js";

// Steps a countdown only while STATUS_FLAGS has bit7 set. With WAVE_PHASE_LATCH already running it advances it and,
// once it reaches the SWEEP_STAGE-indexed limit, restarts it and runs the sweep handler; with WAVE_PHASE_LATCH idle it may
// arm the next stage (bump SWEEP_STAGE, seed WAVE_PHASE_LATCH) when PLAYER_FINE_ANGLE is clear and INPUT_EDGE_FLAGS bit3 is set. Every
// path clears bit7 of INPUT_EDGE_FLAGS on the way out.
export function loc_a83a(m) {
  const { mem8 } = m;

  if ((mem8[STATUS_FLAGS] & 0x80) !== 0) {
    const running = mem8[WAVE_PHASE_LATCH];
    if (running !== 0) {
      const advanced = u8(running + 1);
      const limitIndex = mem8[SWEEP_STAGE];
      mem8[WAVE_PHASE_LATCH] = advanced;
      if (advanced >= mem8[u16(ATTRACT_TIMER_LIMIT_TABLE + limitIndex)]) mem8[WAVE_PHASE_LATCH] = 0;
      loc_a888(m, limitIndex);
    } else if ((mem8[PLAYER_FINE_ANGLE] & 0x80) === 0 && (mem8[INPUT_EDGE_FLAGS] & 0x08) !== 0) {
      if (mem8[SWEEP_STAGE] < 2) {
        mem8[SWEEP_STAGE] = mem8[SWEEP_STAGE] + 1;
        mem8[WAVE_PHASE_LATCH] = 1;
      }
      mem8[INPUT_EDGE_FLAGS] = mem8[INPUT_EDGE_FLAGS] & 0x77;
    }
  }

  mem8[INPUT_EDGE_FLAGS] = mem8[INPUT_EDGE_FLAGS] & 0x7f;
}
