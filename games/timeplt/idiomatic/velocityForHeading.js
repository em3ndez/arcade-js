// SPDX-License-Identifier: GPL-3.0-only
/** velocityForHeading — turn an object's heading into the pair of numbers that will move it. The heading
 * counts a whole turn in 256 steps and the caller's table is read as that many signed 16-bit
 * samples, so the sample a quarter turn back is the perpendicular partner of the one at the
 * heading; their shared length is the speed, chosen by choosing the table. Which of the pair is
 * the screen's across and which its down is not settled here. LIVE-OUT: the pair; no writes. */

const SAMPLES_PER_TURN = 256;
const QUARTER_TURN = SAMPLES_PER_TURN / 4;
const HEADING_OFFSET = 2;

export function velocityForHeading(m, table = m.regs.hl, heading = m.mem8[m.regs.ix + HEADING_OFFSET]) {
  const { regs } = m;
  regs.de = sampleAt(m, table, heading);
  regs.bc = sampleAt(m, table, heading - QUARTER_TURN);
}

function sampleAt(m, table, sample) {
  const index = sample & (SAMPLES_PER_TURN - 1);
  return m.mem16[table + 2 * index];
}
