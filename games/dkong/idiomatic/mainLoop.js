// SPDX-License-Identifier: GPL-3.0-only
//
// mainLoop (ROM 0x02BD) as a GENERATOR for the coroutine go-live engine (core/frame-stepped.js
// runGeneratorGame). Donkey Kong's task-scheduler main loop: it walks a task table in page 0x60
// (the task pointer at 0x60B1); a task byte with bit 7 CLEAR is dispatched, bit 7 SET runs the
// per-frame work (call 0x0315, call 0x0350, bump the 0x6019 counter), then compares the frame
// counter 0x601A against the last-handled frame 0x6383, records a new frame, and runs the two
// per-new-frame tasks (0x037F, 0x03A2).
//
// THE VBLANK POLL is 0x02BD, and the subtle part is WHERE that address is reached: the loop TOP
// falls straight into `ld h,0x60` and never sits at 0x02BD; instead EVERY path RETURNS pc to
// 0x02BD as its last act — the dispatched task's handler rets to the 0x02BD that loc_02e3
// pushed, the frame-counter-unchanged branch spins `jr z,0x02BD`, and the new-frame tail does
// `jr 0x02BD`. The translated oracle (runCycleFree) fires the vblank NMI exactly at those
// pc==0x02BD arrivals, so the coroutine `yield` sits at the END of each path — after loc_02e3,
// in the fZ branch, and after the two per-new-frame tasks — a 1:1 match with the oracle's NMI
// firings. (A yield at the loop top would fire the NMI one step too early — before the per-frame
// work that sets LIVES/BONUS_LIFE — and sample frame 1 off by one.)
//
// Faithful to translated/mainLoop_02bd.js — identical reads/writes/dispatches — with two changes
// for the cycle-free coroutine engine: the per-instruction m.step cycle-accounting is dropped
// (the engine runs cycle-free), and each busy-wait/loop-back to 0x02BD becomes `yield`. The four
// per-frame callees (0x0315/0x0350/0x037F/0x03A2) are all idiomatic and DIRECT-called (no
// push16/m.call), so the guest stack stays clean; only the task dispatch (loc_02e3) still walks
// the routines table via m.call for the handlers with no idiomatic twin in ROUTINES yet. All
// seven of the 0x0307 table's handlers now have idiomatic files and six are already wired;
// only 0x062A is pending, and the base expands under the go-live gate as it is wired.

import { loc_02e3 } from "../translated/loc_02e3.js";
import { rampDifficulty } from "./rampDifficulty.js";
import { awardBonusLifeAtThreshold } from "./awardBonusLifeAtThreshold.js";
import { animateFixedHazardAndReleaseFire } from "./animateFixedHazardAndReleaseFire.js";
import { redrawPlayerUpIndicator } from "./redrawPlayerUpIndicator.js";

export function* mainLoop(m) {
  const { regs, mem } = m;

  for (;;) {
    // Read the current task byte: H = 0x60, L = (0x60B1); `add a,a` tests bit 7 into carry.
    regs.h = 0x60;
    regs.a = mem.read8(0x60b1);
    regs.l = regs.a;
    regs.a = mem.read8(regs.hl);
    regs.add(regs.a);

    // Bit 7 clear: dispatch this task. loc_02e3 pushed 0x02BD, so the handler rets to the poll.
    if (regs.fNC) {
      loc_02e3(m);
      yield;
      continue;
    }

    // Bit 7 set: run the per-frame work. Both callees are idiomatic now — call them DIRECTLY (no
    // push16/m.call), so the guest stack stays clean.
    redrawPlayerUpIndicator(m);
    awardBonusLifeAtThreshold(m);

    // inc (0x6019)
    regs.hl = 0x6019;
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));

    // Compare the frame counter 0x601A against the last-handled frame (0x6383).
    regs.hl = 0x6383;
    regs.a = mem.read8(0x601a);
    regs.cp(mem.read8(regs.hl));
    if (regs.fZ) {
      // Frame counter unchanged — the `jr z,0x02BD` spin IS the vblank wait. The NMI fires here
      // (decrementing 0x601A), so the next pass takes the new-frame path.
      yield;
      continue;
    }

    // A new frame arrived: remember it, run the two per-new-frame tasks (both idiomatic now — called
    // DIRECTLY, no push16/m.call, so the guest stack stays clean), then the tail `jr 0x02BD`.
    mem.write8(regs.hl, regs.a);
    rampDifficulty(m);
    animateFixedHazardAndReleaseFire(m);
    yield;
  }
}
