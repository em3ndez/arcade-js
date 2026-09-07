// SPDX-License-Identifier: GPL-3.0-only
// drawFixedTilePairHorizontal -- ROM 0x259e [code]. Seeds the horizontal tile-pair stamper (stampTilePair,
// 0x25a0) with the fixed glyph code 0x2c (44); stampTilePair writes (HL)=code, (HL+1)=code+1, then steps HL
// by the stride and the code by two, so its advanced return lets a caller's loop chain into the next pair.
// Stamps a horizontal tile pair from the fixed seed code: hands the seed to the tile-pair stamp-and-step
// and returns its advanced tile/pointer, which the caller's loop chains into the next pair.
import { stampTilePair as loc_25a0 } from "./stampTilePair.js";

// The fixed starting tile/glyph code this entry point seeds.
const TILE_SEED = 44;

export function drawFixedTilePairHorizontal(m, dst = m.regs.hl, stride = m.regs.de) {
  return loc_25a0(m, TILE_SEED, dst, stride);
}
