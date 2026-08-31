// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { resetActorRecordQueueSoundAndAbortFrame } from "./resetActorRecordQueueSoundAndAbortFrame.js";
/**
 * engageMatchedSpriteObjectAndResetActor — turn on the matched sprite-object record,
 * then recycle the actor record and bail out of the pass.
 *
 * ROM 0x6190-0x6199. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * The "record found" arm of the hit-processing scan. The machine keeps a table of
 * fixed-stride sprite-object records — one slot per launchable on-screen object
 * (SPRITE_OBJECT_TABLE 0x8b70, stride 0x18, six slots). When a hit event names a target,
 * a scan walks that table comparing the event's key against each record's +0x14 match tag:
 * scanRecordsForTagEngageElseReset does the generic walk, and the round-dependent branch
 * in retireResetOrEngageObjectRecord does the sprite-object-table walk. The first record
 * whose tag matches lands here, with IX already pointing at that matched sprite-object
 * record and IY at the actor record that drove the scan.
 *
 * This routine does the "engage" half of the transaction: it stamps two fixed fields on
 * the matched record so the object turns on, then flows straight into the shared
 * recycle-and-bail tail (resetActorRecordQueueSoundAndAbortFrame), which retires the actor
 * record, sounds the event, and unwinds the pass.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * Engaging a sprite-object record is what brings a dormant object slot to life: the two
 * seated fields are the state/parameter pair that mark the slot active. Because a matching
 * tag ends the hunt, this arm never loops back to keep scanning — it hands off to the reset
 * tail, which clears the active object type (ACTIVE_OBJECT_TYPE 0x8d44) and abandons the
 * frame so no further per-record work happens on this pass.
 *
 * LIVE-OUT: memory only — the two engaged fields on the IX record (state at +0x08,
 *   parameter at +0x0a). The routine adds no return value of its own; it propagates the
 *   reset tail's boolean, which is always false.
 */
export function engageMatchedSpriteObjectAndResetActor(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;
  // --- Step 1: mark the matched sprite-object record engaged --------------------------
  // IX addresses the sprite-object record the tag scan just matched. Seat its two "engaged"
  // control fields with the fixed constants that switch the slot on. +0x08 is the record's
  // state/active byte, set to 0x01 to move the slot from idle to live; +0x0a is its engage
  // parameter, seeded to 0xd0. From here the slot counts as an active object.
  mem8[u16(ix + 0x08)] = 0x01; // engaged state
  mem8[u16(ix + 0x0a)] = 0xd0; // engaged parameter
  // --- Step 2: recycle the actor record and abandon the pass --------------------------
  // With the target engaged, the actor record IY points at has finished its job. Fall into
  // the shared reset tail (ROM 0x6166): it blanks that record back to its idle opening
  // layout so the slot is free next frame, queues the one sound effect for this event, then
  // clears the active object type and unwinds the frame so the scan does no more work this
  // pass. Its result — always false — is handed straight back.
  return resetActorRecordQueueSoundAndAbortFrame(m, iy); // recycle the actor record and abort the frame
}
