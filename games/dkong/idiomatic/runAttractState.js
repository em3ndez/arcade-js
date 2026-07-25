// SPDX-License-Identifier: GPL-3.0-only
/**
 * runAttractState — service the attract game-state (GAME_STATE == 1) once per NMI.  ROM 0x073C.
 *
 * The NMI game-state dispatcher (the 4-entry rst-0x28 table at ROM 0x00CA) routes to
 * this routine while GAME_STATE (0x6005) == 1, the ATTRACT state — the demo/high-score
 * screen shown before a coin is inserted. It has exactly two jobs, chosen on CREDITS:
 *
 *   - A CREDIT IS PRESENT (CREDITS != 0): a coin was accepted. Reset the attract
 *     sub-state (GAME_SUBSTATE = 0) and step GAME_STATE 1 -> 2 (attract -> credited),
 *     so the next NMI dispatches the credited-game handler. This is the move that
 *     walks the machine out of attract. (The ROM's `and a` also clears carry, which
 *     `inc (hl)` preserves into F; that flag is dead across the return — see LIVE-OUT.)
 *
 *   - NO CREDIT (CREDITS == 0): run the current attract sub-state. GAME_SUBSTATE
 *     (0x600A) selects one of ten handlers through the ROM's SECOND inline jump table
 *     (the ten words at ROM 0x0748), the same `rst 0x28` idiom the NMI uses at 0x00CA.
 *     Over a full attract loop the demo plays a whole game, so all eight used slots
 *     are reached: the attract-screen draw, the timed-advance gates, and — via slot 3
 *     — the entire demo-gameplay cascade (handler_1977).
 *
 * doc-06 turns computed dispatch into a table of function references, so this SPECIFIC
 * site's fixed 10-word table becomes ATTRACT_SUBSTATE below and the selected handler is
 * called directly — rather than routing through the generic `rst 0x28` trampoline
 * (dispatchInlineJumpTable, ROM 0x0028), which stays oracle-routed only because it
 * serves many table bases it cannot know statically. Calling that trampoline here would
 * also mean pushing the table base onto the Z80 stack (push16), which the idiomatic
 * contract forbids. The two 0x0000 slots are unused sub-state indices (the oracle's
 * dispatcher throws NotImplemented on them); reproduced as a throw.
 *
 * The trampoline's register handoff (A = 2*index, DE = HL = target, flags) is dead:
 * none of the ten handlers reads it, proven by the gate — the oracle sets it and this
 * routine does not, yet game-visible RAM is identical on every reached and crafted arm.
 * The dispatch is a TAIL dispatch: the sub-state handler's own `ret` returns past this
 * routine to the NMI continuation, so its skip-boolean is returned unchanged (inert for
 * these state-1 arms today; the propagation convention is sub_0028's).
 *
 * Memory-equivalent to the frozen oracle — equivalence-073c.test.js.
 * GATE:     crafted-entry. Real captured attract dispatches (fresh clone each, oracle
 *           handler run in full) cover sub-states 0-4,6,7 including the heavy slot-3
 *           gameplay cascade; a deterministic crafted sweep forces CREDIT and every
 *           sub-state 0-7 on one real entry; teeth = a wrong-selector twin.
 * LIVE-OUT: memory-only — GAME_STATE, GAME_SUBSTATE, and whatever the dispatched
 *           sub-state handler writes. No live registers/flags: the caller chain (the
 *           NMI game-state dispatch) reads none of the handler's residual A/HL/F. SP/pc
 *           are control-flow plumbing handled by the JS call stack: the credit branch's
 *           `ret` becomes the JS return (SP/pc left at entry), and the dispatch branch's
 *           SP/pc are set by the raw-ROM callee's own `ret` (which matches the oracle).
 * NAMES:    CREDITS (0x6001), GAME_STATE (0x6005), GAME_SUBSTATE (0x600A) from ram.js;
 *           the 0x0748 jump-table target addresses stay hex (ROM data, not work RAM).
 */

import { CREDITS, GAME_STATE, GAME_SUBSTATE } from "../optimized/ram.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { handler_0779 } from "../translated/handler_0779.js";
import { handler_0763 } from "../translated/handler_0763.js";
import { handler_123c } from "../translated/handler_123c.js";
import { handler_1977 } from "../translated/handler_1977.js";
import { loc_127c } from "../translated/loc_127c.js";
import { loc_07c3 } from "../translated/loc_07c3.js";
import { loc_07cb } from "../translated/loc_07cb.js";
import { loc_084b } from "../translated/loc_084b.js";

// The ROM inline jump table at 0x0748 (GAME_SUBSTATE selects the attract sub-state).
// Ten little-endian words: eight used handlers, then two unused 0x0000 slots. The
// callees are still-oracle routines imported from translated/ (no idiomatic rewrite
// exists yet), so they are called directly here.
const ATTRACT_SUBSTATE = [
  handler_0779, // 0  ROM 0x0779 — draw the attract screen
  handler_0763, // 1  ROM 0x0763 — timed advance (rst 0x20 gate)
  handler_123c, // 2  ROM 0x123C — seed the demo sprite record
  handler_1977, // 3  ROM 0x1977 — the demo-gameplay cascade
  loc_127c, //     4  ROM 0x127C
  loc_07c3, //     5  ROM 0x07C3
  loc_07cb, //     6  ROM 0x07CB — countdown animation
  loc_084b, //     7  ROM 0x084B — rst 0x20 gate, clears GAME_SUBSTATE
  null, //         8  ROM 0x0000 — unused sub-state slot
  null, //         9  ROM 0x0000 — unused sub-state slot
];

export function runAttractState(m) {
  const { mem } = m;

  // ld a,(CREDITS) / and a / jp nz — a coin was accepted?
  if (mem.read8(CREDITS) !== 0) {
    // Reset the attract sub-state and advance GAME_STATE 1 -> 2 (attract -> credited).
    mem.write8(GAME_SUBSTATE, 0x00); // ld (hl),0x00  (hl == GAME_SUBSTATE)
    mem.write8(GAME_STATE, (mem.read8(GAME_STATE) + 1) & 0xff); // inc (GAME_STATE)
    return; // ret 0x0762
  }

  // No credit: dispatch the current attract sub-state through the 0x0748 table.
  const substate = mem.read8(GAME_SUBSTATE);
  const handler = ATTRACT_SUBSTATE[substate];
  if (handler == null) {
    // Unused slot (8/9 -> 0x0000) or an out-of-range index: the oracle's dispatcher
    // throws NotImplemented here too. Never happens in play — attract holds 0..7.
    throw new NotImplemented(
      `attract sub-state ${substate} has no handler ` +
        "(rst 0x28 table at ROM 0x0748; slots 8,9 are unused 0x0000)",
    );
  }
  // Tail dispatch: the handler's own `ret` returns past us; propagate its skip-boolean.
  return handler(m);
}
