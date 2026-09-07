// SPDX-License-Identifier: GPL-3.0-only
// flagObjectHitOnPlayer — proximity-test one diving object against the player ship.
//
// WHAT IT IS
//   The per-object leaf of the object-vs-player collision sweep. For an active object at IX it biases
//   the object's field (record+3) to pick one of two proximity windows — a near window and a wider far
//   window — then checks the player reference minus the object's coordinate against that window's band.
//   Land inside the band and it raises the player-death event and awards the kill; outside every window,
//   or when the biased field is past the far window, it does nothing.
//
// ROLE IN THE MACHINE
//   This is the "object vs player" hazard leaf driven by flagObjectHitsOnPlayer (0x129e). Rather than a
//   plain box, it classifies each object into a near/far proximity tier and applies a different tolerance
//   band per tier — so an object that is nominally "closer" (small biased field) collides only within a
//   tight window, while a farther tier is granted a wider one (see mechanisms.md "Collisions and the hit
//   response"). A collision raises HIT_EVENT_FLAG (0x4204), consumed by handlePlayerHitEvent (0x12ed) as
//   the player's death, then tail-calls the shared kill handler. The u8() wraps are the Z80 unsigned
//   window idiom: in band when (delta + margin) taken mod 256 is below the band width.
//
// ROM 0x12b6.  Grounding: [seen].
//
// LIVE-OUT: on a hit, HIT_EVENT_FLAG = 1 and the object scored/deactivated via
// awardKillScoreByBandAndDeactivate (whose return value is forwarded); otherwise no state changes.
import { u8 } from "../../../core/int.js";
import { awardKillScoreByBandAndDeactivate } from "./awardKillScoreByBandAndDeactivate.js";
import { loc_4202, HIT_EVENT_FLAG } from "./names.js";

const CLASS_BIAS = 33;    // bias the field before windowing
const LOW_WINDOW = 5;     // biased field below this -> low window
const HIGH_WINDOW = 17;   // below this (and >= LOW_WINDOW) -> high window; at/above -> out of range
const LOW_MARGIN = 7;
const LOW_BAND = 15;
const HIGH_MARGIN = 10;
const HIGH_BAND = 21;

export function flagObjectHitOnPlayer(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Skip records that are not live: record+0 bit0 is the object's active flag.
  if ((mem8[obj] & 1) === 0) return; // inactive object

  // Classify the object: bias its field (record+3) by 0x21 to select which proximity window applies.
  const band = u8(mem8[obj + 3] + CLASS_BIAS);
  // Signed distance of the object's coordinate (record+4) from the player reference at loc_4202.
  const delta = u8(mem8[loc_4202] - mem8[obj + 4]);

  // Low (near) window: tight tolerance — reject unless delta sits within the 15-wide band (margin 7).
  if (band < LOW_WINDOW) {
    if (u8(delta + LOW_MARGIN) >= LOW_BAND) return;
  // High (far) window: wider tolerance — reject unless delta sits within the 21-wide band (margin 10).
  } else if (band < HIGH_WINDOW) {
    if (u8(delta + HIGH_MARGIN) >= HIGH_BAND) return;
  // Biased field past the far window: the object is out of collision range entirely.
  } else {
    return;
  }

  // Inside the selected band: raise the player-death event and hand off to the shared kill handler.
  mem8[HIT_EVENT_FLAG] = 1;
  return awardKillScoreByBandAndDeactivate(m, obj);
}
