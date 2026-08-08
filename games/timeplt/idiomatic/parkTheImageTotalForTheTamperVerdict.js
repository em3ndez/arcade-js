// SPDX-License-Identifier: GPL-3.0-only
/** parkTheImageTotalForTheTamperVerdict — park the running total the caller arrives with in the register the verdict arm
 * reads it from, and hand on. Nothing is read or written and no flag moves; the transfer is a
 * jump, so the arm's own return carries this entry too. LIVE-OUT: memory and registers. */

const CONTINUATION = 0x5303;

export function parkTheImageTotalForTheTamperVerdict(m) {
  const { regs } = m;
  regs.b = regs.a;
  return m.call(CONTINUATION);
}
