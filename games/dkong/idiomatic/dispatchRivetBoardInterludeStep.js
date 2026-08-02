// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchRivetBoardInterludeStep — vector the board-advance render sequence to its current-step handler. ROM 0x1644.
 *
 * The exact `rst 0x28` inline-jump-table idiom of the sub-state dispatchers
 * (dispatchInGameSubstate 0x06FE, dispatchCreditedSubstate 0x08B2, dispatchDeathAnimationPhase 0x127F):
 * read a one-byte step index and vector through a ROM table of little-endian target
 * addresses to the handler for that step. Here the selector is BOARD_ADVANCE_STEP (0x6388),
 * the 100m interlude's step counter (the counter loc_17b6 seeds and stepSpriteAnimationSequence
 * advances), and the 6-entry table lives at ROM 0x1648:
 *   0 -> 0x17B6  — seed the sequence: point the gated tick-advance pointer 0x63C0 at 0x6388,
 *                  redraw the playfield tilemap (grounded as the girder collapse), arm the gate.
 *   1 -> 0x3069  — the shared gated tick-advance: once the 0x6009 gate expires, bump the byte
 *                  0x63C0 points at (here 0x6388), stepping the sequence.
 *   2 -> 0x1839  — advance the 0x6390 render counter (wraps -> steps 0x6388), then draw.
 *   3 -> 0x186F  — gated: reload the sprite-object block template and continue the render.
 *   4 -> 0x1880  — slide the object block one column (rst-0x38 stride add-loop).
 *   5 -> 0x18C6  — gated wind-down: decrement 0x62AF and, on expiry, finish the interlude.
 *
 * Reached from runRivetBoardInterludeFrame (ROM 0x1641), the fall-through arm of
 * dispatchBoardClearedInterlude's board-advance dispatcher (GAME_SUBSTATE 0x600A == 0x16) taken
 * when BOARD is neither of the two bit-gated cases: it calls dispatchEffectState and falls
 * straight through into this dispatch. Not reached in plain attract (a board is never completed
 * there), so it is gated by crafted entries.
 *
 * The oracle expresses the vector as `ld a,(0x6388)` then `rst 0x28`, whose shared trampoline
 * (dispatchInlineJumpTable, ROM 0x0028) recovers the inline table base off the stack, reads the
 * little-endian word at table[selector], and `jp (hl)`s to it. Here that trampoline is folded
 * in directly: the table base is the compile-time constant 0x1648, so the whole mechanism is
 * `read table[step] from ROM, dispatch`. The dispatch itself is genuine computed control flow
 * into a ROM table of targets, so it routes through the still-oracle generic dispatcher
 * loc_00ca — the one address registry doc-06 keeps — rather than a local JS function
 * table. The trampoline's register/flag handoff (A = 2*step, HL = target, DE, flags) is NOT
 * reproduced: it is dead to every arm (each arm's first act loads HL or A itself, reading none
 * of it — verified statically, and the full-handler replay in the gate confirms it), so folding
 * it away is memory-equivalent. The oracle discards the arm's return value at this level, so
 * this routine returns nothing too.
 *
 * NAME: promoted in understanding pass 15 by a proposer plus an independent blind confirmer
 * (docs/reviewer-rules.md R4/R5). Corroboration from OUTSIDE this routine: the selector is the
 * `[seen]` ram.js cell BOARD_ADVANCE_STEP (0x6388); two of the six table targets already carry
 * earned English names — advanceSequenceStepWhenTimerExpires (0x3069, cert "seen") and
 * stepSpriteAnimationSequence (0x1839) — and the step-0 target is grounded through the two named
 * tile writers it drives, fillTileBlock (0x1826: 280 tile writes per completion, a 70-tile fill
 * run four times) and fillColumnAndContinueWalk (0x0F35: 48 more). The "rivet board" qualifier is
 * measured, not inferred from the arm names: every one of the six targets was tallied
 * board-4-exclusive, and the only six frames on which the playfield tilemap changes inside
 * sub-state 0x16 in a whole progression run are all on board 4 — "4=100m rivets" per ram.js's
 * `[seen]` BOARD note. The blind confirmer named this `dispatch100mInterludeStep` and voted
 * PROMOTE; "rivet board" and "100m" are the same board, and both derivations independently
 * identified the same rst-0x28 inline-table idiom shared with dispatchInGameSubstate /
 * dispatchCreditedSubstate / dispatchDeathAnimationPhase.
 *
 * The name claims only which sequence is being vectored, not what its arms draw. Four of the six
 * targets (loc_17b6, loc_186f, loc_1880, loc_18c6) are still address-named, and the visual reading
 * of the 100m steps (collapse → Kong falls → reunion) rests on grounding snapshots rather than on
 * byte measurements.
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
 *           so this routine returns nothing; dispatchRivetBoardInterludeStep's callers ignore any return. Residual
 *           A/HL/DE/flags are the trampoline's dead ABI handoff, read by no arm.
 * NAMES:    BOARD_ADVANCE_STEP (0x6388) from ram.js — the board-advance sequence step selector;
 *           table base 0x1648 kept hex (ROM data, not work RAM).
 */

import { loc_00ca } from "../translated/loc_00ca.js";
import { BOARD_ADVANCE_STEP } from "./ram.js"; // 0x6388 — interlude step selector (0..5 in play)

// The `rst 0x28` inline jump table: 6 little-endian target addresses in ROM starting at 0x1648
// (0x17B6, 0x3069, 0x1839, 0x186F, 0x1880, 0x18C6), indexed by the step. A ROM-data address, hex.
const STEP_TABLE = 0x1648;

// The dispatch-site label handed to loc_00ca; it only surfaces inside a NotImplemented
// throw, naming which inline table an out-of-range selector fell off of. Kept identical to the
// oracle's `m.call(0x0028, ...)` argument.
const DISPATCH_TABLE_1648 = "0x1648 (0x6388 sequence)";

export function dispatchRivetBoardInterludeStep(m) {
  const { mem } = m;

  // ld a,(0x6388) — the 100m interlude sequence step index (0..5).
  const step = mem.read8(BOARD_ADVANCE_STEP);

  // rst 0x28: `add a,a` doubles the index to a 2-byte table offset, and it is an 8-bit result —
  // selector 0x80 wraps the offset to 0 — so the address math is `base + (2*step & 0xff)`, NOT
  // `base + 2*step`. Then read the little-endian target word at table[step].
  const entry = (STEP_TABLE + ((step * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // jp (hl) — dispatch to the step handler. The oracle discards the arm's return value at this
  // level, so this routine does too.
  loc_00ca(m, target, DISPATCH_TABLE_1648);
}
