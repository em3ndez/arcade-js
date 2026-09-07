// SPDX-License-Identifier: GPL-3.0-only
// flagPlayerShotHitOnObject — box-test one diving object against the player's shot.
//
// WHAT IT IS
//   The per-object leaf of the player-shot-vs-divers sweep. For an active object record at IX it
//   box-tests the object's (x,y) against the shot reference position; if the object sits inside a
//   6-wide by 12-tall window around the shot it raises the shot-retire flag and tail-calls the shared
//   kill handler to score and deactivate the object. Inactive or out-of-box records do nothing.
//
// ROLE IN THE MACHINE
//   Sibling of flagPlayerShotHitOnFormation (0x0b0b): that one handles the standing wall in grid space,
//   this one handles the loose divers by walking their object records (see mechanisms.md "Collisions
//   and the hit response"). The shot reference position lives at loc_4209 (X) / loc_420a (Y); an object
//   keeps its X at record+3 and Y at record+4, and record+0 bit0 is its active flag. A hit sets the
//   shot-retire flag loc_420b, then awardKillScoreByBandAndDeactivate (0x125e) deactivates the object
//   and enqueues its score-add. The two u8() wraps implement the Z80 unsigned-window idiom: a value is
//   in band exactly when (entry - ref + bias) taken mod 256 lands in [0, window).
//
// ROM 0x123f.  Grounding: [seen].
//
// LIVE-OUT: on a hit, loc_420b = 1 and the object scored/deactivated via
// awardKillScoreByBandAndDeactivate (whose return value is forwarded); otherwise no state changes.
import { u8 } from "../../../core/int.js";
import { awardKillScoreByBandAndDeactivate } from "./awardKillScoreByBandAndDeactivate.js";
import { loc_4209, loc_420a, loc_420b } from "./names.js";

const X_WINDOW = 6, X_BIAS = 2;    // in-band when (entryX - refX + bias) lands in [0, window)
const Y_WINDOW = 12, Y_BIAS = 5;

export function flagPlayerShotHitOnObject(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Skip records that are not live: record+0 bit0 is the object's active flag.
  if ((mem8[obj + 0] & 1) === 0) return;                     // inactive entry
  // The shot's reference position: X at loc_4209, Y at loc_420a.
  const refX = mem8[loc_4209], refY = mem8[loc_420a];
  // X gate: reject unless the object's X (record+3) lands within the 6-wide window (bias 2) of the shot.
  if (u8(mem8[obj + 3] - refX + X_BIAS) >= X_WINDOW) return; // outside the X band
  // Y gate: reject unless the object's Y (record+4) lands within the 12-tall window (bias 5) of the shot.
  if (u8(mem8[obj + 4] - refY + Y_BIAS) >= Y_WINDOW) return; // outside the Y band

  // Overlap: retire the shot (loc_420b) and hand off to the shared kill handler to score + deactivate.
  mem8[loc_420b] = 1;
  return awardKillScoreByBandAndDeactivate(m, obj);
}
