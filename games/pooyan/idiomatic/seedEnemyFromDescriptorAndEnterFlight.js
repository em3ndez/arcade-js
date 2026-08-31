// SPDX-License-Identifier: GPL-3.0-only
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import { advanceInFlightEnemyAndLand } from "./advanceInFlightEnemyAndLand.js";
/**
 * seedEnemyFromDescriptorAndEnterFlight — the "state 11" (0x0b) handler that hatches a spawned
 * object from a canned descriptor and launches it into flight.
 *
 * WHAT IT IS
 *   ROM 0x3e69. Grounding: [seen]. Every moving thing on the playfield — the player, the enemies
 *   that ride the ropes, thrown objects, the formation pieces — lives as a fixed 0x18-byte record
 *   in the actor arena, and each record runs its own little state machine off the state byte at
 *   record+0x02. The per-record dispatcher for the enemy-actor pool routes a record whose state is
 *   0x0b here (through the index pointer `rec`) once every frame. State 0x0b is the "waiting to
 *   hatch" slot: the object exists as a record but has not yet appeared or begun moving; it is
 *   sitting on a countdown, and when that countdown lapses this handler stamps the object's
 *   starting position out of a descriptor and hands it straight to the in-flight mover.
 *
 * ROLE IN THE MACHINE
 *   This is the one-frame transition from "armed but dormant" to "airborne". Each dormant frame it
 *   simply ticks the per-object timer down and leaves. On the frame the timer reaches zero it walks
 *   the record's linked descriptor pointer to a small spawn descriptor in memory, checks the
 *   descriptor's type is one the spawner recognizes, and — if so — copies the descriptor's four
 *   position bytes into the object's coordinate fields, marks the descriptor consumed, bumps the
 *   object into its next state, and falls straight through into the state-12 in-flight mover so the
 *   object begins travelling on the very same frame rather than waiting one more. If the descriptor
 *   type is not recognized the spawn is abandoned and the object's sprite is blanked instead.
 *
 *   The descriptor is a short byte block elsewhere in memory. The record points at it through a
 *   16-bit linked pointer split across record+0x14 (low byte) and record+0x15 (high byte). The
 *   first useful field sits two bytes into the block (past a 2-byte header): a TYPE byte, then four
 *   position bytes. Those four bytes map onto the coordinate fields the in-flight mover reads —
 *   record+0x03/+0x04 are the object's 16-bit Y (low then high) and record+0x05/+0x06 are its
 *   16-bit X (low then high).
 *
 * LIVE-OUT
 *   None a caller reads directly — this is a table-dispatched state handler and the whole result is
 *   written into the object's own record in work RAM: on the seed path the four position bytes, the
 *   cleared descriptor-pointer high byte, and the advanced state, plus whatever the state-12 mover
 *   then writes as it runs the object's first flight step. On the rejected-descriptor path the exit
 *   is whatever blankActorSpriteBand leaves. On the still-counting path only the decremented timer
 *   changed.
 */
// The recognized descriptor TYPE window is exactly {0x05, 0x06}: TYPE_MIN is the lowest accepted
// value and TYPE_MAX is the first value that is too high, so the accepted range is TYPE_MIN..TYPE_MAX
// exclusive. Any type outside it aborts the hatch.
const TYPE_MIN = 0x05; // descriptor types below this are out of range
const TYPE_MAX = 0x07; // ... and types at/above this are too

export function seedEnemyFromDescriptorAndEnterFlight(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — tick the object's per-state countdown. record+0x11 is a per-object frame timer state
  // handlers use to pace how long an object lingers in the state that owns it; here it times how
  // long the object stays dormant before it hatches. Decrement it in place.
  mem8[rec + 0x11] = mem8[rec + 0x11] - 1; // frame timer
  // While the timer has not reached zero the object is still waiting to hatch, so leave it dormant
  // and come back next frame. Nothing else happens on a waiting frame.
  if (mem8[rec + 0x11] !== 0) return; //       still counting down

  // Step 2 — the countdown lapsed: follow the record's linked descriptor pointer to the TYPE byte.
  // The pointer is 16-bit — high byte at record+0x15, low byte at record+0x14 — and the TYPE byte
  // sits two bytes into the descriptor (past its 2-byte header), so advance the pointer's low byte
  // by two. The step is deliberately an 8-bit add masked to a byte: the whole descriptor is known
  // to lie within a single 256-byte page, so the low byte alone walks it and the high byte never
  // changes (no carry propagates upward).
  // Follow the linked pointer; only its low byte advances (8-bit inc, no carry into the high byte).
  const hi = mem8[rec + 0x15];
  let lo = (mem8[rec + 0x14] + 2) & 0xff;
  const type = mem8[(hi << 8) | lo];
  // Reject a descriptor whose type is outside the recognized {0x05,0x06} window: the object cannot
  // be hatched from it, so blank its sprite band (parking the hardware sprite blank so it draws
  // nothing) and stop. Leaving through blankActorSpriteBand makes its exit state this handler's too.
  if (type < TYPE_MIN || type >= TYPE_MAX) {
    return blankActorSpriteBand(m, rec); // out-of-range descriptor: blank the band and stop
  }

  // Step 3 — copy the descriptor's four position bytes into the object's coordinate fields, walking
  // the descriptor one byte at a time (low-byte-only advances again, staying inside the page). The
  // order matches how the in-flight mover reads them back: Y low, Y high, X low, X high.
  lo = (lo + 1) & 0xff;
  mem8[rec + 0x03] = mem8[(hi << 8) | lo]; // seed the 16-bit Y low byte
  lo = (lo + 1) & 0xff;
  // The Y high byte is seeded one LESS than the descriptor value — the object starts a row above
  // where the raw descriptor points, which the flight step then walks down from.
  mem8[rec + 0x04] = mem8[(hi << 8) | lo] - 1; // pre-decremented position byte
  lo = (lo + 1) & 0xff;
  mem8[rec + 0x05] = mem8[(hi << 8) | lo]; // seed the 16-bit X low byte
  lo = (lo + 1) & 0xff;
  mem8[rec + 0x06] = mem8[(hi << 8) | lo]; // seed the 16-bit X high byte

  // Step 4 — retire the descriptor and advance the object's state. Zeroing the pointer's high byte
  // marks the descriptor consumed so the link is not followed a second time, and bumping the state
  // byte at record+0x02 moves the object from state 0x0b (hatching) into state 0x0c (in flight).
  mem8[rec + 0x15] = 0x00; // clear the pointer high byte
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;

  // Step 5 — run the in-flight mover for this same frame. The state byte now selects state 0x0c, so
  // dropping straight into advanceInFlightEnemyAndLand gives the freshly hatched object its first
  // flight step immediately instead of costing it an idle frame.
  return advanceInFlightEnemyAndLand(m, rec); // fall through into the in-flight mover
}
