// SPDX-License-Identifier: GPL-3.0-only
/** paintQuadTile — lay down one four-tile block and colour the whole of it in one go. The four cells
 * are the one the cursor names, its neighbour one address back, and the two a line-stride on from
 * those; they take four consecutive tile codes counting up from a base the caller fixes, in that
 * order, so the block is one picture cut into quarters and not four independent tiles. Each of
 * the four then gets the caller's single colour, written a fixed distance lower in the address
 * space — a subtraction, so a cursor already on the colour side is carried a further block down
 * rather than left where it is. The cursor comes out two line strides on, clear of the block just
 * written, so a caller can chain the next against it.
 * LIVE-OUT: the eight cells, the cursor, and the colour pointer. */

import { u16 } from "../../../core/int.js";

const LINE_STRIDE = 32;
const COLOUR_PLANE_BELOW = 1024;
const TILES = 4;

export function paintQuadTile(m) {
  const { mem8, regs } = m;
  const cell = regs.de;
  const firstTile = regs.b;
  const colour = regs.c;

  const quarters = [cell, u16(cell - 1), u16(cell - 1 + LINE_STRIDE), u16(cell + LINE_STRIDE)];
  mem8[quarters[0]] = firstTile + 1;
  mem8[quarters[1]] = firstTile;
  mem8[quarters[2]] = firstTile + 2;
  mem8[quarters[3]] = firstTile + 3;
  for (let i = TILES - 1; i >= 0; i--) mem8[u16(quarters[i] - COLOUR_PLANE_BELOW)] = colour;

  regs.hl = u16(cell - COLOUR_PLANE_BELOW);
  regs.de = u16(cell + 2 * LINE_STRIDE);
}
