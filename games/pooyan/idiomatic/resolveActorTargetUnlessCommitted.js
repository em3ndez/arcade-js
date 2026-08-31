// SPDX-License-Identifier: GPL-3.0-only
import { resolveTargetColumnAndArmApproach } from "./resolveTargetColumnAndArmApproach.js";
/**
 * resolveActorTargetUnlessCommitted
 *
 * WHAT IT IS
 *   A one-bit guard sitting in front of the enemy-actor target-tile resolver. Every enemy in
 *   the wave is one fixed-stride actor record; IX points at the record being serviced this
 *   frame. The record's phase byte at rec+0x06 drives the actor phase machine
 *   (dispatchActorPhaseGatedByDelay), and once that phase byte has advanced to 0x14 or
 *   beyond, the phase machine hands control here to decide what the actor does next.
 *
 * ROLE IN THE MACHINE
 *   Enemies in this wave crawl across the playfield one tile-column at a time toward a target
 *   column, then latch on and run an approach animation. That latching is a one-time event:
 *   the resolver, once the actor has crawled far enough, arms the approach and sets the
 *   actor's state latch at rec+0x08 to 1. This guard reads bit 0 of that very latch cell up
 *   front. If the bit is set the actor is already committed to its approach, so the guard
 *   returns immediately and the resolver is skipped -- the actor keeps running the approach it
 *   already picked instead of being re-aimed every frame. If the bit is clear the actor has
 *   not yet committed, and the guard falls through to the resolver to (re)evaluate the target
 *   column and possibly arm the approach.
 *
 *   ROM 0x3625-0x362c. Grounding: [seen].
 *
 * LIVE-OUT: none -- run for its side effects. The committed path writes nothing at all; the
 *   uncommitted path forwards whatever the target-tile resolver leaves in the actor record
 *   (on the arm path: the state latch rec+0x08 set to 1 and the record repointed at an
 *   approach animation script). The record pointer IX is threaded through unchanged.
 */

const LATCH_FIELD = 0x08; //   rec+0x08: the per-actor state latch cell. Its bit 0 is the "approach committed" flag,
//                             raised to 1 by resolveTargetColumnAndArmApproach when it arms the actor's approach.
const COMMIT_BIT = 0x01; //    bit 0 of that latch: set => the actor has already committed, so the guard blocks the resolver.

export function resolveActorTargetUnlessCommitted(m, rec = m.regs.ix) {
  // `rec` addresses the enemy actor record for this frame; `mem8` is the CPU's byte-addressed
  // memory, through which the actor record fields live.
  const { mem8 } = m;

  // Read bit 0 of the state latch at rec+0x08 (ROM 0x3625 `bit 0,(ix+0x08)` / 0x3629 `ret nz`).
  // A set bit means the actor already latched onto its approach on an earlier frame, so there
  // is nothing left to resolve -- return inert and leave the record exactly as it is.
  if (mem8[rec + LATCH_FIELD] & COMMIT_BIT) return; // committed: nothing to do

  // Not yet committed (ROM 0x362a `jp 0x357c`): hand off to the target-tile resolver, passing
  // the same actor record. It works out the column the actor should be heading for this frame
  // and, once the actor has crawled past the turn threshold, arms the approach animation and
  // raises the commit bit read above -- which is what makes future frames take the early-out.
  return resolveTargetColumnAndArmApproach(m, rec);
}
