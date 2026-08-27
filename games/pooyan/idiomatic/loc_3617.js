// SPDX-License-Identifier: GPL-3.0-only
import { loc_365d } from "./loc_365d.js";

/**
 * loc_3617 — pre-spawn guard.
 *
 * When B is below 0x20, tail to the frozen pre-spawn gate; otherwise bail. Reached by tail-jump
 * from the target-tile resolver, so both the bail and the tail run in that caller's frame.
 * LIVE-OUT: none — a dispatched state handler; the caller reloads A and reads no register back. On the
 * bail path A holds B as a harmless value result; the tail path forwards the frozen gate's result.
 */

const B_LIMIT = 0x20;

export function loc_3617(m, b = m.regs.b, rec = m.regs.ix) {
  if (b >= B_LIMIT) return (m.regs.a = b); // bail: A = B
  return loc_365d(m, rec); // tail to the pre-spawn gate
}
