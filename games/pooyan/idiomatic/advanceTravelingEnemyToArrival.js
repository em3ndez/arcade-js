// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advanceEnemyVerticalAndDispatchByAltitude } from "./advanceEnemyVerticalAndDispatchByAltitude.js";
import { fireEnemyShotWhenAlignedWithPlayer } from "./fireEnemyShotWhenAlignedWithPlayer.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_TABLE_3829 } from "./names.js";
/**
 * advanceTravelingEnemyToArrival — horizontal-travel phase of an enemy actor whose (+8) bit0 is clear.
 *
 * WHAT IT IS
 *   One per-frame state handler for a single enemy actor record. An actor is a 0x18-byte record in the
 *   enemy actor table; this routine is entered with `rec` pointing at that record. It runs while the
 *   actor is sliding along its lane toward "arrival" (the point where it reaches its destination row and
 *   either lands quietly or is retired with a flourish). Motion is stored as a two-byte fixed-point
 *   position — a sub-position fraction in (+3) and an integer position in (+4) — that a per-record
 *   velocity (+0x0a) drives forward one frame at a time.
 *
 * ROLE IN THE MACHINE
 *   Enemies released into a wave walk themselves to arrival through a small family of movers. Which mover
 *   runs is chosen by the actor's mode flags: with (+8) bit0 CLEAR the actor is in this horizontal-travel
 *   phase; with bit0 SET it belongs to the vertical mover instead, so this routine's first act is to hand
 *   such an actor off. The travel behaviour then forks on the actor's phase byte (+7): phase 0 is a quiet
 *   "land" (blank the sprite once the actor is deep enough into the lane), while a nonzero phase runs the
 *   full travel-to-retire — firing at the player each frame it is still moving, then formally retiring the
 *   actor once it reaches the far row.
 *
 *   ROM 0x3b87.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT: none — every path either returns or tail-delegates to another mover; all lasting effect is
 *   written into the actor record at `rec` (its position, phase, flags, timer, and animation pointer).
 */
export function advanceTravelingEnemyToArrival(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // MODE SPLIT — mode-flags byte (+8) bit0 selects the mover for this actor. Bit0 SET means the actor is
  // travelling vertically, not horizontally, so this handler is the wrong one: hand the whole frame to the
  // vertical mover (ROM 0x39ba) and take its return. Bit0 CLEAR (fall through) is the horizontal-travel
  // case this routine handles.
  if (mem8[rec + 0x08] & 0x01) return advanceEnemyVerticalAndDispatchByAltitude(m, rec); // bit0 set -> vertical mover

  // ADVANCE POSITION — the actor's location along its lane is a fixed-point value split across two bytes:
  // sub-position fraction (+3) plus integer position (+4). Add the per-record velocity (+0x0a) to the
  // fraction; a sum past 0xff is a fractional overflow that carries one step up into the integer position
  // (+4). Store the low 8 bits back into the fraction. This is the single unit of motion for the frame.
  const sum = mem8[rec + 0x03] + mem8[rec + 0x0a];
  if (sum > 0xff) mem8[rec + 0x04] = u8(mem8[rec + 0x04] + 1); // carry into the integer position
  mem8[rec + 0x03] = u8(sum);

  // ARRIVAL TEST — the integer position (+4) is how far along the lane the actor now sits; it is compared
  // against fixed row thresholds below. Read it once into a local.
  const posHigh = mem8[rec + 0x04];

  // PHASE 0: QUIET LAND — phase byte (+7) == 0 marks an actor that simply settles when it gets deep enough.
  // Once the integer position reaches 0x1b (the landing row), blank the actor's on-screen sprite band
  // (ROM 0x3553) so it disappears; before 0x1b it just keeps sliding. Either way phase 0 is done for the
  // frame, so return without touching state or firing.
  if (mem8[rec + 0x07] === 0) {
    if (posHigh >= 0x1b) blankActorSpriteBand(m, rec); // landed -> blank the band
    return;
  }

  // PHASE nonzero, STILL TRAVELLING — an actor with a nonzero phase byte runs the full travel-to-retire
  // arc. Until the integer position reaches the retire row 0x1d it is still an active threat: hand the
  // frame to the enemy fire routine (ROM 0x39e0), which decides whether to loose a shot at the player when
  // the actor lines up with the player's column, and take its return.
  if (posHigh < 0x1d) return fireEnemyShotWhenAlignedWithPlayer(m, rec); // still travelling

  // RETIRE — the integer position has reached 0x1d, the end of this actor's travel. Formally close it out:
  //   (+2) — advance the actor's state index to the next state in its lifecycle.
  //   (+0) — clear the leading/active byte to 0.
  //   (+1) — set the secondary flag byte to 1 (marks the record entering its retire state).
  //   (+8) — clear the travel/mode bit0 so the actor is no longer treated as travelling.
  //   (+9) — arm the hold timer to 0x20 frames for the retire sequence.
  //   (+0x14) — clear the auxiliary field.
  // Then point the record at the four-frame retire animation ANIM_TABLE_3829 (ROM 0x3829) and restart it
  // via setActorAnimation (ROM 0x381e); that call's return is this routine's return (tail).
  mem8[rec + 0x02] = u8(mem8[rec + 0x02] + 1); // retire: advance to the next state
  mem8[rec + 0x00] = 0x00;
  mem8[rec + 0x01] = 0x01;
  mem8[rec + 0x08] &= ~1; // clear the travel bit
  mem8[rec + 0x09] = 0x20;
  mem8[rec + 0x14] = 0x00;
  return setActorAnimation(m, rec, ANIM_TABLE_3829); // queue the retire animation (tail)
}
