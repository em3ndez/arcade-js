// SPDX-License-Identifier: GPL-3.0-only
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import { advanceInFlightEnemyAndLand } from "./advanceInFlightEnemyAndLand.js";
/**
 * seedEnemyFromDescriptorAndEnterFlight — object state-11 handler for the record based at IX. Counts down the frame timer at
 * +0x11 and returns while it is still running. On expiry it follows the record's linked pointer
 * (+0x14:+0x15) two bytes in to a descriptor type: a type outside 5..6 blanks the sprite band
 * and stops here; an in-range type seeds the object's position (+0x03..+0x06, the +0x04 byte one
 * less than the source), clears the pointer high byte, advances the state (+0x02), and falls
 * through into the state-12 in-flight mover.
 * LIVE-OUT: none — a table-dispatched handler; the whole result is in the record's memory.
 */
const TYPE_MIN = 0x05; // descriptor types below this are out of range
const TYPE_MAX = 0x07; // ... and types at/above this are too

export function seedEnemyFromDescriptorAndEnterFlight(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + 0x11] = mem8[rec + 0x11] - 1; // frame timer
  if (mem8[rec + 0x11] !== 0) return; //       still counting down

  // Follow the linked pointer; only its low byte advances (8-bit inc, no carry into the high byte).
  const hi = mem8[rec + 0x15];
  let lo = (mem8[rec + 0x14] + 2) & 0xff;
  const type = mem8[(hi << 8) | lo];
  if (type < TYPE_MIN || type >= TYPE_MAX) {
    return blankActorSpriteBand(m, rec); // out-of-range descriptor: blank the band and stop
  }

  lo = (lo + 1) & 0xff;
  mem8[rec + 0x03] = mem8[(hi << 8) | lo];
  lo = (lo + 1) & 0xff;
  mem8[rec + 0x04] = mem8[(hi << 8) | lo] - 1; // pre-decremented position byte
  lo = (lo + 1) & 0xff;
  mem8[rec + 0x05] = mem8[(hi << 8) | lo];
  lo = (lo + 1) & 0xff;
  mem8[rec + 0x06] = mem8[(hi << 8) | lo];
  mem8[rec + 0x15] = 0x00; // clear the pointer high byte
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;

  return advanceInFlightEnemyAndLand(m, rec); // fall through into the in-flight mover
}
