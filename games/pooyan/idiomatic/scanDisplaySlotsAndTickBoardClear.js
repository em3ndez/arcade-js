// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickHunterReturnCounterAndCheckBoardClear } from "./tickHunterReturnCounterAndCheckBoardClear.js";
/**
 * scanDisplaySlotsAndTickBoardClear — walk a short run of display-list slots and tick every
 * hunter-return slot in it.
 *
 * WHAT IT IS
 *   A tight sweep over four two-byte display-list slots. Each slot is a mini record: byte 0 is the
 *   slot's field-0 (a driven-off hunter's activity level, which also indexes its timer cell) and
 *   byte 1 is a tag byte. A tag of 0x8c marks the slot as a live hunter-return slot — and 0x8c is
 *   also the high byte of the 0x8c00 page that holds those hunters' paced countdown timers, so the
 *   tag doubles as the high byte of the pointer to this slot's timer cell. For every slot carrying
 *   that tag, this sweep advances that hunter's return timer by one beat (through the per-slot
 *   tick), and when the board is in its clearing phase and a hunter's timer finally runs out, that
 *   per-slot tick can divert the whole machine into the playfield tile-sum integrity check.
 *
 * ROLE IN THE MACHINE
 *   Hunters (the enemy birds) that have been driven off the formation walk back toward it on a
 *   paced countdown. This routine is the per-frame pass that services those countdowns: it is
 *   handed the base of the display-list slot run and a slot count, and applies one beat of return
 *   motion to each qualifying slot. It is the outer loop; the per-slot body it runs once per
 *   qualifying slot is tickHunterReturnCounterAndCheckBoardClear.
 *
 * ROM ADDRESS
 *   0x323e-0x324c.
 *
 * GROUNDING
 *   [seen].
 *
 * LIVE-OUT: none. The slot the loop stops on and the drained slot count are left in scratch that
 *   nothing reads back — no caller reads a result, and the shared formation epilogue that follows
 *   this sweep consumes nothing from it.
 *
 * MECHANISM NOTE — the slot count is a live value, not a snapshot.
 *   The slot count lives in the machine's B register, and the loop decrements it once per slot. On
 *   the board-clear path the per-slot tick tail-runs the tile-sum check, and that check runs its
 *   own slot walk and leaves ITS remaining count in that same B register. Because the loop's
 *   decrement-and-branch reads B directly, the sweep then resumes on the check's count and stops
 *   exactly where the check stopped, instead of blindly finishing all four original slots. Keeping
 *   the count in a register the check can overwrite is what lets the two scans share one stopping
 *   point.
 */

// A display-list slot's tag byte (byte 1 of the two-byte slot) reads 0x8c on a live hunter-return
// slot; that same 0x8c is the high byte of the pointer into the 0x8c00 timer page, so the tag both
// qualifies the slot and names the page its countdown cell lives on.
const TAG_BOARD_CLEAR = 0x8c; // slot tag that triggers the slot-clear handler
// Slots are packed two bytes apart (field-0 then tag), so the sweep steps its cursor by two.
const SLOT_STRIDE = 0x02; //    display-list slots are two bytes apart

export function scanDisplaySlotsAndTickBoardClear(m, rec = m.regs.ix, count = m.regs.b) {
  const { mem8 } = m;

  // Slot count for the sweep, taken from the machine's B register (four, for the hunter-formation
  // run that feeds this pass). Held as a live variable rather than a snapshot because the tile-sum
  // check on the board-clear path can overwrite it mid-sweep (see MECHANISM NOTE).
  let b = count & 0xff;
  // Cursor across the display-list slot run, starting at the record base handed in via IX.
  let slot = rec;
  do {
    // Tag test on byte 1 of the current slot: only slots tagged 0x8c are live hunter-return slots.
    // Any other tag means this slot is not a returning hunter this frame, so it is passed over.
    if (mem8[slot + 0x01] === TAG_BOARD_CLEAR) {
      // Advance this hunter's return timer by one beat. On the board-clear path the per-slot tick
      // hands off to the tile-sum check, which yields the count the sweep should resume on; adopt
      // that count so this loop stops exactly where the check stopped.
      const resumed = tickHunterReturnCounterAndCheckBoardClear(m, slot); // the tile-sum check resumes its counter into the djnz
      if (resumed !== undefined) b = resumed;
    }
    // Step the cursor to the next two-byte slot, wrapping to 16 bits like the machine's pointer.
    slot = u16(slot + SLOT_STRIDE);
    // Drop the slot count by one (the B-register countdown) ...
    b = (b - 1) & 0xff;
  } while (b !== 0); // ... and keep sweeping until the count reaches zero.
}
