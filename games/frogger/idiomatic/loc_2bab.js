// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2bab — an IX sprite-object motion arm. While active and past its move-timer reload, it
 * reads the object's per-object target coordinate and drifts (IX+2) one step toward it along
 * (IX+0) or (IX+1) by facing; on reaching the target it despawns the object unless the hold flag
 * is set, clearing the 16-byte struct and the shared 4-byte block.
 * LIVE-OUT: memory-only.
 */
import { loc_8000, loc_8004, loc_8058 } from "./names.js";

const MOVE_RELOAD = 8;
const STRUCT_BYTES = 16;
const SHARED_BLOCK_BYTES = 4;

export function loc_2bab(m) {
  const { mem8 } = m;
  const obj = m.regs.ix;
  const spr = m.regs.iy;

  if (mem8[(obj + 0x06) & 0xffff] === 0) return; // inactive

  const timer = (mem8[(obj + 0x09) & 0xffff] - 1) & 0xff;
  mem8[(obj + 0x09) & 0xffff] = timer;
  if (timer !== 0) return; // move timer still running
  mem8[(obj + 0x09) & 0xffff] = MOVE_RELOAD;

  const target = mem8[loc_8000 | mem8[(obj + 0x0b) & 0xffff]];
  const span = mem8[(spr + 0x00) & 0xffff];

  if (mem8[(obj + 0x05) & 0xffff] !== 0) {
    if (((target - mem8[(obj + 0x00) & 0xffff]) & 0xff) >= span) return despawn();
    mem8[(obj + 0x02) & 0xffff] = (mem8[(obj + 0x02) & 0xffff] + 1) & 0xff;
    return;
  }
  if (((target - mem8[(obj + 0x01) & 0xffff]) & 0xff) < span) return despawn();
  mem8[(obj + 0x02) & 0xffff] = (mem8[(obj + 0x02) & 0xffff] - 1) & 0xff;

  function despawn() {
    if (mem8[loc_8004] !== 0) return; // held: keep the struct
    for (let i = 0; i < STRUCT_BYTES; i++) mem8[(obj + i) & 0xffff] = 0;
    for (let i = 0; i < SHARED_BLOCK_BYTES; i++) mem8[(loc_8058 + i) & 0xffff] = 0;
  }
}
