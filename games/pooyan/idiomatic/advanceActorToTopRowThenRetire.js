// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceActorToTopRowThenRetire — creep one idle actor up the screen a sub-row at a
 * time and retire its record once it reaches the top row.
 *
 * ROM: 0x667c-0x66a0. Grounding: [seen].
 *
 * ROLE. Pooyan's actor records live in a fixed-stride table; each is a small struct
 * indexed off a base pointer (the caller hands one record over in the index register).
 * A record's state byte at +1 gates what happens to it this frame: this routine acts
 * only on a record whose state byte is 0 ("idle / rising"), and its whole job is to
 * inch that actor upward and, when it tops out, flip the record into the retired state
 * so a higher-level sweep can reuse the slot.
 *
 * The vertical position is stored as a two-byte fixed-point value: +5 is the fractional
 * (sub-row) part and +6 is the whole-row part. Each frame a per-actor step rate at +9 is
 * added into the fractional byte; an 8-bit overflow out of that byte carries one whole
 * row into +6. Smaller step rates therefore climb more slowly but by the same mechanism.
 *
 * When the whole-row byte finally reaches the retire row (0x1d, the top of the play
 * field) the record is retired: state byte +1 is set to 2, and +4 (a per-record scratch/
 * animation byte) and the whole-row byte +6 are both cleared. Below the retire row the
 * routine simply returns and the actor keeps climbing on later frames.
 *
 * The record fields, by offset:
 *   +1  state byte      — 0 = idle/rising (this routine runs), 2 = retired (written here)
 *   +4  scratch byte    — cleared on retire
 *   +5  position, sub-row (fractional low byte of the fixed-point height)
 *   +6  position, whole row (integer high byte; compared against the retire row)
 *   +9  per-frame step rate added into +5 each frame
 *
 * LIVE-OUT: memory only — the record's +5/+6 position and, on retire, its +1/+4/+6.
 * The caller reads back no register or flag.
 */

const RETIRE_ROW = 0x1d; // top of the play field; reaching it retires the record
const ACTOR_RETIRED_STATE = 0x02; // state byte value written into +1 on retire

export function advanceActorToTopRowThenRetire(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Act only on an idle/rising record. A nonzero state byte at +1 means this actor is
  // owned by a different handler this frame, so leave it untouched.
  if (mem8[rec + 0x01] !== 0) return;

  // Advance the fixed-point height: add the per-frame step rate (+9) into the sub-row
  // fractional byte (+5). A sum past 0xff is an 8-bit overflow — it carries one whole
  // row up into the integer height byte (+6). The truncated low byte is stored back below.
  const sum = mem8[rec + 0x05] + mem8[rec + 0x09];
  if (sum > 0xff) mem8[rec + 0x06] = mem8[rec + 0x06] + 1;
  mem8[rec + 0x05] = sum;

  // Not yet at the top row: keep the actor climbing on future frames.
  if (mem8[rec + 0x06] < RETIRE_ROW) return;

  // Reached the top row — retire the record. Mark the state byte retired and clear the
  // scratch byte (+4) and the whole-row position (+6) so the freed slot reads clean.
  mem8[rec + 0x01] = ACTOR_RETIRED_STATE;
  mem8[rec + 0x04] = 0;
  mem8[rec + 0x06] = 0;
}
