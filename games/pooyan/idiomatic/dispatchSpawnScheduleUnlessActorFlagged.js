// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { matchActorScheduleThenSpawnOrAnimate } from "./matchActorScheduleThenSpawnOrAnimate.js";

/**
 * dispatchSpawnScheduleUnlessActorFlagged — the "already-spawned?" gate that stands in front of the
 * actor spawn-scheduling dispatch.
 *
 * WHAT IT IS
 *   A travelling enemy actor is tracked by an ACTOR RECORD — a fixed-layout block of bytes in work
 *   RAM addressed here by IX (the `block` argument). One byte of that record, at offset +0x08, is a
 *   one-shot flag: it starts clear and is latched to 1 the moment the actor commits to its arrival
 *   animation (the point past which its chance to drop a companion object during travel is spent).
 *   This routine reads that one byte and decides whether the actor still has spawn-scheduling work
 *   to do this frame:
 *     - flag bit0 already set -> the actor is done spawning; do nothing and return
 *     - flag bit0 clear       -> hand the actor on to the per-frame spawn-schedule decision
 *   It is purely a guard: it changes no state of its own on either path.
 *
 * ROLE IN THE MACHINE
 *   Reached from the actor sub-state dispatcher dispatchActorSpawnBySubStateAndPaceCadence (ROM
 *   0x1399) on its high-sub-state branch — taken when the actor's sub-state byte (record +0x06) is
 *   0x14 or greater, i.e. the actor has travelled far enough that the per-frame spawn schedule is
 *   now the handler that applies to it. Sitting in front of that schedule, this gate stops an actor
 *   that has already committed to arriving from re-entering the schedule and spawning a companion a
 *   second time.
 *
 * ROM 0x1391. Grounding: [seen].
 *
 * LIVE-OUT
 *   A — on the hand-off path, whatever the spawn-schedule dispatch leaves behind (the child-spawn
 *       result, the actor's own column field, etc., depending on which of its branches ran). On the
 *       guard path A is never touched, so it keeps the value it carried in.
 */

const FLAG_FIELD = 0x08; // actor-record offset of the one-shot "committed / done spawning" flag

export function dispatchSpawnScheduleUnlessActorFlagged(m, block = m.regs.ix) {
  const { mem8 } = m;
  // DONE-SPAWNING GATE (ROM 0x1391-0x1395: bit 0,(ix+0x08) / ret nz). Test bit0 of the actor
  // record's committed flag at +0x08. Once it is set, the actor has already switched to its arrival
  // animation and there is nothing left to schedule for it this frame: return at once, leaving the
  // accumulator A exactly as it came in.
  if (mem8[u16(block + FLAG_FIELD)] & 1) return; // bit0 set -> already handled
  // STILL TRAVELLING (ROM 0x1396: jp 0x12d0). The flag is clear, so the actor has not committed yet.
  // Hand it to the spawn-schedule decision matchActorScheduleThenSpawnOrAnimate, which looks up this
  // round's scheduled target column and then either drops a companion object beside the actor, lets
  // it keep travelling, or latches the +0x08 flag and starts its arrival animation. Whatever that
  // dispatch produces becomes this routine's own result.
  return matchActorScheduleThenSpawnOrAnimate(m); // tail: its result is ours
}
