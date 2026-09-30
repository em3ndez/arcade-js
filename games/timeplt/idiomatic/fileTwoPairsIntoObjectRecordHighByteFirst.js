// SPDX-License-Identifier: GPL-3.0-only
/** fileTwoPairsIntoObjectRecordHighByteFirst — file two register pairs away in an object's record, as four separate bytes: the first
 * pair into two adjacent slots, the second into two more sixteen slots further on. Each half goes
 * in high byte first, so the pair is stored the opposite way round from a word. Nothing is read,
 * nothing is tested, and the four values are taken exactly as they arrive.
 * LIVE-OUT: memory, four bytes.
 *
 * ROM 0x46CE-0x46DA (lift: translated/loc_46ce.js — `ld (ix+0x0c),d / ld (ix+0x0d),e /
 * ld (ix+0x1c),b / ld (ix+0x1d),c / ret`). Grounding: [seen].
 *
 * Role in the machine: its caller is setMotherShipVelocityFromHeading, which files the two pairs
 * it has computed into the record through this entry. The Z80's own word store (`ld (nn),de`)
 * puts the LOW byte first; these four single-byte stores put the high byte first instead, which
 * is the "opposite way round" the name records.
 *
 * Parameters: `record` is the object record's address (the ROM's IX); `firstHigh`/`firstLow` are
 * the D/E pair and `secondHigh`/`secondLow` the B/C pair the caller leaves in registers.
 */

import { u16 } from "../../../core/int.js";

// Record offsets: +0x0C/+0x0D for the first pair, +0x1C/+0x1D for the second — sixteen further on.
const FIRST_PAIR_SLOT = 12;
const SECOND_PAIR_SLOT = 28;

export function fileTwoPairsIntoObjectRecordHighByteFirst(m, record = m.regs.ix, firstHigh = m.regs.d, firstLow = m.regs.e, secondHigh = m.regs.b, secondLow = m.regs.c) {
  const { mem8 } = m;
  // First pair (D,E): high byte into +0x0C, low byte into +0x0D.
  mem8[u16(record + FIRST_PAIR_SLOT)] = firstHigh;
  mem8[u16(record + FIRST_PAIR_SLOT + 1)] = firstLow;
  // Second pair (B,C): high byte into +0x1C, low byte into +0x1D. Addresses wrap like IX+d.
  mem8[u16(record + SECOND_PAIR_SLOT)] = secondHigh;
  mem8[u16(record + SECOND_PAIR_SLOT + 1)] = secondLow;
}
