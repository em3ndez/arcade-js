// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_202f — stamp the leftward horizontal step onto an object's motion record, then hand on to
 * the shared record tail that arms the rest of the fall.
 *
 * The object is one record of the falling-object array, and the loop that walks that array keeps
 * the record's base in the index register. Exactly two bytes of the record are written here and
 * nothing else: the big-endian signed 16-bit per-frame HORIZONTAL STEP, set to −96 in the record's
 * 1/256-pixel units — three eighths of a pixel per frame, leftward. Control then continues into
 * the shared tail, which sets the vertical half of the same motion along with several further
 * record bytes.
 *
 * The pair really is a per-frame step and not a timer or an index: the airborne integrator reads
 * those two bytes as one big-endian value and adds it to the record's horizontal coordinate on
 * every airborne frame. A negative value therefore means leftward, in the same convention Mario's
 * own airborne record uses.
 *
 * The arm is chosen before entry, by how near the object is to one end of the playfield: this one
 * runs at the LOW-X end and stamps a leftward step, while the mirrored arm runs at the high-X end
 * and stamps the opposite. Both push the object AWAY from the middle.
 *
 * WHAT THIS DOES NOT CLAIM: where the object ends up. Only the horizontal half of the motion is
 * set here, and what the outward step looks like on screen was not observed.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register rather than becoming
 * a named argument, because the shared tail reads that same register directly. A caller passing a
 * different record would be obeyed here and ignored one call later.
 *
 * LIVE-OUT: memory (the two written record bytes), the accumulator — which must be zero when
 * control reaches the tail, because the tail stores it into four further bytes of the record —
 * and the tail's own result, forwarded unchanged. The index register passes through untouched.
 */

/**
 * The per-frame horizontal step this arm stamps: the signed 16-bit −96, big-endian, in the
 * record's 1/256-pixel units.
 */
const STEP_LEFT_HI = 0xff;
const STEP_LEFT_LO = 0xa0;

export function loc_202f(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;

  mem8[record + 0x10] = STEP_LEFT_HI;
  mem8[record + 0x11] = STEP_LEFT_LO;

  // The tail stores this zero into four more bytes of the same record, collecting it out of the
  // accumulator rather than as an argument.
  regs.a = 0;

  return m.call(0x2038);
}
