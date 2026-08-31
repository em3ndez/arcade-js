// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import {
  loc_8f0e,
  loc_8f0f,
  OBJECT_VEL_X,
  OBJECT_VEL_Y,
  MOTION_PARAM_TABLE_2712,
  MOTION_PARAM_TABLE_271C,
  MOTION_PARAM_TABLE_2730,
} from "./names.js";
/**
 * loadPhaseMotionParamsAndAdvancePhase — load the current phase's motion params, then step the phase.
 *
 * WHAT IT IS
 * A scripted moving object (the launched/eagle-wave object driven by
 * advanceTargetActorAlongVelocityElseDespawn) does not fly on a single fixed velocity. Its
 * motion is a short script of numbered *phases*, and a phase is one keyframe of that flight: hold
 * for a set number of frames while drifting at a fixed X velocity and a fixed Y velocity, then
 * step to the next phase. This routine reads the parameters for whichever phase the object is
 * currently on and lays them out where the stepper expects them, then advances the phase index.
 *
 * The parameters live in three parallel tables in ROM, all indexed by the same phase number:
 *   - MOTION_PARAM_TABLE_2712 (0x2712) — a BYTE table: the dwell count, i.e. how many frames this
 *     phase lasts. It lands in the phase-dwell countdown loc_8f0e (0x8f0e), which the stepper
 *     decrements once per frame and which, on reaching zero, is what triggers this reload.
 *   - MOTION_PARAM_TABLE_271C (0x271c) — a little-endian WORD table: the X velocity for the phase,
 *     landing in OBJECT_VEL_X (0x8f10).
 *   - MOTION_PARAM_TABLE_2730 (0x2730) — a little-endian WORD table: the Y velocity for the phase,
 *     landing in OBJECT_VEL_Y (0x8f12).
 *
 * ROLE IN THE MACHINE
 * Called from the object stepper the instant the current phase's dwell countdown loc_8f0e has
 * drained to zero. The stepper then integrates the two freshly-loaded velocities into the object's
 * position each frame until the countdown again reaches zero, at which point the next phase loads.
 *
 * ROM 0x2282–0x22b0. Grounding: [seen].
 *
 * LIVE-OUT: memory only. It leaves four cells for the stepper to read back: the new phase dwell
 * countdown loc_8f0e, the X velocity OBJECT_VEL_X (0x8f10), the Y velocity OBJECT_VEL_Y (0x8f12),
 * and the advanced phase index loc_8f0f (0x8f0f).
 */
export function loadPhaseMotionParamsAndAdvancePhase(m) {
  const { mem8, mem16 } = m;

  // Load the three motion parameters for the current phase. The phase index in loc_8f0f (0x8f0f)
  // is the common subscript into all three parallel tables. The byte from MOTION_PARAM_TABLE_2712
  // (0x2712) is the new dwell count and goes into the phase-dwell countdown loc_8f0e (0x8f0e); the
  // two little-endian words from MOTION_PARAM_TABLE_271C (0x271c) and MOTION_PARAM_TABLE_2730
  // (0x2730) are this phase's X and Y velocities, dropped into OBJECT_VEL_X (0x8f10) and
  // OBJECT_VEL_Y (0x8f12).
  const phase = mem8[loc_8f0f];
  mem8[loc_8f0e] = fetchByteFromTableIndex(m, MOTION_PARAM_TABLE_2712, phase)[0];
  mem16[OBJECT_VEL_X] = fetchWordFromTableIndex(m, phase, MOTION_PARAM_TABLE_271C);
  mem16[OBJECT_VEL_Y] = fetchWordFromTableIndex(m, phase, MOTION_PARAM_TABLE_2730);

  // Step to the next phase. Bump the phase index in loc_8f0f (0x8f0f) by one (8-bit). The script
  // runs phases 0..8 once in order; when the index would step past the end to 9 it is pulled back
  // to 8, so the final phase repeats indefinitely — the object holds its last motion segment until
  // it is spent and despawned rather than reading off the end of the tables.
  const next = (mem8[loc_8f0f] + 1) & 0xff;
  mem8[loc_8f0f] = next === 0x09 ? 0x08 : next; // clamp 9 -> 8: loop the tail phase forever
}
