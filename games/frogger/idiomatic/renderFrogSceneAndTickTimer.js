// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFrogSceneAndTickTimer — the per-frame frog-scene render core. Ticks the active player's
 * game-timer byte unless the demo/frame gate is set, flagging expiry; renders the frog sprite and object
 * banner, and while not in the demo gate lays the home-marker column; mirrors the countdown-enable flag,
 * stamps the occupied home slots for the active player's bank, then either resets the frog object
 * outright or loads the lane params and runs the frog-animation dispatcher before the reset.
 * LIVE-OUT: memory + A -- the board-setup caller stores it into the continue flag; 0 on the demo-clear
 * bare return, else the shared reset delegate's A.
 */
import {
  FROG_STATE_DEMO_FLAG, loc_83cf, PLAY_FLAG, ACTIVE_PLAYER, TIME_REMAINING_P1, TIME_REMAINING_P2, GATED_COUNTDOWN_ENABLE_FLAG,
  HOME_BAY1_OCCUPANCY_PRIMARY, HOME_BAY1_OCCUPANCY_ALT, PLAYER_START_DEMO_FLAG, STATUS_ROW_VRAM_BASE, LIFE_RESTART_FLAG,
  GATED_COUNTDOWN_ENABLE_MIRROR,
} from "./names.js";
import { renderFrogAndArmObjects } from "./renderFrogAndArmObjects.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { renderFilledHomeSlots } from "./renderFilledHomeSlots.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { resetFrogObject } from "./resetFrogObject.js";
import { dispatchFrogAnimationArm } from "./dispatchFrogAnimationArm.js";

export function renderFrogSceneAndTickTimer(m) {
  const { mem8 } = m;

  mem8[LIFE_RESTART_FLAG] = 0;
  if (mem8[FROG_STATE_DEMO_FLAG] === 0) mem8[loc_83cf] = 0;

  if (mem8[PLAY_FLAG] === 0) {
    if (mem8[FROG_STATE_DEMO_FLAG] === 0) return (m.regs.a = 0);
    return resetFrogObject(m);
  }

  const timerCell = mem8[ACTIVE_PLAYER] === 1 ? TIME_REMAINING_P1 : TIME_REMAINING_P2;
  if (mem8[FROG_STATE_DEMO_FLAG] === 0) {
    const t = (mem8[timerCell] - 1) & 0xff;
    mem8[timerCell] = t;
    if (t === 0) mem8[loc_83cf] = 1;
  }

  renderFrogAndArmObjects(m);
  if (mem8[FROG_STATE_DEMO_FLAG] === 0) {
    mem8[GATED_COUNTDOWN_ENABLE_MIRROR] = 1;
    blitFourTileGroupColumn(m, STATUS_ROW_VRAM_BASE);
  }

  mem8[GATED_COUNTDOWN_ENABLE_MIRROR] = mem8[GATED_COUNTDOWN_ENABLE_FLAG] ^ 1;
  renderFilledHomeSlots(m, mem8[ACTIVE_PLAYER] === 1 ? HOME_BAY1_OCCUPANCY_PRIMARY : HOME_BAY1_OCCUPANCY_ALT);

  if (mem8[PLAYER_START_DEMO_FLAG] === 0) return resetFrogObject(m);
  loadActivePlayerLaneParams(m);
  dispatchFrogAnimationArm(m);

  mem8[PLAYER_START_DEMO_FLAG] = 0;
  return resetFrogObject(m);
}
