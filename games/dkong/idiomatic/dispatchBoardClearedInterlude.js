// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardClearedInterlude — top dispatcher for the board-advance state, keyed on the board type.  ROM 0x1615.
 *
 * The GAME_SUBSTATE (0x600A) == 0x16 handler: reached once per frame from
 * dispatchInGameSubstate while a board is being cleared / advanced. It first parks the moving
 * sprite groups off-screen (clearSpriteColumns), then routes the interlude's current step to
 * the handler for the CURRENT board type:
 *
 *   - Odd board (BOARD bit0 set: 25m or 75m) -> vector the sequence step through the 6-entry
 *     ROM table at 0x1623 (steps 0..5).
 *   - 50m board (BOARD bit1 set) -> vector through the 5-entry ROM table at 0x1637 (steps 0..4).
 *   - 100m board (neither bit) -> fall through to runRivetBoardInterludeFrame, which runs the effect-sprite state
 *     machine and then dispatches the same sequence through its own table.
 *
 * In both table arms the step index is BOARD_ADVANCE_STEP (0x6388); the little-endian target
 * word is read from ROM at table[step] and handed to the generic computed-jump dispatcher.
 * Nothing at this level consumes a return value — the sub-state dispatcher that reached dispatchBoardClearedInterlude
 * discards it — so this is void.
 *
 * NAME: promoted in understanding pass 15 by a proposer plus an independent blind confirmer
 * (docs/reviewer-rules.md R4/R5). Corroboration from OUTSIDE this routine: both of its inputs are
 * `[seen]` names.js cells — BOARD (0x6227), "1=25m girders, 2=50m conveyors, 3=75m elevators,
 * 4=100m rivets", picks the arm, and BOARD_ADVANCE_STEP (0x6388) picks the step — and the pass-14
 * grounding measured that selector walking 0→1→2→3→4→5 (0→4 on 50m) exactly once per completion,
 * 51 monotone step entries across nine completions, while it is identically 0 on all 7,466 in-play
 * frames OUTSIDE sub-state 0x16; each of the three arms was observed driving its own table. The
 * confirmer contributed a code-only corroboration of the scene itself: clearSpriteColumns parks 28
 * sprite records (20-21, 32-41, 46-56, 67-71), which stops one record short of Mario (19) on one
 * side and one short of the heart record (72) on the other and never touches SPRITE_OBJ_BLOCK
 * (records 2-11) — the gameplay actors are cleared away, the interlude's cast is kept. Working
 * blind it named this `dispatchInterludeStepByBoard`: different wording, same meaning (the
 * once-per-frame entry of the board-cleared interlude, routed by board type), verdict PROMOTE.
 *
 * The name deliberately drops "how high" — the HOW HIGH screen was captured in GAME_SUBSTATE 0x0A
 * on 9/9 board builds, and inside sub-state 0x16 the playfield tilemap changes on only six frames
 * in a whole progression run, all of them on 100m. It also asserts nothing about what the arms
 * DEPICT: the figure they animate is identified from MAME snapshots, not from bytes, and that
 * caveat lives in each step handler's own header.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1615.test.js.
 * GATE:     crafted-entry — not reached in plain attract (a board is never completed there), so a
 *           real attract base is poked over the three board arms with the FULL oracle handlers run
 *           on BOTH sides (RAM − STACK_SCRATCH + pc + SP), plus an EXHAUSTIVE selector sweep
 *           (0..255) of BOTH tables (BOARD 1/3 -> 0x1623, BOARD 2 -> 0x1637) routing every computed
 *           target to an identical catch-all stub, pinning the per-board table base + the
 *           `base + (2*step & 0xff)` 8-bit-wrap math. Teeth: a dropped-clearSpriteColumns twin, a
 *           wrong-table-base twin (ignores the bit1 arm), and a 16-bit-offset twin (no 8-bit wrap).
 * LIVE-OUT: memory-only — clearSpriteColumns' zeroed sprite bytes plus the dispatched arm's RAM
 *           writes. The oracle's board-read/rotate register+flag plumbing is dead (used only to
 *           pick the arm here), and pc/SP net out identically: the oracle's push16 return-brackets
 *           around the 0x30bd call and each rst-0x28 dispatch cancel, leaving the arm's own terminal
 *           ret to pop dispatchBoardClearedInterlude's caller return on both sides.
 * NAMES:    BOARD (0x6227), BOARD_ADVANCE_STEP (0x6388) from names.js. The two ROM table bases
 *           0x1623 / 0x1637 stay hex (ROM data, not work RAM).
 */

import { BOARD, BOARD_ADVANCE_STEP } from "./names.js";
import { clearSpriteColumns } from "./clearSpriteColumns.js"; // ROM 0x30BD — park the moving sprites
import { runRivetBoardInterludeFrame } from "./runRivetBoardInterludeFrame.js";                     // ROM 0x1641 — 100m fall-through arm
import { loc_00ca } from "../translated/loc_00ca.js";

// The two rst-0x28 inline jump tables of board-render step targets in ROM, selected by board type:
// 0x1623 (6 entries) for the odd boards 25m/75m, 0x1637 (5 entries) for 50m. ROM data, kept hex.
const STEP_TABLE_ODD = 0x1623; // 25m / 75m
const STEP_TABLE_50M = 0x1637; // 50m

// Dispatch-site labels handed to loc_00ca; they only surface inside a NotImplemented
// throw, naming which inline table an out-of-range selector fell off of. Kept identical to the
// oracle's two `m.call(0x0028, ...)` arguments.
const DISPATCH_TABLE_1623 = "0x1623 (0x6388 board sub-dispatch)";
const DISPATCH_TABLE_1637 = "0x1637 (0x6388 board sub-dispatch)";

// Vector the board-render sequence step through a ROM table of little-endian targets. The step
// index is doubled to a byte offset with the hardware's 8-bit wrap (offset wraps at 0x100), the
// target word is read from ROM at table[step], and the generic dispatcher jumps to it.
function dispatchBoardRenderStep(m, tableBase, site) {
  const { mem } = m;
  const step = mem.read8(BOARD_ADVANCE_STEP);
  const entry = (tableBase + ((step * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);
  loc_00ca(m, target, site);
}

export function dispatchBoardClearedInterlude(m) {
  const { mem } = m;

  // Park the moving sprite groups off-screen before the board-render sequence runs.
  clearSpriteColumns(m);

  // Route by board type. The odd boards (25m/75m) and 50m each own a step table; 100m has neither
  // bit set and falls through to runRivetBoardInterludeFrame.
  const board = mem.read8(BOARD);
  if ((board & 0x01) !== 0) {
    dispatchBoardRenderStep(m, STEP_TABLE_ODD, DISPATCH_TABLE_1623); // 25m / 75m
  } else if ((board & 0x02) !== 0) {
    dispatchBoardRenderStep(m, STEP_TABLE_50M, DISPATCH_TABLE_1637); // 50m
  } else {
    runRivetBoardInterludeFrame(m); // 100m
  }
}
