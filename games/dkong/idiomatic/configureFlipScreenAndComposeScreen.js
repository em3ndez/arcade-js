// SPDX-License-Identifier: GPL-3.0-only
/**
 * configureFlipScreenAndComposeScreen — orient the display for the player who is up, step to the
 * next in-game sub-state, and post this screen's draw tasks.
 *
 * It is entered with a PLAYER KEY in the accumulator — 1 for the player whose screen is the
 * flipped one, 0 for the other — and that is its only live input; everything else it touches is
 * memory. Four things, in order:
 *
 *   1. FLIP-SCREEN. Write the player key OR'd with the upright-cabinet setting to the flip-screen
 *      board latch. So the player key alone can force the flip on, and an upright cabinet forces
 *      it on regardless; only key 0 on a cocktail cabinet leaves it off. That is the mechanism
 *      that mirrors the screen for the second player of a cocktail game.
 *   2. CLEAR the sub-state timer, so the newly-selected sub-state proceeds on the very next frame
 *      — the "wait zero" form of the wait-then-advance idiom.
 *   3. ADVANCE the in-game sub-state selector by one, so the next dispatch runs the following step.
 *   4. COMPOSE. Post twelve deferred-work messages onto the task ring, all with the same opcode
 *      and with the argument counting up across a fixed range. The messages are drained and
 *      dispatched elsewhere; the opcode used here is the screen-text one, so these twelve are this
 *      screen's text-draw work.
 *
 * NOT CLAIMED: which string each of the twelve arguments selects. The certain fact is the fixed
 * batch posted, not the identity of its contents.
 *
 * LIVE-OUT: memory (the sub-state timer, the sub-state selector, and the task ring with its tail)
 * plus the flip-screen latch, which is a board output rather than work RAM.
 */

import { DIP_UPRIGHT, SUBSTATE_TIMER, GAME_SUBSTATE } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";

// Flip-screen control latch — board hardware, not work RAM, so a local constant.
const FLIPSCREEN = 0x7d82;

export function configureFlipScreenAndComposeScreen(m) {
  const { regs, mem } = m;

  // 1. Flip-screen latch = the incoming player key OR the upright-cabinet setting.
  mem.write8(FLIPSCREEN, (regs.a | mem.read8(DIP_UPRIGHT)) & 0xff);

  // 2. Clear the sub-state timer so the next sub-state proceeds immediately.
  mem.write8(SUBSTATE_TIMER, 0x00);

  // 3. Advance to the next in-game sub-state (8-bit wrap).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);

  // 4. Post the twelve screen-draw messages. The payload rides in the opcode/argument register
  //    pair and is only read, never written back, so the opcode is set once and only the
  //    argument steps between posts.
  regs.d = 0x03;
  for (let arg = 0x0d; arg <= 0x18; arg++) {
    regs.e = arg;
    enqueueTask(m);
  }
}
