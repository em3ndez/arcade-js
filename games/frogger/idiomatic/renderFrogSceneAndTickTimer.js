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
  loc_83cd, loc_83cf, PLAY_FLAG, ACTIVE_PLAYER, loc_83e5, loc_83e6, loc_826c,
  HOME_BAY1_OCCUPANCY_PRIMARY, loc_8263, loc_825a, STATUS_ROW_VRAM_BASE,
} from "./names.js";
import { renderFrogAndArmObjects } from "./renderFrogAndArmObjects.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { renderFilledHomeSlots } from "./renderFilledHomeSlots.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { resetFrogObject } from "./resetFrogObject.js";

const loc_83ce = 0x83ce;           // cleared to 0 on entry each frame
const loc_83b5 = 0x83b5;           // countdown-enable mirror
const FROG_ANIM_DISPATCH = 0x0faf; // the frog-animation dispatcher, a sibling in this batch
const FROG_ANIM_RET = 0x09a6;      // return address pushed ahead of the dispatcher

export function renderFrogSceneAndTickTimer(m) {
  const { regs, mem8 } = m;

  mem8[loc_83ce] = 0;
  if (mem8[loc_83cd] === 0) mem8[loc_83cf] = 0;

  if (mem8[PLAY_FLAG] === 0) {
    if (mem8[loc_83cd] === 0) { regs.a = 0; return; }
    return resetFrogObject(m);
  }

  const timerCell = mem8[ACTIVE_PLAYER] === 1 ? loc_83e5 : loc_83e6;
  if (mem8[loc_83cd] === 0) {
    const t = (mem8[timerCell] - 1) & 0xff;
    mem8[timerCell] = t;
    if (t === 0) mem8[loc_83cf] = 1;
  }

  renderFrogAndArmObjects(m);
  if (mem8[loc_83cd] === 0) {
    mem8[loc_83b5] = 1;
    regs.hl = STATUS_ROW_VRAM_BASE;
    blitFourTileGroupColumn(m);
  }

  mem8[loc_83b5] = mem8[loc_826c] ^ 1;
  regs.hl = mem8[ACTIVE_PLAYER] === 1 ? HOME_BAY1_OCCUPANCY_PRIMARY : loc_8263;
  renderFilledHomeSlots(m);

  if (mem8[loc_825a] === 0) return resetFrogObject(m);
  loadActivePlayerLaneParams(m);
  m.push16(FROG_ANIM_RET);
  m.call(FROG_ANIM_DISPATCH);

  mem8[loc_825a] = 0;
  return resetFrogObject(m);
}
