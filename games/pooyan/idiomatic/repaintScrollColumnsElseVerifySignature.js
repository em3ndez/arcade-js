// SPDX-License-Identifier: GPL-3.0-only
import { blankTileColumn } from "./blankTileColumn.js";
import { paintColumnBodyTiles } from "./paintColumnBodyTiles.js";
import { stampCappedTileColumn } from "./stampCappedTileColumn.js";
import { verifyRomSignature } from "./verifyRomSignature.js";
import {
  WORKER_CONTROL_BYTE,
  WORKER_COLUMN_VRAM,
  COLUMN_CAP_VRAM,
  P2_SCORE_VRAM,
  GAME_ACTIVE_FLAG,
  TWO_PLAYER_FLAG,
  ACTIVE_PLAYER,
} from "./names.js";
/**
 * repaintScrollColumnsElseVerifySignature — the per-frame worker, the machine's true frame beat.
 *
 * WHAT IT IS: the one routine the foreground main loop runs once per frame. That loop spends most
 * of its time draining a ring of display commands; a queued slot with its high bit set is the
 * "worker marker", and reaching it means "run this routine, then treat that as the frame boundary."
 * So exactly one call to this happens per displayed frame, and it does the small amount of drawing
 * that must repeat every frame: nudging the two side columns of the playfield so the background
 * appears to scroll.
 *
 * ROLE IN THE MACHINE: two jobs fused into one per-frame beat. Most frames it does nothing but the
 * program-signature integrity check (an anti-tamper self-test that samples the code ROM against a
 * reference table). One frame in every sixteen it instead repaints the scrolling columns. Which of
 * the two happens is decided by WORKER_CONTROL_BYTE (0x883F) — a byte that sits one cell below the
 * sprite display list and, crucially, is NOT a static configuration value: the vblank service
 * counts it down every frame. So its low nibble sweeps 0..15 and its bit 4 toggles on a 16-frame
 * cadence, and this routine reads that free-running counter as if it were a set of control bits.
 * The low nibble is zero on just one frame of sixteen, which is when the full scroll repaint fires.
 *
 * ROM 0x0254-0x02A7. Grounding: [seen].
 *
 * LIVE-OUT: none. The main loop reloads everything it needs after this returns, so no value or
 * flag this worker leaves behind is consumed — its only lasting effect is the tile cells it stamps
 * into video RAM.
 */

const ROW_UP = -0x20; //         one tilemap row up: video-RAM rows are 0x20 cells apart, so stepping the pointer back by 0x20 moves one on-screen row upward — the shared stride that scrolls every column
const CAP_TILE_2P = 0x02; //     the cap (top) tile stamped atop the two-player mode's first column
// selects WORKER_CONTROL_BYTE's low nibble: nonzero routes to the signature check, zero to the scroll repaint
const LOW_NIBBLE = 0x0f;
const CONTROL_BIT4 = 0x10; //    gates the final blank column
const ACTIVE_BIT0 = 0x01; //     game-active low bit gates the final blank column

export function repaintScrollColumnsElseVerifySignature(m) {
  const { mem8 } = m;
  const control = mem8[WORKER_CONTROL_BYTE];

  // Pick the frame's job off the free-running control byte (0x883F). On the 15 frames of every
  // 16 where the low nibble is nonzero, the worker's whole beat is the anti-tamper signature
  // check — sample the code region against its reference table and flag any mismatch — and it
  // returns without touching the playfield.
  if ((control & LOW_NIBBLE) !== 0) {
    verifyRomSignature(m);
    return;
  }
  // Low nibble is zero: this is the one-in-sixteen scroll-repaint frame. But scrolling columns
  // only exist during a game, so bail unless the in-play gate GAME_ACTIVE_FLAG (0x8806) is set.
  if (mem8[GAME_ACTIVE_FLAG] === 0) return;

  // First (mode-dependent) side column. The one-/two-player split decides whether this region is
  // erased or painted, keyed on TWO_PLAYER_FLAG (0x880E).
  if (mem8[TWO_PLAYER_FLAG] === 0) {
    // One-player game: there is no player-2 score panel here, so wipe the whole strip. Blank the
    // capped column at COLUMN_CAP_VRAM (0x84E0), then blank three more three-cell columns marching
    // up from P2_SCORE_VRAM (0x8521, where player 2's score would live). Each blankTileColumn
    // clears three cells a row apart and hands back the pointer resting on its bottom cell; feeding
    // that straight into the next call chains the runs into one continuous erased column.
    blankTileColumn(m, COLUMN_CAP_VRAM, ROW_UP);
    let cell = blankTileColumn(m, P2_SCORE_VRAM, ROW_UP);
    cell = blankTileColumn(m, cell, ROW_UP);
    blankTileColumn(m, cell, ROW_UP);
  } else {
    // Two-player game: paint a capped body column instead of erasing. Stamp the cap tile 0x02 into
    // the top cell at COLUMN_CAP_VRAM (0x84E0), then let paintColumnBodyTiles fill the two body
    // cells below it — a solid three-tile column framing the shared player-2 area.
    mem8[COLUMN_CAP_VRAM] = CAP_TILE_2P;
    paintColumnBodyTiles(m, COLUMN_CAP_VRAM, ROW_UP);
  }

  // Second (shared) scroll column, repainted every scroll frame in both modes: a fresh three-tile
  // capped column (cap tile plus two body tiles) at WORKER_COLUMN_VRAM (0x8740), climbing one row
  // per cell. This is the column whose per-frame redraw makes the playfield edge appear to scroll.
  stampCappedTileColumn(m, WORKER_COLUMN_VRAM, ROW_UP);
  // Choose which column an optional extra blank would clear, following the active player's banks:
  // player 1 (ACTIVE_PLAYER 0x880D == 0) uses the shared column at 0x8740, player 2 uses the
  // capped column at 0x84E0.
  const column = mem8[ACTIVE_PLAYER] === 0 ? WORKER_COLUMN_VRAM : COLUMN_CAP_VRAM;

  // The optional final blank is doubly gated. It only fires when the control byte's bit 4 is set
  // (its 16-frame toggle) AND the game-active flag's low bit is set — otherwise the worker is done.
  if ((control & CONTROL_BIT4) === 0) return;
  if ((mem8[GAME_ACTIVE_FLAG] & ACTIVE_BIT0) === 0) return;
  // Both gates open: erase the selected column, clearing the cells the scrolling artwork just
  // vacated so no stale tile smear trails behind it.
  blankTileColumn(m, column, ROW_UP);
}
