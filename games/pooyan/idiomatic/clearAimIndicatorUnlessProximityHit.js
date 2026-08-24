// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_6c3f } from "./loc_6c3f.js";
import {
  SPRITE_DISPLAY_LIST,
  SPRITE_TARGET_SLOTS,
  PROJECTILE_TABLE,
  PLAYER_AIM_FLAGS,
  PROXIMITY_HIT_FLAG,
} from "./names.js";

/**
 * clearAimIndicatorUnlessProximityHit — scan three projectile records for a target-in-band proximity hit. The sprite
 * record (ix = SPRITE_DISPLAY_LIST) is fixed; each pass advances the target slot by 4 and
 * the projectile-gate record by 0x18 bytes. The per-pass proximity test returns false the
 * moment it scores a hit, which aborts the whole scan.
 *
 * If all three passes come back clean (no hit found), clear the above/below aim bits on
 * PLAYER_AIM_FLAGS and zero PROXIMITY_HIT_FLAG.
 *
 * LIVE-OUT: none. The caller reads nothing back; all effect is in memory.
 */

const RECORD_COUNT = 3;
const AIM_ABOVE = 0x04; // PLAYER_AIM_FLAGS bit2
const AIM_BELOW = 0x08; // PLAYER_AIM_FLAGS bit3

export function clearAimIndicatorUnlessProximityHit(m) {
  const { mem8 } = m;
  const record = SPRITE_DISPLAY_LIST; // ix, fixed across the scan
  let target = SPRITE_TARGET_SLOTS; //  iy, stride 4
  let gate = PROJECTILE_TABLE; //       hl, stride 0x18

  for (let n = 0; n < RECORD_COUNT; n++) {
    if (!loc_6c3f(m, record, target, gate)) return; // a hit aborts the scan
    target = u16(target + 0x04);
    gate = u16(gate + 0x18);
  }

  // no hit across all three records: clear the aim indicator and the hit flag
  mem8[PLAYER_AIM_FLAGS] = mem8[PLAYER_AIM_FLAGS] & ~AIM_ABOVE & ~AIM_BELOW;
  mem8[PROXIMITY_HIT_FLAG] = 0x00;
}
