// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22f6 — give an object a randomly-sized velocity: take the rolling RANDOM byte as the speed
 * magnitude and hand it to the shared commit step (magnitude at +0x11, sign parity at +0x10).
 *
 * @param {object} m
 * @param {number} objRecord  base pointer of the object record to write, passed through untouched.
 * LIVE-OUT: whatever the commit step returns.
 */
import { RANDOM } from "./names.js";
import { loc_22f9 } from "./loc_22f9.js";

export function loc_22f6(m, objRecord) {
  return loc_22f9(m, objRecord, m.mem8[RANDOM]);
}
