// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_202f — stamp the leftward horizontal step onto a falling object's motion record, then hand on
 * to the shared record tail that arms the rest of the fall. Writes the big-endian signed 16-bit
 * per-frame horizontal step (−96 in 1/256-pixel units, leftward); the mirrored arm stamps the
 * opposite at the high-X end.
 *
 * LIVE-OUT: memory, plus the accumulator (which must be zero when the tail collects it into four
 * further record bytes) and the tail's own result, forwarded unchanged.
 */

const STEP_LEFT_HI = 0xff;
const STEP_LEFT_LO = 0xa0;

export function loc_202f(m, record = m.regs.ix) {
  const { regs, mem8 } = m;

  mem8[record + 0x10] = STEP_LEFT_HI;
  mem8[record + 0x11] = STEP_LEFT_LO;

  // The tail stores this zero into four more record bytes, collecting it out of the accumulator.
  regs.a = 0;

  return m.call(0x2038);
}
