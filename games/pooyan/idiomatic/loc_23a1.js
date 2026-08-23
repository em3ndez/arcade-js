// SPDX-License-Identifier: GPL-3.0-only
import { loc_23ad } from "./loc_23ad.js";
import { STATUS_RENDER_RING, STATUS_RENDER_PHASE } from "./names.js";
/**
 * loc_23a1 — shared render phase tick. Decrements the mod-8 ring counter; while it stays
 * nonzero the caller just returns and the display holds. On wrap it borrows one from the
 * mod-4 render phase and falls into the shared render tail.
 *
 * LIVE-OUT: none — a void tail; every effect lands in the two counters and the render tail.
 */
const RING_MASK = 0x07; // ring counter wraps mod 8

export function loc_23a1(m) {
  const { mem8 } = m;

  const ring = (mem8[STATUS_RENDER_RING] - 1) & RING_MASK;
  mem8[STATUS_RENDER_RING] = ring;
  if (ring !== 0) return; // ring still counting -> hold

  mem8[STATUS_RENDER_PHASE] = mem8[STATUS_RENDER_PHASE] - 1; // borrow into the phase
  return loc_23ad(m, STATUS_RENDER_PHASE); // fall into the shared render tail
}
