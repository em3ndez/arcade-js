// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, COORD_LIST_PTR_HI, ACTIVE_ENEMY_COUNT, loc_2db, loc_2b5, HIT_TALLY } from "./names.js";
import { gateSound1f } from "./gateSound1f.js";
import { insertTimedObjectOfType } from "./insertTimedObjectOfType.js";

// Retire the object in slot Y: fire the sound gate, stage its source and target, re-insert
// a zeroed object, clear the slot, drop the live count, and flag lane X spent.
export function retireSpawnedObject(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  gateSound1f(m, x, y);
  mem8[loc_29] = mem8[u16(loc_2db + y)];
  mem8[COORD_LIST_PTR_HI] = mem8[u16(loc_2b5 + y)];
  insertTimedObjectOfType(m, 0x00, x, y);
  mem8[u16(loc_2db + y)] = 0x00;
  mem8[ACTIVE_ENEMY_COUNT]--;
  mem8[u16(HIT_TALLY + x)] = 0xff;
}
