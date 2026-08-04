// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_17b6 — step 0 of the board-render sequence: draw the initial how-high screen (four
 * girder/ladder items plus a sprite-object row), set the priority tune, then arm and repoint the
 * auto-advance machinery for the rest of the sequence.
 *
 * The sequence runs one step per frame off a step counter; this is the FIRST step. It lays out the
 * static screen and hands the sequence to the frame-driven advancer. In order:
 *
 *   1. Silence every sound output and its work-RAM shadow.
 *   2. Set the sound-priority pair SND_PRIORITY / SND_PRIORITY_FRAMES to 0x0E / 0x03 — a 3-frame
 *      priority-tune pulse, re-set after the silence.
 *   3. Paint two 3-cell descending colour columns, one tilemap row apart. The colour value CHAINS
 *      across the pair: the first column runs 0x10 / 0x0F / 0x0E and the second picks up where it
 *      left off at 0x0D / 0x0C / 0x0B — one continuous six-step gradient.
 *   4. Render four items, each a 5x14 backing block of the blank tile at a tilemap cell, plus the
 *      girder/ladder segments walked from that item's segment table. The four destinations step
 *      left by 5 cells.
 *   5. Load the 40-byte sprite-object block from its template into SPRITE_OBJ_BLOCK, then shift its
 *      X column right by 0x44 across all ten records.
 *   6. Seed the blink-sprite code — the byte the colour cycle toggles.
 *   7. Arm the sub-state gate SUBSTATE_TIMER to 32 frames and seed the how-high animation stepper.
 *   8. Advance the sequence: increment BOARD_ADVANCE_STEP — a read-modify-write of the one byte
 *      this routine consumes as an input — then point SEQ_ADVANCE_PTR at that same counter, so the
 *      gated advancer steps it once the timer expires.
 *
 * NAME: kept the neutral loc_ because the division of labour with the other how-high builder is
 * unresolved; what the routine DOES is pinned, what part of the how-high screen is properly whose
 * is not.
 *
 * LIVE-OUT: memory-only — no successor consumes a register or flag this leaves behind; the whole
 * sequence family runs per frame for effect and reloads its own registers. Three of the sound
 * latches the silence step issues are write-only hardware outputs and never appear in RAM.
 */

import {
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  SUBSTATE_TIMER,
  SPRITE_OBJ_BLOCK,
  SEQ_ADVANCE_PTR,
  BOARD_ADVANCE_STEP,
} from "./names.js";
import { silenceSound } from "./silenceSound.js";
import { fillDescendingColumn } from "./fillDescendingColumn.js";
import { fillTileBlock } from "./fillTileBlock.js";
import { drawBoardLayout } from "./drawBoardLayout.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";

// The how-high interlude's animation stepper, seeded to 0x80 here. It is shared with another
// subsystem, so it carries no registry name.
const HOW_HIGH_ANIM = 0x6390;
// Sprite-buffer record 1, sprite-code byte — the blink sprite the colour cycle toggles.
const BLINK_SPRITE_CODE = 0x6905;

// The sprite-object template block copied into SPRITE_OBJ_BLOCK.
const SPRITE_TEMPLATE = 0x385c;
// X-column shift applied to all ten sprite-object records after the load.
const SPRITE_X_SHIFT = 0x44;

// The four render items: [tilemap destination for the 5x14 blank-tile backing block, pointer to
// that item's girder/ladder segment table]. The destinations step left by 5 cells.
const RENDER_ITEMS = [
  [0x76da, 0x3a47],
  [0x76d5, 0x3a4d],
  [0x76d0, 0x3a53],
  [0x76cb, 0x3a59],
];

export function loc_17b6(m) {
  const { regs, mem } = m;

  // 1. Silence every sound output, and its work-RAM shadow with it.
  silenceSound(m);

  // 2. Set the sound-priority pair, which the silence just zeroed.
  mem.write8(SND_PRIORITY, 0x0e);
  mem.write8(SND_PRIORITY_FRAMES, 0x03);

  // 3. Two chained 3-cell descending colour columns, one tilemap row apart. The colour and the
  //    step CHAIN across the pair: the second call deliberately reuses what the first left, so
  //    the six cells descend continuously. The column fill takes its cell, colour and step in
  //    registers.
  regs.a = 0x10;
  regs.de = 0x0020;
  regs.hl = 0x7623;
  fillDescendingColumn(m);
  regs.hl = 0x7583; // colour and step carried over from the first call
  fillDescendingColumn(m);

  // 4. Render the four items: a 5x14 blank-tile backing block, then the girder/ladder segments
  //    walked from the item's own segment table.
  for (const [tileDest, segTable] of RENDER_ITEMS) {
    regs.hl = tileDest;
    fillTileBlock(m);
    regs.de = segTable;
    drawBoardLayout(m);
  }

  // 5. Load the sprite-object block from its template, then shift each record's X byte.
  regs.hl = SPRITE_TEMPLATE;
  loadSpriteObjectBlock(m);
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.c = SPRITE_X_SHIFT;
  addToSpriteObjectColumn(m);

  // 6. Seed the blink-sprite code.
  mem.write8(BLINK_SPRITE_CODE, 0x13);

  // 7. Arm the sub-state gate to 32 frames and seed the how-high animation stepper.
  mem.write8(SUBSTATE_TIMER, 0x20);
  mem.write8(HOW_HIGH_ANIM, 0x80);

  // 8. Advance the sequence: bump the step counter (the one input-dependent byte), then point
  //    the advance pointer at it so the gated advancer steps it next.
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
  mem.write16(SEQ_ADVANCE_PTR, BOARD_ADVANCE_STEP);
}
