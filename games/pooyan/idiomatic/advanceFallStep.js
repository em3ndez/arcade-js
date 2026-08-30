// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFallStep — advance a falling actor one gravity step and report whether it is
 * still in the air. ROM 0x3fd5. [seen]
 *
 * A leaf physics primitive for anything that drops through the playfield (a shot pooya, a
 * dislodged object). The actor's vertical position is kept as a 16-bit fixed-point number
 * split across the actor record: the fractional (sub-row) part in the byte at rec+0x03 and
 * the whole-row integer part in the byte at rec+0x04. Each call adds the actor's downward
 * speed — the fall velocity byte at rec+0x09 — into the fraction; when that 8-bit add
 * overflows, the fall has crossed a whole row boundary, so one is carried into the integer
 * row at rec+0x04. Speed and the two position bytes are the actor's own state; nothing
 * global moves here.
 *
 * The routine then compares the integer row against the fixed landing row 0x1e (the floor
 * this fall class comes to rest on): while the actor is still above it the fall continues,
 * and once the row reaches the landing row the fall is done.
 *
 * LIVE-OUT: memory — the updated fraction at rec+0x03 and, on a row crossing, the bumped
 * integer row at rec+0x04. Also a boolean returned to the caller (and mirrored in the
 * carry flag): true / carry set means "still above the landing row, keep falling", so a
 * caller can loop or conditionally return on it.
 */

const LANDING_ROW = 0x1e; // the floor row this fall class settles onto

export function advanceFallStep(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Integrate one gravity step: add the fall velocity (rec+0x09) into the fractional part
  // of the 16-bit vertical position (rec+0x03). The add is 8-bit, so a result past 0xff
  // means the fraction wrapped — the fall has crossed a whole-row boundary — and one row is
  // carried into the integer part (rec+0x04). The fraction is stored back 8-bit (it wraps).
  const sum = mem8[rec + 0x03] + mem8[rec + 0x09];
  if (sum > 0xff) {
    mem8[rec + 0x04] = mem8[rec + 0x04] + 1;
  }
  mem8[rec + 0x03] = sum;

  // Test the whole-row position against the landing row. While the integer row is still
  // above 0x1e the actor is airborne; the moment it reaches the landing row the fall is
  // over. This is reported both as the return value and, for a caller that returns on the
  // condition (a conditional-return keeps the fall going), in the carry flag.
  return (m.regs.fC = mem8[rec + 0x04] < LANDING_ROW);
}
