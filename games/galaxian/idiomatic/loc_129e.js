// SPDX-License-Identifier: GPL-3.0-only
// When the object subsystem is enabled, box-test all seven objects against the player, raising the
// hit event and awarding the kill for any that overlap. Disabled: nothing to test.
import { flagObjectHitOnPlayer } from "./flagObjectHitOnPlayer.js";
import { OBJ_ACTIVE_FLAG, OBJ_TABLE } from "./names.js";

const OBJ_COUNT = 7;
const OBJ_STRIDE = 32;

export function loc_129e(m) {
  const { mem8 } = m;

  if ((mem8[OBJ_ACTIVE_FLAG] & 1) === 0) return; // subsystem disabled

  for (let i = 0; i < OBJ_COUNT; i++) {
    flagObjectHitOnPlayer(m, OBJ_TABLE + i * OBJ_STRIDE);
  }
}
