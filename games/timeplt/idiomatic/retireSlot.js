// SPDX-License-Identifier: GPL-3.0-only
/**
 * retireSlot — retire an object, zeroing only the INTEGER halves: its occupancy byte and both of its
 * sprite entry's coordinates, leaving the sub-pixel remainders standing.
 *
 * WHAT IT IS: ROM routine 0x40AB [seen]. Three unconditional zero stores and no reads: a slot's
 * bookkeeping and its position go out together, which is the whole of "retire". Both bases are
 * parameters, so WHICH slot retires is the caller's.
 *
 * ROLE IN THE MACHINE: it is one of two per-family retire helpers. retireSlotAndSubPixel also clears
 * the two sub-pixel remainders; no file calls both, so the two caller sets are disjoint and they are
 * two families' helpers rather than two versions of one. Whether leaving the remainders standing is
 * visible depends on whether the next occupant's spawn path reinitialises them. retireSlotIntoCooldown
 * begins with these same three stores byte for byte, and retireSlotIntoSharedCooldown calls this and
 * then re-arms the record's delay byte -- a slot going back on cooldown rather than an object deleted.
 *
 * PARAMETERS: `record` is the object's state record (the ROM passes it in IX), `entry` its sprite entry
 * (IY). LIVE-OUT: memory only -- the three bytes written.
 */

/** A sprite entry's two coordinates live in parallel tables forty-nine (0x31) bytes apart. */
const SECOND_AXIS_OFFSET = 49;

export function retireSlot(m, record = m.regs.ix, entry = m.regs.iy) {
  const { mem8 } = m;
  // Step 1: release the slot -- a zero occupancy byte is what the per-slot handlers read as "empty".
  mem8[record] = 0;
  // Step 2: take the sprite off the screen by zeroing both of its coordinates, one in each of the two
  // parallel coordinate tables.
  mem8[entry] = 0;
  mem8[entry + SECOND_AXIS_OFFSET] = 0;
}
