// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loadPhaseMotionParamsAndAdvancePhase } from "./loadPhaseMotionParamsAndAdvancePhase.js";
import { clearTargetActorRecord } from "./clearTargetActorRecord.js";
import {
  loc_8f0e,
  loc_8f0f,
  OBJECT_VEL_X,
  OBJECT_VEL_Y,
  loc_8d45,
  loc_8d77,
  LAUNCH_STATE,
  LAUNCH_ARMED_FLAG,
  FLASH_CELL_BASE,
} from "./names.js";

/**
 * advanceTargetActorAlongVelocityElseDespawn — advance a two-axis moving object at IY.
 *
 * WHAT IT IS
 * The per-frame position stepper for a launched target actor — the scripted flyer that, in the
 * bonus stage, is the eagle. The actor does not travel on one fixed velocity; its flight is a short
 * script of numbered *phases*, each holding a fixed X velocity and a fixed Y velocity for a set
 * number of frames before the next phase loads (see loadPhaseMotionParamsAndAdvancePhase). This
 * routine runs once per frame for one such actor: it advances the phase script when the current
 * phase's dwell has elapsed, integrates the phase's two velocities into the actor's X and Y
 * coordinate words, and retires the actor once it has flown past the bottom of its travel.
 *
 * ROLE IN THE MACHINE
 * Called each frame as the "two-axis mover" for a live target record: the object stepper hands a
 * record here to be carried forward. The actor's record base is IY; its live X coordinate is the
 * word at (record+5:record+6) and its live Y coordinate is the word at (record+3:record+4). For
 * the eagle those are the eagle's on-screen X and Y.
 *
 * The current flight phase is held in two scratch cells shared by whatever actor is being flown:
 * the phase-dwell countdown loc_8f0e (0x8f0e), decremented once per frame here, and the phase index
 * loc_8f0f (0x8f0f). The two velocities for the active phase sit in OBJECT_VEL_X (0x8f10) and
 * OBJECT_VEL_Y (0x8f12).
 *
 * ROM 0x2226–0x2280. Grounding: [seen].
 *
 * LIVE-OUT: memory only — nothing is handed back to the caller. On the keep-moving path it leaves
 * the actor's advanced Y coordinate in (record+3:record+4), its advanced X coordinate in
 * (record+5:record+6), and the phase-dwell countdown loc_8f0e ticked down by one. On the spent
 * path it zeroes the flight/launch scratch cells (loc_8f0e, loc_8f0f, LAUNCH_STATE, loc_8d45,
 * loc_8d77, LAUNCH_ARMED_FLAG) and blanks the whole actor record.
 */

const SPENT_Y_HIGH = 0xe8; // Y high byte at/above this marks the object spent

export function advanceTargetActorAlongVelocityElseDespawn(m, obj = m.regs.iy) {
  const { mem8, mem16 } = m;

  // STEP 1 — advance the flight script when the current phase has run out.
  // The phase-dwell countdown loc_8f0e (0x8f0e) reaches zero when the active phase has held for its
  // full frame count; that is the cue to load the next phase's dwell and X/Y velocities. The reload
  // also bumps the phase index loc_8f0f (0x8f0f) and finishes by comparing the newly-advanced index
  // against 9, which leaves a borrow (carry) set whenever that index is 8 or below. That borrow is
  // carried into the X subtraction in STEP 2, so it is recovered here from the pre-reload phase
  // value; when no reload runs this frame the borrow is clear.
  let borrow = 0;
  if (mem8[loc_8f0e] === 0) {
    const phase = mem8[loc_8f0f];
    loadPhaseMotionParamsAndAdvancePhase(m);
    borrow = ((phase + 1) & 0xff) <= 0x08 ? 1 : 0; // reload's phase++/cp-9 leaves carry set below 9
  }

  // STEP 2 — integrate the X velocity into the actor's X coordinate word (record+5:record+6).
  // The direction is not stored in the velocity; it comes from the direction-sign pair at
  // FLASH_CELL_BASE (0x8d19/0x8d1a). The actor record's own address bit 3 (obj & 0x08) selects which
  // of the two cells applies to this actor, and that cell's bit0 chooses the sense: bit0 set adds
  // the velocity, bit0 clear subtracts it together with the borrow recovered in STEP 1.
  const xv = mem16[OBJECT_VEL_X];
  const sign = mem8[FLASH_CELL_BASE + ((obj & 0x08) ? 1 : 0)];
  const x = mem16[obj + 0x05];
  mem16[obj + 0x05] = u16((sign & 0x01) ? x + xv : x - xv - borrow);

  // STEP 3 — integrate the Y velocity into the actor's Y coordinate word (record+3:record+4).
  // Y always accumulates the phase velocity OBJECT_VEL_Y (0x8f12); the high byte of the running sum
  // is what decides whether the actor is still on screen.
  const yv = mem16[OBJECT_VEL_Y];
  const y = u16(mem16[obj + 0x03] + yv);
  if ((y >> 8) >= SPENT_Y_HIGH) {
    // STEP 3a — spent: the actor has descended past the bottom of its travel (Y high byte reached
    // 0xe8). Tear down the shared flight/launch state so the next launch starts clean: clear the
    // phase-dwell countdown and phase index (loc_8f0e/loc_8f0f), the launch state machine selector
    // LAUNCH_STATE (0x8f30), the two launch scratch cells loc_8d45/loc_8d77, and the launch arm
    // flag LAUNCH_ARMED_FLAG (0x8f3f) — then blank the actor's own record.
    mem8[loc_8f0e] = 0; //          object spent: clear its scratch cells
    mem8[loc_8f0f] = 0;
    mem8[LAUNCH_STATE] = 0;
    mem8[loc_8d45] = 0;
    mem8[loc_8d77] = 0;
    mem8[LAUNCH_ARMED_FLAG] = 0;
    return clearTargetActorRecord(m, obj); // tail: blank the record
  }

  // STEP 3b — still flying: commit the new Y coordinate and count one frame off the current phase's
  // dwell. When loc_8f0e (0x8f0e) reaches zero again STEP 1 will pull in the next phase.
  mem16[obj + 0x03] = y; // keep moving: store Y, tick the phase counter down
  mem8[loc_8f0e] = u8(mem8[loc_8f0e] - 1);
}
