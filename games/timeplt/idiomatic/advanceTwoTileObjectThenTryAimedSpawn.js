// SPDX-License-Identifier: GPL-3.0-only
/** advanceTwoTileObjectThenTryAimedSpawn — advance a two-tile object one step: fly it along its stored velocity, then place its
 * second tile directly under the first (same X, Y dropped by sixteen). If it has reached a boundary,
 * retire it; otherwise dress the pair by heading and run the aimed-spawn attempt. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { flyAlongStoredVelocity } from "./flyAlongStoredVelocity.js";
import { loc_3cc4 } from "./loc_3cc4.js";
import { retireObjectAndHold } from "./retireObjectAndHold.js";
import { mirrorTwoTileObjectByHeading } from "./mirrorTwoTileObjectByHeading.js";
import { loc_3d25 } from "./loc_3d25.js";

const TILE_Y = 0x31;
const SECOND_TILE_Y = 0x33;
const TILE_X = 0x00;
const SECOND_TILE_X = 0x02;
const TILE_DROP = 0x10;

export function advanceTwoTileObjectThenTryAimedSpawn(m) {
  const { regs, mem8 } = m;
  const sprite = regs.iy;

  flyAlongStoredVelocity(m);
  mem8[u16(sprite + SECOND_TILE_Y)] = u8(mem8[u16(sprite + TILE_Y)] + TILE_DROP);
  mem8[u16(sprite + SECOND_TILE_X)] = mem8[u16(sprite + TILE_X)];

  if (loc_3cc4(m)) return retireObjectAndHold(m);
  mirrorTwoTileObjectByHeading(m);
  return loc_3d25(m);
}
