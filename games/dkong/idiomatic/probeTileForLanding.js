// SPDX-License-Identifier: GPL-3.0-only
/**
 * probeTileForLanding — tile gate at the head of the airborne-descent collision probe. Maps HL
 * (y high, x low) to its tilemap cell and either REJECTS or builds a column boundary and hands to
 * resolveAirborneTileLanding.
 *
 * Returns `{ skip, a, b, c, e }`: skip is the caller-skip (false = the two-frame unwind once Mario
 * has landed), a/b the result code and twin, c the column boundary, e the pixel x. A/B still ride
 * the register file for the downstream ABI; the pixel x is threaded via `e` only.
 */

import { u8 } from "../../../core/int.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js";
import { resolveAirborneTileLanding } from "./resolveAirborneTileLanding.js";

/** REJECT tail: result code 0 in A and its twin 0 in B; the register writes ride the return. */
function reject(m) {
  const { regs } = m;
  return (regs.a = 0, regs.b = 0, { skip: true, a: 0, b: 0 });
}

/** HIT tail: resolve the airborne descent with explicit args, and carry its A/B off the return. */
function airborneHit(m, boundary, x, ix) {
  const res = resolveAirborneTileLanding(m, boundary, ix, x);
  return { skip: res.skip, a: res.a, b: res.b, c: boundary, e: x };
}

export function probeTileForLanding(m, hl = m.regs.hl, ix = m.regs.ix) {
  const { regs, mem8 } = m;

  const pixel = hl;
  const y = (pixel >> 8) & 0xff;
  const x = pixel & 0xff;
  const addr = tileAddrForPixel(y, x); // local cell address, not a live-out

  let tile = mem8[addr];

  if (tile < 0xb0) return reject(m);           // below the surface-tile band
  if ((tile & 0x0f) >= 0x08) return reject(m); // right half of the tile pair
  tile = mem8[addr];
  if (tile === 0xc0) return reject(m);         // the excluded tile

  // HIT (silent): x's 8-pixel column, minus one.
  if (tile < 0xc0) return airborneHit(m, u8((x & 0xf8) - 1), x, ix);

  // Above 0xC0: column offset from the tile band.
  let col;
  if (tile < 0xd0) col = u8((tile & 0x0f) - 9);
  else if (tile < 0xe0) col = u8((tile & 0x0f) - 1);
  else if (tile < 0xf0) col = u8((tile & 0x0f) - 9);
  else col = u8((tile & 0x0f) - 1);

  const boundary = u8((x & 0xf8) + col);
  // HIT only if left of x; otherwise the C boundary still rides out to the reject.
  if (boundary < x) return airborneHit(m, boundary, x, ix);
  return (regs.c = boundary, reject(m));
}
