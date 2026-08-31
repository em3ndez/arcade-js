// SPDX-License-Identifier: GPL-3.0-only
//
// mainLoop -- the main-loop spine.
//
// WHAT IT IS: the machine's foreground loop. Pooyan's main loop free-runs -- it never
// waits for vertical blank. It spins forever, and the vblank NMI only interrupts it; the
// loop is never clocked a frame at a time by the hardware. Its whole job is to keep
// draining the display-command ring (the 64-byte queue of two-byte drawing commands that
// every other part of the machine posts work into) and, once per pass through that ring,
// run the per-frame worker.
//
// ROLE IN THE MACHINE: the outer loop of the display-command driver. Each turn runs one
// main-loop step. Most steps pull a single two-byte command off the ring's read cursor
// and run its handler, then the loop repeats immediately -- so an entire queued backlog
// drains back-to-back within one frame, not one command per frame. That whole-backlog
// drain is load-bearing: a queue built up on the credit screen would otherwise clear only
// one command per frame and leak stale attract tiles onto the playfield. When a step
// instead reaches the worker/ring-idle slot -- the ring's perpetual end-of-queue sentinel
// -- it runs the per-frame scroll worker, and that ring-idle iteration is the once-per-
// frame boundary the vblank NMI marks: the point the machine settles at each frame.
//
// ROM 0x020F-0x0241. Grounding: [seen].
//
// LIVE-OUT: none of its own. Every memory effect belongs to the step it runs -- the
// per-frame worker, or the display-command handler a command dispatch invokes (HUD and
// panel tiles, the score cells, the integrity flags) -- together with the ring read
// cursor those command dispatches advance and the two ring slots they free.
import { mainLoopStep } from "./mainLoopStep.js";

export function* mainLoop(m) {
  // The main loop never terminates: on the board it is only ever left through the vblank
  // NMI or a dispatched handler, and it resumes here right after.
  for (;;) {
    // Run one main-loop step. It reports true only on the worker/ring-idle iteration --
    // the per-frame worker just ran because the display-command queue is drained -- and
    // that is the frame beat, so settle the completed frame here before draining the next
    // one. A false report is an ordinary command dispatch, so keep consuming the ring
    // within this same frame without settling.
    if (mainLoopStep(m)) yield;
  }
}
