// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1bec — advance the airborne player one frame along his arc, then run the airborne
 *            handler on the result.  ROM 0x1BEC.
 *
 * The two-instruction join point at the bottom of the airborne movement block. Both of the
 * block's horizontal-clamp arms end here, and both arrive with the actor record pointer on
 * Mario's actor record — the block whose first byte is MARIO_ACTIVE — as every captured real
 * dispatch does (see the gate note). The routine steps that record's ballistic state one frame
 * — coordinate A drifts at constant velocity, coordinate B takes its velocity plus the ramping
 * gravity term, and the airborne-frame counter is bumped — and then hands the frame straight
 * to the airborne handler at ROM 0x1C05, which decides from the freshly-stepped position
 * whether Mario has landed, whether the fall has become lethal, and when to arm the
 * fall-height check.
 *
 * It is reached only when the block above it has just clamped Mario's horizontal drift at a
 * screen edge (or in the upper-left region of an odd-numbered board), so this is the
 * "bounced off the boundary — now finish the frame normally" path rather than the ordinary
 * airborne frame, which jumps to 0x1C05 directly and never comes through here.
 *
 * Writes no memory of its own: everything it changes is written by the ballistic step (five
 * record bytes) or by the handler it hands off to.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1bec.test.js.
 * GATE:     real captured dispatches + crafted entries, and the honest reachability note is
 *           that PLAIN ATTRACT NEVER REACHES IT — 0 dispatches over 2000 attract frames,
 *           because the demo only ever jumps mid-girder, where the position gate at ROM
 *           0x241F answers "not at a boundary" and the block above tail-jumps past this
 *           routine. It IS reached in a real credited game: the gate coins in, starts a
 *           1-player game, pokes only Mario's starting spot, and lets the game's own engine
 *           carry him airborne into the boundary region — 57 real dispatches across three
 *           spots (upper-left, far-left, far-right), each replayed oracle-vs-candidate. On
 *           top of that a crafted sweep over 1085 position/phase combinations built from a
 *           real captured state covers the handler exits attract cannot supply, including
 *           the landing exit. Teeth: a dropped-step twin, an order-swapped twin and a
 *           wrong-tail-target twin — the last two baited on the counter-driven arm, because
 *           in the phase every real dispatch arrives in the handler branches away before it
 *           reads anything the step touched, which makes an order swap genuinely invisible
 *           there (measured, not assumed).
 * LIVE-OUT: memory + pc + SP + the propagated return value. The whole 0x1C05 tail runs on
 *           both sides, so it also settles the ballistic step's register live-out for free:
 *           any register the handler chain actually consumes would show up as a memory
 *           difference, and none does. The callers (the clamp block, then the movement state
 *           machine above it) consume no register this leaves, and the chain nets exactly one
 *           caller-return — so pc and SP land identically without any modelling fixup.
 * NAMES:    none — the routine names no memory cell; it holds no address of its own, and the
 *           record fields it steps are reached through the caller's record pointer inside
 *           stepBallisticMotion.
 */

import { stepBallisticMotion } from "./stepBallisticMotion.js"; // ROM 0x239C

/**
 * @param {object} m  the machine. The actor record pointer is a live-in the caller sets
 *                    (always Mario's record in every observed dispatch).
 * @returns {*} whatever the airborne handler chain returns — undefined on every observed
 *              dispatch; propagated so a caller-skip further down cannot be swallowed here.
 */
export function loc_1bec(m) {
  // One frame of ballistic motion on the caller's actor record.
  stepBallisticMotion(m);

  // Hand the stepped frame to the airborne handler (still the frozen oracle).
  return m.call(0x1c05);
}
