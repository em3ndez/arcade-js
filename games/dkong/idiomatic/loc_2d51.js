// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2d51 — reload the render string cursor from RAM, then render the next character.  ROM 0x2D51.
 *
 * The string renderer's per-character loop entry: loc_2d15 tail-jumps here once per
 * character. It reloads the current source position from RENDER_STR_PTR and falls straight
 * into the per-character body (loc_2d54). loc_2d54 advances RENDER_STR_PTR by two bytes each
 * character, so reloading the cursor here walks the string one character further on every
 * entry until the 0x7F terminator is met.
 *
 * REGISTER-ABI: loc_2d54 still takes its source pointer in a register, so the reloaded
 * cursor is handed to it there — this is exactly the routine's own reload, not extra
 * marshalling; it dissolves to an honest parameter once loc_2d54 is promoted.
 *
 * GROUNDED — observed live in MAME 0.288 on the real dkong ROM (understanding pass 12,
 * scratchpad/pass12-grounding.md): this renderer chain runs in ORDINARY 25m BARREL PLAY on
 * board 1, not in a cutscene. All 46 captured dispatches of the chain's head (loc_2cf6) fell
 * at gameplay substates — 17 in a credited in-board 25m game, 29 in the attract 25m demo — and
 * ZERO at substate 7, the opening Kong-climb cutscene; the object being dressed is always an
 * OBJ_ARRAY_67 barrel record, one per slot claim by the barrel-release routine (board 1,
 * ROM 0x2CB8), 46 claims paired 1:1 with 46 dispatches.
 *
 * NAME: kept loc_ — the mechanism (reload the cursor, render one character) is pinned to the
 * oracle, and grounding fixes the CONTEXT (25m barrel play). What is still open is the NAMED
 * identity of the two barrel kinds the chain's head selects between, which the grounding run
 * deliberately did not establish, so an English name would have to guess.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2d51.test.js.
 * GATE:     real captured 0x2D51 dispatches from attract (both the emit and terminator
 *           arms occur naturally) plus crafted entries that force the terminator and both
 *           attribute arms with a DELIBERATELY-mismatched incoming cursor, proving the
 *           reload reads RENDER_STR_PTR and ignores the register it is handed. The RAM diff
 *           excludes the dead STACK_SCRATCH the terminator hand-off (loc_2d8c's dissolved
 *           call brackets) pushes into. Teeth: a twin that skips the reload and a twin that
 *           reloads the wrong pointer.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and the single terminal
 *           `ret` handed up through loc_2d54 are dead ABI — the caller (loc_2d15's tail
 *           jump) reads none of them; that one return is modelled in the gate, not here.
 * NAMES:    RENDER_STR_PTR (0x62A8) from ram.js. The object record and destination slot are
 *           reached downstream through loc_2d54 / loc_2d8c's own pointers.
 */

import { RENDER_STR_PTR } from "./ram.js"; // ROM 0x62A8 — the render source-string cursor
import { loc_2d54 } from "./loc_2d54.js"; // ROM 0x2D54 — the per-character body

export function loc_2d51(m) {
  const { regs, mem } = m;

  // Reload the source cursor from RAM and render the next character. loc_2d54 reads its
  // source pointer from the register, so hand it the freshly-loaded cursor.
  regs.hl = mem.read16(RENDER_STR_PTR);
  return loc_2d54(m);
}
