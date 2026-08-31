// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_618a } from "./loc_618a.js";
import { queueSoundCommand05 } from "./queueSoundCommand05.js";
import { queueSoundCommand08 } from "./queueSoundCommand08.js";
import { ACTIVE_OBJECT_TYPE } from "./names.js";
/**
 * resetActorRecordQueueSoundAndAbortFrame — return one actor record to its idle
 * opening state, queue the matching sound effect, then abandon the caller's frame.
 *
 * ROM 0x6166-0x6189. [seen].
 *
 * WHAT IT IS
 * ----------
 * A shared "recycle this actor" tail used by the object-record handlers. The machine
 * keeps banks of fixed-stride actor records in work RAM — one per on-screen creature,
 * arrow, or launched object — and a hit-processing pass walks those records looking for
 * the one an event refers to. When a record is done (its target has been hit, or a scan
 * for a matching record comes up empty and the slot must be recycled), the handler tails into
 * here to wipe that record back to the state a freshly opened slot holds, sound the
 * event, and then stop the current pass entirely.
 *
 * The record wiped is the one IY addresses. It is reached three ways, all of which have
 * already picked the record and pointed IY at it: from the tag scan when no record
 * matches (scanRecordsForTagEngageElseReset), from the branch that recycles rather than
 * engages (retireResetOrEngageObjectRecord), and after a target has been marked engaged
 * (engageMatchedSpriteObjectAndResetActor, which seats its fields and then falls in here).
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is the "reset + report + bail" leaf of the object-record subsystem. It performs
 * three jobs in order: (1) blank the actor record to its opening layout so the slot is
 * free for reuse, (2) emit exactly one sound so the event is audible, and (3) unwind the
 * frame so the handler that called it does no further work this pass.
 *
 * LIVE-OUT: memory only — the IY record is rewritten and one sound command is queued.
 *   The frame-abort tail (which also clears ACTIVE_OBJECT_TYPE) returns a boolean that is
 *   always false, and that value is propagated straight out.
 */
export function resetActorRecordQueueSoundAndAbortFrame(m, iy = m.regs.iy) {
  const { mem8 } = m;
  // --- Step 1: blank the IY actor record to its idle opening layout ------------------
  // Overwrite the record's leading control fields with the fixed byte pattern a newly
  // opened slot carries, so the walk that scans these records next frame treats the slot
  // as available. +0x00 is the record's state/active byte: zeroing it drops the record
  // out of the "live" set and marks it idle. +0x01 and +0x02 seat the fixed opening
  // seed values the record starts life with.
  mem8[u16(iy + 0x00)] = 0x00; // idle opening state
  mem8[u16(iy + 0x01)] = 0x01;
  mem8[u16(iy + 0x02)] = 0x08;
  // +0x16 and +0x17 are the record's second pair of fixed opening seed bytes, restored
  // to the same constants a fresh slot holds.
  mem8[u16(iy + 0x16)] = 0x07;
  mem8[u16(iy + 0x17)] = 0x05;
  // +0x14 is the record's match tag — the field the tag scan (scanRecordsForTagEngageElseReset)
  // compares against when it hunts for the record an event names. Clearing it to zero
  // makes this recycled slot match no future tag lookup. +0x13 is cleared alongside it.
  mem8[u16(iy + 0x14)] = 0x00;
  mem8[u16(iy + 0x13)] = 0x00;
  // --- Step 2: queue the one sound effect for this event ------------------------------
  // ACTIVE_OBJECT_TYPE (0x8d44) holds the kind of object the current hit-processing pass
  // is handling. The special type 0x03 gets its own effect; every other type shares one.
  // Only one of the two selectors runs, so exactly one command byte lands in the ring.
  if (mem8[ACTIVE_OBJECT_TYPE] !== 0x03) queueSoundCommand05(m); // ordinary object -> effect 0x05
  else queueSoundCommand08(m); // object type 3 -> effect 0x08
  // --- Step 3: clear the object type and abandon the caller's frame -------------------
  // The tail zeroes ACTIVE_OBJECT_TYPE (0x8d44) so the pass leaves no stale object kind
  // behind, then unwinds one extra level of the call stack: control returns past the
  // handler that invoked this reset, so that handler's remaining per-record work for this
  // pass is skipped. Its result — always false — is the value this routine hands back.
  return loc_618a(m); // clear the object type and abort the frame
}
