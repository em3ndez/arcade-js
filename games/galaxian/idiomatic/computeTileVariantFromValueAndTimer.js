// SPDX-License-Identifier: GPL-3.0-only
/**
 * computeTileVariantFromValueAndTimer (ROM 0x2104) -- the figure handlers' front door to the
 * timer-driven tile-animation variant.
 *
 * WHAT IT IS
 *   Takes a value in register B (in practice a figure's packed coordinate) and turns it into the same
 *   two-bit tile-variant index that computeTileVariantFromTimer produces, but first pre-biases the
 *   fold by the value itself. Values at or above the range limit of 112 saturate to the 0x80
 *   out-of-range marker; otherwise it isolates the value's low nibble, computes a carry byte (0xff or
 *   0) by comparing that nibble against the frame counter's low nibble, and folds the two through the
 *   timer routine.
 *
 * ROLE IN THE MACHINE
 *   Called by the animated tile-figure painters (e.g. drawAnimatedTileFigureAtPackedCoord, channel 0
 *   of the display-list drain). Biasing the animation phase by each figure's own coordinate is what
 *   keeps neighbouring figures from all flipping their tile in lockstep. Reads FRAME_COUNTER (0x425f);
 *   no memory write of its own.
 *
 * ROM 0x2104.  Grounding: [seen] (names.js cert for 0x2104).
 *
 * LIVE-OUT: register B = the 2-bit variant index, or 0x80 on the saturation path.
 */
import { computeTileVariantFromTimer } from "./computeTileVariantFromTimer.js";
import { FRAME_COUNTER } from "./names.js";

const RANGE_LIMIT = 112;  // values at or above this saturate
const OUT_OF_RANGE = 128; // saturation marker

export function computeTileVariantFromValueAndTimer(m, value = m.regs.b) {
  const { mem8 } = m;

  // Out-of-range coordinates never animate: slam B to the 0x80 marker and return.
  if (value >= RANGE_LIMIT) return (m.regs.b = OUT_OF_RANGE);

  // The low nibble of the coordinate is the per-figure phase bias fed into the fold.
  const low = value & 0x0f;
  // Carry byte for the timer fold: 0xff when the frame counter's low nibble is smaller than this figure's
  // nibble, else 0. Because the timer routine treats C as 0x00/0xff (-1 mod 4), this nudges the
  // phase one step and staggers figures against the shared FRAME_COUNTER.
  const carryIn = (mem8[FRAME_COUNTER] & 0x0f) < low ? 0xff : 0;
  // Fold the biased nibble and carry through the shared 2-bit variant core.
  return computeTileVariantFromTimer(m, low, carryIn);
}
