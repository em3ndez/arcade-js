// SPDX-License-Identifier: GPL-3.0-only
/** dispatchPlayerFrameByState — seat the player record and its paired sprite entry, then route the frame on the
 * player-state byte: leave at once while it is clear, drive the multi-frame animation while it is
 * mid-count, and once it is fully wound either fly the demo pilot (no live play), turn the ship
 * toward the read stick, or just scroll the world when the stick is centred. LIVE-OUT: memory. */

import { loc_2010 } from "./loc_2010.js";
import { flyDemoShipByScript } from "./flyDemoShipByScript.js";
import { readPlayerControls } from "./readPlayerControls.js";
import { turnShipTowardTargetHeading } from "./turnShipTowardTargetHeading.js";
import { scrollWorldAtTheEraPace } from "./scrollWorldAtTheEraPace.js";
import { PLAYER_STATE, PLAY_ACTIVE } from "./names.js";

const PAIRED_ENTRY_SEAT = 0xaa10;
const WOUND = 0xff;

export function dispatchPlayerFrameByState(m) {
  const { regs, mem8 } = m;
  regs.ix = PLAYER_STATE;
  regs.iy = PAIRED_ENTRY_SEAT;

  const state = mem8[PLAYER_STATE];
  if (state === 0) return;
  if (state !== WOUND) return loc_2010(m);

  if (mem8[PLAY_ACTIVE] === 0) return flyDemoShipByScript(m);

  const stick = readPlayerControls(m) & 0x0f;
  regs.a = stick;
  if (stick !== 0) return turnShipTowardTargetHeading(m);
  return scrollWorldAtTheEraPace(m);
}
