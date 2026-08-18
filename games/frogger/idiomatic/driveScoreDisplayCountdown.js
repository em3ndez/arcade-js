// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveScoreDisplayCountdown — the per-frame score-display driver. Returns while the display guard or
 * the hold flag is set; on first entry seeds its flag and queues a tile, lays out the field, then either
 * takes the bonus arm (armScoreBonusStrip) or runs the step countdown that walks a BCD counter down and
 * animates one tile of the bar. Draining the counter to zero takes the end-strip tail. armScoreBonusStrip
 * is also a standalone entry: it blits its strip once, prints the counter byte, then scores. LIVE-OUT:
 * memory-only.
 */
import {
  FROG_STATE_DEMO_FLAG, HOLD_FLAG, COUNTDOWN_EXPIRY_FLAG, SCORE_DISPLAY_ARM_SELECT, loc_83dc,
  SCORE_DISPLAY_COUNTER_HI, loc_83de, loc_83e0, OBJRAM_COL3F_ATTR_SHADOW,
  LAYOUT_SETUP_COLUMN_VRAM, NO_MORE_FROGS_COLUMN_VRAM, LAYOUT_SETUP_STRIP_SRC,
} from "./names.js";
import { initDisplayFieldOnce } from "./initDisplayFieldOnce.js";
import { blitEndStripAndSetHold } from "./blitEndStripAndSetHold.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writePackedBcdByte } from "./writePackedBcdByte.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";
import { bcdSubByte } from "../../../core/bcd.js";

const COUNTDOWN_RELOAD = 0x20;
const BAR_BASE = LAYOUT_SETUP_COLUMN_VRAM;

export function driveScoreDisplayCountdown(m) {
  const { mem8 } = m;

  if (mem8[FROG_STATE_DEMO_FLAG] !== 0) return;
  if (mem8[HOLD_FLAG] !== 0) return;

  if (mem8[COUNTDOWN_EXPIRY_FLAG] === 0) {
    mem8[COUNTDOWN_EXPIRY_FLAG] = 1;
    enqueueSoundCommand(m, 0x06);
  }

  initDisplayFieldOnce(m);

  if (mem8[SCORE_DISPLAY_ARM_SELECT] !== 0) return armScoreBonusStrip(m);

  const left = (mem8[loc_83dc] - 1) & 0xff;
  mem8[loc_83dc] = left;
  if (left !== 0) return;
  mem8[loc_83dc] = COUNTDOWN_RELOAD;

  const counterHi = mem8[SCORE_DISPLAY_COUNTER_HI];
  if (counterHi === 0) return blitEndStripAndSetHold(m);
  mem8[SCORE_DISPLAY_COUNTER_HI] = counterHi - 1;

  const stepped = bcdSubByte(mem8[loc_83de], 1).value; // BCD decrement
  mem8[loc_83de] = stepped;

  if (stepped === 0x10) {
    enqueueSoundCommand(m, 0x05);
    mem8[OBJRAM_COL3F_ATTR_SHADOW] = 0;
  }
  return stepScoreBarTile(m);
}

// Stamp one cell of the bar: index from the counter's high bits, value 0x10 minus its low two bits.
function stepScoreBarTile(m) {
  const { mem8 } = m;
  const dd = mem8[SCORE_DISPLAY_COUNTER_HI];
  const c = dd & 0x03;
  let a = dd & 0xfc;
  a = ((a << 2) | (a >> 6)) & 0xff; // rotate left by two
  const dst = BAR_BASE + (a + a);
  mem8[dst] = 0x10 - c;
}

export function armScoreBonusStrip(m) {
  const { mem8 } = m;

  if (mem8[loc_83e0] !== 0) return;
  mem8[loc_83e0] = 1;

  copyRunUpTileColumn(m, NO_MORE_FROGS_COLUMN_VRAM, LAYOUT_SETUP_STRIP_SRC, 0x05);

  const counter = mem8[loc_83de];
  writePackedBcdByte(m, counter);

  return addScoreAndAwardExtraLife(m, counter);
}
