// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1880 — one step of the board-advance / "how high" interlude render sequence:
 * descend the sprite-object block, then on arrival build the next scene and advance.
 * ROM 0x1880.
 *
 * Step index 4 of the EVEN-board (BOARD bit0 clear → 50m / 100m) board-advance
 * sequence. loc_1615 (the GAME_SUBSTATE 0x600A == 0x16 board-advance dispatcher)
 * routes the even-board arm through loc_1644, which rst-0x28-dispatches the 0x6388
 * step selector via the 6-entry table at 0x1648 = [17b6, 3069, 1839, 186f, 1880, 18c6];
 * this is the entry at index 4, the sibling of loc_186f / loc_18c6 in that family.
 *
 * Every frame it runs, it first nudges the whole ten-record sprite-object block down
 * one pixel, then FORKS on whether the block has finished descending:
 *
 *   - DESCEND (record 4's Y, 0x691b, is not yet 0xD0): return — keep sliding the
 *     block down one pixel per frame. This is the common, per-frame arm.
 *   - LANDED (record 4's Y reaches 0xD0): build the next scene, once:
 *       * set record 4's sprite code (0x6919) to 0x20;
 *       * stage a 4-byte object record 7F 39 01 D8 at 0x6a24;
 *       * fill a 5×14 = 70-tile block with tile 0x10, descending from VRAM 0x76c6
 *         (sub_1826);
 *       * draw the board's line-segment layout from the ROM segment table at 0x3a5f
 *         (drawBoardLayout — girders / ladders);
 *       * shift sprite-buffer records 0 and 1 down 0x28 px (add 0x28 into their Y
 *         field, 0x6903 / 0x6907, via addStrided);
 *       * reset the 0x62AF pace counter to 0 (the NEXT step, loc_18c6, counts it down);
 *       * pulse sound latch SND_TRIGGER[2] (0x6082) to 3 (a 3-frame assert);
 *       * advance the step selector 0x6388 (`inc (hl)`) so the next NMI dispatches
 *         the following step.
 *
 * Reached via dispatchGameState's rst-0x28 tail, which discards this handler's return,
 * so nothing downstream reads a register or flag it leaves.
 * NAME: kept as loc_1880 — the mechanics are understood precisely but the exact visual
 * the interlude depicts is not independently confirmed, and the whole sibling family
 * (loc_186f / loc_1670 / loc_18c6 …) stayed address-named for the same reason.
 *
 * CALLEES (called directly — no stack modelling):
 *   addToSpriteObjectColumn (idiomatic, ROM 0x0038 → addStrided 0x003d) — the per-frame
 *     Y nudge; addStrided (idiomatic, ROM 0x003d) — the sprite-buffer Y shift;
 *   drawBoardLayout (idiomatic, ROM 0x0da7) — the segment-table board draw;
 *   sub_1826 (ORACLE, ROM 0x1826 — no idiomatic lift yet) — the 70-tile VRAM fill.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1880.test.js.
 * GATE:     crafted-entry — attract never reaches GAME_SUBSTATE 0x16 (it does not
 *           complete a board), so 0x1880 dispatches 0 times; validated on real
 *           booted-attract state with surgical pokes: EXHAUSTIVE sweep of the gate
 *           byte 0x691b 0..255 (after the +1 descend nudge, only 0xCF → 0xD0 fires the
 *           payload; the other 255 just slide the block), a crafted LANDED entry
 *           running the full scene build (tile fill + board draw + sprite shift + sound
 *           + step advance) with game-visible RAM identical, and an EXHAUSTIVE sweep of
 *           the 0x6388 step byte at the payload (the `inc`, incl. 0xFF→0x00 wrap).
 *           Teeth: a dropped step `inc`, a dropped sound latch, and a wrong gate value.
 * LIVE-OUT: memory-only. Every write lands in work RAM / VRAM (the sprite-object and
 *           sprite-buffer records, the 0x62AF pace counter, the 0x6082 sound latch, the
 *           0x6388 selector, and the tiles the fill / board draw stamp). The rst-0x28
 *           dispatch tail reads no register/flag this leaves; the oracle's residual
 *           A/HL/DE/BC/flags are dead ABI. It models no stack of its own (direct calls);
 *           SP/pc are the Z80 caller-skip mechanism the plain return replaces. The
 *           oracle callees sub_1826 / drawBoardLayout do use the modeled stack, but every push
 *           lands in STACK_SCRATCH and is excluded from the compare.
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908), SPRITE_BUFFER (0x6900), SND_TRIGGER (0x6080 →
 *           +2 = latch bit 2), BOARD_ADVANCE_STEP (0x6388 — the render-sequence step
 *           selector) from ram.js. Hex-kept: 0x62AF (pace counter — ram.js's rejected
 *           board-object bookkeeping, the byte loc_18c6 consumes), 0x6A24 (a 4-byte
 *           object record), 0x76C6 (VRAM tile-fill target), 0x3A5F (ROM segment-table
 *           base, an immediate).
 */

import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)
import { addStrided } from "./addStrided.js"; // ROM 0x003d
import { drawBoardLayout } from "./drawBoardLayout.js"; // ROM 0x0da7 — draw the board segment layout
import { sub_1826 } from "../translated/sub_1826.js"; // ROM 0x1826 — 70-tile VRAM fill (oracle; no idiomatic yet)
import { SPRITE_OBJ_BLOCK, SPRITE_BUFFER, SND_TRIGGER, BOARD_ADVANCE_STEP } from "./ram.js";

const Y_COLUMN = SPRITE_OBJ_BLOCK + 3; // 0x690b — field +3 (Y) of sprite-object record 0
const DESCEND_STEP = 0x01; // +1 into the Y column each frame (slide the block down)
const GATE_Y = SPRITE_OBJ_BLOCK + 0x13; // 0x691b — record 4's Y byte (the descent gate)
const LANDED_Y = 0xd0; // the Y at which the block has finished descending

const REC4_CODE = SPRITE_OBJ_BLOCK + 0x11; // 0x6919 — record 4's sprite-code byte
const REC4_CODE_VALUE = 0x20;

const OBJ_RECORD = 0x6a24; // staged 4-byte object record: 7F 39 01 D8

const TILE_FILL_DST = 0x76c6; // VRAM: start of the 5×14 descending 0x10-tile fill (sub_1826)
const SEGMENT_TABLE = 0x3a5f; // ROM: this scene's line-segment table (drawBoardLayout)

const SPRITE_BUF_Y = SPRITE_BUFFER + 3; // 0x6903 — field +3 (Y) of sprite-buffer record 0
const SPRITE_BUF_STRIDE = 0x04; // one 4-byte sprite record
const SPRITE_BUF_COUNT = 0x02; // records 0 and 1
const SPRITE_BUF_Y_SHIFT = 0x28; // move those two records down 0x28 px

const PACE_COUNTER = 0x62af; // per-frame pace counter loc_18c6 (the next step) counts down
const SND_LATCH = SND_TRIGGER + 2; // 0x6082 — SND_TRIGGER[2]
const SND_ASSERT_FRAMES = 0x03; // 3-frame sound-latch assert (sub_00e0 counts it down)

export function loc_1880(m) {
  const { regs, mem } = m;

  // rst 0x38 (addToSpriteObjectColumn): slide the whole ten-record sprite-object block
  // down one pixel — add +1 into field +3 (the Y column) of all ten records, stride 4.
  regs.hl = Y_COLUMN; // 0x690b
  regs.c = DESCEND_STEP; // +1
  addToSpriteObjectColumn(m);

  // Hold here until record 4's Y (0x691b) reaches 0xD0 — the block's landing row.
  // Until then just keep sliding (the oracle's `cp 0xd0 / ret nz` caller-skip).
  if (mem.read8(GATE_Y) !== LANDED_Y) return;

  // Landed — build the next scene, once.

  // Record 4's sprite code := 0x20.
  mem.write8(REC4_CODE, REC4_CODE_VALUE); // 0x6919

  // Stage a 4-byte object record 7F 39 01 D8 at 0x6a24.
  mem.write8(OBJ_RECORD + 0, 0x7f);
  mem.write8(OBJ_RECORD + 1, 0x39);
  mem.write8(OBJ_RECORD + 2, 0x01);
  mem.write8(OBJ_RECORD + 3, 0xd8);

  // Fill a 5×14 = 70-tile block with tile 0x10, descending from VRAM 0x76c6.
  regs.hl = TILE_FILL_DST; // 0x76c6 — the fill start (sub_1826 reads HL live-in)
  sub_1826(m); // ROM 0x1826

  // Draw the board's line-segment layout (girders / ladders) from the ROM table at 0x3a5f.
  regs.de = SEGMENT_TABLE; // 0x3a5f (drawBoardLayout reads DE live-in)
  drawBoardLayout(m); // ROM 0x0da7

  // addStrided: add +0x28 into field +3 (Y) of sprite-buffer records 0 and 1
  // (0x6903, 0x6907), stride 4 — shift those two records down 0x28 px.
  regs.hl = SPRITE_BUF_Y; // 0x6903
  regs.de = SPRITE_BUF_STRIDE; // 4
  regs.b = SPRITE_BUF_COUNT; // 2 records
  regs.c = SPRITE_BUF_Y_SHIFT; // +0x28
  addStrided(m); // ROM 0x003d

  // Reset the 0x62AF pace counter (loc_18c6, the next step, counts it down), pulse the
  // 3-frame sound-latch assert, and advance the render-sequence step selector.
  mem.write8(PACE_COUNTER, 0x00); // 0x62af
  mem.write8(SND_LATCH, SND_ASSERT_FRAMES); // 0x6082 := 3
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff); // inc (0x6388)
}
