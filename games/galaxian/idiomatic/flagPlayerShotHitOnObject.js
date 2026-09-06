// SPDX-License-Identifier: GPL-3.0-only
// Per-object hit test: an active object at IX whose position falls inside a 6-wide by 12-tall box around the
// reference position raises the hit flag and is deactivated/scored. Inactive or out-of-box entries do nothing.
import { u8 } from "../../../core/int.js";
import { awardKillScoreByBandAndDeactivate } from "./awardKillScoreByBandAndDeactivate.js";
import { loc_4209, loc_420a, loc_420b } from "./names.js";

const X_WINDOW = 6, X_BIAS = 2;    // in-band when (entryX - refX + bias) lands in [0, window)
const Y_WINDOW = 12, Y_BIAS = 5;

export function flagPlayerShotHitOnObject(m, obj = m.regs.ix) {
  const { mem8 } = m;

  if ((mem8[obj + 0] & 1) === 0) return;                     // inactive entry
  const refX = mem8[loc_4209], refY = mem8[loc_420a];
  if (u8(mem8[obj + 3] - refX + X_BIAS) >= X_WINDOW) return; // outside the X band
  if (u8(mem8[obj + 4] - refY + Y_BIAS) >= Y_WINDOW) return; // outside the Y band

  mem8[loc_420b] = 1;
  return awardKillScoreByBandAndDeactivate(m, obj);
}
