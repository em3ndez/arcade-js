// SPDX-License-Identifier: GPL-3.0-only
/**
 * runAttractState — service the attract state once per vblank.
 *
 * The game-state dispatcher routes here while the machine is in ATTRACT — the demo and
 * high-score screens shown before a coin is inserted. It has exactly two jobs, chosen on the
 * credit count:
 *
 *   - A CREDIT IS PRESENT: a coin was accepted. Reset the sub-state and step the game state
 *     on from attract to credited, so the next vblank dispatches the credited-game handler.
 *     This is the move that walks the machine out of attract.
 *
 *   - NO CREDIT: run the current attract sub-state. The sub-state byte selects one of ten
 *     handlers from the table below. Over a full attract loop the demo plays a whole game, so
 *     all eight used slots are reached: the attract-screen draw, the timed-advance gates, and
 *     — through slot 3 — the entire demo-gameplay cascade.
 *
 * The dispatch is a TAIL dispatch: the sub-state handler returns past this routine to the
 * vblank continuation, so whatever skip signal it produces is returned unchanged (inert for
 * these arms today).
 *
 * The two empty slots are unused sub-state indices; reaching one is a refusal, not a
 * dispatch, and it never happens in play.
 *
 * LIVE-OUT: memory-only — the game state, the sub-state, and whatever the dispatched handler
 * writes. Nothing reads a register back from this routine.
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

// The attract sub-state table: eight handlers, selected by the sub-state byte, then two
// unused slots. Most of these handlers finish the return this routine's caller is waiting
// on, which is why the dispatch below is a tail dispatch and not a plain call.
const ATTRACT_SUBSTATE = [
  loc_0779, // 0  draw the attract screen
  loc_0763, // 1  timed advance
  loc_123c, // 2  seed the demo sprite record
  loc_1977, // 3  the demo-gameplay cascade
  runDeathAnimationSubstate, // 4  the death animation
  loc_07c3, //     5
  loc_07cb, //     6  countdown animation
  loc_084b, //     7  timed gate; clears the sub-state
  null, //         8  unused sub-state slot
  null, //         9  unused sub-state slot
];

export function runAttractState(m) {
  const { mem } = m;

  // A coin was accepted?
  if (mem.read8(CREDITS) !== 0) {
    // Reset the attract sub-state and advance the game state, attract -> credited.
    mem.write8(GAME_SUBSTATE, 0x00);
    mem.write8(GAME_STATE, (mem.read8(GAME_STATE) + 1) & 0xff);
    return;
  }

  // No credit: dispatch the current attract sub-state.
  const substate = mem.read8(GAME_SUBSTATE);
  const handler = ATTRACT_SUBSTATE[substate];
  if (handler == null) {
    // An unused slot or an out-of-range index. Never happens in play — attract holds 0..7.
    throw new NotImplemented(
      `attract sub-state ${substate} has no handler ` +
        "(rst 0x28 table at ROM 0x0748; slots 8,9 are unused 0x0000)",
    );
  }
  // Tail dispatch: the handler returns past us, so propagate its skip signal unchanged.
  return handler(m);
}
