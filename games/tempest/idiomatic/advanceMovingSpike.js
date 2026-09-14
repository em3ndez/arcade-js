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

/**
 * advanceMovingSpike — step the moving spike one frame. ROM 0x97f8 (per-frame spike growth + collision).
 *
 * Role in the machine: the "spike" is the growing stalk an enemy leaves climbing out of a tube lane;
 * left alone it grows toward the rim and kills the player who flies into it. This routine is the spike's
 * per-frame heartbeat: it only runs while the primary gate loc_201 (PLAYER_FINE_ANGLE) has bit7 clear and
 * the arm flag loc_106 (SPIKE_ACTIVE_FLAG) has bit7 set, so it is a no-op except during the window a spike
 * is actually alive. When armed it plays the spike's rising note, drives the spike higher up the tube each
 * frame, retires it with an end sound once it tops out, keeps the on-screen spike table and depth shading
 * in step, and finally checks whether the spike has grown far enough in the player's own lane to hit them.
 *
 * Behavior: bail on either gate. At trigger height (loc_202/PLAYER_SHOT_DEPTH == 0x10) cue the start sound.
 * Advance the 16-bit height loc_107/loc_202 (SPIKE_HEIGHT_LO low, PLAYER_SHOT_DEPTH high) by the step
 * loc_104/loc_105 (SPIKE_STEP_LO/HI); on carry past the ceiling (hi overflow or >= 0xf0) request game mode
 * loc_0 (GAME_MODE) = 0x0e, cue the end sound, and park the height at 0xff. Once the height passes 0x50 and
 * the table guard loc_115 (SPIKE_TABLE_GUARD) is clear, rebuild the spike table. Step a second 16-bit depth
 * accumulator DEPTH_ACCUM_LO/DEPTH_HI (paging DEPTH_LO on carry) and bump REDRAW_COUNTER whenever its high
 * byte pages, so the depth-shaded redraw stays fresh. Rederive the per-frame step: scale loc_9f by 4, clamp
 * to 0x30, bias by 0x20, and fold it back into loc_104/loc_105. Finally, while below the ceiling, scan the
 * 16 lane-limit cells loc_3ac (LANE_LIMIT); for the one lane equal to the player's segment loc_200
 * (PLAYER_SEGMENT) whose stored height the spike has now exceeded, register the hit.
 *
 * Live-out: the 16-bit spike height SPIKE_HEIGHT_LO/PLAYER_SHOT_DEPTH, the per-frame step SPIKE_STEP_LO/HI,
 * the depth accumulator DEPTH_ACCUM_LO/DEPTH_HI/DEPTH_LO, REDRAW_COUNTER, GAME_MODE (on ceiling), the spike
 * table (rebuilt) and its guard SPIKE_TABLE_GUARD (cleared on a hit). Grounding: [seen].
 */
export function advanceMovingSpike(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  if (mem8[PLAYER_FINE_ANGLE] & 0x80) return; // primary gate loc_201: bit7 set -> spike inactive this frame
  if (!(mem8[SPIKE_ACTIVE_FLAG] & 0x80)) return; // arm flag loc_106: must be negative for the spike to move

  // At the trigger height the spike first becomes audible -- seed its rising note exactly once.
  if (mem8[PLAYER_SHOT_DEPTH] === 0x10) cueMovingSpikeStartSound(m, x, y);

  // Advance the 16-bit spike height loc_107/loc_202 by the current step loc_104/loc_105, low byte first
  // so its carry feeds the high byte -- this is what walks the spike up the lane frame by frame.
  const lo = mem8[SPIKE_HEIGHT_LO] + mem8[SPIKE_STEP_LO];
  mem8[SPIKE_HEIGHT_LO] = lo;
  const hi = mem8[PLAYER_SHOT_DEPTH] + mem8[SPIKE_STEP_HI] + (lo > 0xff ? 1 : 0); // +carry from the low byte
  mem8[PLAYER_SHOT_DEPTH] = hi;
  // Topped out: either the high byte carried out, or it reached the 0xf0 ceiling. Retire the spike --
  // request game mode 0x0e, cue the end sound, and pin the height at 0xff so it stops climbing.
  if (hi > 0xff || mem8[PLAYER_SHOT_DEPTH] >= 0xf0) {
    mem8[GAME_MODE] = 0x0e;
    cueMovingSpikeEndSound(m, x, y);
    mem8[PLAYER_SHOT_DEPTH] = 0xff;
  }

  // Past the 0x50 reset height, and only if the table guard loc_115 is clear, rebuild the on-screen spike table.
  if (mem8[PLAYER_SHOT_DEPTH] >= 0x50 && mem8[SPIKE_TABLE_GUARD] === 0) rebuildSpikeTable(m);

  // Second 16-bit accumulator: the depth used for perspective shading, stepped by the same loc_104/loc_105.
  const acc = mem8[DEPTH_ACCUM_LO] + mem8[SPIKE_STEP_LO];
  mem8[DEPTH_ACCUM_LO] = acc;
  const accHi = mem8[DEPTH_HI] + mem8[SPIKE_STEP_HI] + (acc > 0xff ? 1 : 0);
  const newHi = accHi & 0xff;
  if (accHi > 0xff) mem8[DEPTH_LO] = mem8[DEPTH_LO] + 1; // page the extra byte on overflow
  if (newHi !== mem8[DEPTH_HI]) mem8[REDRAW_COUNTER] = mem8[REDRAW_COUNTER] + 1; // high byte moved -> redraw needed
  mem8[DEPTH_HI] = newHi;

  // Rederive the per-frame step from loc_9f: scale by 4, clamp to 0x30, bias by 0x20, then fold back into
  // the 16-bit step loc_104/loc_105 -- so the spike accelerates toward a capped, biased climb rate.
  let delta = (mem8[loc_9f] << 2) & 0xff;
  if (delta >= 0x30) delta = 0x30; // clamp the scaled source
  delta = (delta + 0x20) & 0xff;   // minimum-rate bias
  const sum = delta + mem8[SPIKE_STEP_LO];
  mem8[SPIKE_STEP_LO] = sum;
  mem8[SPIKE_STEP_HI] = mem8[SPIKE_STEP_HI] + (sum > 0xff ? 1 : 0); // carry into the step high byte

  // No collision check once the spike has parked at the ceiling -- it can no longer grow into anyone.
  if (mem8[PLAYER_SHOT_DEPTH] >= 0xf0) return;
  // Scan the 16 lane-limit cells loc_3ac from the top down for the player's own lane.
  for (let xi = 0x0f; xi >= 0; xi--) {
    const val = mem8[u16(LANE_LIMIT + xi)];
    if (val === 0) continue;                    // empty lane -- no spike stored here
    if (xi !== mem8[PLAYER_SEGMENT]) continue;  // only the lane the player currently occupies can hit them
    if (val >= mem8[PLAYER_SHOT_DEPTH]) continue; // spike hasn't grown past the player yet
    // Hit: play the collision sound, drop an object-head marker, clear the table guard, and kill live shots.
    cueSpikeCollisionSound(m, xi, y); // the sound cue reads its two params from xi and y
    insertObjectHeadTag7(m, xi, y);
    mem8[SPIKE_TABLE_GUARD] = 0x00;
    clearActiveShots(m);
  }
}
