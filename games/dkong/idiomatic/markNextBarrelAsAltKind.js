// SPDX-License-Identifier: GPL-3.0-only
/**
 * markNextBarrelAsAltKind — raise bit 7 of BARREL_CLAIM_MODE (the barrel-KIND select), leaving
 * the low mode bits untouched. Bit 0 (straight-drop vs roll) is independent and unchanged.
 *
 * LIVE-OUT: memory-only — BARREL_CLAIM_MODE.
 */

import { BARREL_CLAIM_MODE } from "./names.js";

export function markNextBarrelAsAltKind(m) {
  const { mem8 } = m;
  mem8[BARREL_CLAIM_MODE] = mem8[BARREL_CLAIM_MODE] | 0x80;
}
