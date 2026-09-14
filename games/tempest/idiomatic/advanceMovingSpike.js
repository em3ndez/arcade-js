// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  GAME_MODE, DEPTH_ACCUM_LO, DEPTH_HI, DEPTH_LO, loc_9f, SPIKE_STEP_LO, SPIKE_STEP_HI, SPIKE_ACTIVE_FLAG,
  SPIKE_HEIGHT_LO, REDRAW_COUNTER, SPIKE_TABLE_GUARD, PLAYER_SEGMENT, PLAYER_FINE_ANGLE, PLAYER_SHOT_DEPTH, LANE_LIMIT,
} from "./names.js";
import { cueMovingSpikeStartSound } from "./cueMovingSpikeStartSound.js";
import { cueMovingSpikeEndSound } from "./cueMovingSpikeEndSound.js";
import { rebuildSpikeTable } from "./rebuildSpikeTable.js";
import { cueSpikeCollisionSound } from "./cueSpikeCollisionSound.js";
import { insertObjectHeadTag7 } from "./insertObjectHeadTag9.js";
import { clearActiveShots } from "./clearActiveShots.js";

// Per-frame step of the moving spike. Runs only while the primary flag is low and the arm
// flag is negative. Seeds a start sound at the trigger height; advances a 16-bit height,
// on overflow past the ceiling parks it and cues an end sound; past the reset height it
// rebuilds a table. Steps a second accumulator (paging its high byte and bumping a change
// counter), then rederives the per-frame delta from a scaled, clamped source. Finally,
// when below the ceiling, scans the slot row for a matching entry the spike has passed and
// registers the collision.
export function advanceMovingSpike(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  if (mem8[PLAYER_FINE_ANGLE] & 0x80) return;
  if (!(mem8[SPIKE_ACTIVE_FLAG] & 0x80)) return;

  if (mem8[PLAYER_SHOT_DEPTH] === 0x10) cueMovingSpikeStartSound(m, x, y);

  const lo = mem8[SPIKE_HEIGHT_LO] + mem8[SPIKE_STEP_LO];
  mem8[SPIKE_HEIGHT_LO] = lo;
  const hi = mem8[PLAYER_SHOT_DEPTH] + mem8[SPIKE_STEP_HI] + (lo > 0xff ? 1 : 0);
  mem8[PLAYER_SHOT_DEPTH] = hi;
  if (hi > 0xff || mem8[PLAYER_SHOT_DEPTH] >= 0xf0) {
    mem8[GAME_MODE] = 0x0e;
    cueMovingSpikeEndSound(m, x, y);
    mem8[PLAYER_SHOT_DEPTH] = 0xff;
  }

  if (mem8[PLAYER_SHOT_DEPTH] >= 0x50 && mem8[SPIKE_TABLE_GUARD] === 0) rebuildSpikeTable(m);

  const acc = mem8[DEPTH_ACCUM_LO] + mem8[SPIKE_STEP_LO];
  mem8[DEPTH_ACCUM_LO] = acc;
  const accHi = mem8[DEPTH_HI] + mem8[SPIKE_STEP_HI] + (acc > 0xff ? 1 : 0);
  const newHi = accHi & 0xff;
  if (accHi > 0xff) mem8[DEPTH_LO] = mem8[DEPTH_LO] + 1;
  if (newHi !== mem8[DEPTH_HI]) mem8[REDRAW_COUNTER] = mem8[REDRAW_COUNTER] + 1;
  mem8[DEPTH_HI] = newHi;

  let delta = (mem8[loc_9f] << 2) & 0xff;
  if (delta >= 0x30) delta = 0x30;
  delta = (delta + 0x20) & 0xff;
  const sum = delta + mem8[SPIKE_STEP_LO];
  mem8[SPIKE_STEP_LO] = sum;
  mem8[SPIKE_STEP_HI] = mem8[SPIKE_STEP_HI] + (sum > 0xff ? 1 : 0);

  if (mem8[PLAYER_SHOT_DEPTH] >= 0xf0) return;
  for (let xi = 0x0f; xi >= 0; xi--) {
    const val = mem8[u16(LANE_LIMIT + xi)];
    if (val === 0) continue;
    if (xi !== mem8[PLAYER_SEGMENT]) continue;
    if (val >= mem8[PLAYER_SHOT_DEPTH]) continue;
    cueSpikeCollisionSound(m, xi, y); // the sound cue reads its two params from xi and y
    insertObjectHeadTag7(m, xi, y);
    mem8[SPIKE_TABLE_GUARD] = 0x00;
    clearActiveShots(m);
  }
}
