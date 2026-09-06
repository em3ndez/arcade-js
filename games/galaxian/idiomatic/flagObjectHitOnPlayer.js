// SPDX-License-Identifier: GPL-3.0-only
// Per-object proximity test against the player: skip inactive objects, classify the object's field into
// a low or high proximity window, and when its X sits within that window's band of the player, raise the
// hit event and award the kill. Outside every window it does nothing.
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

  if ((mem8[obj] & 1) === 0) return; // inactive object

  const band = u8(mem8[obj + 3] + CLASS_BIAS);
  const delta = u8(mem8[loc_4202] - mem8[obj + 4]);

  if (band < LOW_WINDOW) {
    if (u8(delta + LOW_MARGIN) >= LOW_BAND) return;
  } else if (band < HIGH_WINDOW) {
    if (u8(delta + HIGH_MARGIN) >= HIGH_BAND) return;
  } else {
    return;
  }

  mem8[HIT_EVENT_FLAG] = 1;
  return awardKillScoreByBandAndDeactivate(m, obj);
}
