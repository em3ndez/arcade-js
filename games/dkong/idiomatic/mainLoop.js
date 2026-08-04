// SPDX-License-Identifier: GPL-3.0-only
//
// mainLoop — Donkey Kong's task-scheduler main loop, written as a GENERATOR so a host can drive it
// one vblank at a time.
//
// Each pass reads the current task byte out of a small table in the work-RAM page the scheduler
// keeps its state in, indexed by a pointer byte the table itself supplies, and tests its top bit:
//
//   - bit 7 CLEAR — dispatch that task, then wait for vblank.
//   - bit 7 SET   — run the per-frame work: repaint the player-up indicator, award a bonus life if
//                   the score has crossed the threshold, and bump a frame-work counter. Then
//                   compare the frame counter against the last frame this loop handled. Unchanged
//                   means the frame has not turned over yet, so wait. Changed means a new frame
//                   arrived: record it, ramp the difficulty, step the fixed-hazard animation and
//                   its fire release, and wait.
//
// EVERY `yield` IS THE VBLANK WAIT, and each one sits at the END of its path rather than at the
// top of the loop: after a dispatched task returns, inside the frame-unchanged spin, and after the
// two per-new-frame tasks. That placement is load-bearing. Yielding at the loop top would let the
// vblank interrupt land one step early — before the per-frame work that updates lives and the
// bonus-life award has run — and the very first frame would come out one step behind.

import { loc_02e3 } from "../translated/loc_02e3.js";
import { rampDifficulty } from "./rampDifficulty.js";
import { awardBonusLifeAtThreshold } from "./awardBonusLifeAtThreshold.js";
import { animateFixedHazardAndReleaseFire } from "./animateFixedHazardAndReleaseFire.js";
import { redrawPlayerUpIndicator } from "./redrawPlayerUpIndicator.js";

export function* mainLoop(m) {
  const { regs, mem } = m;

  for (;;) {
    // Read the current task byte, indexed by the scheduler's pointer byte, and test its bit 7.
    regs.h = 0x60;
    regs.a = mem.read8(0x60b1);
    regs.l = regs.a;
    regs.a = mem.read8(regs.hl);
    regs.add(regs.a);

    // Bit 7 clear: dispatch this task, then wait for vblank.
    if (regs.fNC) {
      loc_02e3(m);
      yield;
      continue;
    }

    // Bit 7 set: run the per-frame work.
    redrawPlayerUpIndicator(m);
    awardBonusLifeAtThreshold(m);

    // Bump the frame-work counter.
    regs.hl = 0x6019;
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));

    // Has the frame counter moved since the last frame this loop handled?
    regs.hl = 0x6383;
    regs.a = mem.read8(0x601a);
    regs.cp(mem.read8(regs.hl));
    if (regs.fZ) {
      // Frame counter unchanged — this spin IS the vblank wait. The interrupt fires here and
      // moves the frame counter on, so the next pass takes the new-frame path.
      yield;
      continue;
    }

    // A new frame arrived: remember it, run the two per-new-frame tasks, then wait again.
    mem.write8(regs.hl, regs.a);
    rampDifficulty(m);
    animateFixedHazardAndReleaseFire(m);
    yield;
  }
}
