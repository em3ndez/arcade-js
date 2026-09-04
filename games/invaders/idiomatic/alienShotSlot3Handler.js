// SPDX-License-Identifier: GPL-3.0-only
import { copyRecordToWorkBuffer } from "./copyRecordToWorkBuffer.js";
import { stepAlienShot } from "./stepAlienShot.js";
import { copyWorkBufferToRecord } from "./copyWorkBufferToRecord.js";
import { blockCopy } from "./blockCopy.js";
import { loc_067e } from "./loc_067e.js";
import {
  loc_206e, loc_2080, loc_2045, loc_2036, loc_2070, loc_2056, loc_2071, loc_2076,
  loc_1b48, ALIEN_SHOT_BLOWUP_TIMER, loc_2040, loc_1b40, ALIEN_COUNT,
} from "./names.js";

// Object handler reached by the table walker. Runs only while its gate cell is clear and its mode cell
// is one: prime the record's strip, stage the rate cells, step the alien shot, clamp its column at 16,
// then restore the strip mid-blowup or blit the record's template band. When only one alien survives it
// latches the gate; finally it publishes the column word.
export function alienShotSlot3Handler(m) {
  if (m.mem8[loc_206e] !== 0) return;
  if (m.mem8[loc_2080] !== 1) return;
  copyRecordToWorkBuffer(m, 0xed, loc_2045);
  m.mem8[loc_2070] = m.mem8[loc_2036];
  m.mem8[loc_2071] = m.mem8[loc_2056];
  stepAlienShot(m);
  if (m.mem8[loc_2076] >= 16) m.mem8[loc_2076] = m.mem8[loc_1b48];
  if (m.mem8[ALIEN_SHOT_BLOWUP_TIMER] !== 0) return copyWorkBufferToRecord(m, loc_2045);
  blockCopy(m, loc_1b40, loc_2040, 16);
  if (m.mem8[ALIEN_COUNT] === 1) m.mem8[loc_206e] = 1;
  return loc_067e(m, m.mem16[loc_2076]);
}
