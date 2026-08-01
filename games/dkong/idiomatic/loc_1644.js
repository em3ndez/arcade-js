// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1644 — vector the board-advance render sequence to its current-step handler. ROM 0x1644.
 *
 * The exact `rst 0x28` inline-jump-table idiom of the sub-state dispatchers
 * (dispatchInGameSubstate 0x06FE, dispatchCreditedSubstate 0x08B2, loc_127f 0x127F):
 * read a one-byte step index and vector through a ROM table of little-endian target
 * addresses to the handler for that step. Here the selector is the board-render / how-high
 * sequence step counter at 0x6388 (the counter loc_17b6 seeds and loc_1839 advances), and
 * the 6-entry table lives at ROM 0x1648:
 *   0 -> 0x17B6  — seed the sequence: point the gated tick-advance pointer 0x63C0 at 0x6388,
 *                  paint the how-high render, arm the tick gate.
 *   1 -> 0x3069  — the shared gated tick-advance: once the 0x6009 gate expires, bump the byte
 *                  0x63C0 points at (here 0x6388), stepping the sequence.
 *   2 -> 0x1839  — advance the 0x6390 render counter (wraps -> steps 0x6388), then draw.
 *   3 -> 0x186F  — gated: reload the sprite-object block template and continue the render.
 *   4 -> 0x1880  — slide the object block one column (rst-0x38 stride add-loop).
 *   5 -> 0x18C6  — gated wind-down: decrement 0x62AF and, on expiry, finish the interlude.
 *
 * Reached from sub_1641 (ROM 0x1641), the fall-through arm of loc_1615's board-advance
 * dispatcher (GAME_SUBSTATE 0x600A == 0x16) taken when BOARD is neither of the two bit-gated
 * cases: sub_1641 calls sub_1dbd and falls straight through into this dispatch. Not reached in
 * plain attract (a board is never completed there), so it is gated by crafted entries.
 *
 * The oracle expresses the vector as `ld a,(0x6388)` then `rst 0x28`, whose shared trampoline
 * (sub_0028 / dispatchInlineJumpTable) recovers the inline table base off the stack, reads the
 * little-endian word at table[selector], and `jp (hl)`s to it. Here that trampoline is folded
 * in directly: the table base is the compile-time constant 0x1648, so the whole mechanism is
 * `read table[step] from ROM, dispatch`. The dispatch itself is genuine computed control flow
 * into a ROM table of targets, so it routes through the still-oracle generic dispatcher
 * dispatchGameState — the one address registry doc-06 keeps — rather than a local JS function
 * table. The trampoline's register/flag handoff (A = 2*step, HL = target, DE, flags) is NOT
 * reproduced: it is dead to every arm (each arm's first act loads HL or A itself, reading none
 * of it — verified statically, and the full-handler replay in the gate confirms it), so folding
 * it away is memory-equivalent. The oracle discards the arm's return value at this level, so
 * this routine returns nothing too.
 *
 * NAME: kept neutral loc_1644 on purpose. The dispatch MECHANISM is fully understood, and the
 * selector 0x6388 is now named BOARD_ADVANCE_STEP in ram.js, but the board-render animation's
 * exact visual is not settled — the whole render family (loc_1654, loc_1670, loc_186f, loc_1880,
 * loc_18c6, …) is kept address-named for the same reason, so an English routine name here would
 * over-assert. Promote once the render sequence's visual is confirmed.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1644.test.js.
 * GATE:     crafted-entry — a real attract-run machine with the step 0x6388 poked to each of
 *           the 6 reachable indices and the FULL oracle handler run on BOTH sides (so a wrong
 *           target or a live register/flag handoff the folded-away trampoline would supply
 *           surfaces as divergent RAM), + an EXHAUSTIVE sweep of the selector byte 0..255 (any
 *           computed target routed to an identical catch-all stub on both sides) pinning the
 *           `0x1648 + (2*sel & 0xff)` 8-bit-wrap table math for the off-table indices; teeth =
 *           a 16-bit-offset (no 8-bit wrap) twin. Not reached in plain attract.
 * LIVE-OUT: memory-only — the dispatched arm's RAM writes. pc/SP are in the contract and
 *           identical by construction (this routine never touches SP; the oracle's push/pop of
 *           the table base nets to zero, and each arm's own first push overwrites that stack
 *           slot before it is read). The oracle discards the arm's return value at this level,
 *           so this routine returns nothing; loc_1644's callers ignore any return. Residual
 *           A/HL/DE/flags are the trampoline's dead ABI handoff, read by no arm.
 * NAMES:    BOARD_ADVANCE_STEP (0x6388) from ram.js — the board-advance sequence step selector;
 *           table base 0x1648 kept hex (ROM data, not work RAM).
 */

import { dispatchGameState } from "../translated/dispatchGameState.js";
import { BOARD_ADVANCE_STEP } from "./ram.js"; // 0x6388 — board-render / how-high sequence step selector (0..5 in play)

// The `rst 0x28` inline jump table: 6 little-endian target addresses in ROM starting at 0x1648
// (0x17B6, 0x3069, 0x1839, 0x186F, 0x1880, 0x18C6), indexed by the step. A ROM-data address, hex.
const STEP_TABLE = 0x1648;

// The dispatch-site label handed to dispatchGameState; it only surfaces inside a NotImplemented
// throw, naming which inline table an out-of-range selector fell off of. Kept identical to the
// oracle's `m.call(0x0028, ...)` argument.
const DISPATCH_TABLE_1648 = "0x1648 (0x6388 sequence)";

export function loc_1644(m) {
  const { mem } = m;

  // ld a,(0x6388) — the board-render sequence step index (0..5).
  const step = mem.read8(BOARD_ADVANCE_STEP);

  // rst 0x28: `add a,a` doubles the index to a 2-byte table offset, and it is an 8-bit result —
  // selector 0x80 wraps the offset to 0 — so the address math is `base + (2*step & 0xff)`, NOT
  // `base + 2*step`. Then read the little-endian target word at table[step].
  const entry = (STEP_TABLE + ((step * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // jp (hl) — dispatch to the step handler. The oracle discards the arm's return value at this
  // level, so this routine does too.
  dispatchGameState(m, target, DISPATCH_TABLE_1648);
}
