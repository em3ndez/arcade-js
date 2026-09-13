// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PLAYER_SHOT_DEPTH, loc_29, loc_2a, loc_2b, LEVEL_GEOM_SCALE, ZOOM_ACCUM_HI, PROJ_OFS_X_LO, PROJ_OFS_X_HI, DEPTH_HI, DEPTH_LO, DEPTH_TARGET, SPIKE_TABLE_GUARD, STATUS_FLAGS, GAME_MODE, loc_3d, loc_102, REDRAW_COUNTER } from "./names.js";
import { loc_9749 } from "./loc_9749.js";

// Fold the sign-extended scroll delta into the long accumulator, step the 16-bit
// position by a fixed stride, flag it when the high byte saturates, and on a matched
// high difference rebuild the position seeds before delegating the spinner update.
export function loc_904b(m, y = m.regs.y) {
  const { mem8 } = m;
  mem8[PLAYER_SHOT_DEPTH] = 0x10;

  // Sign-extend the raw delta across low/mid/high work bytes.
  mem8[loc_29] = 0x00;
  mem8[loc_2b] = 0x00;
  mem8[loc_2a] = mem8[LEVEL_GEOM_SCALE];
  if (mem8[LEVEL_GEOM_SCALE] & 0x80) mem8[loc_2b] = 0xff;

  // Arithmetic-shift the mid:low pair right twice, preserving the sign.
  for (let i = 0; i < 2; i++) {
    const hi = mem8[loc_2a];
    mem8[loc_2a] = (hi >> 1) | (hi & 0x80);
    mem8[loc_29] = (mem8[loc_29] >> 1) | ((hi & 1) << 7);
  }

  // 24-bit accumulate the work bytes into the running total.
  let s = mem8[loc_29] + mem8[ZOOM_ACCUM_HI];
  mem8[ZOOM_ACCUM_HI] = s;
  s = mem8[loc_2a] + mem8[PROJ_OFS_X_LO] + (s >> 8);
  mem8[PROJ_OFS_X_LO] = s;
  s = mem8[loc_2b] + mem8[PROJ_OFS_X_HI] + (s >> 8);
  mem8[PROJ_OFS_X_HI] = s;

  // 16-bit position += fixed stride; flag on high-byte saturation.
  let p = mem8[DEPTH_HI] + 0x18;
  mem8[DEPTH_HI] = p;
  p = mem8[DEPTH_LO] + (p >> 8);
  mem8[DEPTH_LO] = p;
  if (mem8[DEPTH_LO] >= 0xfc) mem8[SPIKE_TABLE_GUARD] = 0x01;

  // High difference against the target; a zero difference rebuilds the seeds.
  const borrow = mem8[DEPTH_HI] >= mem8[DEPTH_TARGET] ? 1 : 0;
  const highDiff = mem8[DEPTH_LO] === 0 ? 0 : (mem8[DEPTH_LO] - 0xff - (1 - borrow)) & 0xff;
  if (highDiff === 0) {
    mem8[DEPTH_HI] = mem8[DEPTH_TARGET];
    mem8[DEPTH_LO] = 0xff;
    mem8[GAME_MODE] = mem8[STATUS_FLAGS] & 0x80 ? 0x04 : 0x08;
    mem8[u16(loc_102 + mem8[loc_3d])] = 0x00;
  }

  mem8[REDRAW_COUNTER] = 0xff;
  return loc_9749(m, y);
}
