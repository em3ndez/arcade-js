// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBarrelTileAnimation — step one barrel record's animation prescaler (+0x0f) and, on the
 * visit it reaches zero, flip the low bit of OBJ_SPRITE_CODE to show the other tile of the pair
 * and reload the prescaler; then hand off to the shared object-sprite tail. The prescaler steps as
 * a byte, so 0 wraps to 255 and only an exact zero is expiry.
 *
 * LIVE-OUT: memory, the guest pc and SP, and the propagated return value. No register and no flag.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_SPRITE_CODE } from "./names.js";

// +0x0f means a height on other object arrays; here it is this walk's animation prescaler.
const OBJ_ANIM_PRESCALER = 0x0f;
const VISITS_PER_TILE = 4;
// low bit of the tile code selects which tile of the pair; bit 7 is the raster flip
const TILE_PAIR_BIT = 1;

export function advanceBarrelTileAnimation(m, record = m.regs.ix) {
  const { mem8 } = m;

  let remaining = u8(mem8[record + OBJ_ANIM_PRESCALER] - 1);

  if (remaining === 0) {
    mem8[record + OBJ_SPRITE_CODE] = mem8[record + OBJ_SPRITE_CODE] ^ TILE_PAIR_BIT;
    remaining = VISITS_PER_TILE;
  }
  mem8[record + OBJ_ANIM_PRESCALER] = remaining;

  return m.call(0x21ba);
}
