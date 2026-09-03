// SPDX-License-Identifier: GPL-3.0-only
import { copyRecordToWorkBuffer } from "./copyRecordToWorkBuffer.js";
import { loc_0563 } from "./loc_0563.js";
import { copyWorkBufferToRecord } from "./copyWorkBufferToRecord.js";
import { blockCopy } from "./blockCopy.js";
import {
  ATTRACT_ANIM_ACK, loc_2046, loc_2070, loc_2036, loc_2071, loc_2076, loc_1b58,
  ALIEN_SHOT_BLOWUP_TIMER, loc_1b50, loc_2050, loc_2058,
} from "./names.js";

// Object step handler: copy this record's descriptor strip into the shared work buffer, stage the two
// per-column rate cells, step the alien shot, then clamp its firing column at 21. If a blowup is still
// running restore the strip in place; otherwise blit the record's template band and stow the column word.
export function loc_050f(m) {
  copyRecordToWorkBuffer(m, 0xdb, ATTRACT_ANIM_ACK);
  m.mem8[loc_2070] = m.mem8[loc_2046];
  m.mem8[loc_2071] = m.mem8[loc_2036];
  loc_0563(m);
  if (m.mem8[loc_2076] >= 21) m.mem8[loc_2076] = m.mem8[loc_1b58];
  if (m.mem8[ALIEN_SHOT_BLOWUP_TIMER] !== 0) return copyWorkBufferToRecord(m, ATTRACT_ANIM_ACK);
  blockCopy(m, loc_1b50, loc_2050, 16);
  m.mem16[loc_2058] = m.mem16[loc_2076];
}
