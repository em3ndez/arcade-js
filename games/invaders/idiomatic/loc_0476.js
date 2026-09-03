// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { copyRecordToWorkBuffer } from "./copyRecordToWorkBuffer.js";
import { loc_0563 } from "./loc_0563.js";
import { copyWorkBufferToRecord } from "./copyWorkBufferToRecord.js";
import { blockCopy } from "./blockCopy.js";
import {
  loc_1b32, loc_2032, loc_2038, loc_2035, loc_2046, loc_2070, loc_2056, loc_2071,
  ALIEN_SHOT_BLOWUP_TIMER, loc_2030, loc_1b30,
} from "./names.js";

// Object handler reached by the table walker. Mirror one control byte, then gate on a 16-bit countdown:
// while it reads zero, reset it to its wrap value and stop for this pass. Otherwise prime the record's
// strip into the shared buffer, stage the rate cells, step the alien shot, and either restore the strip
// mid-blowup or blit the record's template band.
export function loc_0476(m) {
  m.mem8[loc_2032] = m.mem8[loc_1b32];
  const countdown = m.mem16[loc_2038];
  if (countdown === 0) { m.mem16[loc_2038] = u16(countdown - 1); return; }
  copyRecordToWorkBuffer(m, 0xf9, loc_2035);
  m.mem8[loc_2070] = m.mem8[loc_2046];
  m.mem8[loc_2071] = m.mem8[loc_2056];
  loc_0563(m);
  if (m.mem8[ALIEN_SHOT_BLOWUP_TIMER] !== 0) return copyWorkBufferToRecord(m, loc_2035);
  blockCopy(m, loc_1b30, loc_2030, 16);
}
