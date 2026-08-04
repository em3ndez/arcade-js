// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchDeathAnimationPhase — vector Mario's DEATH ANIMATION to its current-phase handler. ROM 0x127F.
 *
 * The exact `rst 0x28` inline-jump-table idiom of the sub-state dispatchers
 * (dispatchInGameSubstate 0x06FE, dispatchCreditedSubstate 0x08B2,
 * dispatchIntroCutsceneStep 0x0A76): read a one-byte step index and vector through a
 * ROM table of little-endian target addresses to the handler for that step. Here the
 * selector is DEATH_ANIM_PHASE (0x639D) and the 4-entry table lives at ROM 0x1283:
 *   0 -> 0x128B  — seed the animation: rewrite Mario's sprite-code byte 0x694D to tile
 *                  0x78 (old bit 7 kept), prime DEATH_ANIM_TICKS_LEFT (0x639E) = 0x0D,
 *                  advance DEATH_ANIM_PHASE, re-arm the SUBSTATE_TIMER (0x6009) tick gate
 *                  to 8, clear sprite runs, and fire the death sound line (0x6088).
 *   1 -> 0x12AC  — each expiry of the 8-frame SUBSTATE_TIMER gate: decrement
 *                  DEATH_ANIM_TICKS_LEFT (0x639E) and step Mario's sprite through its four
 *                  orientations (0x694D/0x694E); when DEATH_ANIM_TICKS_LEFT reaches 0,
 *                  settle the sprite on tile 0x7A, advance DEATH_ANIM_PHASE 1 -> 2 and
 *                  re-arm the gate long (0x80 ticks).
 *   2 -> 0x12DE  — advance the game sub-state GAME_SUBSTATE (0x600A) (by 2 for player 2,
 *                  1 for player 1) and set the gate to fire next frame — i.e. hand off to
 *                  the life-loss handler that follows (0x0E -> 0x12F2, 0x0F -> 0x1344).
 *   3 -> 0x0000  — table PADDING, not an arm. DEATH_ANIM_PHASE has exactly three writers in
 *                  the whole ROM (inc @0x1298, inc @0x12D7, the 0x6280-0x6AFF block clear
 *                  @0x0F69) and none of them can produce 3, so slot 3 is STRUCTURALLY
 *                  unreachable — it is not described here because there is nothing to
 *                  describe. The selector is NOT range-checked (as in the 0x0702 / 0x08B6
 *                  tables), so a corrupt out-of-range phase would vector to 0x0000 / off the
 *                  table, which the still-oracle loc_00ca surfaces as a loud NotImplemented
 *                  throw rather than a silent reset — same as the oracle.
 *
 * REACHABILITY — CORRECTED (pass 13; the previous "Not reached in plain attract" was FALSE).
 * This dispatch IS reached with zero coins, zero inputs and zero pokes: the attract demo ENDS
 * BY KILLING ITS OWN MARIO, so a pure-attract MAME run drives the whole cluster 9 times in
 * 400 s, with the 0x639D/0x639E write taps first firing at frame 2719; and 0x127F is fetched
 * 1:1 with 0x127C (3256 / 3256 in a credited run), because this router IS the whole body of
 * its caller. It is reached in credited play too, as in-game sub-state 0x0D (3 episodes per 1P
 * game, 6 per 2P game). The old claim also contradicted its own caller's GATE note of 888 real
 * captured 0x127C attract dispatches covering DEATH_ANIM_PHASE {0,1,2}.
 *
 * Reached from runDeathAnimationSubstate (0x127C), which is entry 4 of the game-state-1 sub-state table
 * at ROM 0x0748 (handler_073c) AND entry 0x0D of the credited-game table at ROM 0x0702:
 * runDeathAnimationSubstate calls sub_1dbd and falls straight through into this dispatch.
 *
 * The oracle expresses the vector as `ld a,(0x639d)` then `rst 0x28`, whose shared
 * trampoline (sub_0028 / dispatchInlineJumpTable) recovers the inline table base off the
 * stack, reads the little-endian word at table[selector], and `jp (hl)`s to it. Here that
 * trampoline is folded in directly: the table base is the compile-time constant 0x1283,
 * so the whole mechanism is `read table[phase] from ROM, dispatch`. The dispatch itself is
 * genuine computed control flow into a ROM table of targets, so it routes through the
 * still-oracle generic dispatcher loc_00ca — the one address registry doc-06
 * keeps — rather than a local JS function table. The trampoline's register/flag handoff
 * (A = 2*phase, HL = target, DE, flags) is NOT reproduced: it is dead to every arm (each
 * arm's first act is a `rst 0x18` gate check that then reloads HL, reading none of it —
 * verified statically, and the full-handler replay in the gate confirms it), so folding it
 * away is memory-equivalent.
 *
 * NAME — GROUNDED, and corroborated from OUTSIDE this routine (R5). Live MAME 0.288 on the
 * real dkong ROM (scratchpad/pass13-grounding.md §2): 136,367 logged frames, positive control
 * ≈1 NMI fetch per frame, 44 episodes. Every completed episode is byte-identical — phase run
 * [0, 1, 2], count run [13 … 0], 13 gate ticks of 8 frames, 296 frames end to end. The outside
 * evidence for calling it DEATH: names.js carries both cells at [seen] (DEATH_ANIM_PHASE 0x639D,
 * DEATH_ANIM_TICKS_LEFT 0x639E); the 0x0702 table places the caller at sub-state 0x0D, between
 * gameplay (0x0C) and the life-loss handlers (0x0E / 0x0F), where 15 observed deaths produced
 * 15 LIVES (0x6228) decrements and none came from elsewhere; and the sound line arm 0 fires
 * (SND_IRQ_TRIGGER 0x6088, ROM 0x12A8) is MAME's own "dead" line (dkong.cpp:202), traced in
 * games/dkong/audio/README.md at exactly one rise per life. ★ NEGATIVE CONTROL: 42,275 frames
 * of ordinary play with both cells 0 on every frame; 0x639E never transitions in any of the
 * 87,142 non-cluster frames.
 * WHAT THE NAME DOES NOT CLAIM. It does not claim a CAUSE — "runs when something kills Mario"
 * is false on a reachable path: the bonus-timer-expiry death enters the same sequence with
 * MARIO_ACTIVE (0x6200) still 1 (ROM 0x1A2A jumps into the middle of the same instructions at
 * 0x19D2, stepping over the MARIO_ACTIVE test). It does not claim this router does anything
 * itself beyond vectoring — the animation is entirely its three arms'. It does not claim to
 * take the life: that is the following sub-state (0x12F2 / 0x1344). And it makes no pixel
 * claim; pass 13 ran `-video none`, so the evidence is RAM bytes and opcode fetches only.
 *
 * Memory-equivalent to the frozen oracle — equivalence-127f.test.js.
 * GATE:     crafted-entry — a real attract-run machine with the phase 0x639D poked to each
 *           reachable arm (0,1,2) and the tick gate opened, the FULL oracle handler run on
 *           BOTH sides (so a wrong target or a live register/flag handoff would surface as
 *           divergent RAM), + an EXHAUSTIVE sweep of the selector byte 0..255 (any computed
 *           target routed to an identical catch-all stub on both sides) pinning the
 *           `base + (2*sel & 0xff)` 8-bit-wrap table math for the off-table indices; teeth =
 *           a 16-bit-offset (no 8-bit wrap) twin. COVERAGE HOLE, stated plainly (R17): this
 *           entry IS reached naturally (see REACHABILITY above), so real captures ARE
 *           available — this gate simply does not replay them; every case is a crafted
 *           selector on a real base. Adding a captured-dispatch case is open work, not a
 *           claim already met.
 * LIVE-OUT: memory-only — the dispatched arm's RAM writes. pc/SP are in the contract and
 *           identical by construction (this routine never touches SP; the oracle's push/pop
 *           of the table base nets to zero, and each arm's own first push overwrites that
 *           stack slot before it is read). The oracle discards the arm's return value at
 *           this level, so this routine returns nothing too; dispatchDeathAnimationPhase's callers ignore any
 *           return. Residual A/HL/DE/flags are the trampoline's dead ABI handoff, read by
 *           no arm.
 * NAMES:    DEATH_ANIM_PHASE (0x639D) from names.js is the selector; DEATH_ANIM_TICKS_LEFT (0x639E) the
 *           ticks-remaining counter the arms step (both [seen] in names.js). Table base 0x1283
 *           kept hex (ROM data, not work RAM).
 */

import { loc_00ca } from "../translated/loc_00ca.js";
import { DEATH_ANIM_PHASE } from "./names.js";

// The `rst 0x28` inline jump table: 4 little-endian target addresses in ROM starting at
// 0x1283 (0x128B, 0x12AC, 0x12DE, 0x0000), indexed by the phase. A ROM-data address, hex.
const PHASE_TABLE = 0x1283;

// The dispatch-site label handed to loc_00ca; it only surfaces inside a
// NotImplemented throw, naming which inline table an out-of-range selector fell off of.
// Kept identical to the oracle's `m.call(0x0028, ...)` argument.
const DISPATCH_TABLE_1283 = "0x1283 (0x639D dispatch)";

export function dispatchDeathAnimationPhase(m) {
  const { mem } = m;

  // ld a,(0x639d) — the death-animation phase index. Observed values are {0,1,2} only.
  const phase = mem.read8(DEATH_ANIM_PHASE);

  // rst 0x28: `add a,a` doubles the index to a 2-byte table offset, and it is an 8-bit
  // result — selector 0x80 wraps the offset to 0 — so the address math is
  // `base + (2*phase & 0xff)`, NOT `base + 2*phase`. Then read the little-endian target
  // word at table[phase].
  const entry = (PHASE_TABLE + ((phase * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // jp (hl) — dispatch to the phase handler. The oracle discards the arm's return value
  // at this level, so this routine does too.
  loc_00ca(m, target, DISPATCH_TABLE_1283);
}
