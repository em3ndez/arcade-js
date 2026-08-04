// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBarrelMotion — move a live barrel on for this frame, choosing between five motion arms
 * from two bytes of its record.
 *
 * The routine reads two bytes, writes nothing, and jumps to one of five arms, each of which does
 * the record's actual movement and rejoins the walk. Every arm is a tail jump and none of them
 * returns here, so this routine's live-out IS the moved barrel — which is why the name is the
 * motion rather than the choice.
 *
 * TWO FIELDS, AND THE FIRST OUTRANKS THE SECOND. The select byte (record +1) is tested first and
 * for EQUALITY WITH 1; only if that fails are the low three bits of the mode byte (record +2)
 * tested, lowest first, first-set-bit-wins. Both halves of that sentence are load-bearing rather
 * than pedantic: a record can arrive with the select byte at 1 over an already-set mode byte, and
 * the priority is the only thing that decides which arm it gets.
 *
 * NOT CLAIMED. What each of the five arms does is that arm's business, and nothing here
 * establishes what an empty mode byte means beyond "the fifth arm". The mode byte's bits above
 * bit 2 are not examined at all: a record with mode 8 and one with mode 0 are indistinguishable
 * to this routine.
 *
 * THE RECORD STAYS IN THE INDEX REGISTER rather than becoming a parameter, because every arm
 * reads the record base out of that register itself — a caller passing a different base would be
 * obeyed by the two reads below and ignored one call later.
 *
 * LIVE-OUT: memory-only — this routine writes nothing — plus the chosen arm's return value
 * propagated unchanged. What it drops is the accumulator and the flags at the moment the arm is
 * entered, and nothing else.
 */

// Record fields, relative to the walk's current record base. Neither carries a shared OBJ_*
// name: offset +1 means something else again on other record arrays, so both are file-local
// here.
const BRANCH_SELECT = 1; // tested for equality with 1, and outranks the mode bits
const BRANCH_MODE_BITS = 2; // low three bits, lowest first, first set bit wins

/**
 * @param {object} m  the machine. The record base is read from the index register rather
 *                    than passed — every arm below reads it there itself.
 * @returns {*}       the chosen branch's return value, propagated unchanged.
 */
export function advanceBarrelMotion(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;

  // The select byte pre-empts the mode bits entirely, and only the exact value 1 counts.
  if (mem8[record + BRANCH_SELECT] === 1) return m.call(0x20ec);

  // Otherwise the lowest set of the three mode bits picks the branch. Every one of these
  // is entered by a jump, so there is no return address to push beside it: this routine's
  // own return IS the branch's return.
  const mode = mem8[record + BRANCH_MODE_BITS];
  if (mode & 1) return m.call(0x1fac);
  if (mode & 2) return m.call(0x1fe5);
  if (mode & 4) return m.call(0x1fef);

  // None of the three set — which includes every record whose mode byte is 8 or 0.
  return m.call(0x2053);
}
