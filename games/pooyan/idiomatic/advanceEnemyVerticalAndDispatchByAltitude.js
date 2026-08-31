// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { fireEnemyShotWhenAlignedWithPlayer } from "./fireEnemyShotWhenAlignedWithPlayer.js";
import { resetActorSubstateAndReloadStateTimer } from "./resetActorSubstateAndReloadStateTimer.js";
import { armActorDropAnimationNearTop } from "./armActorDropAnimationNearTop.js";

/**
 * advanceEnemyVerticalAndDispatchByAltitude — step an enemy actor one frame along its vertical
 * velocity, then decide what that enemy does next from how high it now sits.
 *
 * WHAT IT IS
 * ----------
 * Every moving enemy on the field is tracked by an ACTOR RECORD — a fixed-layout block of bytes
 * in work RAM, addressed here through `rec`. This routine reads and writes five of its fields:
 *   +0x03  the LOW (fractional / sub-cell) byte of the enemy's 16-bit vertical position,
 *   +0x04  the HIGH byte of that position — the coarse on-screen Y, and the value every altitude
 *          test below reads,
 *   +0x07  an animation-variant / facing flag: zero for an enemy on its plain climb, nonzero once
 *          it has been routed onto a variant behaviour,
 *   +0x0a  the enemy's signed vertical velocity — the negation of the facing byte at +0x09,
 *          seeded at spawn from a round-keyed lookup,
 * and, through the tails it may hand off to, the sub-state (+0x02), the phase timer (+0x11) and
 * the animation fields (+0x0c..+0x0e).
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is the vertical-motion body of one enemy-actor state handler, reached from the enemy-actor
 * motion handler on the frames where that handler acts. It does two things in sequence.
 *
 * First it INTEGRATES the position: it adds the signed velocity into the {high:low} pair,
 * borrowing one from the high byte when the low byte underflows — so the enemy glides at sub-cell
 * resolution while the high byte tracks the whole-cell Y.
 *
 * Then it DISPATCHES on that fresh high byte. The high byte shrinks toward zero as the enemy
 * rises, so a small value means the enemy is near the top of its travel:
 *   - if the actor is still on its ordinary climb (flag +0x07 == 0) it hands off to the
 *     arrive-at-top step, which turns the enemy over into its drop once it reaches the ceiling;
 *   - otherwise a high byte below 0x04 (right at the top) restarts the actor's state machine;
 *   - a high byte still below 0x10 means it is coasting mid-travel, so nothing happens this frame;
 *   - at or below 0x10 it runs the fire/drop gate, where a descended enemy may loose a shot at
 *     the player when its column lines up.
 *
 * ROM 0x39ba. Grounding: [seen].
 *
 * LIVE-OUT: memory only — the actor record at `rec`. This body always rewrites the position (the
 * low byte +0x03, and the high byte +0x04 on a borrow); every exit then either returns or tail-
 * delegates, and any further effect lands in the same record through that delegate.
 */
export function advanceEnemyVerticalAndDispatchByAltitude(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- Integrate the vertical position (ROM 0x39ba-0x39ce) ---
  // (+0x0a) is the enemy's signed vertical velocity: the negation of the facing byte at +0x09.
  // The position is a 16-bit value split across (+0x03) low and (+0x04) high; advancing it means
  // adding the velocity into that pair. Because the velocity field is stored negated, the add can
  // only ever borrow DOWN out of the low byte — never carry up — so the high byte is decremented
  // exactly when the low byte would underflow, i.e. when the low byte is smaller than the borrow
  // amount (-velocity, taken as an unsigned byte).
  const vel = mem8[rec + 0x0a];
  const posLow = mem8[rec + 0x03];
  if (posLow < u8(-vel)) mem8[rec + 0x04] = u8(mem8[rec + 0x04] - 1); // borrow into the high byte
  // Commit the advanced low byte: the sub-cell position slides by the velocity, wrapping mod 256
  // as the high byte above absorbs any borrow.
  mem8[rec + 0x03] = u8(posLow + vel);

  // --- Dispatch on the new altitude (ROM 0x39cf-0x39e0) ---
  // Read back the high byte just settled above: this is the coarse on-screen Y and the altitude
  // the branches below gate on. It decreases as the enemy climbs, so a small value = near the top.
  const posHigh = mem8[rec + 0x04];

  // Flag (+0x07) zero (ROM 0x39d2/0x39d6) = an enemy on its plain climb. Hand it to the
  // arrive-at-top step, which keeps it climbing until the high byte reaches the ceiling and then
  // turns it over into its drop; `posHigh` is passed through as the altitude that step gates on.
  if (mem8[rec + 0x07] === 0) return armActorDropAnimationNearTop(m, posHigh, rec);

  // Right at the top — high byte below 0x04 (ROM 0x39d9/0x39db) — restart this actor's state
  // machine: sub-state back to its first value and the state timer reloaded for a fresh dwell.
  if (posHigh < 0x04) return resetActorSubstateAndReloadStateTimer(m, rec);

  // Still high on the screen — high byte below 0x10 (ROM 0x39dd/0x39df) — but past the reset
  // band: the enemy is coasting mid-travel, so there is nothing to do for it this frame.
  if (posHigh < 0x10) return;

  // Descended to 0x10 or below: run the fire/drop gate. There the level counters decide whether
  // this enemy may act, and in the shared tail it spawns a shot when its derived target column
  // lines up with the player.
  return fireEnemyShotWhenAlignedWithPlayer(m, rec);
}
