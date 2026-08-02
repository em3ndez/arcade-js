// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchCreditedSubstate — vector the credited game (game-state 2) to its sub-state handler.  ROM 0x08B2.
 *
 * GAME_STATE (0x6005) == 2 is the "credited" state: a coin has been accepted but the
 * game has not yet started. It is a brief two-sub-state setup machine that hands off
 * to in-game (state 3). This routine is its per-frame dispatcher — the NMI game-state
 * table (loc_00ca entry 2) reaches it once per frame while GAME_STATE == 2.
 * It reads the sub-state index GAME_SUBSTATE (0x600A) and vectors through the 2-entry
 * inline jump table in ROM at 0x08B6 to the handler for that sub-state:
 *   0 -> 0x08BA  — clear the playfield, mark the credit accepted (ATTRACT 0x6007 = 0),
 *                  enqueue the intro task, advance the sub-state to 1.
 *   1 -> 0x08F8  — wait on the start button; on 1P/2P start, record TWO_PLAYER_GAME and
 *                  advance GAME_STATE (0x6005) to 3 (in-game), resetting 0x600A to 0.
 * The table holds only those 2 entries and the selector is NOT range-checked (as in the
 * 29-entry state-3 table at 0x0702); the ROM only ever holds 0 or 1 here, so those are
 * the only reachable arms.
 *
 * This is the exact sibling of dispatchInGameSubstate (0x06FE, game-state 3): the same
 * `ld a,(0x600a)` / `rst 0x28` idiom, only the table base (0x08B6 vs 0x0702) differs. The
 * oracle expresses the vector through the shared `rst 0x28` trampoline (sub_0028 /
 * dispatchInlineJumpTable), which recovers the inline table base off the stack, reads the
 * little-endian word at table[selector], and `jp (hl)`s to it. Here that trampoline is
 * folded in directly: the table base is the compile-time constant 0x08B6, so the whole
 * mechanism is `read table[substate] from ROM, dispatch`. The dispatch itself is genuine
 * computed control flow into a ROM table of targets, so it routes through the still-oracle
 * generic dispatcher loc_00ca — the one address registry doc-06 keeps — rather
 * than a local JS function table. The trampoline's register/flag handoff (A = 2*selector,
 * HL = target, DE, flags) is NOT reproduced: it is dead to both arms (0x08BA's first act is
 * a `call 0x0874` that never reads A/HL/DE and then `xor a`; 0x08F8's first act is a
 * `call 0x08D5` whose only register input is B, which the trampoline never touches), so
 * folding it away is memory-equivalent — the full-handler replay in the gate confirms it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-08b2.test.js.
 * GATE:     crafted-entry — real captured credited-state dispatches from a coin run (fresh
 *           clone each, the full oracle handler run on BOTH sides so a wrong target or a
 *           live handoff would surface as divergent RAM), covering both sub-states 0 and 1,
 *           + an EXHAUSTIVE sweep of the selector byte 0..255 (routed to an identical
 *           catch-all stub on both sides) pinning the `base + (2*sel & 0xff)` 8-bit-wrap
 *           table math for the off-table indices the run never reaches; teeth = a
 *           16-bit-offset (no 8-bit wrap) twin. Reached only after a coin (GAME_STATE == 2),
 *           never in plain attract.
 * LIVE-OUT: memory-only — the sub-state handler's RAM writes. pc/SP are in the contract and
 *           identical by construction (this routine never touches SP; the oracle's push/pop
 *           of the table base nets to zero, and from loc_00ca onward both sides run
 *           the identical arm). The oracle discards the arm's return value at this level, so
 *           this routine returns nothing too; loc_08b2's own callers ignore any return.
 *           Residual A/HL/DE/flags are the trampoline's dead ABI handoff, read by neither arm.
 * NAMES:    GAME_SUBSTATE (0x600A) from ram.js; table base 0x08B6 kept hex (ROM data, not
 *           work RAM).
 */

import { GAME_SUBSTATE } from "./ram.js";
import { loc_00ca } from "../translated/loc_00ca.js";

// The `rst 0x28` inline jump table: 2 little-endian target addresses in ROM starting at
// 0x08B6, indexed by GAME_SUBSTATE. A ROM-data address, so kept hex.
const SUBSTATE_TABLE = 0x08b6;

// The dispatch-site label handed to loc_00ca; it only ever surfaces inside a
// NotImplemented throw, naming which inline table an out-of-range selector fell off of.
// Kept identical to the oracle's site string.
const DISPATCH_TABLE_08B6 = "0x08B6 (0x600A, 2-entry)";

export function dispatchCreditedSubstate(m) {
  const { mem } = m;

  // ld a,(0x600a) — the credited-state sub-state index (0 or 1).
  const substate = mem.read8(GAME_SUBSTATE);

  // rst 0x28: `add a,a` doubles the index to a 2-byte table offset, and it is an 8-bit
  // result — selector 0x80 wraps the offset to 0 — so the address math is
  // `base + (2*substate & 0xff)`, NOT `base + 2*substate`. Then read the little-endian
  // target word at table[substate].
  const entry = (SUBSTATE_TABLE + ((substate * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // jp (hl) — dispatch to the sub-state handler. The oracle discards the arm's return
  // value at this level, so this routine does too.
  loc_00ca(m, target, DISPATCH_TABLE_08B6);
}
