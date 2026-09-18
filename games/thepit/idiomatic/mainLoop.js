// SPDX-License-Identifier: GPL-3.0-only
/**
 * mainLoop — the in-game / attract-demo main loop: drive one frame of game work, forever.
 * Once a round begins, control enters here and never leaves — the loop runs the whole round
 * and is broken into only by the vblank interrupt. Each pass, in fixed order: pet the watchdog,
 * re-arm the vblank interrupt, generate the auto-player's move during the attract demo (it
 * stands in for the joystick), then run the per-frame game services in order.
 */

import { GAME_STATE, STACK_TOP } from "./names.js";
import { enableNmi } from "./enableNmi.js";
import { steerDemoPlayer } from "./steerDemoPlayer.js";
import { dispatchObjectFrameByStateTimer } from "./dispatchObjectFrameByStateTimer.js";
import { erodeMountain } from "./erodeMountain.js";
import { glitterJewels } from "./glitterJewels.js";
import { advancePlayerLaser } from "./advancePlayerLaser.js";

// Reading this hardware port pets the watchdog timer; the value read is discarded,
// the read itself is the effect. (The write side of the same port is the sound latch.)
const WATCHDOG_KICK = 0xb800;

// The attract demo runs the game itself with the auto-player steering; the game-mode byte holds this value.
const DEMO_MODE = 4;

export function* mainLoop(m) {
  const { mem8 } = m;

  for (;;) {
    // Re-seat the stack at the top of every pass; the whole round runs inside this loop,
    // so resetting the stack pointer each frame keeps the work stack from drifting.
    m.regs.sp = STACK_TOP;

    // Pet the watchdog so the hardware does not reset mid-round.
    void mem8[WATCHDOG_KICK];

    // The vblank wait: the coroutine engine fires the per-frame NMI here, then resumes.
    yield;

    // Re-arm the vblank interrupt for the coming frame.
    enableNmi(m);

    // During the attract demo, produce the auto-player's move for this frame.
    if (mem8[GAME_STATE] === DEMO_MODE) steerDemoPlayer(m);

    // The per-frame game services, in order: object/state dispatcher, column-reveal
    // animation, diamond glitter, dig/push reaction driver.
    dispatchObjectFrameByStateTimer(m);
    erodeMountain(m);
    glitterJewels(m);
    advancePlayerLaser(m);
  }
}
