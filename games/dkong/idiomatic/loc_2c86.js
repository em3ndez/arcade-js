// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c86 — bonus-event barrel-release entry: clear the slot-claim byte, then request a
 * release with mode 3. The clear leaves the byte at 0 (nothing claimed) or 0x80 (a slot claimed).
 *
 * LIVE-OUT: memory-only — the slot-claim byte, plus whatever the shared release step writes.
 */

import { BARREL_CLAIM_MODE } from "./names.js";
import { armBarrelRelease } from "./armBarrelRelease.js";

const MODE_BYTE = 0x03;

export function loc_2c86(m) {
  const { regs, mem8 } = m;
  mem8[BARREL_CLAIM_MODE] = 0;
  armBarrelRelease(m, MODE_BYTE, regs.c);
}
