// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c4b — barrel slot-claim entry: store the caller's mode byte, then run the shared body
 * with that byte incremented, so the body's scratch copy sits one above the claim-mode cell.
 * Bit 7 of the claim-mode byte selects barrel kind: clear = rolls along the girders, set = drops.
 *
 * @param {object} m
 * @param {number} modeByte  stored in the claim-mode cell, then handed on incremented.
 * @param {number} bonus     the bonus value the shared body's event gate tests against.
 * LIVE-OUT: memory-only.
 */

import { BARREL_CLAIM_MODE } from "./names.js";
import { armBarrelRelease } from "./armBarrelRelease.js";

export function loc_2c4b(m, modeByte, bonus) {
  const { mem8 } = m;
  mem8[BARREL_CLAIM_MODE] = modeByte;
  armBarrelRelease(m, modeByte + 1, bonus);
}
