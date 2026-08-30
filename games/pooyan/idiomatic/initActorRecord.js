// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * initActorRecord — stamp the fixed opening state into a fresh 0x18-byte actor record.
 * ROM 0x619f. Grounding: [seen].
 *
 * Every moving thing on the Pooyan screen — a hunter, an arrow, a chunk of meat, an eagle —
 * lives in a 0x18-byte (24-byte) record inside the actor table. When the machine decides to
 * bring a new actor to life it hands this routine the address of a fresh, otherwise-uninitialized
 * record together with a 16-bit datum, and this routine writes the handful of fields that must
 * hold known values at birth. It is the actor constructor's opening move: seed the identity
 * bytes, plant the marker the per-frame scan looks for, and store the caller's datum.
 *
 * Only six of the record's twenty-four bytes are touched here; the rest are left as they were
 * and are filled in later by whichever spawn path invoked the constructor (see the seed at
 * ROM 0x60d9, which arrives with the datum = 0x0404). This routine reads no memory of its own,
 * calls nothing, and depends on nothing but its two inputs — a pure leaf.
 *
 * LIVE-OUT: the six seeded record bytes in memory, AND the advanced record pointer left at
 * rec+0x17 (16-bit). The spawn path that called this reads that pointer back as the resume
 * point for the rest of the record's fields — it does not recompute the record base — so the
 * pointer is a genuine result, not a discard.
 */
export function initActorRecord(m, rec = m.regs.hl, value = m.regs.de) {
  const { mem8 } = m;

  // Identity constants at the head of the record. These three bytes are the same for every
  // actor born through this constructor: +0x00 = 0x00 (the top-level state/kind byte, reset to
  // its zero state), +0x01 = 0x01, +0x02 = 0x08. Later spawn code overwrites +0x00 with the
  // actor's real kind; seeding it 0 here guarantees a clean starting state either way.
  mem8[rec + 0x00] = 0x00;
  mem8[rec + 0x01] = 0x01;
  mem8[rec + 0x02] = 0x08;

  // The +0x12 marker byte, planted as 0xff. The per-frame actor scan keys off this cell, so a
  // freshly-born record must carry it before the scan next sweeps the table.
  mem8[rec + 0x12] = 0xff;

  // Store the caller's 16-bit datum little-endian across +0x16 (low byte) and +0x17 (high byte),
  // matching the Z80's low-first memory order. The datum is whatever payload the spawn path
  // wants the new actor to carry (e.g. the 0x0404 seeded at ROM 0x60d9).
  mem8[rec + 0x16] = value;
  mem8[rec + 0x17] = value >> 8;

  // Leave the pointer at the last byte written (rec+0x17); the caller's spawn path resumes the
  // record's remaining fields from here rather than re-deriving the record base.
  return (m.regs.hl = u16(rec + 0x17));
}
