// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3e88 — vector to the current board's collision-search arm, handing it the
 * caller's bounds word across the dispatch.  ROM 0x3E88.
 *
 * The caller (still-untranslated, from 0x286B) hands a bounds word in a register and
 * wants the board-specific object-overlap search run for it. This routine reads the
 * board type BOARD (0x6227) and vectors through its own 6-entry inline jump table in
 * ROM at 0x3E8D to that board's arm:
 *   board 0 -> 0x0000  (reset-vector guard for an out-of-range board)
 *   board 1 -> 0x3E99  (25m: recover the bounds, count object overlaps, return a code)
 *   board 2 -> 0x28B0
 *   board 3 -> 0x28E0
 *   board 4 -> 0x2901
 *   board 5 -> 0x0000  (reset-vector guard)
 * The selected arm's value passes straight back to the caller (this routine adds no
 * frame of its own — the dispatch is its last act).
 *
 * The bounds word is handed to the arm THROUGH THE STACK, not a register: the shared
 * dispatch trampoline clobbers the register pair while it recovers its own table base,
 * so the word is stacked first and the arm's opening move (e.g. 0x3E99's pop) lifts it
 * back off as its collision bounds. That hand-off is genuine data, not call plumbing —
 * dropping it feeds the arm a garbage bounds word.
 *
 * The dispatch itself is the shared `rst 0x28` inline-table trampoline
 * (dispatchInlineJumpTable): it recovers the inline table base off the stack, reads the
 * little-endian target word at table[board], and vectors to it. Its ABI still takes the
 * table base off the stack, so this routine hands it that base the way the dispatch does
 * — as the top word — exactly as the frozen oracle's call site loads it. This table's
 * arms are reached ONLY here (never on the live NMI / sub-state / guard dispatch paths),
 * so the trampoline's dispatch still routes through the still-oracle generic dispatcher.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3e88.test.js.
 * GATE:     crafted-entry — never dispatched in attract (its table is reached only from
 *           the untranslated 0x286B caller), so all coverage is crafted on a real
 *           attract-base machine: an EXHAUSTIVE board sweep 0..255 routed to an identical
 *           catch-all stub on both sides (pins BOARD as the selector, 0x3E8D as the table
 *           base, and the whole dispatch handoff), the board-1 arm run FOR REAL through
 *           entry_3e99 (pins the stacked bounds hand-off, observable in the overlap count),
 *           and the null-guard boards 0/5 (both throw). Teeth: a dropped-bounds twin and a
 *           wrong-selector twin.
 * LIVE-OUT: memory + pc + SP + the arm's returned value + result registers A and IX (the
 *           collision code / record pointer the caller reads back — same live-out its exact
 *           sibling dispatchBoardCollision declares). The arm's own ret sets pc/SP on both
 *           sides identically; the trampoline's own register/flag handoff into the arm is dead
 *           to this routine's caller.
 * NAMES:    BOARD (0x6227) from ram.js; the inline table base 0x3E8D kept hex (ROM data,
 *           not work RAM).
 */

import { BOARD } from "./ram.js";
import { dispatchInlineJumpTable } from "./dispatchInlineJumpTable.js";

// This routine's own `rst 0x28` inline jump table: 6 little-endian target words in ROM
// starting at 0x3E8D, indexed by BOARD. A ROM-data address, so kept hex.
const BOARD_DISPATCH_TABLE = 0x3e8d;

// The dispatch-site label handed down to the generic dispatcher; it only ever surfaces
// inside a NotImplemented throw (an out-of-range board hitting a 0x0000 guard). Kept
// identical to the frozen oracle's site string so the throw text matches byte-for-byte.
const DISPATCH_SITE = "0x3E8D (entry_3e88 dispatch)";

export function loc_3e88(m) {
  const { regs, mem } = m;

  // ld a,(0x6227) — the board type selects which arm of the inline table runs.
  regs.a = mem.read8(BOARD);

  // push hl — the caller's bounds word, handed across the dispatch to the selected arm
  // (the trampoline clobbers the register recovering its table base, and the arm lifts
  // this back off the stack). Sits BELOW the table base.
  m.push16(regs.hl);

  // rst 0x28 — dispatch through the inline table. The trampoline takes its table base off
  // the stack, so hand it that base as the top word (as the rst does), then it reads
  // table[board] and vectors to the arm; the arm's value passes straight up to the caller.
  m.push16(BOARD_DISPATCH_TABLE);
  return dispatchInlineJumpTable(m, DISPATCH_SITE);
}
