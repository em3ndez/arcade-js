// SPDX-License-Identifier: GPL-3.0-only
// Per-frame sound tick, gated on the frame flag's bit0 (skip the frame when clear). If the counter minus
// one is still nonzero, hand the counter pointer to the sound-counter manager; on the pass where it reaches
// zero, clear the counter and reload the sweep cell and sound counter with the idle template.
import { u8 } from "../../../core/int.js";
import { loc_4006, loc_41c2, loc_41c4 } from "./names.js";
import { advanceSoundSweepAndStagePitch } from "./advanceSoundSweepAndStagePitch.js";

const SWEEP_IDLE = 2;     // low byte of the idle template -> the sweep cell (counter + 1)
const COUNTER_IDLE = 160; // high byte of the idle template -> the sound counter (parked past its ceiling)

export function loc_17d0(m) {
  const { mem8 } = m;

  if ((mem8[loc_4006] & 1) === 0) return;

  const next = u8(mem8[loc_41c2] - 1);
  if (next !== 0) return advanceSoundSweepAndStagePitch(m, loc_41c2);

  mem8[loc_41c2] = 0;
  mem8[loc_41c2 + 1] = SWEEP_IDLE;
  mem8[loc_41c4] = COUNTER_IDLE;
}
