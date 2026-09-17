// SPDX-License-Identifier: GPL-3.0-only
//
// mainLoop — Donkey Kong's task-scheduler main loop, written as a GENERATOR so a host can drive
// it one vblank at a time. Each pass reads the current task byte and tests bit 7: clear dispatches
// the task; set runs the per-frame work (repaint player-up, award bonus life, bump the frame
// counter) and, when the frame counter turns over, ramps difficulty and steps the hazard/fire.
//
// EVERY `yield` IS THE VBLANK WAIT, and each sits at the END of its path, not the loop top:
// yielding at the top would let the vblank land before the per-frame work runs, so the first frame
// would come out one step behind.

import { loc_02e3 } from "../translated/loc_02e3.js";
import { rampDifficulty } from "./rampDifficulty.js";
import { awardBonusLifeAtThreshold } from "./awardBonusLifeAtThreshold.js";
import { animateFixedHazardAndReleaseFire } from "./animateFixedHazardAndReleaseFire.js";
import { redrawPlayerUpIndicator } from "./redrawPlayerUpIndicator.js";

export function* mainLoop(m) {
  const { regs, mem8 } = m;

  for (;;) {
    regs.h = 0x60;
    regs.a = mem8[0x60b1];
    regs.l = regs.a;
    regs.a = mem8[regs.hl];
    regs.add(regs.a);

    if (regs.fNC) {
      loc_02e3(m);
      yield;
      continue;
    }

    redrawPlayerUpIndicator(m);
    awardBonusLifeAtThreshold(m);

    regs.hl = 0x6019;
    mem8[regs.hl] = regs.inc8(mem8[regs.hl]);

    regs.hl = 0x6383;
    regs.a = mem8[0x601a];
    regs.cp(mem8[regs.hl]);
    if (regs.fZ) {
      // Frame counter unchanged — this spin IS the vblank wait; the interrupt moves it on.
      yield;
      continue;
    }

    mem8[regs.hl] = regs.a;
    rampDifficulty(m);
    animateFixedHazardAndReleaseFire(m);
    yield;
  }
}
