// SPDX-License-Identifier: GPL-3.0-only
/** loc_2b60 — carry one object along with the scrolling world.
 * Each of the object's two coordinates is 16 bits stored split: the whole part off one base,
 * the fraction off the other. Both gain a displacement read from a fixed pair of cells rather
 * than from the object, so every object that runs this drifts by the same amount per frame.
 * LIVE-OUT: memory only — four bytes; nothing is clamped and nothing is returned. */

export function loc_2b60(m) {
  const { regs } = m;
  const object = regs.ix;
  const sprite = regs.iy;

  driftCoordinate(m, sprite + 49, object + 3, m.mem16[0xa808]);
  driftCoordinate(m, sprite, object + 5, m.mem16[0xa80a]);
}

/** One coordinate: whole and fraction read as a single number, displaced, then split back. */
function driftCoordinate(m, wholeAddr, fractionAddr, displacement) {
  const { mem8 } = m;
  const moved = (mem8[wholeAddr] << 8) + mem8[fractionAddr] + displacement;
  mem8[wholeAddr] = moved >> 8;
  mem8[fractionAddr] = moved;
}
