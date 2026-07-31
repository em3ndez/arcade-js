// SPDX-License-Identifier: GPL-3.0-only
/**
 * mainLoop — the in-game/attract-demo main loop: drive one frame of game work, forever.  ROM 0x0348.
 *
 * Once a round begins, control enters here and never leaves — the loop runs the
 * whole round and is broken into only by the vblank interrupt. Each pass does the
 * once-per-frame work in a fixed order:
 *   - pet the watchdog so the board does not force a reset mid-round;
 *   - re-arm the vblank interrupt for the coming frame;
 *   - during the attract demo, generate the auto-player's next move (it stands in
 *     for the joystick);
 *   - run the per-frame game services: the object/state dispatcher, the column-
 *     reveal animation, the diamond glitter, and the dig/push reaction driver.
 * Then it loops back to the top and does it again.
 *
 * The original also spins a short busy-delay at the end of each pass to pace the
 * loop. That delay is pure timing — it touches no memory — so it is dropped with
 * the cycle model. (On real hardware this delay is also what lets frame time pass
 * between vblank interrupts, so this cycle-free form documents the per-frame memory
 * effects rather than driving the live scheduler.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-0348.test.js.
 * GATE:     crafted-entry — the attract demo really enters this loop (~frame 695,
 *           game-mode 4), which exercises the demo-steer arm; a crafted game-mode-0
 *           entry exercises the skip arm. One pass is compared, bounded at the once-
 *           per-pass watchdog kick; the dead stack scratch just below 0x83ff (the
 *           oracle's own call brackets) is excluded. Teeth: dropping a service, and
 *           flipping the demo-mode test, are both caught in work RAM.
 * LIVE-OUT: memory-only — the loop never returns, so nothing downstream reads a
 *           register or flag from it; its whole effect is the work/colour/video/
 *           sprite RAM its per-frame services leave behind.
 * NAMES:    GAME_STATE (0x8001) from ram.js. The watchdog/sound port 0xb800 is board
 *           I/O (not work RAM), kept hex. The callees are the decomposed idiomatic
 *           per-frame services.
 */

import { GAME_STATE } from "./ram.js";
import { enableNmi } from "./enableNmi.js"; //                       ROM 0x4b14
import { steerDemoPlayer } from "./steerDemoPlayer.js"; //           ROM 0x03e8
import { dispatchObjectFrameByStateTimer } from "./dispatchObjectFrameByStateTimer.js"; //                         ROM 0x13c9
import { erodeMountain } from "./erodeMountain.js"; // ROM 0x241c
import { glitterJewels } from "./glitterJewels.js"; //           ROM 0x06ac
import { advancePlayerLaser } from "./advancePlayerLaser.js"; // ROM 0x24f3

// Reading this hardware port pets the watchdog timer; the value read is discarded,
// the read itself is the effect. (The write side of the same port is the sound latch.)
const WATCHDOG_KICK = 0xb800;

// The attract demo runs the game itself, with the auto-player steering in place of the
// joystick; the game-mode byte holds this value while that demo is active.
const DEMO_MODE = 4;

// Top of the work-RAM stack (ld sp,0x83ff) — re-seated at the top of every pass.
const STACK_TOP = 0x83ff;

export function* mainLoop(m) {
  const { mem8 } = m;

  for (;;) {
    // Re-seat the stack at the top of every pass (ld sp,0x83ff). The whole round runs inside
    // this loop, so resetting the stack pointer each frame keeps the work stack from drifting.
    m.regs.sp = STACK_TOP;

    // Pet the watchdog so the hardware does not reset mid-round.
    void mem8[WATCHDOG_KICK];

    // The vblank wait: the coroutine engine fires the per-frame NMI here, then resumes.
    yield;

    // Re-arm the vblank interrupt for the coming frame.
    enableNmi(m);

    // During the attract demo, produce the auto-player's move for this frame.
    if (mem8[GAME_STATE] === DEMO_MODE) steerDemoPlayer(m);

    // The per-frame game services, in order.
    dispatchObjectFrameByStateTimer(m); //               object / state dispatcher (gated by the state-lockout timer)
    erodeMountain(m); // one frame-gated step of the vertical column reveal
    glitterJewels(m); //        recolour the next diamond in the glitter cycle
    advancePlayerLaser(m); //  drive the tracked object's dig/push reaction
  }
}
