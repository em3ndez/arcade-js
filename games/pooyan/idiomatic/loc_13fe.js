// SPDX-License-Identifier: GPL-3.0-only
import { loc_1410 } from "./loc_1410.js";

/**
 * loc_13fe — advance an actor's X by its per-frame velocity, spending a lap/lifetime on wrap.
 *
 * Adds the velocity byte to the X byte. When the current X is below the negated velocity — the
 * step would carry it past zero — the lap/lifetime counter is decremented. The advanced X is
 * stored back and dispatched through the countdown-gated update; that result is returned.
 *
 * REGISTER BRIDGE: rec = m.regs.ix — the actor record base. LIVE-OUT: memory only — the lap
 * counter (conditionally), the stored X, and its dispatch; the return is the forwarded tail.
 */

const VELOCITY_FIELD = 0x0a; // signed per-frame velocity added to the X byte
const X_FIELD = 0x05; //       current X position
const LAP_FIELD = 0x06; //     lap/lifetime counter, spent on a wrap past zero

export function loc_13fe(m, rec = m.regs.ix) {
  const { mem8 } = m;
  const velocity = mem8[rec + VELOCITY_FIELD];
  const x = mem8[rec + X_FIELD];
  if (x < ((-velocity) & 0xff)) {
    mem8[rec + LAP_FIELD] = mem8[rec + LAP_FIELD] - 1;
  }
  return loc_1410(m, rec, (x + velocity) & 0xff);
}
