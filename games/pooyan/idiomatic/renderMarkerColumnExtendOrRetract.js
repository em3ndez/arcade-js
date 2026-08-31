// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  ROUND_COUNTER,
  SPAWN_PHASE_COUNTER,
  FORMATION_SLOT_TABLE,
  ROPE_DRAW_COUNT,
  MARKER_LAYOUT_PTR,
  SPRITE_BAND_86E3,
  ANIM_ARMED_LATCH,
  ROPE_DRAW_STEP_TIMER,
  ROPE_DRAW_EXTEND_FLAG,
  ROPE_DRAW_COMPLETE_FLAG,
  ROPE_DRAW_ANIM_PHASE,
  MARKER_GLYPH_SRC,
  MARKER_GLYPH_SRC_ODD,
  MARKER_COLUMN_GLYPH_SRC,
  MARKER_COLUMN_GLYPH_SRC_ODD,
  MARKER_RETRACT_GLYPH_SRC,
  MARKER_RETRACT_GLYPH_SRC_ODD,
} from "./names.js";
import { driveRopeExtendAndRenderCells } from "./driveRopeExtendAndRenderCells.js";
import { queueSoundCommand0C } from "./queueSoundCommand0C.js";
import { queueSoundCommand0E } from "./queueSoundCommand0E.js";
import { queueSoundCommand14 } from "./queueSoundCommand14.js";
import { blitTile3x3Block } from "./blitTile3x3Block.js";

/**
 * renderMarkerColumnExtendOrRetract — the per-frame driver that draws the vertical rope/lift
 * marker column into video RAM, one 2x2-tile segment record at a time.
 *
 * ROM 0x25a6-0x26bc. Grounding: [seen].
 *
 * WHAT IT IS
 * ----------
 * Pooyan's playfield carries a tall vertical column of stacked segments — the pull-rope / lift
 * that grabbable hanging objects ride. This routine is that column's renderer: each frame it looks
 * at the column's current state, decides whether the column should grow taller, be pulled back in,
 * or simply be redrawn where it stands, and then stamps the segment tiles down the tilemap from a
 * saved layout pointer. The column's height is capped at seven segment records.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * One of the six per-frame sub-drivers fanned out by the alternate gameplay frame coordinator. It
 * shares the column with a sibling even-frame driver: the column advances its work on alternating
 * video frames, this half running only on odd ROUND_COUNTER (0x8907) frames and the sibling on the
 * even ones. Its own pacing timer, ROPE_DRAW_STEP_TIMER (0x8f09), throttles how often the column
 * actually redraws so the growth reads as animation rather than an instant snap.
 *
 * The three draw modes, selected by the direction flag FORMATION_SLOT_TABLE (0x8920):
 *   - RETRACT (flag nonzero): blank a band of cells one screen-band above the column, then redraw
 *     the retract glyph — the column being pulled back up out of view.
 *   - EXTEND  (flag zero, a growth sweep armed): move the layout pointer up one tile-row, pulse the
 *     newly exposed cell pair, and redraw — the column growing one segment taller.
 *   - STEADY  (flag zero, no growth sweep): redraw the existing column in place.
 * A forward (non-retract) frame also appends a 3x3 cap glyph above the top of the column.
 *
 * LIVE-OUT: memory only — segment tiles written into the 0x84/0x86-page tilemap, the layout
 * pointer / draw-state cells at MARKER_LAYOUT_PTR (0x8932) and the 0x8f0x rope-draw block updated,
 * and one or more sound cues enqueued. A void per-frame driver; no caller reads a register back.
 */

const BLANK = 0x80; // tile written when clearing a column pair
const PULSE = 0x10; // step-timer reload and the extend/cap pulse value
const EXTEND_TIMER = 0x1c; // longer reload used while growing
const MAX_ROWS = 0x07; // capped row count for the stamp loop
const ROW_STRIDE = 0x40; // one column record spans two 0x20 rows
const EXTEND_LIMIT = 0xa3; // pointer low byte that ends an extend sweep
const CAP_MARK = 0xc3; // pointer low byte that latches the complete flag
const HI_STEP = 0x400; // retract works one screen-band (high byte) up

export function renderMarkerColumnExtendOrRetract(m) {
  const { mem8, mem16 } = m;

  // -- Frame-parity gate. The column's per-frame work is split across two video frames keyed on the
  // low bit of ROUND_COUNTER (0x8907). On even frames (bit0 clear) the sibling even-frame driver
  // owns the column and this half does nothing; only odd frames fall through to the draw below.
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return driveRopeExtendAndRenderCells(m);

  // -- Redraw pacing. ROPE_DRAW_STEP_TIMER (0x8f09) throttles how often the column actually redraws.
  // Count it down one this frame; while it is still nonzero the column holds its current picture and
  // we return. When it reaches zero the draw proceeds and the timer reloads to PULSE (0x10); a
  // growth frame later overrides that reload with the longer EXTEND_TIMER so growth is slower.
  mem8[ROPE_DRAW_STEP_TIMER] = mem8[ROPE_DRAW_STEP_TIMER] - 1;
  if (mem8[ROPE_DRAW_STEP_TIMER] !== 0) return;
  mem8[ROPE_DRAW_STEP_TIMER] = PULSE;

  // -- Nothing-to-draw gate. SPAWN_PHASE_COUNTER (0x8902) is the per-round phase/step counter; while
  // it is zero no column exists yet, so there is nothing to render this frame.
  const phase = mem8[SPAWN_PHASE_COUNTER];
  if (phase === 0) return; // nothing to draw

  // -- Two-frame shimmer. ROPE_DRAW_ANIM_PHASE (0x8f0a) toggles which of a paired even/odd ROM tile
  // source to draw, alternating the segment glyphs frame to frame for a small animated shimmer. Its
  // low bit picks the variant here; the counter is bumped once at the very end of the pass.
  const odd = mem8[ROPE_DRAW_ANIM_PHASE] & 0x01; // animation parity picks the source variant
  let src;
  let rows;

  // -- Mode select. The direction flag at FORMATION_SLOT_TABLE (0x8920): nonzero pulls the column
  // back in (retract), zero draws it forward (extend or steady).
  if (mem8[FORMATION_SLOT_TABLE] !== 0) {
    // -- RETRACT: clear the band of cells above the column, then redraw the retract glyph.
    // Pick the retract tile source (MARKER_RETRACT_GLYPH_SRC 0x2770 / _ODD 0x2774) by parity.
    src = odd ? MARKER_RETRACT_GLYPH_SRC_ODD : MARKER_RETRACT_GLYPH_SRC;
    // Step the layout pointer up one whole screen-band: subtracting HI_STEP (0x400) drops the high
    // byte by four, landing on the same column one tilemap band higher.
    let up = u16(mem16[MARKER_LAYOUT_PTR] - HI_STEP);
    // Only clear if that band is not already blank (top cell != BLANK 0x80): otherwise the column
    // has already been pulled in and there is nothing left to erase.
    if (mem8[up] !== BLANK) {
      // Walk MAX_ROWS (7) records upward, blanking each record's left/right cell pair to BLANK and
      // stepping up one record (ROW_STRIDE 0x40 = two tile rows) each pass. This erases the old top
      // of the column so the redraw below leaves it visibly shorter.
      for (let k = 0; k < MAX_ROWS; k++) {
        mem8[up] = BLANK;
        mem8[u16(up + 1)] = BLANK;
        up = u16(up - ROW_STRIDE);
      }
      queueSoundCommand14(m); // raise the retract sound cue (command 0x14)
    }
    // The retract redraw always stamps the full column height.
    rows = MAX_ROWS;
  } else {
    // -- FORWARD: advance the growth-sweep state machine, then choose to grow or redraw in place.
    if (phase !== mem8[ROPE_DRAW_COUNT] && mem8[ROPE_DRAW_EXTEND_FLAG] === 0) {
      // Begin a new extend sweep. The rendered segment count ROPE_DRAW_COUNT (0x8934) lags the
      // target phase, and no sweep is in progress, so start one: bump the segment count, arm the
      // extend flag ROPE_DRAW_EXTEND_FLAG (0x8f05), and reseat the layout pointer to the interior
      // sprite band base SPRITE_BAND_86E3 (0x86e3) where the column starts.
      mem8[ROPE_DRAW_COUNT] = mem8[ROPE_DRAW_COUNT] + 1; // begin a new extend sweep
      mem8[ROPE_DRAW_EXTEND_FLAG] = 1;
      mem16[MARKER_LAYOUT_PTR] = SPRITE_BAND_86E3;
    } else if (mem8[ROPE_DRAW_EXTEND_FLAG] !== 0 && mem8[MARKER_LAYOUT_PTR] === EXTEND_LIMIT) {
      // End the sweep. A sweep is running and the layout pointer's low byte has reached its top-of-
      // travel value EXTEND_LIMIT (0xa3): clear the extend flag so no further growth happens, and
      // clear the interior-band arm latch ANIM_ARMED_LATCH (0x8f63).
      mem8[ROPE_DRAW_EXTEND_FLAG] = 0; // sweep reached its limit
      mem8[ANIM_ARMED_LATCH] = 0;
    }

    // -- Row count for this frame's stamp. While the segment count is below the seven-record cap the
    // column is drawn only as tall as it has grown; at or above the cap it draws its full height.
    const count = mem8[ROPE_DRAW_COUNT];
    if (count < MAX_ROWS) {
      rows = count;
    } else {
      // At full height, if the layout pointer's low byte has reached the terminal cap position
      // CAP_MARK (0xc3), latch ROPE_DRAW_COMPLETE_FLAG (0x8f04): the column has finished extending.
      if (mem8[MARKER_LAYOUT_PTR] === CAP_MARK) mem8[ROPE_DRAW_COMPLETE_FLAG] = 1;
      rows = MAX_ROWS;
    }

    // Pick the forward-column tile source (MARKER_COLUMN_GLYPH_SRC 0x2768 / _ODD 0x276c) by parity.
    src = odd ? MARKER_COLUMN_GLYPH_SRC_ODD : MARKER_COLUMN_GLYPH_SRC;
    if (mem8[ROPE_DRAW_EXTEND_FLAG] !== 0) {
      // -- Grow one row. A sweep is active, so make the column one segment taller this frame:
      // stretch the redraw cadence to EXTEND_TIMER (0x1c) so growth paces slower than a steady
      // redraw, move the layout pointer up one tile-row (-0x20), and store it back.
      mem8[ROPE_DRAW_STEP_TIMER] = EXTEND_TIMER;
      const grown = u16(mem16[MARKER_LAYOUT_PTR] - 0x20);
      mem16[MARKER_LAYOUT_PTR] = grown;
      // Pulse the freshly exposed cell pair one record below the new top with the bright PULSE tile
      // (0x10) so the growing tip flashes.
      mem8[u16(grown + ROW_STRIDE)] = PULSE;
      mem8[u16(grown + ROW_STRIDE + 1)] = PULSE;
      queueSoundCommand0E(m); // raise the two extend/grow sound cues (0x0e then 0x0c)
      queueSoundCommand0C(m);
    }
  }

  // -- Stamp the column. From the layout pointer, write the chosen 2x2 glyph down `rows` records:
  // the four source bytes go to the record's left/right cells (dst+0/+1) and the two cells one tile
  // row below (dst+0x20/+0x21), then step up one whole record (ROW_STRIDE 0x40) for the next. The
  // same four source bytes repeat each pass, painting a solid column of the one segment tile.
  let dst = mem16[MARKER_LAYOUT_PTR];
  for (let k = 0; k < rows; k++) {
    mem8[dst] = mem8[src];
    mem8[u16(dst + 1)] = mem8[u16(src + 1)];
    mem8[u16(dst + 0x20)] = mem8[u16(src + 2)];
    mem8[u16(dst + 0x21)] = mem8[u16(src + 3)];
    dst = u16(dst - ROW_STRIDE);
  }

  // -- Cap glyph (forward frames only). On a non-retract frame, crown the column with a 3x3 marker
  // block. The cap sits one record-and-a-column back from where the stamp loop left off (dst - 0x21);
  // its ROM source is the round-marker glyph MARKER_GLYPH_SRC (0x2754) / _ODD (0x275e) by parity.
  // The blit returns the destination it advanced to, whose end cell is pulsed with PULSE (0x10).
  if (mem8[FORMATION_SLOT_TABLE] === 0) {
    const capDst = u16(dst - 0x21);
    const capSrc = odd ? MARKER_GLYPH_SRC_ODD : MARKER_GLYPH_SRC;
    const [capEnd] = blitTile3x3Block(m, capDst, capSrc); // blit the 3x3 cap, take the advanced dest
    mem8[capEnd] = PULSE;
  }

  // -- Flip the shimmer parity for next frame: bump ROPE_DRAW_ANIM_PHASE (0x8f0a) so the paired
  // even/odd tile source alternates on the column's next redraw.
  mem8[ROPE_DRAW_ANIM_PHASE] = mem8[ROPE_DRAW_ANIM_PHASE] + 1; // advance animation parity
}
