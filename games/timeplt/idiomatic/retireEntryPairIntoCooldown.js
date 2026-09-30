// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireEntryPairIntoCooldown — clear a record's occupancy byte and both coordinates of TWO
 * neighbouring sprite entries, then arm the record's delay byte with a fixed value rather than leaving
 * it clear.
 *
 * WHAT IT IS: ROM routine 0x46DB [seen]. Five cells go to zero -- the record's first (occupancy) byte,
 * and both coordinates of each of two neighbouring sprite entries -- and one record byte is loaded with
 * 95. Nothing is read, so what it does cannot depend on anything in the machine, and a second run
 * changes nothing.
 *
 * ROLE IN THE MACHINE: it retires a thing that occupies TWO sprite entries. armMotherShipOrStep refuses
 * to spawn the Mother-Ship unless the occupancy bytes of both records of its two-slot bank read empty,
 * and then hands this routine the lead record (MOTHER_SHIP_STATE) with the matching entry base
 * (MOTHER_SHIP_ENTRY) -- so the "pair" is settled by the caller's own test, not by this routine's
 * shape. A second caller reaches it conditionally from elsewhere.
 *
 * The byte it arms, record offset 14, is the same delay byte retireSlotIntoCooldown arms with 0xF0 and
 * retireObjectAndHold with 0x80; this site's value is 95. How long that lasts depends on the routine
 * that counts it down, not on anything here.
 *
 * PARAMETERS: `record` is the object's state record (the ROM passes it in IX), `entry` its first sprite
 * entry (IY). LIVE-OUT: memory only -- the six bytes written.
 */

/** Neighbouring sprite entries are two bytes apart within each coordinate table. */
const NEXT_ENTRY = 2;
/** A sprite entry's two coordinates live in parallel tables forty-nine (0x31) bytes apart. */
const SECOND_AXIS = 49;
/** Record offset 14: the delay byte a retired slot counts down before it may be reused. */
const RECORD_BYTE = 14;
/** The delay this site arms (0x5F). */
const RECORD_CODE = 95;

export function retireEntryPairIntoCooldown(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  // Step 1: release the slot -- a zero occupancy byte is what the per-slot handlers read as "empty".
  mem8[record] = 0;
  // Step 2: zero both coordinates of BOTH sprite entries (first coordinate at +0 and +2, second at
  // +0x31 and +0x33), taking the two-entry object off the screen. The ROM does these four stores from
  // one `xor a` zero in the same order.
  mem8[entry] = 0;
  mem8[entry + NEXT_ENTRY] = 0;
  mem8[entry + SECOND_AXIS] = 0;
  mem8[entry + SECOND_AXIS + NEXT_ENTRY] = 0;
  // Step 3: arm the delay byte instead of leaving it clear, so the emptied slot is held on cooldown
  // rather than free the instant it is emptied (ROM `ld (ix+0x0e),0x5f`).
  mem8[record + RECORD_BYTE] = RECORD_CODE;
}
