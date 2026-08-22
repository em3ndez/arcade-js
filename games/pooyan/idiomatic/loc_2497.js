// SPDX-License-Identifier: GPL-3.0-only
import { loc_250f } from "./loc_250f.js";
import { ACTOR_TABLE, SHAPE_TABLE_26C5 } from "./names.js";
/**
 * loc_2497 — the actor-table state-2 handler: a frame-delay countdown that, on expiry, advances the
 * state and nudges the primary record.
 *
 * Decrements the record's frame-delay field (0x11) and returns while it is still counting. On expiry
 * it advances the state field (0x02), loads the shape table through the shared shape-loader, then
 * steps the primary record: base Y (field 0x04) up by four and the secondary coordinate (0x06) by −6.
 *
 * LIVE-OUT: A — the new secondary coordinate from the final subtract, for a register-reading caller;
 * the still-counting early return leaves A untouched (the decrement is memory-only).
 */

export function loc_2497(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const delay = (mem8[ix + 0x11] - 1) & 0xff;
  mem8[ix + 0x11] = delay;
  if (delay !== 0) return; // still counting down this frame

  mem8[ix + 0x02] = mem8[ix + 0x02] + 1; // advance the actor state (byte wraps)
  loc_250f(m, SHAPE_TABLE_26C5, ix);

  mem8[ACTOR_TABLE + 0x04] = mem8[ACTOR_TABLE + 0x04] + 0x04; // base Y += 4 (byte wraps)
  const secondary = (mem8[ACTOR_TABLE + 0x06] - 0x06) & 0xff;
  mem8[ACTOR_TABLE + 0x06] = secondary;
  return (m.regs.a = secondary); // A live-out: the new secondary coordinate
}
