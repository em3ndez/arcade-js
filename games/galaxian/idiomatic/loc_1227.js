// SPDX-License-Identifier: GPL-3.0-only
// Player-shot vs object-table sweep: when the shot gate is armed, box-test the shot against each of the
// seven object records (walking the object table by its record stride) and score/deactivate any that it
// hits. When the gate is clear, do nothing.
import { flagPlayerShotHitOnObject } from "./flagPlayerShotHitOnObject.js";
import { loc_4208, OBJ_TABLE } from "./names.js";

const OBJECT_COUNT = 7;
const OBJECT_STRIDE = 32; // 0x20

export function loc_1227(m) {
  const { mem8 } = m;

  if ((mem8[loc_4208] & 1) === 0) return; // shot gate closed

  let obj = OBJ_TABLE;
  for (let i = 0; i < OBJECT_COUNT; i++) {
    flagPlayerShotHitOnObject(m, obj);
    obj += OBJECT_STRIDE;
  }
}
