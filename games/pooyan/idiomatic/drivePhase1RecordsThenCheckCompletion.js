// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { dispatchEnemyActorRecordState } from "./dispatchEnemyActorRecordState.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fillByteRun } from "./fillByteRun.js";
import {
  ENEMY_ACTOR_TABLE,
  LAUNCH_SCRIPT_PTR,
  INTRO_PHASE_INDEX,
  HIT_TALLY,
  TARGET_GROUP_COUNT,
  INTRO_DELAY_CKSUM_WORD,
  ENEMY_TARGET_REC0,
  PROJECTILE_SLOT_STATE,
  PHASE1_COMPLETE_DISPLAY_CMD,
  TARGET_MISMATCH_DISPLAY_CMD,
  TARGET_MATCH_DISPLAY_CMD,
} from "./names.js";
/**
 * drivePhase1RecordsThenCheckCompletion -- phase-1 body of the level-intro sequence.
 *
 * WHAT IT IS
 *   The per-frame driver for phase 1 of the level-intro state machine. The intro plays as a short
 *   numbered sequence held in INTRO_PHASE_INDEX (0x8f51), dispatched through the intro jump table:
 *   phase 0 seats a launch script and steps the phase on, and this routine is the body dispatched
 *   while the phase index sits at 1. Each frame it does two things -- advance every intro actor one
 *   step, then test whether the phase-1 show has finished so the intro can move on and the round
 *   bonus can be settled.
 *
 * ROLE IN THE MACHINE
 *   Phase 1 is the animated stretch of the between-rounds intro. The launch script seated in phase 0
 *   marches a cast of actors (the enemy-actor records) and their in-flight projectiles through a
 *   scripted little display. This routine keeps that cast moving until the script has played out and
 *   nothing is still airborne. Only then does it award the round -- checking whether the player
 *   cleared the whole target group -- and prime the next phase.
 *
 *   ROM 0x6edb. Grounding: [seen].
 *
 * LIVE-OUT: memory only -- the intro-phase dispatcher that reaches this body returns straight after
 *   and reads no register back. Everything the routine decides is left in RAM: the bumped (or, on a
 *   full clear, forced) INTRO_PHASE_INDEX, the reprimed INTRO_DELAY_CKSUM_WORD, the two queued
 *   display commands, and the zeroed target-record block.
 */
const RECORD_STRIDE = 0x18; //   actor / projectile record pitch (each record is 0x18 bytes)
const ACTOR_COUNT = 0x0e; //     enemy-actor records swept each frame (14)
const SLOT_COUNT = 0x03; //      projectile slots checked for idle (3)
const SCRIPT_TERMINATOR = 0xff; // launch-script end marker
const INTRO_PHASE_FOUR = 0x04; // intro phase forced on a full-clear (target/tally match)
const INTRO_DELAY_RESEED = 0x40; // value the intro delay timer is reprimed to
const TARGET_CLEAR_LEN = 0x30; // bytes of the target-record block cleared to zero

export function drivePhase1RecordsThenCheckCompletion(m) {
  const { mem8 } = m;

  // STEP 1 -- march the intro cast. Walk the 14 enemy-actor records based at ENEMY_ACTOR_TABLE
  // (0x8ae0), each 0x18 bytes apart, and run the per-record state handler on every one. That handler
  // is what actually animates and moves an intro actor for this frame; here we just drive it record
  // by record across the whole table.
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < ACTOR_COUNT; i++) {
    dispatchEnemyActorRecordState(m, rec);
    rec = u16(rec + RECORD_STRIDE);
  }

  // STEP 2 -- has the launch script finished? LAUNCH_SCRIPT_PTR (0x8f4a) holds a little-endian
  // pointer into the currently-playing, 0xff-terminated launch script; read that 16-bit pointer,
  // then read the byte it points at. While the script still has opcodes to run, that byte is not the
  // 0xff terminator, so phase 1 is not done -- leave the phase index alone and re-test next frame.
  const script = mem8[LAUNCH_SCRIPT_PTR] | (mem8[u16(LAUNCH_SCRIPT_PTR + 1)] << 8);
  if (mem8[script] !== SCRIPT_TERMINATOR) return; // script not finished

  // STEP 3 -- is anything still airborne? Even once the script is spent, an actor may still have a
  // projectile in flight. Check the state byte of all three projectile slots (PROJECTILE_SLOT_STATE
  // at 0x8bea, stride 0x18): a nonzero state means that slot is still busy, so phase 1 is not yet
  // complete -- return and re-test next frame.
  let slot = PROJECTILE_SLOT_STATE;
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (mem8[slot] !== 0) return; // a slot still busy
    slot = u16(slot + RECORD_STRIDE);
  }

  // STEP 4 -- phase 1 is complete. Advance the intro sequence one step past phase 1 (INTRO_PHASE_INDEX
  // at 0x8f51) and queue the "phase-1 complete" display command so the text/banner for the next beat
  // gets drawn.
  mem8[INTRO_PHASE_INDEX] = (mem8[INTRO_PHASE_INDEX] + 1); // advance the intro phase
  enqueueDisplayCommand(m, PHASE1_COMPLETE_DISPLAY_CMD);

  // STEP 5 -- settle the round bonus. TARGET_GROUP_COUNT (0x8f47) is how many targets this group
  // held; HIT_TALLY (0x8f52) counts collisions, bumped once per target hit. The full-clear test is
  // 3 x the group count against the tally: equality means the group was fully cleared. On a match,
  // jump the intro straight to phase 4 (the bonus beat) and swap in the "match" display command;
  // otherwise leave the phase where STEP 4 left it and keep the "mismatch" command.
  const target3 = (mem8[TARGET_GROUP_COUNT] * 3) & 0xff; // 3 x target-group count
  let cmd = TARGET_MISMATCH_DISPLAY_CMD;
  if (target3 === mem8[HIT_TALLY]) {
    mem8[INTRO_PHASE_INDEX] = INTRO_PHASE_FOUR; // force phase 4
    cmd = TARGET_MATCH_DISPLAY_CMD;
  }

  // STEP 6 -- reprime and tidy up. Reseed the intro delay timer (INTRO_DELAY_CKSUM_WORD, 0x8f48) to
  // 0x40 so the next phase has its dwell countdown, queue the match/mismatch display command chosen
  // above, then wipe the 0x30-byte target-record block at ENEMY_TARGET_REC0 (0x8c90) back to zero,
  // retiring this group's targets before the next round is set up.
  mem8[INTRO_DELAY_CKSUM_WORD] = INTRO_DELAY_RESEED;
  enqueueDisplayCommand(m, cmd);
  fillByteRun(m, ENEMY_TARGET_REC0, 0x00, TARGET_CLEAR_LEN); // clear the target block to zero
}
