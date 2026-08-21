// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  SPRITE_DISPLAY_LIST,
  ACTOR_TABLE,
  ENEMY_TARGET_REC0,
  ENEMY_ACTOR_TABLE,
} from "./names.js";
import { copyObjectRecordsToDisplayList } from "./copyObjectRecordsToDisplayList.js";
import { loc_0343 } from "./loc_0343.js";
import { loc_0320 } from "./loc_0320.js";
/**
 * loc_02ef — rebuild the sprite display list from the object-record banks each frame.
 *
 * Copies four record groups into the list in turn: the two lead actors, the two
 * enemy-target records, the eighteen moving-object records (with coordinate math), and the
 * two arrow/launch records. It then nudges the arrow group's two sprite-Y bytes down one
 * pixel each, handing the second one to the shared tail, which ticks that byte and mirrors
 * the whole list when the screen is flipped.
 *
 * LIVE-OUT: memory only (the rebuilt display list). Every caller rets straight after; no
 * register survives, matching the shared tail this falls into.
 */

const RECORD_STRIDE = 0x18; // object-record pitch
const GROUP_COUNT = 0x02; // records copied per small group
const MOVING_COUNT = 0x12; // moving-object records
const ARROW_GROUP = 0x30; // arrow/launch records sit at arena slot 2
const ARROW_SPRITE_Y_A = 0x58; // list offset of the arrow group's first sprite-Y byte
const ARROW_SPRITE_Y_B = 0x5c; // ... and the second, ticked by the shared tail

export function loc_02ef(m) {
  const { mem8 } = m;

  let list = copyObjectRecordsToDisplayList(m, SPRITE_DISPLAY_LIST, ACTOR_TABLE, RECORD_STRIDE, GROUP_COUNT);
  list = copyObjectRecordsToDisplayList(m, list, ENEMY_TARGET_REC0, RECORD_STRIDE, GROUP_COUNT);
  list = loc_0343(m, list, ENEMY_ACTOR_TABLE, RECORD_STRIDE, MOVING_COUNT);
  copyObjectRecordsToDisplayList(m, list, ACTOR_TABLE + ARROW_GROUP, RECORD_STRIDE, GROUP_COUNT);

  const yA = SPRITE_DISPLAY_LIST + ARROW_SPRITE_Y_A;
  mem8[yA] = u8(mem8[yA] - 1); // drop the first arrow sprite one pixel
  loc_0320(m, SPRITE_DISPLAY_LIST + ARROW_SPRITE_Y_B); // drop the second, then flip-mirror if armed
}
