// SPDX-License-Identifier: GPL-3.0-only
/**
 * probeTileForLanding — the tile gate at the head of the airborne-descent collision probe.
 *
 * Given a pixel coordinate (y in the high byte, x in the low byte), it looks up the tile
 * under that pixel and decides whether the pixel sits on a landable tile surface. On a
 * miss it REJECTS (result code 0). On a hit it builds a tile-column boundary in C and hands
 * off to the descent resolver, which measures Mario's fall against that boundary and either
 * keeps him airborne or snaps him onto the surface.
 *
 * The lookup: map the pixel to its tilemap cell, keeping the original pixel so its x survives
 * as the column reference. Then read the tile byte and filter it:
 *   - tile below 0xB0                 -> REJECT (not a surface tile)
 *   - low nibble 8..0xF               -> REJECT (right half of the tile pair)
 *   - tile exactly 0xC0               -> REJECT (the excluded tile)
 *   - tile below 0xC0                 -> HIT via the "silent" boundary (x column minus one)
 *   - tile above 0xC0                 -> HIT via a per-band column offset
 *
 * For the above-0xC0 hit the tile band picks a column offset from its low nibble
 * (bands 0xC1..0xCF and 0xE0..0xEF subtract 9; bands 0xD0..0xDF and 0xF0..0xFF subtract 1),
 * the boundary is (x rounded down to the 8-pixel column) plus that offset, and it is a HIT
 * only when that boundary lands strictly left of x; otherwise REJECT.
 *
 * RETURN CONTRACT (caller-skip): returns true on a normal return (the REJECT arm with result
 * code 0, and the "still airborne" verdict the descent resolver reports), and false to
 * signal the two-frame unwind that aborts the whole multi-probe collision walk once Mario has
 * landed. Callers propagate it as `if (probeTileForLanding(m) === false) return false;`.
 *
 * The tile byte comes from the hardware tilemap, which is video memory rather than game RAM,
 * so the address arithmetic here produces a raw pointer and not a named cell.
 *
 * LIVE-OUT: the result code A (0 reject / 1 landed / 2 airborne) and its twin B; Mario's Y on
 * the landed arm (written inside the descent resolver); the column boundary in C and the
 * pixel x in E, which the resolver reads; and the caller-skip boolean.
 */

import { u8 } from "../../../core/int.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js";
import { resolveAirborneTileLanding } from "./resolveAirborneTileLanding.js";

/** The REJECT tail: report code 0 in A and its twin 0 in B, normal return. */
function reject(regs) {
  regs.a = 0;
  regs.b = 0;
  return true;
}

/**
 * @param {object} m  the machine. Live-in: HL = pixel (y high, x low), IX = object pointer.
 *   Live-out: A/B result code, C boundary + E pixel-x handed to resolveAirborneTileLanding.
 * @returns {boolean} true = normal return; false = the two-frame collision-walk unwind.
 */
export function probeTileForLanding(m) {
  const { regs, mem } = m;

  // Map the pixel to its tilemap cell; keep the original pixel (its x is the column ref).
  const pixel = regs.hl;
  const y = (pixel >> 8) & 0xff;
  const x = pixel & 0xff;
  regs.hl = tileAddrForPixel(y, x); // the tilemap address the tile is read from
  regs.de = pixel;                  // DE = original pixel; E = x survives to the tail call

  // Read the tile byte under the pixel (tilemap video memory, not game RAM).
  let tile = mem.read8(regs.hl);

  // Reject filters.
  if (tile < 0xb0) return reject(regs);           // below the surface-tile band
  if ((tile & 0x0f) >= 0x08) return reject(regs); // right half of the tile pair
  tile = mem.read8(regs.hl);                       // reload the raw tile
  if (tile === 0xc0) return reject(regs);         // the excluded tile

  if (tile < 0xc0) {
    // HIT (silent): boundary is x's 8-pixel column, minus one.
    regs.c = u8((x & 0xf8) - 1);
    return resolveAirborneTileLanding(m);
  }

  // Above 0xC0: pick the column offset from the tile band (both arms converge here).
  let col;
  if (tile < 0xd0) col = u8((tile & 0x0f) - 9);       // 0xC1..0xCF
  else if (tile < 0xe0) col = u8((tile & 0x0f) - 1);  // 0xD0..0xDF
  else if (tile < 0xf0) col = u8((tile & 0x0f) - 9);  // 0xE0..0xEF
  else col = u8((tile & 0x0f) - 1);                   // 0xF0..0xFF

  // Boundary = x's 8-pixel column plus the offset; HIT only if it lands left of x.
  const boundary = u8((x & 0xf8) + col);
  regs.c = boundary;
  if (boundary < x) return resolveAirborneTileLanding(m); // HIT
  return reject(regs);
}
