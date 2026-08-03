// SPDX-License-Identifier: GPL-3.0-only
/**
 * armTwoPlayerBoardSetup — the 2-player arm of the board-setup sub-state step:
 * clear two board control latches, post two draw tasks, advance the game sub-state,
 * then paint the shared 3-cell column.  ROM 0x09D6.
 *
 * This is table entry of the in-game (GAME_STATE == 3) sub-state dispatcher that runs
 * while GAME_SUBSTATE (0x600A) == 2 — one step of the pre-play board-setup sequence
 * (sub-states 2..5, before play begins at sub-state 7). It is the TWO-PLAYER variant:
 * loc_09ab (the 1-player path) advances straight to sub-state 5, and only routes here
 * when TWO_PLAYER_GAME (0x600F) is non-zero, so this arm additionally lays down the
 * two-player start furniture. A driven 2-coin + start-2 run confirms the context: it
 * dispatches exactly once, at game start, with GAME_SUBSTATE == 2 and TWO_PLAYER_GAME == 1.
 *
 * What it does, straight-line (no data-dependent branch of its own):
 *   - clears the two board control latches at 0x7D86/0x7D87 to 0,
 *   - posts two deferred draw tasks onto the task ring via enqueueTask — [opcode 3,
 *     argument 2] then [opcode 2, argument 1] (D = opcode, E = argument, enqueueTask's ABI),
 *   - advances GAME_SUBSTATE 2 -> 5, then
 *   - FALLS THROUGH into loc_09ee, which paints one tilemap column (three cells 0x20
 *     apart: 0x74E0 = 0x02, 0x74C0 = 0x25, 0x74A0 = 0x20). loc_09ee's own `ret` is what
 *     returns from here — a tail fall-through, so the JS return value is loc_09ee's.
 *
 * A LEAF over enqueueTask + loc_09ee: it reads no RAM itself (A is loaded, never read);
 * all data-dependent behaviour lives in enqueueTask (ring full / wrap arms).
 *
 * Memory-equivalent to the frozen oracle — equivalence-09d6.test.js.
 * GATE:     crafted-entry — the real driven dispatch (2-coin + start-2 reaches it once at
 *           game start, SP in STACK_SCRATCH, tail near the ring end) + crafted CLEAN /
 *           FULL / WRAP ring arms (the enqueueTask drop/wrap branches the single natural
 *           dispatch does not force), poked identically on both sides, with the exact
 *           4-byte payload + latches + sub-state + column pinned.
 * LIVE-OUT: memory-only — the two latches (0x7D86/0x7D87), the two posted ring slots +
 *           TASK_TAIL (0x60B0), GAME_SUBSTATE (0x600A) = 5, and the 3-cell VRAM column
 *           (0x74E0/0x74C0/0x74A0, via loc_09ee). The caller is the NMI's rst-0x28
 *           game-state dispatch (a tail `jp (hl)` that reads no flag set here); the
 *           oracle's residual A(=0x20)/DE(=0x0201)/HL/flags are dead ABI. pc/SP are the
 *           dropped stack model — loc_09ee's `ret` becomes the JS return, so the sole
 *           oracle-vs-idiomatic residue is the pushed bytes in STACK_SCRATCH (excluded).
 * NAMES:    GAME_SUBSTATE (0x600A) from ram.js; imports enqueueTask (idiomatic ROM 0x309F)
 *           and the loc_09ee oracle (ROM 0x09EE, not yet decompiled). The two latches live
 *           in the 0x7D00-page board control space (not work RAM, so not in ram.js) and
 *           stay hex; the task opcode/argument bytes are literal message payloads.
 */

import { GAME_SUBSTATE } from "./ram.js";
import { enqueueTask } from "./enqueueTask.js";
// ROM 0x09EE — the FROZEN ORACLE, deliberately. An idiomatic twin (draw2UpLabel.js) exists and
// 0x09EE is in ram.js's ROUTINES, so this is NOT a "no idiomatic yet" import. It stays because
// this is a tail FALL-THROUGH: loc_09ee's own Z80 `ret` is what returns from this routine, and
// draw2UpLabel models that return as a JS `return` and leaves pc/SP at entry. MEASURED — swapping
// it fails this routine's own equivalence gate: pc oracle=0x00D2 (the popped NMI continuation)
// vs idiomatic=0x0028, SP 2 apart. Dissolving it needs the tail return moved into this routine,
// which is an ABI change, not an import swap.
import { loc_09ee } from "../translated/loc_09ee.js";

// Two board control latches this arm clears to 0. They live in the 0x7D00-page board
// control space (0x7D86, 0x7D87), NOT work RAM, so they are not in ram.js and stay hex.
// sub_0a1b (ROM 0x0A1B) clears the identical pair with the same `xor a / ld (nn),a` opener.
const BOARD_CONTROL_LATCH_A = 0x7d86;
const BOARD_CONTROL_LATCH_B = 0x7d87;

export function armTwoPlayerBoardSetup(m) {
  const { regs, mem } = m;

  // Clear the two board control latches.
  mem.write8(BOARD_CONTROL_LATCH_A, 0x00);
  mem.write8(BOARD_CONTROL_LATCH_B, 0x00);

  // Post two draw tasks [opcode, argument] onto the task ring. enqueueTask reads the
  // pair from D/E, so each is marshalled through regs.de before the call (its ABI).
  regs.de = 0x0302; // [opcode 3, argument 2]
  enqueueTask(m);
  regs.de = 0x0201; // [opcode 2, argument 1]
  enqueueTask(m);

  // Advance the board-setup sub-state 2 -> 5.
  mem.write8(GAME_SUBSTATE, 0x05);

  // Fall through into the shared 3-cell column painter; its `ret` returns from here.
  return loc_09ee(m);
}
