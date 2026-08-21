// SPDX-License-Identifier: GPL-3.0-only
import { loc_2bd3 } from "./loc_2bd3.js";
/**
 * loc_2bd2 — a stack-adjust entry that falls straight into the ready-sprite painter.
 *
 * Reached by a jump that lands one byte early, its only machine act is to discard a byte of
 * the pushed return before continuing into the painter. That discard is a stack/return
 * effect the memory model drops, so the memory behaviour here is exactly the painter's:
 * stamp the ready-sprite square unless it is already present.
 *
 * LIVE-OUT: none — memory only (the painter's video cells).
 */

export function loc_2bd2(m) {
  return loc_2bd3(m);
}
