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
  loc_83d7, loc_83d8,
  POINT_TABLE_PHASE1_STRIP_VRAM, POINT_TABLE_PHASE1_VALUE_VRAM, POINT_TABLE_PHASE2_VALUE_VRAM, POINT_TABLE_PHASE2_STRIP_VRAM, POINT_TABLE_PHASE3_VALUE_VRAM, loc_ab71, POINT_TABLE_PHASE4_VALUE_VRAM,
  loc_2f9e, PTS_SUFFIX_STRIP, loc_2f39, loc_2fae, loc_2f43, loc_2f17, loc_2f2a, loc_2ed1,
  loc_801d, loc_8023, loc_8029, loc_802f, loc_801b, OBJECT_ANIM_STATE_8021, loc_8027, loc_802d,
} from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writePackedBcdWord } from "./writePackedBcdWord.js";
import { writePackedBcdByte } from "./writePackedBcdByte.js";

const STATE_IDLE = 0xc0;
const STATE_DRAWN = 0x80;

export function renderMode4PointTablePhase(m) {
  const { regs, mem8 } = m;

  // reload the counter when it drains, then count down: the low value selects this call's phase
  let phase = mem8[loc_83d7];
  if (phase === 0) phase = 5;
  phase -= 1;
  mem8[loc_83d7] = phase;

  switch (phase) {
    case 0:
      mem8[loc_83d8] = STATE_IDLE;
      return;

    case 1:
      copyRunUpTileColumn(m, POINT_TABLE_PHASE1_STRIP_VRAM, loc_2f9e, 10);
      regs.a = 0x10;
      regs.hl = POINT_TABLE_PHASE1_VALUE_VRAM;
      writePackedBcdByte(m);
      copyRunUpTileColumn(m, regs.hl, PTS_SUFFIX_STRIP, 4);
      copyRunUpTileColumn(m, regs.hl, regs.de, 19);
      break;

    case 2:
      regs.hl = POINT_TABLE_PHASE2_VALUE_VRAM;
      regs.de = 0x1000;
      writePackedBcdWord(m);
      copyRunUpTileColumn(m, regs.hl, PTS_SUFFIX_STRIP, 4);
      copyRunUpTileColumn(m, regs.hl, loc_2f39, 10);
      copyRunUpTileColumn(m, regs.hl, loc_2fae, 6);
      copyRunUpTileColumn(m, POINT_TABLE_PHASE2_STRIP_VRAM, loc_2f2a, 15);
      break;

    case 3:
      regs.a = 0x50;
      regs.hl = POINT_TABLE_PHASE3_VALUE_VRAM;
      writePackedBcdByte(m);
      copyRunUpTileColumn(m, regs.hl, PTS_SUFFIX_STRIP, 4);
      copyRunUpTileColumn(m, regs.hl, loc_2f43, 10);
      copyRunUpTileColumn(m, regs.hl, loc_2fae, 5);
      copyRunUpTileColumn(m, loc_ab71, loc_2f17, 19);
      break;

    case 4:
      mem8[loc_801d] = 6;
      mem8[loc_8023] = 6;
      mem8[loc_8029] = 6;
      mem8[loc_802f] = 6;
      mem8[loc_801b] = 3;
      mem8[OBJECT_ANIM_STATE_8021] = 3;
      mem8[loc_8027] = 3;
      mem8[loc_802d] = 3;
      regs.a = 0x10;
      regs.hl = POINT_TABLE_PHASE4_VALUE_VRAM;
      writePackedBcdByte(m);
      copyRunUpTileColumn(m, regs.hl, PTS_SUFFIX_STRIP, 4);
      copyRunUpTileColumn(m, regs.hl, loc_2ed1, 14);
      break;

    default:
      throw new NotImplemented(`renderMode4PointTablePhase: phase ${phase} outside 0..4`);
  }

  mem8[loc_83d8] = STATE_DRAWN;
}
