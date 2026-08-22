// SPDX-License-Identifier: GPL-3.0-only
import { loc_5e11 } from "./loc_5e11.js";
import { GRAB_ACTIVE_FLAG, FORMATION_STATE, WAVE_TEARDOWN_STATE, SPRITE_DISPLAY_LIST, SPRITE_TARGET_SLOTS, PROJECTILE_TABLE } from "./names.js";
/**
 * loc_5df7 — gate and seed the proximity sweep.
 *
 * Bails without touching anything when a grab is already latched, or when either the
 * formation state or the wave-teardown state is set. Otherwise it aims the sweep at its
 * three fixed tables — the sprite display list as the reference source, the sprite
 * target slots as the per-slot comparison coords, and the projectile table as the
 * records — and runs three slots. The sweep aborts itself on a grab hit.
 *
 * LIVE-OUT: none. The sweep is a tail delegate with no live-out, and the per-frame
 * updater that invokes this routine reads nothing back from it.
 */

const SLOT_COUNT = 0x03;

export function loc_5df7(m) {
  const { mem8 } = m;
  if (mem8[GRAB_ACTIVE_FLAG] !== 0) return;
  if ((mem8[FORMATION_STATE] | mem8[WAVE_TEARDOWN_STATE]) !== 0) return;
  loc_5e11(m, PROJECTILE_TABLE, SPRITE_DISPLAY_LIST, SPRITE_TARGET_SLOTS, SLOT_COUNT);
}
