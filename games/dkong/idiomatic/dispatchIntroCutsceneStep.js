// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchIntroCutsceneStep — vector the opening Kong-climb cutscene to its current step handler. ROM 0x0A76.
 *
 * The opening Kong-climb cutscene is in-game sub-state 7 (GAME_SUBSTATE 0x600A == 7):
 * the short animated intro that plays at the head of every board before gameplay
 * begins. dispatchInGameSubstate (0x06FE, game-state 3) reaches this routine once per
 * frame while that sub-state is active — it is entry 7 of the 0x0702 table. This
 * routine is the cutscene's own per-frame dispatcher: it reads the cutscene STEP index
 * INTRO_STEP (0x6385) and vectors through the 8-entry inline jump table in ROM at
 * 0x0A7A to the handler for that step:
 *   0 -> 0x0A8A  — seed the cutscene's walk/animation pointers.
 *   1 -> 0x0ABF  — advance Kong's climb.
 *   2 -> 0x0AE8  — advance Kong's climb (re-points SEQ_ADVANCE_PTR 0x63C0 at INTRO_STEP).
 *   3 -> 0x3069  — the shared gated tick (loc_3069): once the sub-state timer 0x6009
 *                  expires, `inc` the byte SEQ_ADVANCE_PTR points at (INTRO_STEP) — i.e.
 *                  a metered pause that bumps the step to the next frame's arm.
 *   4 -> 0x0B06  — next cutscene beat (re-points SEQ_ADVANCE_PTR at INTRO_STEP).
 *   5 -> 0x3069  — the same gated tick / metered pause as step 3.
 *   6 -> 0x0B68  — next cutscene beat.
 *   7 -> 0x0BB3  — final beat; fires the Kong roar (priority audio SND_PRIORITY 0x608A = 0x0F).
 * INTRO_STEP walks 0 -> 1 -> ... -> 7 over the cutscene; each arm is a short
 * cutscene-setup step that typically advances the step for the next frame (directly, or
 * via the gated tick). None is the interruptible per-frame gameplay loop — that is a
 * different 0x0702 arm, one dispatch level up.
 *
 * This is the exact sibling of dispatchInGameSubstate (0x06FE) and dispatchCreditedSubstate
 * (0x08B2): the same `ld a,(addr)` / `rst 0x28` idiom, only the selector byte (INTRO_STEP
 * 0x6385 here, vs GAME_SUBSTATE 0x600A) and the table base (0x0A7A vs 0x0702 / 0x08B6)
 * differ. The oracle expresses the vector through the shared `rst 0x28` trampoline (sub_0028
 * / dispatchInlineJumpTable), which recovers the inline table base off the stack, reads the
 * little-endian word at table[selector], and `jp (hl)`s to it. Here that trampoline is folded
 * in directly: the table base is the compile-time constant 0x0A7A, so the whole mechanism is
 * `read table[step] from ROM, dispatch`. The dispatch itself is genuine computed control flow
 * into a ROM table of targets, so it routes through the still-oracle generic dispatcher
 * dispatchGameState — the one address registry doc-06 keeps — rather than a local JS function
 * table. The trampoline's register/flag handoff (A = 2*step, HL = target, DE, flags) is NOT
 * reproduced: it is dead to every arm (the full-handler replay in the gate confirms it), so
 * folding it away is memory-equivalent.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0a76.test.js.
 * GATE:     crafted-entry — real captured cutscene dispatches from a driven coin+start run
 *           (fresh clone each, the full oracle handler run on BOTH sides so a wrong target or
 *           a live handoff would surface as divergent RAM), covering all 8 steps 0..7 the run
 *           naturally reaches, + an EXHAUSTIVE sweep of the selector byte 0..255 (routed to an
 *           identical catch-all stub on both sides) pinning the `base + (2*sel & 0xff)` 8-bit-
 *           wrap table math for the off-table indices the run never reaches; teeth = a 16-bit-
 *           offset (no 8-bit wrap) twin. Reached only in a credited game during the opening
 *           cutscene (GAME_STATE 3, GAME_SUBSTATE == 7); never in plain attract (0 dispatches
 *           over 2000 attract frames).
 * LIVE-OUT: memory-only — the step handler's RAM writes. pc/SP are in the contract and
 *           identical by construction (this routine never touches SP; the oracle's push/pop of
 *           the table base nets to zero, and from dispatchGameState onward both sides run the
 *           identical arm). The oracle discards the arm's return value at this level, so this
 *           routine returns nothing too; loc_0a76's own callers ignore any return. Residual
 *           A/HL/DE/flags are the trampoline's dead ABI handoff, read by no arm.
 * NAMES:    INTRO_STEP (0x6385) from ram.js; table base 0x0A7A kept hex (ROM data, not work RAM).
 */

import { INTRO_STEP } from "../optimized/ram.js";
import { dispatchGameState } from "../translated/dispatchGameState.js";

// The `rst 0x28` inline jump table: 8 little-endian target addresses in ROM starting at
// 0x0A7A, indexed by INTRO_STEP. A ROM-data address, so kept hex.
const INTRO_STEP_TABLE = 0x0a7a;

// The dispatch-site label handed to dispatchGameState; it only ever surfaces inside a
// NotImplemented throw, naming which inline table an out-of-range selector fell off of.
// Kept identical to the oracle's site string (loc_0a76's `m.call(0x0028, ...)` argument).
const DISPATCH_TABLE_0A7A = "0x0A7A (0x6385 sequence)";

export function dispatchIntroCutsceneStep(m) {
  const { mem } = m;

  // ld a,(0x6385) — the opening-cutscene step index (0..7).
  const step = mem.read8(INTRO_STEP);

  // rst 0x28: `add a,a` doubles the index to a 2-byte table offset, and it is an 8-bit
  // result — selector 0x80 wraps the offset to 0 — so the address math is
  // `base + (2*step & 0xff)`, NOT `base + 2*step`. Then read the little-endian target
  // word at table[step].
  const entry = (INTRO_STEP_TABLE + ((step * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // jp (hl) — dispatch to the step handler. The oracle discards the arm's return value
  // at this level, so this routine does too.
  dispatchGameState(m, target, DISPATCH_TABLE_0A7A);
}
