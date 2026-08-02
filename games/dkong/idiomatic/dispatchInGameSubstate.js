// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchInGameSubstate — vector the credited game to its current sub-state handler. ROM 0x06FE.
 *
 * This is game-state 3's per-frame dispatcher: reached from the NMI's game-state
 * table (loc_00ca entry 3) once per frame while a credited game runs. It
 * reads the in-game sub-state index GAME_SUBSTATE (0x600A) and vectors through the
 * 29-entry inline jump table in ROM at 0x0702 to the handler for that sub-state —
 * 7 = opening Kong-climb cutscene, 8 = how-high interlude, 0x0A = board setup,
 * 0x0C = gameplay (0x197A), 0x16 = board-cleared/advance, and so on. The death sequence
 * occupies the three slots after gameplay, corrected in pass 13 (the old header was one
 * step off, calling 0x0C/0x0D both "gameplay" and 0x0E "P1 death"):
 *   0x0D -> 0x127C  Mario's DEATH ANIMATION (runDeathAnimationSubstate) — entered the frame
 *                   Mario dies and running a fixed 296 frames; 3 episodes per credited 1P
 *                   game, 6 per 2P game (44 observed live in MAME across attract and
 *                   credited play — scratchpad/pass13-grounding.md §2);
 *   0x0E -> 0x12F2  the P1 LIFE-LOSS handler — LIVES (0x6228) is decremented here, at ROM
 *                   0x12FC (12 of the 15 observed decrements);
 *   0x0F -> 0x1344  the P2 LIFE-LOSS twin — its decrement is at ROM 0x134E (3 observed, all
 *                   in a real 2-player run).
 * Arm 2 of the death animation is what selects between them: it advances GAME_SUBSTATE by
 * one for P1 (0x0D -> 0x0E) and by two for P2 (0x0D -> 0x0F).
 * Six table slots (index 9 and 24–28) are 0x0000 and the selector is NOT range-
 * checked, so a null/out-of-range sub-state vectors to 0x0000 / off the table; the
 * ROM has no guard, and loc_00ca surfaces such a target as a loud
 * NotImplemented throw rather than a silent reset.
 *
 * The oracle expresses the vector as `ld a,(0x600a)` then `rst 0x28`, whose shared
 * trampoline (sub_0028 / dispatchInlineJumpTable) recovers the inline table base off
 * the stack, reads the little-endian word at table[selector], and `jp (hl)`s to it.
 * Here that trampoline is folded in directly: the table base is the compile-time
 * constant 0x0702, so the whole mechanism is `read table[substate] from ROM, dispatch`.
 * The dispatch itself is genuine computed control flow into a ROM table of targets, so
 * it routes through the still-oracle generic dispatcher loc_00ca — the one
 * address registry doc-06 keeps — rather than a local JS function table. The
 * trampoline's register/flag handoff (A = 2*selector, HL = target, DE, flags) is NOT
 * reproduced: it is dead to every 0x0702 arm (each handler's entry immediately
 * overwrites or ignores A/HL/DE — verified statically, and the full-handler replay in
 * the gate confirms it), so folding it away is memory-equivalent.
 *
 * Memory-equivalent to the frozen oracle — equivalence-06fe.test.js.
 * GATE:     crafted-entry — real captured in-game dispatches from a driven coin+start
 *           run (fresh clone each, the full oracle handler run on BOTH sides so a wrong
 *           target or a live handoff would surface as divergent RAM) + an EXHAUSTIVE
 *           sweep of the selector byte 0..255 (routed to an identical catch-all stub on
 *           both sides) pinning the `base + (2*sel & 0xff)` 8-bit-wrap table math for the
 *           indices the run never reaches; teeth = a base-off-by-one twin. Reached only
 *           in a credited game (GAME_STATE 3), never in plain attract.
 * LIVE-OUT: memory-only — the sub-state handler's RAM writes. pc/SP are in the contract
 *           and identical by construction (this routine never touches SP; the handler's
 *           own ret sets both, and SP entering the dispatch is the same on each side —
 *           the oracle's push/pop of the table base nets to zero). The oracle discards
 *           the arm's skip-boolean here, so this routine returns nothing too; loc_06fe's
 *           own callers ignore any return. Residual A/HL/DE/flags are the trampoline's
 *           dead ABI handoff, read by no 0x0702 arm.
 * NAMES:    GAME_SUBSTATE (0x600A) from ram.js; table base 0x0702 kept hex (ROM data,
 *           not work RAM).
 */

import { GAME_SUBSTATE } from "./ram.js";
import { loc_00ca } from "../translated/loc_00ca.js";

// The `rst 0x28` inline jump table: 29 little-endian target addresses in ROM starting
// at 0x0702, indexed by GAME_SUBSTATE. A ROM-data address, so kept hex.
const SUBSTATE_TABLE = 0x0702;

// The dispatch-site label handed to loc_00ca; it only ever surfaces inside a
// NotImplemented throw, naming which inline table a null/out-of-range selector fell off
// of. Kept identical to the oracle's DISPATCH_TABLE_0702.
const DISPATCH_TABLE_0702 = "0x0702 (0x600A game sub-state)";

export function dispatchInGameSubstate(m) {
  const { mem } = m;

  // ld a,(0x600a) — the in-game sub-state index.
  const substate = mem.read8(GAME_SUBSTATE);

  // rst 0x28: `add a,a` doubles the index to a 2-byte table offset, and it is an 8-bit
  // result — selector 0x80 wraps the offset to 0 — so the address math is
  // `base + (2*substate & 0xff)`, NOT `base + 2*substate`. Then read the little-endian
  // target word at table[substate].
  const entry = (SUBSTATE_TABLE + ((substate * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // jp (hl) — dispatch to the sub-state handler. The oracle discards the arm's return
  // value at this level, so this routine does too.
  loc_00ca(m, target, DISPATCH_TABLE_0702);
}
