// SPDX-License-Identifier: GPL-3.0-only
import { alienIndexToScreenCoords } from "./alienIndexToScreenCoords.js";
import { advanceRecordTotals } from "./advanceRecordTotals.js";
import { invasionReset } from "./invasionReset.js";
import {
  ALIEN_DRAW_PENDING, ALIEN_DRAW_INDEX, ALIEN_DRAW_ADDR, ACTIVE_PLAYER_PAGE,
  FLEET_STEP_DY, loc_2004, ALIEN_MARCH_FRAME_TOGGLE, FLEET_MARCH_ENABLE, WARM_RESTART_SUPPRESS,
} from "./names.js";

/**
 * pickNextMarchingAlien (ROM 0x0141-0x0179) -- the mid-screen draw scan that advances the fleet.
 *
 * WHAT IT IS
 *   Runs once per frame from the mid-screen interrupt body (idiomaticMidNmi). It picks the NEXT live alien
 *   to repaint, one alien per frame, so the fleet ripples across the screen rather than jumping as a block.
 *   It walks an index cursor forward through the 55-cell (0x37) liveness grid of the active player, wraps at
 *   the end of a pass -- folding the fleet's per-pass motion into the reference corner and toggling the
 *   two-frame walk animation -- and hands the found alien's screen coordinate off to the drawing pass. If a
 *   picked alien has descended past the low-row limit it instead arms the round-ending warm restart.
 *
 * ROLE IN THE MACHINE
 *   The mid-frame counterpart to drawPendingAlien (which does the actual blit in the other raster half).
 *   Reads/writes: the march enable/gate FLEET_MARCH_ENABLE (clear = do nothing this frame), the draw handoff flag
 *   ALIEN_DRAW_PENDING (0x2000), the active-player page selector ACTIVE_PLAYER_PAGE (0x2067), the scan
 *   cursor ALIEN_DRAW_INDEX (0x2006), the per-pass vertical drop FLEET_STEP_DY (0x2007), the reference
 *   record it folds totals into (via advanceRecordTotals over FLEET_STEP_DY, i.e. loc_2009/loc_200a), the
 *   frame-alternate bit ALIEN_MARCH_FRAME_TOGGLE, the resolved draw coordinate ALIEN_DRAW_ADDR (0x200b), the row-span latch
 *   loc_2004, and the warm-restart suppress flag WARM_RESTART_SUPPRESS. The liveness grid byte at (page<<8 | index)
 *   reads 0x01 while that alien is alive. See mechanisms.md "The alien field and its march".
 *
 * Grounding: [seen] (mechanisms.md tags ALIEN_DRAW_PENDING/ALIEN_DRAW_ADDR [seen]; the descend-limit
 *   diversion is a [guess]-tagged threshold). ROM body confirmed against translated/loc_0141.js.
 *
 * LIVE-OUT: memory only. May set m.nextMain (arming invasionReset as the next main flow) instead of drawing.
 */
export function pickNextMarchingAlien(m) {
  // Gate 1: the march must be enabled (FLEET_MARCH_ENABLE nonzero). While clear, the fleet is frozen -- return.
  if (m.mem8[FLEET_MARCH_ENABLE] === 0) return;
  // Gate 2: never pick a new alien while the previous pick is still awaiting its blit -- the draw pass
  // clears ALIEN_DRAW_PENDING once it has painted, which is what frees this scan to advance again.
  if (m.mem8[ALIEN_DRAW_PENDING] !== 0) return;

  let page = m.mem8[ACTIVE_PLAYER_PAGE];
  let index = m.mem8[ALIEN_DRAW_INDEX];
  // A live-cell search bounded to two full passes: if two whole sweeps of the 55-cell grid find nothing
  // alive, give up this frame (guards against spinning when the field is momentarily empty).
  let passesLeft = 0x02;
  for (;;) {
    index = (index + 1) & 0xff;
    // End-of-field wrap at cell 0x37 (=55): a full pass just completed, so run the per-pass fleet step.
    if (index === 0x37) {
      // Give up after two barren passes.
      if (--passesLeft === 0) return;
      // Restart the cursor at the top of the grid.
      m.mem8[ALIEN_DRAW_INDEX] = 0x00;
      // Fold this pass's vertical drop into the reference corner: read FLEET_STEP_DY (the edge handler
      // stages the one-row drop here), clear it, then advanceRecordTotals over the FLEET_STEP_DY record
      // adds it into the reference-alien coordinate pair (loc_2009/loc_200a) -- sliding the whole fleet.
      const carry = m.mem8[FLEET_STEP_DY];
      m.mem8[FLEET_STEP_DY] = 0x00;
      advanceRecordTotals(m, FLEET_STEP_DY, carry);
      // Toggle the two-frame walk-cycle bit so aliens flip between their two poses each pass.
      m.mem8[ALIEN_MARCH_FRAME_TOGGLE] = (m.mem8[ALIEN_MARCH_FRAME_TOGGLE] + 1) & 0x01;
      // Re-read the page (the active player can change) and restart the index at the grid base.
      page = m.mem8[ACTIVE_PLAYER_PAGE];
      index = 0x00;
    }
    // Stop on the first live cell (grid byte == 0x01) at (page<<8 | index).
    if (m.mem8[(page << 8) | index] === 0x01) break;
  }
  // Remember where we stopped so next frame resumes from the following cell.
  m.mem8[ALIEN_DRAW_INDEX] = index;

  // Turn the grid index into screen coordinates (row, column, and the row span) via the reference corner.
  const [row, col, span] = alienIndexToScreenCoords(m, index);
  // Stash the draw coordinate as a packed word (col in the high byte, row in the low) for the draw pass;
  // this overwrites the reference word loadReferenceAlienState had parked at ALIEN_DRAW_ADDR.
  m.mem16[ALIEN_DRAW_ADDR] = (col << 8) | row;
  // Descend limit: if this alien has reached the bottom band (row < 0x28), the invasion has succeeded --
  // arm the round-ending warm restart as the next main flow, unless a reset is already in progress
  // (WARM_RESTART_SUPPRESS set). Either way, do not draw this alien.
  if (row < 0x28) {
    if (m.mem8[WARM_RESTART_SUPPRESS] === 0) m.nextMain = () => invasionReset(m);
    return;
  }
  // Normal case: latch the alien's row span and raise ALIEN_DRAW_PENDING to hand the blit to drawPendingAlien.
  m.mem8[loc_2004] = span;
  m.mem8[ALIEN_DRAW_PENDING] = 0x01;
}
