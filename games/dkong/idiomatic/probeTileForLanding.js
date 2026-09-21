// SPDX-License-Identifier: GPL-3.0-only
/**
 * probeTileForLanding — the tile gate at the head of the airborne-descent collision probe. Maps
 * HL (y high, x low) to its tilemap cell, reads the tile, and either REJECTS (result code 0) or
 * builds a tile-column boundary in C and hands off to resolveAirborneTileLanding.
 *
 * RETURN CONTRACT (caller-skip): true on a normal return (the REJECT arm, and the "still airborne"
 * verdict), and false to signal the two-frame unwind that aborts the collision walk once Mario has
 * landed. Callers propagate `if (probeTileForLanding(m) === false) return false;`.
 *
 * LIVE-OUT: the result code A (0 reject / 1 landed / 2 airborne) and its twin B; Mario's Y on the
 * landed arm; the column boundary in C and the pixel x in E; and the caller-skip boolean.
 */

import { u8 } from "../../../core/int.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js";
import { resolveAirborneTileLanding } from "./resolveAirborneTileLanding.js";

/** REJECT tail: report code 0 in A and its twin 0 in B, normal return. */
function reject(regs) {
  return (regs.a = 0, regs.b = 0, true); // the twin result bytes ride the return
}

export function probeTileForLanding(m, hl = m.regs.hl) {
  const { regs, mem8 } = m;

  const pixel = hl;
  const y = (pixel >> 8) & 0xff;
  const x = pixel & 0xff;
  const addr = tileAddrForPixel(y, x); // local cell address, not a live-out
  regs.de = pixel; // E = x survives to the tail call

  let tile = mem8[addr];

  if (tile < 0xb0) return reject(regs);           // below the surface-tile band
  if ((tile & 0x0f) >= 0x08) return reject(regs); // right half of the tile pair
  tile = mem8[addr];
  if (tile === 0xc0) return reject(regs);         // the excluded tile

  if (tile < 0xc0) {
    // HIT (silent): x's 8-pixel column, minus one; the C boundary rides the tail call.
    return (regs.c = u8((x & 0xf8) - 1), resolveAirborneTileLanding(m));
  }

  // Above 0xC0: column offset from the tile band.
  let col;
  if (tile < 0xd0) col = u8((tile & 0x0f) - 9);
  else if (tile < 0xe0) col = u8((tile & 0x0f) - 1);
  else if (tile < 0xf0) col = u8((tile & 0x0f) - 9);
  else col = u8((tile & 0x0f) - 1);

  const boundary = u8((x & 0xf8) + col);
  // HIT only if left of x; the C boundary rides whichever tail this arm takes.
  if (boundary < x) return (regs.c = boundary, resolveAirborneTileLanding(m));
  return (regs.c = boundary, reject(regs));
}
