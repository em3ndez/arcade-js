// SPDX-License-Identifier: GPL-3.0-only
import { TASK_FLAGS, ANIM_DONE_FLAG } from "./names.js";

/**
 * runAttractAnimTask -- arm the interrupt-driven title-screen animation and block until it finishes.
 *
 * WHAT IT IS
 *   Some attract-screen animations run on the interrupt rather than in the foreground. The foreground code
 *   arms the task, then parks itself frame by frame until the interrupt handler signals completion. This
 *   is that park loop.
 *
 * ROLE IN THE MACHINE
 *   Raises the attract animation task bit in TASK_FLAGS (0x20c1) = 0x02, which the vblank interrupt's
 *   task dispatcher (dispatchAttractTask) reads to run one animation-step frame (stepAnimationFrame). It
 *   then spins until that stepper latches ANIM_DONE_FLAG (0x20cb) to 1 (it does so when the animation's
 *   running coordinate reaches its end coordinate), and finally clears the task bit so the interrupt stops
 *   servicing it. The wait is paced by yielding one displayed frame per pass -- the interrupt runs between
 *   yields and is what actually advances (and eventually completes) the animation.
 *
 * ROM 0x0a80.  Grounding: [seen].
 *
 * LIVE-OUT: generator, returns nothing; memory + IO. Leaves TASK_FLAGS cleared and ANIM_DONE_FLAG set.
 */
export function* runAttractAnimTask(m) {
  // Arm the animation task so the interrupt's task dispatcher will step it each frame.
  m.mem8[TASK_FLAGS] = 0x02;
  while (m.mem8[ANIM_DONE_FLAG] === 0) {
    // Kick the hardware watchdog (output port 6) so the machine does not reset while we spin waiting for
    // the interrupt-driven animation; the written value is immaterial to the watchdog.
    m.io.portOut(0x06, 0x02);
    // Yield one displayed frame -- the interrupt runs here and advances the animation.
    yield;
  }
  // Animation complete: disarm the task so the interrupt stops servicing it.
  m.mem8[TASK_FLAGS] = 0x00;
}
