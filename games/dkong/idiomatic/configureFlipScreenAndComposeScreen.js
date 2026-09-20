// SPDX-License-Identifier: GPL-3.0-only
/**
 * configureFlipScreenAndComposeScreen — orient the display for the player who is up, step to the
 * next in-game sub-state, and post this screen's draw tasks.
 *
 * Entered with a player key in A (1 = flipped player, 0 = other). It writes the key OR'd with the
 * upright-cabinet setting to the flip-screen latch (upright forces the flip on; only key 0 on a
 * cocktail leaves it off), clears the sub-state timer so the next sub-state runs immediately,
 * advances the sub-state selector, then posts twelve screen-text draw messages onto the task ring
 * with the argument counting across a fixed range.
 *
 * LIVE-OUT: memory (the sub-state timer, the sub-state selector, the task ring with its tail) plus
 * the flip-screen latch, a board output.
 */

import { DIP_UPRIGHT, SUBSTATE_TIMER, GAME_SUBSTATE } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";

// Flip-screen control latch — board hardware, not work RAM.
const FLIPSCREEN = 0x7d82;

export function configureFlipScreenAndComposeScreen(m, a = m.regs.a) {
  const { regs, mem8 } = m;

  mem8[FLIPSCREEN] = (a | mem8[DIP_UPRIGHT]) & 0xff;
  mem8[SUBSTATE_TIMER] = 0x00;
  mem8[GAME_SUBSTATE] = (mem8[GAME_SUBSTATE] + 1);

  regs.d = 0x03;
  for (let arg = 0x0d; arg <= 0x18; arg++) {
    regs.e = arg;
    enqueueTask(m);
  }
}
