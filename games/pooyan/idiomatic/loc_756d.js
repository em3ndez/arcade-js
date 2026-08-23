// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_7595 } from "./loc_7595.js";
import { SHARED_FRAME_DELAY_TIMER, WAVE_NUMBER, ENEMY_ACTOR_TABLE, SPRITE_OBJECT_TABLE } from "./names.js";
/**
 * loc_756d — per-frame projectile/arrow spawner driver.
 *
 * While the shared frame-delay timer is still running, tick it down and return. Once it reads zero —
 * and unless all eight waves have already spawned — walk the eight paired object records (IX over the
 * enemy-actor table, IY over the sprite-object table, both stride 0x18) and try to launch each through
 * the per-record launch helper. A launch reports false and skip-returns, aborting the remaining walk (the callee's
 * pop-af caller-skip, reproduced here as an early return).
 *
 * LIVE-OUT: none — memory only; the loop pointers and counter are locals no caller reads.
 */
const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 0x08;
const ALL_WAVES_SPAWNED = 0x08;

export function loc_756d(m) {
  const { mem8 } = m;
  if (mem8[SHARED_FRAME_DELAY_TIMER] !== 0) {
    mem8[SHARED_FRAME_DELAY_TIMER]--; // tick the frame delay
    return;
  }
  if (mem8[WAVE_NUMBER] === ALL_WAVES_SPAWNED) return; // every wave already launched

  let ix = ENEMY_ACTOR_TABLE;
  let iy = SPRITE_OBJECT_TABLE;
  for (let i = 0; i < RECORD_COUNT; i++) {
    if (!loc_7595(m, ix, iy)) return; // launched -> caller-skip aborts the walk
    ix = u16(ix + RECORD_STRIDE);
    iy = u16(iy + RECORD_STRIDE);
  }
}
