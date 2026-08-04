// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchDeathAnimationPhase — vector Mario's DEATH ANIMATION to its current-phase
 * handler.
 *
 * The one-byte selector DEATH_ANIM_PHASE indexes a 4-entry table of little-endian
 * target addresses, and control vectors to that phase's handler:
 *   0 — seed the animation: rewrite Mario's sprite-code byte to the first death tile
 *       (keeping its old high bit), prime the ticks-remaining counter to 13, advance
 *       the phase, re-arm the frame gate to 8, clear the sprite runs, and fire the
 *       death sound line.
 *   1 — on each expiry of the 8-frame gate: decrement the ticks-remaining counter and
 *       step Mario's sprite through its four orientations; when the counter reaches 0,
 *       settle the sprite on its final tile, advance the phase 1 -> 2 and re-arm the
 *       gate long (0x80 ticks).
 *   2 — advance the game sub-state (by 2 for player 2, 1 for player 1) and set the
 *       gate to fire next frame — i.e. hand off to the life-loss handler that follows.
 *   3 — table PADDING, not an arm. DEATH_ANIM_PHASE has exactly three writers and none
 *       of them can produce 3, so slot 3 is STRUCTURALLY unreachable; there is nothing
 *       to describe. The selector is NOT range-checked, so a corrupt out-of-range
 *       phase vectors off the table, which the generic dispatcher surfaces as a loud
 *       throw rather than a silent reset.
 *
 * THE TABLE MATH IS 8-BIT. The selector is doubled into a 2-byte table offset and that
 * doubling wraps in a byte — selector 0x80 gives offset 0 — so the address is
 * `base + (2*phase & 0xff)`, NOT `base + 2*phase`.
 *
 * WHAT THE DEATH READING RESTS ON. Every completed episode is byte-identical: the
 * phase runs [0, 1, 2], the counter runs 13 down to 0, 13 gate ticks of 8 frames, 296
 * frames end to end. The sound line arm 0 fires is the hardware's "dead" line, one
 * rise per life; and the sub-state this cluster occupies sits between gameplay and the
 * life-loss handlers, where every observed death produced exactly one life decrement
 * and none came from anywhere else.
 *
 * WHAT THE NAME DOES NOT CLAIM. It does not claim a CAUSE — "runs when something kills
 * Mario" is false on a reachable path: the bonus-timer-expiry death enters the same
 * sequence with MARIO_ACTIVE still set, by jumping into the middle of the same
 * instructions and stepping over the active test. It does not claim this router does
 * anything itself beyond vectoring — the animation is entirely its three arms'. It
 * does not claim to take the life: that is the following sub-state. And it makes no
 * pixel claim; the evidence behind it is RAM bytes and opcode fetches only.
 *
 * LIVE-OUT: memory-only — the dispatched arm's RAM writes. The vector's own
 * register/flag handoff is NOT reproduced: it is dead to every arm, each of which
 * opens with a frame-gate check that reloads what it needs.
 */

import { loc_00ca } from "../translated/loc_00ca.js";
import { DEATH_ANIM_PHASE } from "./names.js";

// The inline jump table: 4 little-endian target addresses, indexed by the phase.
const PHASE_TABLE = 0x1283;

// The dispatch-site label handed down to the generic dispatcher; it only surfaces
// inside a NotImplemented throw, naming which inline table an out-of-range selector
// fell off of.
const DISPATCH_TABLE_1283 = "0x1283 (0x639D dispatch)";

export function dispatchDeathAnimationPhase(m) {
  const { mem } = m;

  // The death-animation phase index. Observed values are {0,1,2} only.
  const phase = mem.read8(DEATH_ANIM_PHASE);

  // Doubling the index gives a 2-byte table offset, and the doubling is an 8-bit
  // result — selector 0x80 wraps the offset to 0 — so the address math is
  // `base + (2*phase & 0xff)`, NOT `base + 2*phase`. Then read the little-endian
  // target word at table[phase].
  const entry = (PHASE_TABLE + ((phase * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // Dispatch to the phase handler. The arm's return value is discarded at this level,
  // so this routine returns nothing.
  loc_00ca(m, target, DISPATCH_TABLE_1283);
}
