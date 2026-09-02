// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_1910 } from "./loc_1910.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";
import { readActivePlayerPageTopByte } from "./readActivePlayerPageTopByte.js";
import { drawSpriteColumn } from "./drawSpriteColumn.js";
import { drawLivesDigit } from "./drawLivesDigit.js";
import { startSound } from "./startSound.js";
import { LIVES_DIGIT_SCREEN_ADDR, RESERVE_SHIP_SPRITE, SFX_OFF_TIMER } from "./names.js";

// Award the next reserve ship once the active player's tally reaches its port-2-selected threshold: bump the
// stored count, redraw the reserve-ship column and lives digit, clear the flag, and cue the award sound.
export function loc_0935(m) {
  const flagPtr = loc_1910(m);
  if (m.mem8[flagPtr - 2] === 0) return;

  const threshold = (m.io.portIn(0x02) & 0x08) ? 0x10 : 0x15;
  const tally = m.mem8[currentPlayerRecordPtr(m) + 1];
  if (tally < threshold) return;

  const [countPtr] = readActivePlayerPageTopByte(m);
  m.mem8[countPtr] = u8(m.mem8[countPtr] + 1);
  const count = m.mem8[countPtr];

  let hi = u8(LIVES_DIGIT_SCREEN_ADDR >> 8);
  let n = count;
  do { hi = u8(hi + 2); n = u8(n - 1); } while (n !== 0);
  drawSpriteColumn(m, (hi << 8) | (LIVES_DIGIT_SCREEN_ADDR & 0xff), RESERVE_SHIP_SPRITE, 0x10);

  drawLivesDigit(m, u8(count + 1));
  m.mem8[loc_1910(m) - 2] = 0x00;
  m.mem8[SFX_OFF_TIMER] = 0xff;
  return startSound(m, 0x10);
}
