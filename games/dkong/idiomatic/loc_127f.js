// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_127f — vector a short animation sequence to its current-step handler. ROM 0x127F.
 *
 * The exact `rst 0x28` inline-jump-table idiom of the sub-state dispatchers
 * (dispatchInGameSubstate 0x06FE, dispatchCreditedSubstate 0x08B2,
 * dispatchIntroCutsceneStep 0x0A76): read a one-byte step index and vector through a
 * ROM table of little-endian target addresses to the handler for that step. Here the
 * selector is the sequence-phase counter at 0x639D and the 4-entry table lives at ROM
 * 0x1283:
 *   0 -> 0x128B  — seed the sequence: set Mario's sprite-record byte 0x694D (flip a
 *                  two-cell blinker on), load the blink repeat-count 0x639E = 0x0D,
 *                  advance 0x639D, re-arm the 0x6009 tick gate, fire a sound (0x6088).
 *   1 -> 0x12AC  — each expiry of the 0x6009 gate: decrement the blink count 0x639E and
 *                  toggle the two-cell blinker (0x694D/0x694E); when 0x639E reaches 0,
 *                  advance the phase 0x639D 1 -> 2 and re-arm the gate long (0x80 ticks).
 *   2 -> 0x12DE  — advance the game sub-state GAME_SUBSTATE (0x600A) (by 2 for player 2,
 *                  1 for player 1) and set the gate to fire next frame — i.e. hand the
 *                  sequence off to the following sub-state.
 *   3 -> 0x0000  — unused table slot; 0x639D only ever holds 0..2 in play, so this arm
 *                  is unreachable. The selector is NOT range-checked (as in the 0x0702 /
 *                  0x08B6 tables), so a null/out-of-range phase vectors to 0x0000 / off
 *                  the table, which the still-oracle dispatchGameState surfaces as a loud
 *                  NotImplemented throw rather than a silent reset — same as the oracle.
 *
 * Reached from loc_127c (0x127C), which is entry 4 of the game-state-1 sub-state table
 * at ROM 0x0748 (handler_073c): loc_127c calls sub_1dbd and falls straight through into
 * this dispatch. Not reached in plain attract (that 0x0748 arm is a deep sub-state the
 * attract demo does not drive), so it is gated by crafted entries, not natural captures.
 *
 * The oracle expresses the vector as `ld a,(0x639d)` then `rst 0x28`, whose shared
 * trampoline (sub_0028 / dispatchInlineJumpTable) recovers the inline table base off the
 * stack, reads the little-endian word at table[selector], and `jp (hl)`s to it. Here that
 * trampoline is folded in directly: the table base is the compile-time constant 0x1283,
 * so the whole mechanism is `read table[phase] from ROM, dispatch`. The dispatch itself is
 * genuine computed control flow into a ROM table of targets, so it routes through the
 * still-oracle generic dispatcher dispatchGameState — the one address registry doc-06
 * keeps — rather than a local JS function table. The trampoline's register/flag handoff
 * (A = 2*phase, HL = target, DE, flags) is NOT reproduced: it is dead to every arm (each
 * arm's first act is a `rst 0x18` gate check that then reloads HL, reading none of it —
 * verified statically, and the full-handler replay in the gate confirms it), so folding it
 * away is memory-equivalent.
 *
 * NAME: kept neutral loc_127f on purpose. The dispatch MECHANISM is fully understood, but
 * the selector 0x639D is unconfirmed (deliberately unnamed in ram.js) and the animated
 * sequence's game-semantic identity is not settled to the proposer!=confirmer bar, so an
 * English name would over-assert. Promote (e.g. dispatchAnimationStep) only once 0x639D is
 * confirmed to ram.js.
 *
 * Memory-equivalent to the frozen oracle — equivalence-127f.test.js.
 * GATE:     crafted-entry — a real attract-run machine with the phase 0x639D poked to each
 *           reachable arm (0,1,2) and the tick gate opened, the FULL oracle handler run on
 *           BOTH sides (so a wrong target or a live register/flag handoff would surface as
 *           divergent RAM), + an EXHAUSTIVE sweep of the selector byte 0..255 (any computed
 *           target routed to an identical catch-all stub on both sides) pinning the
 *           `base + (2*sel & 0xff)` 8-bit-wrap table math for the off-table indices; teeth =
 *           a 16-bit-offset (no 8-bit wrap) twin. Not reached in plain attract.
 * LIVE-OUT: memory-only — the dispatched arm's RAM writes. pc/SP are in the contract and
 *           identical by construction (this routine never touches SP; the oracle's push/pop
 *           of the table base nets to zero, and each arm's own first push overwrites that
 *           stack slot before it is read). The oracle discards the arm's return value at
 *           this level, so this routine returns nothing too; loc_127f's callers ignore any
 *           return. Residual A/HL/DE/flags are the trampoline's dead ABI handoff, read by
 *           no arm.
 * NAMES:    none from ram.js — the selector 0x639D is unconfirmed, so kept hex; table base
 *           0x1283 kept hex (ROM data, not work RAM).
 */

import { dispatchGameState } from "../translated/dispatchGameState.js";

// The sequence-phase selector byte (0..2 in play). Unconfirmed in ram.js, so kept hex.
const PHASE = 0x639d;

// The `rst 0x28` inline jump table: 4 little-endian target addresses in ROM starting at
// 0x1283 (0x128B, 0x12AC, 0x12DE, 0x0000), indexed by the phase. A ROM-data address, hex.
const PHASE_TABLE = 0x1283;

// The dispatch-site label handed to dispatchGameState; it only surfaces inside a
// NotImplemented throw, naming which inline table an out-of-range selector fell off of.
// Kept identical to the oracle's `m.call(0x0028, ...)` argument.
const DISPATCH_TABLE_1283 = "0x1283 (0x639D dispatch)";

export function loc_127f(m) {
  const { mem } = m;

  // ld a,(0x639d) — the animation-sequence phase index (0..2).
  const phase = mem.read8(PHASE);

  // rst 0x28: `add a,a` doubles the index to a 2-byte table offset, and it is an 8-bit
  // result — selector 0x80 wraps the offset to 0 — so the address math is
  // `base + (2*phase & 0xff)`, NOT `base + 2*phase`. Then read the little-endian target
  // word at table[phase].
  const entry = (PHASE_TABLE + ((phase * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // jp (hl) — dispatch to the phase handler. The oracle discards the arm's return value
  // at this level, so this routine does too.
  dispatchGameState(m, target, DISPATCH_TABLE_1283);
}
