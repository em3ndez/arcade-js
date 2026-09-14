// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { STATUS_FLAGS, SPINNER_ACCUM, RIM_ROT_OFFSET, loc_2a, loc_2b, COORD_LIST_PTR_LO, TUBE_GEOM_FLAG, PLAYER_SEGMENT, PLAYER_FINE_ANGLE } from "./names.js";
import { aimSpinnerAtNearestEnemy } from "./aimSpinnerAtNearestEnemy.js";
import { loc_ccb5 } from "./loc_ccb5.js";

// Advance the spinner/rotation state: skip while the angle flag is still negative. Take a raw
// delta either from the aim scan or by clamping the manual delta into its band, fold it into the
// packed-angle work cells, and when the level gate is live cap the offset and saturate it toward
// the stored sign on a sign flip. The offset's high nibble seeds the coarse angle; a changed
// coarse angle rings the sound cue; then the new coarse/fine/offset commit to the angle state.
export function rotateBlasterAroundRim(m, y = m.regs.y) {
  const { mem8 } = m;
  if (mem8[PLAYER_FINE_ANGLE] & 0x80) return;

  let a;
  if (mem8[STATUS_FLAGS] & 0x80) {
    a = mem8[SPINNER_ACCUM];
    if ((a & 0x80) === 0) {
      if (a >= 0x1f) a = 0x1f;      // positive: cap
    } else if (a < 0xe1) {
      a = 0xe1;                     // negative: floor
    }
    mem8[SPINNER_ACCUM] = 0x00;           // consume the raw reading
  } else {
    a = aimSpinnerAtNearestEnemy(m);
  }

  mem8[loc_2b] = a;
  let c = u8((a ^ 0xff) + mem8[RIM_ROT_OFFSET] + 1); // $51 - a
  mem8[COORD_LIST_PTR_LO] = c;

  if (mem8[TUBE_GEOM_FLAG] !== 0) {
    if (c >= 0xf0) { c = 0xef; mem8[COORD_LIST_PTR_LO] = c; }
    if ((c ^ mem8[loc_2b]) & 0x80 && (c ^ mem8[RIM_ROT_OFFSET]) & 0x80) {
      mem8[COORD_LIST_PTR_LO] = mem8[RIM_ROT_OFFSET] & 0x80 ? 0xef : 0x00;
    }
  }

  const hi = mem8[COORD_LIST_PTR_LO] >> 4;
  mem8[loc_2a] = hi;
  mem8[loc_2b] = (hi + 1) & 0x0f;

  if (mem8[loc_2a] !== mem8[PLAYER_SEGMENT]) loc_ccb5(m, mem8[TUBE_GEOM_FLAG], y);

  mem8[PLAYER_SEGMENT] = mem8[loc_2a];
  mem8[PLAYER_FINE_ANGLE] = mem8[loc_2b];
  mem8[RIM_ROT_OFFSET] = mem8[COORD_LIST_PTR_LO];
}
