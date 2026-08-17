// SPDX-License-Identifier: GPL-3.0-only
/**
 * steerSpriteObjectTowardTarget — an IX sprite-object motion arm. While active and past its move-timer reload, it
 * reads the object's per-object target coordinate and drifts (IX+2) one step toward it along
 * (IX+0) or (IX+1) by facing; on reaching the target it despawns the object unless the hold flag
 * is set, clearing the 16-byte struct and the shared 4-byte block.
 * LIVE-OUT: memory-only.
 */
import { loc_8000, HOLD_FLAG, SPRITE_OBJECT_SLOT_B } from "./names.js";

const MOVE_RELOAD = 8;
const STRUCT_BYTES = 16;
const SHARED_BLOCK_BYTES = 4;

export function steerSpriteObjectTowardTarget(m, obj = m.regs.ix, spr = m.regs.iy) {
  const { mem8 } = m;

  if (mem8[(obj + 0x06)] === 0) return; // inactive

  const timer = (mem8[(obj + 0x09)] - 1) & 0xff;
  mem8[(obj + 0x09)] = timer;
  if (timer !== 0) return; // move timer still running
  mem8[(obj + 0x09)] = MOVE_RELOAD;

  const target = mem8[loc_8000 | mem8[(obj + 0x0b)]];
  const span = mem8[(spr + 0x00)];

  if (mem8[(obj + 0x05)] !== 0) {
    if (((target - mem8[(obj + 0x00)]) & 0xff) >= span) return despawn();
    mem8[(obj + 0x02)] = (mem8[(obj + 0x02)] + 1) & 0xff;
    return;
  }
  if (((target - mem8[(obj + 0x01)]) & 0xff) < span) return despawn();
  mem8[(obj + 0x02)] = (mem8[(obj + 0x02)] - 1) & 0xff;

  function despawn() {
    if (mem8[HOLD_FLAG] !== 0) return; // held: keep the struct
    for (let i = 0; i < STRUCT_BYTES; i++) mem8[(obj + i)] = 0;
    for (let i = 0; i < SHARED_BLOCK_BYTES; i++) mem8[(SPRITE_OBJECT_SLOT_B + i)] = 0;
  }
}
