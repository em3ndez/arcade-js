// SPDX-License-Identifier: GPL-3.0-only
/**
 * runAttractState — service the attract state once per vblank. If a credit is present, reset
 * the sub-state and step the game state on to credited; otherwise dispatch the current attract
 * sub-state through the handler table (a tail dispatch: the handler's return propagates).
 *
 * LIVE-OUT: memory-only — the game state, the sub-state, and whatever the dispatched handler writes.
 */

import { CREDITS, GAME_STATE, GAME_SUBSTATE } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { loc_0779 } from "../translated/loc_0779.js";
import { loc_0763 } from "../translated/loc_0763.js";
import { loc_123c } from "../translated/loc_123c.js";
import { loc_1977 } from "../translated/loc_1977.js";
import { runDeathAnimationSubstate } from "./runDeathAnimationSubstate.js";
import { loc_07c3 } from "../translated/loc_07c3.js";
import { loc_07cb } from "../translated/loc_07cb.js";
import { loc_084b } from "../translated/loc_084b.js";

const ATTRACT_SUBSTATE = [
  loc_0779, // 0  draw the attract screen
  loc_0763, // 1  timed advance
  loc_123c, // 2  seed the demo sprite record
  loc_1977, // 3  the demo-gameplay cascade
  runDeathAnimationSubstate, // 4  the death animation
  loc_07c3, // 5
  loc_07cb, // 6  countdown animation
  loc_084b, // 7  timed gate; clears the sub-state
  null, // 8  unused
  null, // 9  unused
];

export function runAttractState(m) {
  const { mem8 } = m;

  if (mem8[CREDITS] !== 0) {
    mem8[GAME_SUBSTATE] = 0x00;
    mem8[GAME_STATE] = (mem8[GAME_STATE] + 1) & 0xff;
    return;
  }

  const substate = mem8[GAME_SUBSTATE];
  const handler = ATTRACT_SUBSTATE[substate];
  if (handler == null) {
    throw new NotImplemented(`attract sub-state ${substate} has no handler`);
  }
  // Tail dispatch: propagate the handler's skip signal unchanged.
  return handler(m);
}
