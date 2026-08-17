// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode4PointTablePhase — mode-4 attract POINT-TABLE screen renderer: draw one phase per call.
 * Steps a phase counter that reloads to 5 and counts down, so successive calls cycle phases 4,3,2,1,0.
 * Phase 0 parks the state/pacing cell to idle; phases 1-4 blit the point-table tile strips (three
 * leading a packed-BCD point value, 10/50/1000 PTS), and phase 4 also seeds four sprite records. Every
 * drawing phase parks the state cell to the drawn marker; the idle phase parks it to the idle marker.
 * The point values pass through the packed-BCD writers as hex so each nibble reads as one displayed digit.
 * LIVE-OUT: memory-only (the tilemap/VRAM strips, the sprite record cells, and the two state cells).
 */
import { NotImplemented } from "../../../boards/frogger/io.js";
import {
  ATTRACT_DEMO_PHASE_COUNTER, POINT_TABLE_DRAW_STATE,
  POINT_TABLE_PHASE1_STRIP_VRAM, POINT_TABLE_PHASE1_VALUE_VRAM, POINT_TABLE_PHASE2_VALUE_VRAM, POINT_TABLE_PHASE2_STRIP_VRAM, POINT_TABLE_PHASE3_VALUE_VRAM, POINT_TABLE_PHASE3_STRIP_VRAM, POINT_TABLE_PHASE4_VALUE_VRAM,
  POINT_TABLE_PHASE1_STRIP_ROM, PTS_SUFFIX_STRIP, POINT_TABLE_PHASE2_VALUE_ROM, INTRO_TITLE_STRIP2_SRC, POINT_TABLE_PHASE3_VALUE_ROM, POINT_TABLE_PHASE3_STRIP_ROM, POINT_TABLE_PHASE2_STRIP_ROM, POINT_TABLE_PHASE4_VALUE_ROM,
  POINT_TABLE_SPRITE_ATTR_801D, SCREEN_MODE_STATE, POINT_TABLE_SPRITE_ATTR_8029, LANE_LOW_BOUND_SELECTOR, INTRO_COUNTER_801B, OBJECT_ANIM_STATE_8021, POINT_TABLE_SPRITE_CODE_8027, POINT_TABLE_SPRITE_CODE_802D,
} from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writePackedBcdWord } from "./writePackedBcdWord.js";
import { writePackedBcdByte } from "./writePackedBcdByte.js";

const STATE_IDLE = 0xc0;
const STATE_DRAWN = 0x80;

export function renderMode4PointTablePhase(m) {
  const { regs, mem8 } = m;

  // reload the counter when it drains, then count down: the low value selects this call's phase
  let phase = mem8[ATTRACT_DEMO_PHASE_COUNTER];
  if (phase === 0) phase = 5;
  phase -= 1;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = phase;

  switch (phase) {
    case 0:
      mem8[POINT_TABLE_DRAW_STATE] = STATE_IDLE;
      return;

    case 1:
      copyRunUpTileColumn(m, POINT_TABLE_PHASE1_STRIP_VRAM, POINT_TABLE_PHASE1_STRIP_ROM, 10);
      regs.hl = POINT_TABLE_PHASE1_VALUE_VRAM;
      copyRunUpTileColumn(m, writePackedBcdByte(m, 0x10), PTS_SUFFIX_STRIP, 4);
      copyRunUpTileColumn(m, regs.hl, regs.de, 19);
      break;

    case 2:
      regs.hl = POINT_TABLE_PHASE2_VALUE_VRAM;
      copyRunUpTileColumn(m, writePackedBcdWord(m, 0x1000), PTS_SUFFIX_STRIP, 4);
      copyRunUpTileColumn(m, regs.hl, POINT_TABLE_PHASE2_VALUE_ROM, 10);
      copyRunUpTileColumn(m, regs.hl, INTRO_TITLE_STRIP2_SRC, 6);
      copyRunUpTileColumn(m, POINT_TABLE_PHASE2_STRIP_VRAM, POINT_TABLE_PHASE2_STRIP_ROM, 15);
      break;

    case 3:
      regs.hl = POINT_TABLE_PHASE3_VALUE_VRAM;
      copyRunUpTileColumn(m, writePackedBcdByte(m, 0x50), PTS_SUFFIX_STRIP, 4);
      copyRunUpTileColumn(m, regs.hl, POINT_TABLE_PHASE3_VALUE_ROM, 10);
      copyRunUpTileColumn(m, regs.hl, INTRO_TITLE_STRIP2_SRC, 5);
      copyRunUpTileColumn(m, POINT_TABLE_PHASE3_STRIP_VRAM, POINT_TABLE_PHASE3_STRIP_ROM, 19);
      break;

    case 4:
      mem8[POINT_TABLE_SPRITE_ATTR_801D] = 6;
      mem8[SCREEN_MODE_STATE] = 6;
      mem8[POINT_TABLE_SPRITE_ATTR_8029] = 6;
      mem8[LANE_LOW_BOUND_SELECTOR] = 6;
      mem8[INTRO_COUNTER_801B] = 3;
      mem8[OBJECT_ANIM_STATE_8021] = 3;
      mem8[POINT_TABLE_SPRITE_CODE_8027] = 3;
      mem8[POINT_TABLE_SPRITE_CODE_802D] = 3;
      regs.hl = POINT_TABLE_PHASE4_VALUE_VRAM;
      copyRunUpTileColumn(m, writePackedBcdByte(m, 0x10), PTS_SUFFIX_STRIP, 4);
      copyRunUpTileColumn(m, regs.hl, POINT_TABLE_PHASE4_VALUE_ROM, 14);
      break;

    default:
      throw new NotImplemented(`renderMode4PointTablePhase: phase ${phase} outside 0..4`);
  }

  mem8[POINT_TABLE_DRAW_STATE] = STATE_DRAWN;
}
