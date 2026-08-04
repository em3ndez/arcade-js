// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchInGameSubstate — vector the credited game to its current sub-state handler.
 *
 * The per-frame dispatcher for the in-game top-level state, reached once per frame while a
 * credited game runs. It reads the in-game sub-state index GAME_SUBSTATE and vectors through
 * a 29-entry jump table to the handler for that sub-state. The occupied slots run, in table
 * order, the opening Kong-climb cutscene, the how-high interlude, board setup, gameplay, the
 * death sequence, the board-cleared advance, and so on.
 *
 * The death sequence occupies the three slots immediately after gameplay: Mario's DEATH
 * ANIMATION, then the player-1 LIFE-LOSS handler, then its player-2 twin. The life count is
 * decremented inside those last two, not in the animation. The animation's own hand-off arm
 * is what selects between them: it advances GAME_SUBSTATE by one for player 1 and by two for
 * player 2.
 *
 * Six of the table slots are null and the selector is NOT range-checked, so a null or
 * out-of-range sub-state vectors to address zero or off the end of the table. There is no
 * guard; the shared computed-dispatch helper surfaces such a target as a loud
 * unimplemented-target throw rather than a silent reset.
 *
 * The table index is an 8-BIT double of the selector, so a selector of 128 or more wraps the
 * offset back into the start of the table rather than reading past its end. The dispatch is
 * genuine computed control flow into a table of target addresses, so it goes through the
 * shared computed-dispatch helper rather than a local table of JS functions. Nothing about
 * the register or flag state at the moment of dispatch is reproduced: every arm overwrites or
 * ignores it on entry.
 *
 * LIVE-OUT: memory-only — the sub-state handler's own writes. This routine returns nothing;
 * its callers ignore whatever the arm produces.
 */

import { GAME_SUBSTATE } from "./names.js";
import { loc_00ca } from "../translated/loc_00ca.js";

// The jump table: 29 little-endian target addresses, indexed by GAME_SUBSTATE.
const SUBSTATE_TABLE = 0x0702;

// The dispatch-site label. It only ever surfaces inside the unimplemented-target throw,
// naming which table a null or out-of-range selector fell off of.
const DISPATCH_TABLE_0702 = "0x0702 (0x600A game sub-state)";

export function dispatchInGameSubstate(m) {
  const { mem } = m;

  // The in-game sub-state index.
  const substate = mem.read8(GAME_SUBSTATE);

  // Doubling the index into a 2-byte table offset is an 8-BIT operation — selector 128 wraps
  // the offset to 0 — so the address math is `base + (2*substate & 0xff)`, NOT
  // `base + 2*substate`. Then read the little-endian target word out of the table.
  const entry = (SUBSTATE_TABLE + ((substate * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // Dispatch to the sub-state handler. Nothing consumes a return value at this level.
  loc_00ca(m, target, DISPATCH_TABLE_0702);
}
