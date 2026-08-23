// SPDX-License-Identifier: GPL-3.0-only
import { loc_7625 } from "./loc_7625.js";
import { loc_02ef } from "./loc_02ef.js";
/**
 * loc_76ea — a per-frame driver that runs three subsystems in order.
 *
 * Advances the six-record object state table, walks the enemy-actor animation tick, then rebuilds
 * the sprite display list. Straight-line calls, no branches.
 *
 * SEATING: a void sequencer — no register survives; the caller reads only memory back.
 */
export function loc_76ea(m) {
  m.call(0x76f4); // advance the object state table (record-walk dispatcher)
  loc_7625(m);
  loc_02ef(m);
}
