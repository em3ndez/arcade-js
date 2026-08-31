// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { engageMatchedSpriteObjectAndResetActor } from "./engageMatchedSpriteObjectAndResetActor.js";
import { resetActorRecordQueueSoundAndAbortFrame } from "./resetActorRecordQueueSoundAndAbortFrame.js";
/**
 * scanRecordsForTagEngageElseReset — walk a bank of fixed-stride records hunting for the
 * one whose match tag equals A; engage the first hit, or reset the actor record if none.
 *
 * ROM 0x615d-0x6165. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * The generic "find the record this event names" scan of the object-record subsystem. The
 * machine keeps banks of fixed-stride records in work RAM — one slot per on-screen object —
 * and every record carries a match tag at +0x14 that a hit event can point at. This routine
 * is the linear search over such a bank: starting at the base record IX, it compares the
 * search key A against each record's +0x14 tag, stepping IX forward by the stride DE after
 * every miss, for up to `count` records.
 *
 * Its one live caller (retireResetOrEngageObjectRecord) runs it over the sprite-object bank:
 * IX = SPRITE_OBJECT_TABLE (0x8b70), DE = 0x18 (the record stride), count = 6 (the six
 * sprite-object slots), A = the driving actor record's own +0x14 tag, and IY = that actor
 * record carried through so the reset tail knows which record to recycle.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This is the fork between the two outcomes of a hit-processing pass. If some record in the
 * bank claims the tag, the object it stands for is switched on (the "engage" arm) and the
 * hunt stops. If no record matches within `count` slots, the event has nothing to act on,
 * so the driving actor record is recycled instead. Both outcomes end the same way — the
 * caller's frame is abandoned so no further per-record work runs this pass.
 *
 * LIVE-OUT: nothing of its own — it seats no memory directly. It hands off to whichever
 *   continuation fires (engage-then-reset, or reset), and returns that continuation's
 *   boolean, which is always false.
 */
const TAG_FIELD = 0x14;

export function scanRecordsForTagEngageElseReset(m, a = m.regs.a, ix = m.regs.ix, de = m.regs.de, count = m.regs.b, iy = m.regs.iy) {
  const { mem8 } = m;
  // The scan cursor: starts at the base record IX and marches forward one stride at a time.
  // Each record is `de` bytes wide (0x18 for the sprite-object bank), and its match tag lives
  // at +0x14 (TAG_FIELD) — the same field the reset tail clears when it recycles a record.
  let rec = ix;
  // Walk up to `count` records looking for a tag match. `count` is the trip count as the CPU's
  // 8-bit down-counter holds it: a value of 0 means "all 256" — the full wrap of a
  // decrement-and-branch (djnz) loop — not "scan nothing".
  for (let n = count === 0 ? 256 : count; n > 0; n--) { // count 0 wraps to 256 (djnz)
    // Compare the search key A against this record's +0x14 match tag. The first record that
    // claims the tag is the target the event named: hand it (rec) and the driving actor record
    // (iy) to the engage arm, which seats that record's active fields (+0x08 := 0x01,
    // +0x0a := 0xd0) to switch the object on, then recycles the actor record and abandons the
    // frame. A match ends the hunt — the loop never resumes.
    if (a === mem8[u16(rec + TAG_FIELD)]) return engageMatchedSpriteObjectAndResetActor(m, rec, iy); // match -> engage
    // Miss: advance the cursor by the record stride DE and try the next slot.
    rec = u16(rec + de);
  }
  // The whole bank was walked with no tag match, so the event has no record to engage. Recycle
  // the driving actor record IY instead: blank it to its idle opening layout, queue the one
  // sound effect selected by ACTIVE_OBJECT_TYPE (0x8d44), clear that object type, and abandon
  // the caller's frame so the pass does no more work.
  return resetActorRecordQueueSoundAndAbortFrame(m, iy); // no match -> reset the actor record
}
