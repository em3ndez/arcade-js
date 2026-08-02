// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchBoardCollision — vector a collision test to the current board's handler. ROM 0x286F.
 *
 * Called from the collision cascade (sub_2808, loc_281d) with a position already in HL:
 * it reads BOARD (0x6227) and vectors through the 6-entry inline jump table in ROM at
 * 0x2874 to the collision handler for that board type —
 *   1 -> 0x2880  (25m girders),  2 -> 0x28B0  (50m),
 *   3 -> 0x28E0  (75m),          4 -> 0x2901  (100m rivets).
 * Entries 0 and 5 are 0x0000 guard slots (BOARD is never range-checked; a stray value
 * vectors off the table, which loc_00ca surfaces as a loud NotImplemented throw).
 * Each handler sweeps the board's object records — via the shared search entry_2913 —
 * for one overlapping with the caller's position and leaves the hit/miss result the
 * callers read back (A, and for loc_281d also IX). This routine only routes; the handler
 * does the work.
 *
 * The passed-in HL is genuine data, not call plumbing: this routine PUSHES it and every
 * handler recovers it with `pop hl` as its first act. It survives the rst-0x28 trampoline
 * (whose own push+pop of the table base nets to zero) precisely because it is pushed
 * FIRST, underneath the trampoline's frame. So the push is reproduced exactly — drop it
 * and every handler pops the wrong stack word and the return unwinds two bytes off.
 *
 * This is the exact sibling of dispatchInGameSubstate (0x06FE) and dispatchIntroCutsceneStep
 * (0x0A76): the same `ld a,(sel)` / `rst 0x28` idiom, differing only in the selector (BOARD
 * here) and the table base (0x2874). The oracle routes the vector through the shared `rst
 * 0x28` trampoline (sub_0028 / dispatchInlineJumpTable), which recovers the inline table base
 * off the stack, reads the little-endian word at table[board], and `jp (hl)`s to it. Here
 * that trampoline is folded in directly — the table base is the compile-time constant 0x2874
 * — leaving `push the caller's HL, read table[board] from ROM, dispatch`. The dispatch itself
 * is genuine computed control flow into a ROM table of targets, so it routes through the
 * still-oracle generic dispatcher loc_00ca (the one address registry doc-06 keeps)
 * rather than a local JS function table. The trampoline's register/flag handoff (A = 2*board,
 * HL = target, DE, flags) is NOT reproduced: it is dead into every handler (each opens with
 * `pop hl` then overwrites A/DE before reading them — verified statically, and the
 * full-handler replay in the gate confirms it), so folding it away is memory-equivalent.
 *
 * Memory-equivalent to the frozen oracle — equivalence-286f.test.js.
 * GATE:     crafted-entry — real captured attract dispatches (BOARD == 1, the 25m handler
 *           0x2880; ~1500 per 2000 attract frames), full oracle handler run on BOTH sides so
 *           a wrong target or a live register/flag handoff would surface as divergent RAM,
 *           plus crafted BOARD == 2/3/4 to run the other three handlers, plus an EXHAUSTIVE
 *           sweep of BOARD 0..255 routed to an identical catch-all stub on both sides to pin
 *           the `base + (2*board & 0xff)` 8-bit-wrap table math (including the 0x0000 guard
 *           slots and the sel>=0x80 wrap). Teeth: a 16-bit-offset twin (no 8-bit wrap) and a
 *           dropped-push-HL twin.
 * LIVE-OUT: memory + SP + the handler's result registers A and IX (both consumed by the
 *           callers). pc/SP net from the handler's own return; the oracle's push/pop of the
 *           table base nets to zero and the caller's HL push is reproduced, so SP entering the
 *           dispatch matches. The oracle discards the JS return value at this level, so this
 *           routine returns nothing too; the result lives in A/IX on the machine.
 * NAMES:    BOARD (0x6227) from ram.js; table base 0x2874 kept hex (ROM data, not work RAM).
 */

import { BOARD } from "./ram.js";
import { loc_00ca } from "../translated/loc_00ca.js";

// The `rst 0x28` inline jump table: 6 little-endian target addresses in ROM starting at
// 0x2874, indexed by BOARD. A ROM-data address, so kept hex.
const BOARD_COLLISION_TABLE = 0x2874;

// The dispatch-site label handed to loc_00ca; it only ever surfaces inside a
// NotImplemented throw, naming which inline table a stray BOARD fell off of. Kept identical
// to the oracle's `m.call(0x0028, ...)` site string.
const DISPATCH_TABLE_2874 = "0x2874 (0x6227 collision dispatch)";

export function dispatchBoardCollision(m) {
  const { regs, mem } = m;

  // ld a,(0x6227) — the current board number selects its collision handler.
  const board = mem.read8(BOARD);

  // push hl — the caller's position, genuine data every handler recovers with `pop hl`.
  // Pushed FIRST so it sits below the trampoline's frame and survives to the handler.
  m.push16(regs.hl);

  // rst 0x28: `add a,a` doubles the board into a 2-byte table offset, and it is an 8-bit
  // result — board 0x80 wraps the offset to 0 — so the address math is
  // `base + (2*board & 0xff)`, NOT `base + 2*board`. Then read the little-endian handler
  // address at table[board].
  const entry = (BOARD_COLLISION_TABLE + ((board * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // jp (hl) — dispatch to the board's collision handler. Its hit/miss result is left in
  // A/IX on the machine; the oracle discards the JS return value here, so this routine does too.
  loc_00ca(m, target, DISPATCH_TABLE_2874);
}
