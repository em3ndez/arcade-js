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
// 0x02BD as its last act — the dispatched task's handler rets to the 0x02BD that dispatchTask
// pushed, the frame-counter-unchanged branch spins `jr z,0x02BD`, and the new-frame tail does
// `jr 0x02BD`. The translated oracle (runCycleFree) fires the vblank NMI exactly at those
// pc==0x02BD arrivals, so the coroutine `yield` sits at the END of each path — after dispatchTask,
// in the fZ branch, and after the two per-new-frame tasks — a 1:1 match with the oracle's NMI
// firings. (A yield at the loop top would fire the NMI one step too early — before the per-frame
// work that sets LIVES/BONUS_LIFE — and sample frame 1 off by one.)
//
// Faithful to translated/mainLoop_02bd.js — identical reads/writes/dispatches — with two changes
// for the cycle-free coroutine engine: the per-instruction m.step cycle-accounting is dropped
// (the engine runs cycle-free), and each busy-wait/loop-back to 0x02BD becomes `yield`. Callees are
// dispatched through the routines table via m.call, so a wired idiomatic override is used wherever
// one exists (today they are still translated). This is a transitional, faithful spine; it will be
// idiomatised as the base expands.

import { dispatchTask } from "../translated/dispatchTask.js";
import { rampDifficulty } from "./rampDifficulty.js";
import { awardBonusLifeAtThreshold } from "./awardBonusLifeAtThreshold.js";

export function* mainLoop(m) {
  const { regs, mem } = m;

  for (;;) {
    // Read the current task byte: H = 0x60, L = (0x60B1); `add a,a` tests bit 7 into carry.
    regs.h = 0x60;
    regs.a = mem.read8(0x60b1);
    regs.l = regs.a;
    regs.a = mem.read8(regs.hl);
    regs.add(regs.a);

    // Bit 7 clear: dispatch this task. dispatchTask pushed 0x02BD, so the handler rets to the poll.
    if (regs.fNC) {
      dispatchTask(m);
      yield;
      continue;
    }

    // Bit 7 set: run the per-frame work. 0x0350 is idiomatic (awardBonusLifeAtThreshold) — call it
    // DIRECTLY; 0x0315 is still translated and keeps the m.call bracket.
    m.push16(0x02ca);
    m.call(0x0315);
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

    // A new frame arrived: remember it, run the two per-new-frame tasks, then the tail `jr 0x02BD`.
    // 0x037F is idiomatic (rampDifficulty) — call it DIRECTLY (no push16/m.call), so the guest stack
    // stays clean; 0x03A2 is still translated and keeps the m.call bracket.
    mem.write8(regs.hl, regs.a);
    rampDifficulty(m);
    m.push16(0x02e1);
    m.call(0x03a2);
    yield;
  }
}
