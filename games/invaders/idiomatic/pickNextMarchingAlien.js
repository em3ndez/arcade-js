// SPDX-License-Identifier: GPL-3.0-only
import { alienIndexToScreenCoords } from "./alienIndexToScreenCoords.js";
import { advanceRecordTotals } from "./advanceRecordTotals.js";
import { invasionReset } from "./invasionReset.js";
import {
  ALIEN_DRAW_PENDING, ALIEN_DRAW_INDEX, ALIEN_DRAW_ADDR, ACTIVE_PLAYER_PAGE,
  FLEET_STEP_DY, loc_2004, loc_2005, loc_2068, loc_206d,
} from "./names.js";

// Pick the next marching alien to paint. Do nothing unless the picker is armed and the previous pick is
// already drawn. Scan the active player's alien-status field forward from the last index, wrapping at the
// end of the field: each wrap folds the pass totals into the reference record, toggles the frame-alternate
// bit, and gives up after two full passes with no live cell. On the found cell resolve its screen row and
// column and stash the draw coordinate. If that alien has crossed the low row threshold, end the round --
// unless a reset is already running -- by arming the warm restart. Otherwise latch the row span and raise
// the pending-draw flag for the other raster half to paint. Memory only.
export function pickNextMarchingAlien(m) {
  if (m.mem8[loc_2068] === 0) return;
  if (m.mem8[ALIEN_DRAW_PENDING] !== 0) return;

  let page = m.mem8[ACTIVE_PLAYER_PAGE];
  let index = m.mem8[ALIEN_DRAW_INDEX];
  let passesLeft = 0x02;
  for (;;) {
    index = (index + 1) & 0xff;
    if (index === 0x37) {
      if (--passesLeft === 0) return;
      m.mem8[ALIEN_DRAW_INDEX] = 0x00;
      const carry = m.mem8[FLEET_STEP_DY];
      m.mem8[FLEET_STEP_DY] = 0x00;
      advanceRecordTotals(m, FLEET_STEP_DY, carry);
      m.mem8[loc_2005] = (m.mem8[loc_2005] + 1) & 0x01;
      page = m.mem8[ACTIVE_PLAYER_PAGE];
      index = 0x00;
    }
    if (m.mem8[(page << 8) | index] === 0x01) break;
  }
  m.mem8[ALIEN_DRAW_INDEX] = index;

  const [row, col, span] = alienIndexToScreenCoords(m, index);
  m.mem16[ALIEN_DRAW_ADDR] = (col << 8) | row;
  if (row < 0x28) {
    if (m.mem8[loc_206d] === 0) m.nextMain = () => invasionReset(m);
    return;
  }
  m.mem8[loc_2004] = span;
  m.mem8[ALIEN_DRAW_PENDING] = 0x01;
}
