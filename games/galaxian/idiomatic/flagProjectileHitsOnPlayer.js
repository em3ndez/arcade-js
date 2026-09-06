// SPDX-License-Identifier: GPL-3.0-only
// When projectiles are enabled, box-test all 14 projectile entries against the player,
// deactivating any that hit and raising the hit-event flag.
import { flagProjectileHitOnPlayer } from "./flagProjectileHitOnPlayer.js";
import { OBJ_ACTIVE_FLAG, loc_4260 } from "./names.js";

const ENTRY_COUNT = 14;
const ENTRY_STRIDE = 5;
// The per-entry check reads its Y-band delta from register E, which the loop leaves holding the
// low byte of the record stride (5). So the band delta is always the stride value 5 -- never
// whatever E the caller happened to hold on entry.
const BAND_DELTA = ENTRY_STRIDE;

export function flagProjectileHitsOnPlayer(m) {
  const { mem8 } = m;

  // Projectiles disabled: nothing to test.
  if ((mem8[OBJ_ACTIVE_FLAG] & 1) === 0) return;

  for (let i = 0; i < ENTRY_COUNT; i++) {
    flagProjectileHitOnPlayer(m, loc_4260 + i * ENTRY_STRIDE, BAND_DELTA);
  }
}
