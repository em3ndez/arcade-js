// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderLivesRow  —  ROM 0x0A48  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The HUD painter for the lives/level indicator. It stamps a run of identical life-marker tiles
 *   (tile 0x4C) down one tilemap column, one marker per remaining life, so the player can read their
 *   life count off the screen. It is the DISPLAY side of the lives system only — it never changes the
 *   count itself, it just mirrors the current LIVES_COUNT (0x83b7) into video RAM.
 *
 * WHERE IT SITS
 *   Called from the board-setup / next-life path (setUpBoardOrContinueLife redraws the lives row as a
 *   board is laid), so it runs at the top of a board rather than every frame. The count it reads is
 *   maintained elsewhere: startNewGame seeds it to 1, awardExtraLife bumps and mirrors it on a board
 *   completion, and handOffToOtherPlayer loads the incoming player's count into it. This routine simply
 *   redraws whatever that count currently is.
 *
 * LIVE-OUT
 *   Memory only. It writes a column of VRAM tile cells and returns nothing; it leaves no register the
 *   caller reads.
 */
import { LIVES_COUNT, LIVES_ROW_COLUMN_VRAM } from "./names.js";

// The life-marker tile — tile 0x4C in the tile ROM (76 decimal). The same glyph awardExtraLife stamps
// when it grows the row, and the sibling of renderTimeBar's 0x4D time glyph.
const MARKER_TILE = 76;

// One full tilemap row is 32 cells wide (0x20). Adding it to a VRAM address steps to the same column on
// the next row down — so successive markers stack down a single tilemap column (the ROM's DE = 0x0020).
const ROW_STRIDE = 32;

// The drawn markers are capped at 15 (0x0F) regardless of the true life count. This mirrors the ROM's
// `CP 0x0F` clamp: it bounds how tall the row can get, NOT the underlying life count (which awardExtraLife
// caps separately at 16).
const MAX_MARKERS = 15;

// Faithful reproduction of a Z80 `djnz` quirk, not a real gameplay case. The ROM loads the (clamped)
// count into B and loops with `djnz`, which decrements B THEN tests it — so B = 0 wraps to 0xFF and runs
// the loop a full 256 times before exiting. A live game never reaches this row with a zero count, but the
// equivalence oracle exercises the edge, so we preserve it exactly.
const ZERO_DRAWS_FULL_RUN = 256;

export function renderLivesRow(m) {
  const { mem8 } = m;

  // ── Read the life count and clamp it to the visible maximum ──────────────────────────
  // LIVES_COUNT (0x83b7) is the life/level count. The ROM clamps it to 0x0F (`CP 0x0F` → keep if below,
  // else load 0x0F) before using it as the marker run length, so a large count never overruns the row.
  const count = Math.min(mem8[LIVES_COUNT], MAX_MARKERS);

  // ── Resolve the loop length, honouring the djnz zero→256 wrap ─────────────────────────
  // A clamped count of 0 does not draw zero markers — the ROM's `djnz` treats a 0 loop counter as 256
  // (see ZERO_DRAWS_FULL_RUN above). Any nonzero count draws exactly that many markers.
  const markers = count === 0 ? ZERO_DRAWS_FULL_RUN : count;

  // ── Stamp the marker column ───────────────────────────────────────────────────────────
  // Start at LIVES_ROW_COLUMN_VRAM (0xa87e), the base VRAM cell of the lives/level row, and write the
  // marker tile once per life, stepping +ROW_STRIDE (one tilemap row) after each so the markers stack
  // straight down the column. On the rotated Galaxian display this VRAM column is the on-screen lives row.
  let cell = LIVES_ROW_COLUMN_VRAM;
  for (let i = 0; i < markers; i++) {
    mem8[cell] = MARKER_TILE;
    cell += ROW_STRIDE;
  }
}
