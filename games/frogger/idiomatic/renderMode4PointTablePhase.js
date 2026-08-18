// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderMode4PointTablePhase  —  ROM 0x0C6D (span 0x0C51-0x0D10)  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The assembler for Frogger's attract-mode "-POINT TABLE-" marquee (screen mode 4): the page that
 *   teaches the scoring — 10 PTS per hop forward, 50 PTS per frog brought home, 1000 PTS for filling all
 *   five home bays. It paints the page a little at a time: ONE phase per call. A phase is either a strip
 *   of the marquee (a point value plus its column artwork) or a bookkeeping step, and the routine walks a
 *   counter through phases 4,3,2,1,0 so the whole page is rebuilt every fifth call and then idles for one.
 *
 * WHERE IT SITS
 *   Driven once per attract frame from the mode-4 arm of the attract pacing dispatcher (loc_0d11). The
 *   point values reach the tilemap through the packed-BCD digit ladder (writePackedBcdWord /
 *   writePackedBcdByte), and every tile strip is stamped up its screen column by the low-level primitive
 *   copyRunUpTileColumn (ROM 0x0028). In the ROM the phase selector is a `jp (hl)` into a table of `jr`
 *   trampolines (0x0C82) indexed by 2*phase; the idiomatic form dissolves that jump table into the plain
 *   `switch` below — one `case` per marquee phase.
 *
 * THE PACKED-BCD-AS-HEX TRICK
 *   A packed-BCD value stores one decimal digit per nibble, and the char ROM's tiles 0..9 are the glyphs
 *   0..9, so the digit printers stamp each nibble straight to screen. That is why the point values are
 *   written as HEX literals: 0x10 shows as "10", 0x50 as "50", 0x1000 as "1000". Read the hex digits and
 *   you are reading exactly what the marquee displays.
 *
 * LIVE-OUT
 *   Memory only. It writes tilemap/VRAM tile strips, four sprite records into the object table, and the
 *   two attract-state cells (the phase counter and the drawn/idle gate). It returns nothing and leaves no
 *   register the caller reads.
 */
import { NotImplemented } from "../../../boards/frogger/io.js";
import {
  ATTRACT_DEMO_PHASE_COUNTER, POINT_TABLE_DRAW_STATE,
  POINT_TABLE_PHASE1_STRIP_VRAM, POINT_TABLE_PHASE1_VALUE_VRAM, POINT_TABLE_PHASE2_VALUE_VRAM, POINT_TABLE_PHASE2_STRIP_VRAM, POINT_TABLE_PHASE3_VALUE_VRAM, POINT_TABLE_PHASE3_STRIP_VRAM, POINT_TABLE_PHASE4_VALUE_VRAM,
  POINT_TABLE_PHASE1_STRIP_ROM, PTS_SUFFIX_STRIP, POINT_TABLE_PHASE2_VALUE_ROM, INTRO_TITLE_STRIP2_SRC, POINT_TABLE_PHASE3_VALUE_ROM, POINT_TABLE_PHASE3_STRIP_ROM, POINT_TABLE_PHASE2_STRIP_ROM, POINT_TABLE_PHASE4_VALUE_ROM,
  POINT_TABLE_SPRITE_ATTR_801D, SCREEN_MODE_STATE, POINT_TABLE_SPRITE_ATTR_8029, LANE_LOW_BOUND_SELECTOR, INTRO_COUNTER_801B, OBJECT_ANIM_STATE_8021, POINT_TABLE_SPRITE_CODE_8027, POINT_TABLE_SPRITE_CODE_802D,
  POINT_TABLE_1000_PTS,
} from "./names.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { writePackedBcdWord } from "./writePackedBcdWord.js";
import { writePackedBcdByte } from "./writePackedBcdByte.js";

// The two markers this routine parks in the drawn/idle gate POINT_TABLE_DRAW_STATE (0x83d8) — the cell the
// attract pacing dispatcher (loc_0d11) reads to decide whether a phase still owes a paint. 0xC0 = idle
// (phase 0 painted nothing this cycle); 0x80 = drawn (a strip phase 1-4 just laid tiles down).
const STATE_IDLE = 0xc0;
const STATE_DRAWN = 0x80;

export function renderMode4PointTablePhase(m) {
  const { mem8 } = m;

  // ── Step the marquee phase counter ───────────────────────────────────────────────────
  // ATTRACT_DEMO_PHASE_COUNTER (0x83d7) is the shared attract sub-phase counter; in mode 4 it selects
  // which slice of the page this call paints. Read it, reload to 5 when it has drained to 0, then decrement
  // and store back. The value written back is the phase drawn now, so successive calls cycle 4,3,2,1,0 —
  // one strip per call, the whole page every five calls, then a one-call idle (phase 0).
  let phase = mem8[ATTRACT_DEMO_PHASE_COUNTER];
  if (phase === 0) phase = 5;
  phase -= 1;
  mem8[ATTRACT_DEMO_PHASE_COUNTER] = phase;

  switch (phase) {
    // ── Phase 0: idle ────────────────────────────────────────────────────────────────
    // Nothing to paint this cycle. Park the gate idle (0xC0) and return WITHOUT the drawn-marker park at
    // the tail — this is the one phase that leaves POINT_TABLE_DRAW_STATE at the idle marker.
    case 0: {
      mem8[POINT_TABLE_DRAW_STATE] = STATE_IDLE;
      return;
    }

    // ── Phase 1: the "10 PTS" row ────────────────────────────────────────────────────
    case 1: {
      // Column artwork: 10 tiles stamped up the column at POINT_TABLE_PHASE1_STRIP_VRAM (0xab76) from the
      // ROM run POINT_TABLE_PHASE1_STRIP_ROM (0x2f9e).
      copyRunUpTileColumn(m, POINT_TABLE_PHASE1_STRIP_VRAM, POINT_TABLE_PHASE1_STRIP_ROM, 10);
      // The value+suffix, drawn as one chained run: writePackedBcdByte stamps 0x10 ("10") at
      // POINT_TABLE_PHASE1_VALUE_VRAM (0xab77) and hands back the write pointer stepped two rows up; that
      // pointer becomes the dst for the 4-tile " PTS" suffix (PTS_SUFFIX_STRIP, 0x2fba). p1run holds the
      // dst/src pointers left just past the suffix.
      const p1run = copyRunUpTileColumn(m, writePackedBcdByte(m, 0x10, POINT_TABLE_PHASE1_VALUE_VRAM), PTS_SUFFIX_STRIP, 4);
      // Continue the same column for 19 more tiles: dst keeps climbing from where " PTS" ended, and the src
      // continues from p1run.de (0x2fbe, the ROM immediately after the " PTS" strip) — a chained read, not
      // a fresh source.
      copyRunUpTileColumn(m, p1run.hl, p1run.de, 19);
      break;
    }

    // ── Phase 2: the "1000 PTS" row ──────────────────────────────────────────────────
    case 2: {
      // Value+suffix: writePackedBcdWord stamps POINT_TABLE_1000_PTS (0x1000 = "1000"; a [code] value) at
      // POINT_TABLE_PHASE2_VALUE_VRAM (0xab73) as four digits, then the 4-tile " PTS" suffix follows from
      // the returned pointer. p2runA is left just past the suffix.
      const p2runA = copyRunUpTileColumn(m, writePackedBcdWord(m, POINT_TABLE_1000_PTS, POINT_TABLE_PHASE2_VALUE_VRAM), PTS_SUFFIX_STRIP, 4);
      // Keep climbing the same column for 10 more tiles, but with a FRESH source POINT_TABLE_PHASE2_VALUE_ROM
      // (0x2f39): the dst chains from p2runA, the src is reloaded.
      const p2runB = copyRunUpTileColumn(m, p2runA.hl, POINT_TABLE_PHASE2_VALUE_ROM, 10);
      // Six more tiles up the same column from the shared strip INTRO_TITLE_STRIP2_SRC (0x2fae).
      copyRunUpTileColumn(m, p2runB.hl, INTRO_TITLE_STRIP2_SRC, 6);
      // A separate second column: 15 tiles at POINT_TABLE_PHASE2_STRIP_VRAM (0xab74) from
      // POINT_TABLE_PHASE2_STRIP_ROM (0x2f2a).
      copyRunUpTileColumn(m, POINT_TABLE_PHASE2_STRIP_VRAM, POINT_TABLE_PHASE2_STRIP_ROM, 15);
      break;
    }

    // ── Phase 3: the "50 PTS" row (byte value, otherwise the mirror of phase 2) ───────
    case 3: {
      // Value+suffix: 0x50 ("50") at POINT_TABLE_PHASE3_VALUE_VRAM (0xab70), then the 4-tile " PTS" suffix.
      const p3runA = copyRunUpTileColumn(m, writePackedBcdByte(m, 0x50, POINT_TABLE_PHASE3_VALUE_VRAM), PTS_SUFFIX_STRIP, 4);
      // Chain 10 more tiles up the column, source reloaded to POINT_TABLE_PHASE3_VALUE_ROM (0x2f43).
      const p3runB = copyRunUpTileColumn(m, p3runA.hl, POINT_TABLE_PHASE3_VALUE_ROM, 10);
      // Five more tiles from the shared strip INTRO_TITLE_STRIP2_SRC (0x2fae).
      copyRunUpTileColumn(m, p3runB.hl, INTRO_TITLE_STRIP2_SRC, 5);
      // Separate second column: 19 tiles at POINT_TABLE_PHASE3_STRIP_VRAM (0xab71) from
      // POINT_TABLE_PHASE3_STRIP_ROM (0x2f17).
      copyRunUpTileColumn(m, POINT_TABLE_PHASE3_STRIP_VRAM, POINT_TABLE_PHASE3_STRIP_ROM, 19);
      break;
    }

    // ── Phase 4: the "10 PTS" row PLUS four sprite records ────────────────────────────
    case 4: {
      // Seed four sprite records into the object table 0x801b-0x802f (records stride 6; each has a CODE
      // field at offset +0 and an ATTR/Y field at offset +2), later mirrored to OBJRAM (0xB01b…) so the
      // little frog icons appear beside the point values. Several of these cells are shared work RAM whose
      // names reflect other modes' uses — in mode 4 they are simply the record fields.
      //   ATTR/Y = 6 for all four records (offset +2 cells):
      mem8[POINT_TABLE_SPRITE_ATTR_801D] = 6; // record 0 ATTR (0x801d)
      mem8[SCREEN_MODE_STATE] = 6;            // record 1 ATTR (0x8023)
      mem8[POINT_TABLE_SPRITE_ATTR_8029] = 6; // record 2 ATTR (0x8029)
      mem8[LANE_LOW_BOUND_SELECTOR] = 6;      // record 3 ATTR (0x802f)
      //   CODE = 3 for all four records (offset +0 cells):
      mem8[INTRO_COUNTER_801B] = 3;           // record 0 CODE (0x801b)
      mem8[OBJECT_ANIM_STATE_8021] = 3;       // record 1 CODE (0x8021)
      mem8[POINT_TABLE_SPRITE_CODE_8027] = 3; // record 2 CODE (0x8027)
      mem8[POINT_TABLE_SPRITE_CODE_802D] = 3; // record 3 CODE (0x802d)
      // Value+suffix: 0x10 ("10") at POINT_TABLE_PHASE4_VALUE_VRAM (0xab6d), then the 4-tile " PTS" suffix.
      const p4run = copyRunUpTileColumn(m, writePackedBcdByte(m, 0x10, POINT_TABLE_PHASE4_VALUE_VRAM), PTS_SUFFIX_STRIP, 4);
      // Chain 14 more tiles up the column, source reloaded to POINT_TABLE_PHASE4_VALUE_ROM (0x2ed1).
      copyRunUpTileColumn(m, p4run.hl, POINT_TABLE_PHASE4_VALUE_ROM, 14);
      break;
    }

    // The counter arithmetic above can only yield 0..4, so this arm is a defensive guard: it fires only if
    // the phase cell were corrupted out of range.
    default:
      throw new NotImplemented(`renderMode4PointTablePhase: phase ${phase} outside 0..4`);
  }

  // Shared drawn-tail (ROM 0x0cba): every strip phase (1-4) marks the gate drawn (0x80) so the attract
  // pacing dispatcher advances. Phase 0 has already returned above and never reaches here.
  mem8[POINT_TABLE_DRAW_STATE] = STATE_DRAWN;
}
