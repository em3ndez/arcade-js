// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { spawnChildActorIfInRange } from "./spawnChildActorIfInRange.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { ROUND_COUNTER, ANIM_FRAME_COUNTER, ANIM_SEQ_TABLE_12FB, ANIM_TABLE_3838 } from "./names.js";
/**
 * matchActorScheduleThenSpawnOrAnimate — per-frame decision for one travelling actor: is it time to
 * drop a companion object, keep travelling, or commit to its arrival animation?
 *
 * WHAT IT IS
 *   A travelling enemy actor is tracked by an ACTOR RECORD (a fixed-layout block of bytes in work
 *   RAM, addressed here by IX) and is walked across the playfield a little each frame. Every round
 *   carries a SCHEDULE — a small table saying, frame by frame, which playfield column that round's
 *   actors are supposed to act on. This routine reads today's scheduled target column, compares it
 *   against the actor's own current column, and takes exactly one of three actions:
 *     - column reached exactly   -> drop a companion object beside the actor
 *     - column not far enough yet -> do nothing this frame; let the actor keep travelling
 *     - column already past       -> mark the actor "done spawning" and switch it to its arrival look
 *
 *   HOW THE TARGET COLUMN IS FOUND — two nested table reads:
 *     1. ROUND_COUNTER (0x8907): its low 5 bits, shifted right by 2 (so four rounds share one
 *        schedule), pick an entry from the round schedule table ANIM_SEQ_TABLE_12FB (0x12fb). Each
 *        entry is a 16-bit pointer to that round's per-frame target-column row.
 *     2. ANIM_FRAME_COUNTER (0x8d41): its low nibble indexes a byte inside that row — the target
 *        column this round's actors should act on for the current frame.
 *
 *   THE ACTOR'S OWN COLUMN is the record byte at +0x06, the coarse (integer) part of the position
 *   the travel tick nudges forward each frame; the record byte at +0x08 is a one-shot flag marking
 *   the actor as having committed / finished spawning.
 *
 * ROLE IN THE MACHINE
 *   Reached from the per-object travel tick advanceEnemyTravelAndSpawnChildActors (ROM 0x12af),
 *   after that handler has advanced the actor's position for the frame and only while the stage is
 *   not yet near its end (STAGE_COUNTDOWN 0x8901 is 3 or more). This routine is the step that turns
 *   steady travel into either a spawn or an arrival. The spawn hand-off runs the range-guarded child
 *   spawn spawnChildActorIfInRange (ROM 0x1383); the arrival hand-off retargets the record through
 *   setActorAnimation (ROM 0x381e) onto the four-frame animation table ANIM_TABLE_3838 (0x3838).
 *
 * ROM 0x12d0. Grounding: [seen].
 *
 * LIVE-OUT
 *   C  — always the looked-up target column.
 *   DE — the advanced schedule-table pointer (parked one byte past this round's entry) on the spawn
 *        and wait branches; the animation-table base ANIM_TABLE_3838 on the arrival branch.
 *   A  — the child-spawn result on the spawn branch; otherwise the actor's own column field.
 *   The caller dispatches on these register values.
 *
 * CONTROL FLOW: the two acting branches are tail jumps — the spawn branch and the arrival branch
 * each return the value the routine they hand off to produces. The wait branch returns here.
 */

const OBJ_FIELD = 0x06; // record +0x06: the actor's coarse column, compared against the schedule
const SPAWNED_FLAG = 0x08; // record +0x08: one-shot "committed / done spawning" flag
const ROUND_MASK = 0x1f; // low 5 bits of the round counter select the schedule
const FRAME_MASK = 0x0f; // low nibble of the frame counter indexes within the schedule row
const FIELD_MIN = 0x14; // below this the handler returns

export function matchActorScheduleThenSpawnOrAnimate(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // ROUND SCHEDULE ENTRY (ROM 0x12d3-0x12e0). Pick this round's schedule: take the low 5 bits of
  // ROUND_COUNTER (0x8907) and shift them right by 2 (four consecutive rounds share one entry),
  // then read that entry from the round schedule table ANIM_SEQ_TABLE_12FB (0x12fb). The entry is a
  // 16-bit pointer to the round's per-frame target-column row.
  const index = (mem8[ROUND_COUNTER] & ROUND_MASK) >> 2;
  const row = fetchWordFromTableIndex(m, index, ANIM_SEQ_TABLE_12FB); // row = table[index]

  // TARGET COLUMN FOR THIS FRAME (ROM 0x12e3-0x12e7). Index the schedule row by the low nibble of
  // the global animation frame counter ANIM_FRAME_COUNTER (0x8d41): the byte living there is the
  // column this round's actors are meant to act on this frame. It is carried out to the caller in C.
  const [target] = fetchByteFromTableIndex(m, row, mem8[ANIM_FRAME_COUNTER] & FRAME_MASK); // byte at row + frame

  // THE ACTOR'S OWN COLUMN (ROM 0x12e7-0x12ea). Read the record's compare field at +0x06 — the
  // coarse (integer) part of the position the travel tick advances each frame. Every branch below
  // is decided by this actual column against the scheduled target column.
  const field = mem8[rec + OBJ_FIELD];

  // The schedule-table pointer left parked one byte past this round's entry (it survives in DE from
  // the word lookup). It is handed back to the caller in DE on the two branches that do not switch
  // the actor's animation.
  const advancedPtr = u16(ANIM_SEQ_TABLE_12FB + ((index << 1) & 0xff) + 1);

  // REACHED THE SCHEDULED COLUMN (ROM 0x12eb jp z,0x1383). The actor's column exactly matches this
  // frame's target: it is time to drop a companion object beside it. Hand off to the range-guarded
  // child spawn, carrying the target column in C and the schedule pointer in DE; its result becomes
  // this routine's result.
  if (field === target) return (m.regs.c = target, m.regs.de = advancedPtr, spawnChildActorIfInRange(m)); // tail: spawn dispatch
  // NOT FAR ENOUGH YET (ROM 0x12f0 ret c). The actor's column is still below 0x14 — short of the
  // window in which it can act — so nothing happens this frame and it keeps travelling. The target
  // column stays in C, the schedule pointer in DE, and A is left holding the column field.
  if (field < FIELD_MIN) return (m.regs.c = target, m.regs.de = advancedPtr, m.regs.a = field);
  // PAST THE SPAWN POINT (ROM 0x12f1-0x12f8). The actor is at or beyond 0x14 but did not land on the
  // target column, so its chance to spawn on this run is over. Latch the record's committed flag at
  // +0x08 so it will not spawn again.
  mem8[rec + SPAWNED_FLAG] = 0x01;
  // Switch the actor to its arrival look: retarget the record onto the four-frame animation table
  // ANIM_TABLE_3838 (0x3838), which begins playing it from its first frame.
  setActorAnimation(m, rec, ANIM_TABLE_3838); // point the record at the animation
  // Leave the outputs: C = target column, DE = the animation-table base just installed, A = the
  // actor's column field.
  return (m.regs.c = target, m.regs.de = ANIM_TABLE_3838, m.regs.a = field); // spawned: DE = anim-table base
}
