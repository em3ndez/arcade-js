// SPDX-License-Identifier: GPL-3.0-only
import { GAME_MODE, MODE_DISPATCH_SEL, STATUS_FLAGS, PENDING_WORK_FLAGS, EAROM_MODE, IN0_PORT } from "./names.js";
import { loc_abac } from "./loc_abac.js";

// Arm two mode bytes, then rebuild only while idle, enabled, and unbusy.
export function loc_d7e1(m) {
  const { mem8 } = m;
  mem8[STATUS_FLAGS] = 0x00;
  mem8[MODE_DISPATCH_SEL] = 0x02;
  if (mem8[EAROM_MODE] !== 0) return;
  if ((mem8[IN0_PORT] & 0x10) === 0) return;
  mem8[GAME_MODE] = 0x00;
  if ((mem8[PENDING_WORK_FLAGS] & 0x03) === 0) return;
  loc_abac(m);
}
