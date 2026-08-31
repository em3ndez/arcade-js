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
 * renderMarkerColumnExtendOrRetract — per-frame lift/marker column driver at the layout pointer.
 *
 * On even round-counter frames the sibling even-frame branch runs instead. Otherwise a
 * step timer paces the work; when it expires the driver picks a glyph source and a row
 * count for one of three modes — retract (blank then redraw), extend (grow one row and
 * pulse), or steady (redraw in place) — then stamps that source down the column and, on a
 * forward frame, appends the cap glyph.
 *
 * LIVE-OUT: memory only. A void per-frame driver dispatched from the frame coordinator;
 * no caller reads a register back.
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

  // even frames run the other branch
  if ((mem8[ROUND_COUNTER] & 0x01) === 0) return driveRopeExtendAndRenderCells(m);

  // pace the driver on its own timer
  mem8[ROPE_DRAW_STEP_TIMER] = mem8[ROPE_DRAW_STEP_TIMER] - 1;
  if (mem8[ROPE_DRAW_STEP_TIMER] !== 0) return;
  mem8[ROPE_DRAW_STEP_TIMER] = PULSE;

  const phase = mem8[SPAWN_PHASE_COUNTER];
  if (phase === 0) return; // nothing to draw

  const odd = mem8[ROPE_DRAW_ANIM_PHASE] & 0x01; // animation parity picks the source variant
  let src;
  let rows;

  if (mem8[FORMATION_SLOT_TABLE] !== 0) {
    // -- retract: blank a band above the layout, then redraw the retract glyph
    src = odd ? MARKER_RETRACT_GLYPH_SRC_ODD : MARKER_RETRACT_GLYPH_SRC;
    let up = u16(mem16[MARKER_LAYOUT_PTR] - HI_STEP);
    if (mem8[up] !== BLANK) {
      for (let k = 0; k < MAX_ROWS; k++) {
        mem8[up] = BLANK;
        mem8[u16(up + 1)] = BLANK;
        up = u16(up - ROW_STRIDE);
      }
      queueSoundCommand14(m); // queue the retract display command
    }
    rows = MAX_ROWS;
  } else {
    // -- forward: advance the sweep state, then redraw or grow
    if (phase !== mem8[ROPE_DRAW_COUNT] && mem8[ROPE_DRAW_EXTEND_FLAG] === 0) {
      mem8[ROPE_DRAW_COUNT] = mem8[ROPE_DRAW_COUNT] + 1; // begin a new extend sweep
      mem8[ROPE_DRAW_EXTEND_FLAG] = 1;
      mem16[MARKER_LAYOUT_PTR] = SPRITE_BAND_86E3;
    } else if (mem8[ROPE_DRAW_EXTEND_FLAG] !== 0 && mem8[MARKER_LAYOUT_PTR] === EXTEND_LIMIT) {
      mem8[ROPE_DRAW_EXTEND_FLAG] = 0; // sweep reached its limit
      mem8[ANIM_ARMED_LATCH] = 0;
    }

    const count = mem8[ROPE_DRAW_COUNT];
    if (count < MAX_ROWS) {
      rows = count;
    } else {
      if (mem8[MARKER_LAYOUT_PTR] === CAP_MARK) mem8[ROPE_DRAW_COMPLETE_FLAG] = 1;
      rows = MAX_ROWS;
    }

    src = odd ? MARKER_COLUMN_GLYPH_SRC_ODD : MARKER_COLUMN_GLYPH_SRC;
    if (mem8[ROPE_DRAW_EXTEND_FLAG] !== 0) {
      // grow one row upward and pulse the new cell pair
      mem8[ROPE_DRAW_STEP_TIMER] = EXTEND_TIMER;
      const grown = u16(mem16[MARKER_LAYOUT_PTR] - 0x20);
      mem16[MARKER_LAYOUT_PTR] = grown;
      mem8[u16(grown + ROW_STRIDE)] = PULSE;
      mem8[u16(grown + ROW_STRIDE + 1)] = PULSE;
      queueSoundCommand0E(m); // queue the two extend display commands
      queueSoundCommand0C(m);
    }
  }

  // stamp the chosen glyph down `rows` column records from the layout pointer
  let dst = mem16[MARKER_LAYOUT_PTR];
  for (let k = 0; k < rows; k++) {
    mem8[dst] = mem8[src];
    mem8[u16(dst + 1)] = mem8[u16(src + 1)];
    mem8[u16(dst + 0x20)] = mem8[u16(src + 2)];
    mem8[u16(dst + 0x21)] = mem8[u16(src + 3)];
    dst = u16(dst - ROW_STRIDE);
  }

  // on a forward frame, append the cap glyph one row-and-a-bit below the last record
  if (mem8[FORMATION_SLOT_TABLE] === 0) {
    const capDst = u16(dst - 0x21);
    const capSrc = odd ? MARKER_GLYPH_SRC_ODD : MARKER_GLYPH_SRC;
    const [capEnd] = blitTile3x3Block(m, capDst, capSrc); // blit the 3x3 cap, take the advanced dest
    mem8[capEnd] = PULSE;
  }

  mem8[ROPE_DRAW_ANIM_PHASE] = mem8[ROPE_DRAW_ANIM_PHASE] + 1; // advance animation parity
}
