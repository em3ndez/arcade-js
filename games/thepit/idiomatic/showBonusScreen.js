// SPDX-License-Identifier: GPL-3.0-only
/**
 * showBonusScreen — paint a tier-selected status screen, then hold it with a count-length
 *            sound + score + colour-cycle animation.  ROM 0x3bec.
 *
 * Two gameplay-set config bytes choose a tier: the tier count starts at 5, gains 5
 * when the first byte is 4, and gains another 5 when the second byte is 3, so it lands
 * on 5, 10, or 15. That single count then drives both what the screen SAYS and how long
 * it animates:
 *
 *   1. Lay the shared fixed panel (edge columns, both score HUDs, the common labelled
 *      runs), then stamp three text rows over it. The top two rows each pick one of
 *      three ROM label strips by the tier (the 5 / 10 / 15 strip), so the screen reads
 *      differently per tier; the third row is a fixed strip. Two of the rows get a solid
 *      colour column beside them.
 *   2. Hold the finished screen for `count` passes. Each pass plays one sound, adds ten
 *      to the active player's score (a no-op unless a player is in play), advances the
 *      shared colour band one shade down the top row's column, and waits fifteen video
 *      frames — so the screen shimmers while it tallies, for as many passes as the tier.
 *
 * The role kept a neutral loc_ name: the mechanism (a tier-selected status screen with an
 * animated hold) is clear, but which game screen it is — and what the two config bytes
 * and the ROM strips mean — is not yet confidently pinned, so a routine name would claim
 * more than the evidence supports. Reached only from the round/mode transition (loc_02fd),
 * never during idle attract.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3bec.test.js.
 * GATE:     crafted-entry — 0x3bec never dispatches in a boot/attract run, so the gate runs
 *           it from a real captured round-setup state (the sibling painter 0x3a6f's genuine
 *           boot dispatch) and sweeps the two config bytes to reach all three tiers (5/10/15),
 *           which selects each text strip and each loop length. The fifteen-frame waits are
 *           driven by one identical per-frame-tick hook on both sides; RAM diff outside the
 *           dead stack-scratch window (pc/SP/registers excluded per the contract). Teeth: a
 *           wrong tier text strip and a hold that stops one pass short.
 * LIVE-OUT: memory-only — the painted panel + three text rows (video RAM), their colour
 *           columns (colour RAM), the queued sound-ring slots, the cycled colour band, the
 *           score digits (when a player is in play), and the tier counter 0x800a drained to
 *           0. No register/flag is read back; the oracle's tail return is modelled by m.ret.
 * NAMES:    TILE_COL / TILE_ROW / PLOT_RUN_LENGTH from ram.js. 0x8081 / 0x8082 (the two
 *           gameplay config bytes) and 0x800a (this routine's tier counter, the same hold
 *           cell showSetupScreen drains) are unnamed in ram.js and kept hex; the ROM label
 *           strips (0x4a07..0x4a55) and the colour attributes (0xa3 / 0xa6) are hex too.
 */

import { drawSharedPanel } from "./drawSharedPanel.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { copyTileColumn } from "./copyTileColumn.js";
import { fillColourColumnAt } from "./fillColourColumnAt.js";
import { requestSound8 } from "./requestSound8.js";
import { addScore } from "./addScore.js";
import { cycleColumnColour } from "./cycleColumnColour.js";
import { waitFrames } from "./waitFrames.js";
import { TILE_COL, TILE_ROW, PLOT_RUN_LENGTH } from "./ram.js";

const CONFIG_A = 0x8081; // first gameplay config byte; == 4 adds a tier
const CONFIG_B = 0x8082; // second gameplay config byte; == 3 adds a tier
const TIER_COUNTER = 0x800a; // holds the tier count, then drained to 0 by the hold loop

// The two upper text rows each pick a ROM label strip by tier; the third row is fixed.
const ROW1_STRIP = { hi: 0x4a2e, mid: 0x4a21, lo: 0x4a14 }; // tier 15 / 10 / 5
const ROW2_STRIP = { hi: 0x4a55, mid: 0x4a48, lo: 0x4a3b };
const ROW3_STRIP = 0x4a07; // fixed third row

const HOLD_FRAMES = 15; // video frames each hold pass waits
const HOLD_SCORE = 16; // packed-BCD amount added each pass (+10 on screen)
const CYCLE_COLUMN = 15; // the top row's column, cycled through the palette while holding
const RESUME_AFTER_WAIT = 0x3cb7; // the frame wait returns here through the stack

/** Pick a strip by tier: the 15-strip, the 10-strip, or (otherwise) the 5-strip. */
function stripForTier(count, strip) {
  if (count === 15) return strip.hi;
  if (count === 10) return strip.mid;
  return strip.lo;
}

/** Seat the tile cursor at (column, row) and derive its colour-RAM / video-RAM write cursors. */
function seatCell(m, column, row) {
  m.mem8[TILE_COL] = column;
  m.mem8[TILE_ROW] = row;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
}

export function showBonusScreen(m) {
  const { mem8 } = m;

  // Choose the tier from the two config bytes: 5, then +5 per matching byte -> 5/10/15.
  let count = 5;
  if (mem8[CONFIG_A] === 4) count += 5;
  if (mem8[CONFIG_B] === 3) count += 5;
  mem8[TIER_COUNTER] = count;

  // 1. The shared fixed panel, then three text rows.
  drawSharedPanel(m);

  // Row one: 12 glyphs at column 15, row 11 — the tier's strip.
  seatCell(m, 15, 11);
  mem8[PLOT_RUN_LENGTH] = 12;
  copyTileColumn(m, stripForTier(count, ROW1_STRIP));

  // Row two: 12 glyphs at column 17, row 11 — the tier's strip — then a colour column.
  seatCell(m, 17, 11);
  mem8[PLOT_RUN_LENGTH] = 12;
  copyTileColumn(m, stripForTier(count, ROW2_STRIP));
  fillColourColumnAt(m, 17, 0xa3);

  // Row three: 15 glyphs at column 21, row 9 — a fixed strip — then a colour column.
  seatCell(m, 21, 9);
  mem8[PLOT_RUN_LENGTH] = 15;
  copyTileColumn(m, ROW3_STRIP);
  fillColourColumnAt(m, 21, 0xa6);

  // 2. Hold the screen for `count` passes, shimmering the colour band as it tallies.
  let remaining;
  do {
    requestSound8(m); // one sound per pass
    addScore(m, HOLD_SCORE); // +10 to the active player's score (dropped in attract/demo)
    cycleColumnColour(m, CYCLE_COLUMN); // advance the top row's colour band one shade

    m.push16(RESUME_AFTER_WAIT);
    waitFrames(m, HOLD_FRAMES); // hold fifteen frames (returns through the stack)

    remaining = mem8[TIER_COUNTER] - 1;
    mem8[TIER_COUNTER] = remaining;
  } while (remaining !== 0);

  return m.ret();
}
