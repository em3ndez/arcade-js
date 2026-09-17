// SPDX-License-Identifier: GPL-3.0-only
/**
 * snapYToGirder — nudge a coordinate one pixel along the 25m girder slope. Given the mover's X, the
 * Y being corrected, and a step selector, returns the corrected Y. It moves y only when x lands on a
 * 16-pixel cell boundary (offset 0 when step is 1, else 15); mid-cell, y is unchanged. Direction is
 * read from y's bit 0x20 in the general band, with two hard-coded band-seam rails (y == 240, y == 76)
 * that instead flip on x. A pure leaf: three unsigned-byte inputs, a corrected-Y-byte result.
 *
 * LIVE-OUT: the corrected Y byte — the value the caller stores back into a coordinate.
 */
export function snapYToGirder(x, y, step) {
  const stepIsOne = step === 1;
  const cellOffset = x % 16;

  let d;
  if (stepIsOne) {
    if (cellOffset !== 0) return y;
    d = 1;
  } else {
    if (cellOffset !== 15) return y;
    d = -1;
  }

  if (y === 240) {
    // Bottom band-seam rail: steps only when x is in its high half, else holds.
    const xInHighHalf = x >= 128;
    return xInHighHalf ? (y - d) & 0xff : y;
  }
  if (y === 76) {
    // Upper band-seam rail: steps only once x has crossed the 152 seam, else holds.
    return x < 152 ? y : (y + d) & 0xff;
  }
  // General band: y's bit 0x20 picks direction (clear -> add, set -> subtract).
  const addsAlongSlope = (y & 0x20) === 0;
  return addsAlongSlope ? (y + d) & 0xff : (y - d) & 0xff;
}

/**
 * snapYToGirderFromRegisters — the seam entry: marshals the machine to the pure (x, y, step) and
 * returns the corrected coordinate in the low half. ⚠ Without this marshalling the seam passes the
 * machine as x — a silent no-op resembling the routine's frequent early-out. The dead ABI (spare
 * accumulator/step/flags) is dropped, no consumer.
 */
export function snapYToGirderFromRegisters(m, h = m.regs.h, l = m.regs.l, b = m.regs.b) {
  const { regs } = m;
  regs.l = snapYToGirder(h, l, b);
}
