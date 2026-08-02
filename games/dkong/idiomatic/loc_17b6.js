// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_17b6 — idx 0 of the 0x6388 render sequence: draw the initial how-high screen
 * (four girder/ladder items + a sprite-object row), set the priority tune, then arm
 * and repoint the auto-advance machinery for the rest of the sequence.  ROM 0x17b6.
 *
 * Dispatched as entry 0 of the rst-0x28 table at 0x1648 (loc_1644 / sub_1641), which
 * jumps on the sequence step counter 0x6388. This is the first step: it lays out the
 * static screen and hands the sequence to the frame-driven advancer. In order:
 *
 *   1. silenceSound (ROM 0x011c) — zero every sound output + its work-RAM shadow.
 *   2. Set the sound-priority pair SND_PRIORITY / SND_PRIORITY_FRAMES (0x608A/0x608B)
 *      to 0x0E / 0x03 — a 3-frame priority-tune pulse (re-set after silenceSound).
 *   3. Paint two 3-cell descending colour columns via fillDescendingColumn (ROM 0x0514),
 *      stride 0x20 (one tilemap row). The A value CHAINS across the pair: the first
 *      column starts at 0x10 (0x7623 -> 0x10/0x0F/0x0E) and the second reuses the A the
 *      first left (0x0D), so 0x7583 -> 0x0D/0x0C/0x0B — a continuous six-step gradient.
 *   4. Render four items, each a 5x14 backing block of tile 0x10 (fillTileBlock, ROM
 *      0x1826) at a tilemap cell plus the girder/ladder segments walked from a ROM
 *      segment table (drawBoardLayout, ROM 0x0da7). The four dests step left by 5 cells
 *      (0x76DA/D5/D0/CB) over the four ROM tables (0x3A47/4D/53/59).
 *   5. Load the 40-byte sprite-object block from ROM template 0x385C into SPRITE_OBJ_BLOCK
 *      (loadSpriteObjectBlock, ROM 0x004e), then shift its X column right by 0x44 across
 *      all ten records (addToSpriteObjectColumn, the rst-0x38 shim, ROM 0x0038).
 *   6. Seed the blink-sprite code 0x6905 = 0x13 (the byte the colour cycle toggles).
 *   7. Arm the sub-state gate SUBSTATE_TIMER (0x6009) = 0x20 (32 frames) and seed the
 *      how-high animation stepper 0x6390 = 0x80.
 *   8. Advance the sequence: inc the step counter 0x6388 (a read-modify-write of the ONE
 *      byte this routine consumes as an input), then point SEQ_ADVANCE_PTR (0x63C0) at
 *      0x6388 so the gated advancer advanceSequenceStepWhenTimerExpires steps this same counter once the gate expires.
 *
 * The ram.js SEQ_ADVANCE_PTR note (proposer!=confirmer) records "loc_17b6 seeds 0x6388
 * for the how-high render", so the mechanism and its how-high role are documented; the
 * neutral loc_ name is kept because the division of labour with buildHowHighScreen
 * (0x0bda, the sub-state-8 how-high builder) is not resolved at the routine-name bar —
 * same convention the drawBoardLayout record-drawing family follows.
 *
 * Memory-equivalent to the frozen oracle — equivalence-17b6.test.js.
 * GATE:     crafted-entry — NOT dispatched in attract (measured: 0 over 6000 frames; its
 *           only entry is the 0x6388 sequence during a credited game's interlude), so it
 *           is validated against the oracle on real captured ATTRACT states used as
 *           entries (fresh clone per side — it writes RAM) PLUS crafted entries whose work
 *           + video RAM is pre-dirtied identically on both sides. The only input-dependent
 *           output is 0x6388 (an `inc (hl)`); a dedicated wrap-edge entry (0x6388 = 0xFF ->
 *           0x00) pins it. Teeth: a wrong gate value at 0x6009 and a dropped render item.
 * LIVE-OUT: memory-only — the dispatch tail-returns up the rst-0x28 chain and no successor
 *           consumes a register or flag this leaves (the whole 0x6388-sequence family runs
 *           per-frame for effect, reloading its own registers). SP/PC are NOT compared: the
 *           direct-call layer replaces the oracle's push16/call/ret stack + PC bookkeeping
 *           with the JS call stack. The three sound-hardware latches silenceSound issues
 *           (0x7D00-07, 0x7D80, 0x7C00) are write-only io outputs, not in the RAM dump.
 * NAMES:    SND_PRIORITY (0x608A), SND_PRIORITY_FRAMES (0x608B), SUBSTATE_TIMER (0x6009),
 *           SPRITE_OBJ_BLOCK (0x6908), SEQ_ADVANCE_PTR (0x63C0), BOARD_ADVANCE_STEP (0x6388 —
 *           the step counter this arm increments and repoints SEQ_ADVANCE_PTR at) from ram.js.
 *           The how-high animation stepper 0x6390 (rejected as a shared byte in ram.js) and the
 *           blink code 0x6905 have no ram.js symbol and stay local hex consts; the VRAM/colour
 *           dests, ROM segment tables and the 0x385C sprite template are caller-fixed addresses
 *           kept hex.
 */

import {
  SND_PRIORITY,
  SND_PRIORITY_FRAMES,
  SUBSTATE_TIMER,
  SPRITE_OBJ_BLOCK,
  SEQ_ADVANCE_PTR,
  BOARD_ADVANCE_STEP,
} from "./ram.js";
import { silenceSound } from "./silenceSound.js"; // ROM 0x011c
import { fillDescendingColumn } from "./fillDescendingColumn.js"; // ROM 0x0514
import { fillTileBlock } from "./fillTileBlock.js"; // ROM 0x1826
import { drawBoardLayout } from "./drawBoardLayout.js"; // ROM 0x0da7
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)

// How-high interlude animation stepper (shared byte in ram.js), seeded to 0x80 here.
const HOW_HIGH_ANIM = 0x6390;
// Sprite-buffer record 1, +1 byte — the blink-sprite code the colour cycle toggles.
const BLINK_SPRITE_CODE = 0x6905;

// ROM sprite-object template block copied into SPRITE_OBJ_BLOCK.
const SPRITE_TEMPLATE = 0x385c;
// X-column shift applied to all ten sprite-object records after the load.
const SPRITE_X_SHIFT = 0x44;

// The four render items: [tilemap dest for the 5x14 tile-0x10 backing block, ROM
// segment-table pointer for the girder/ladder draw]. Dests step left by 5 cells.
const RENDER_ITEMS = [
  [0x76da, 0x3a47],
  [0x76d5, 0x3a4d],
  [0x76d0, 0x3a53],
  [0x76cb, 0x3a59],
];

export function loc_17b6(m) {
  const { regs, mem } = m;

  // 1. Silence every sound output (and its work-RAM shadow 0x6080-0x608B).
  silenceSound(m); // ROM 0x011c

  // 2. Set the sound-priority pair (silenceSound just zeroed both).
  mem.write8(SND_PRIORITY, 0x0e); //        0x608A
  mem.write8(SND_PRIORITY_FRAMES, 0x03); // 0x608B

  // 3. Two chained 3-cell descending colour columns, stride 0x20. A CHAINS across the
  //    pair: the second call deliberately reuses the A (0x0D) and DE the first left, so
  //    the six cells descend 0x10..0x0B continuously. fillDescendingColumn takes HL/A/DE
  //    as register live-in.
  regs.a = 0x10; //         ld a,0x10
  regs.de = 0x0020; //      ld de,0x0020
  regs.hl = 0x7623; //      ld hl,0x7623
  fillDescendingColumn(m); // ROM 0x0514 -> 0x7623/0x7643/0x7663 = 0x10/0x0F/0x0E
  regs.hl = 0x7583; //      ld hl,0x7583 (A=0x0D and DE=0x20 carried from the first call)
  fillDescendingColumn(m); // ROM 0x0514 -> 0x7583/0x75A3/0x75C3 = 0x0D/0x0C/0x0B

  // 4. Render the four items: a 5x14 tile-0x10 backing block then the girder/ladder
  //    segments walked from the item's ROM segment table.
  for (const [tileDest, segTable] of RENDER_ITEMS) {
    regs.hl = tileDest; // ld hl,vhl
    fillTileBlock(m); //    ROM 0x1826 — 5x14 block of tile 0x10
    regs.de = segTable; //  ld de,rde
    drawBoardLayout(m); //         ROM 0x0da7 — walk the segment table and draw
  }

  // 5. Load the sprite-object block from ROM 0x385C, then shift its X column by 0x44.
  regs.hl = SPRITE_TEMPLATE; // ld hl,0x385c
  loadSpriteObjectBlock(m); //  ROM 0x004e — copy 40 bytes into SPRITE_OBJ_BLOCK (0x6908)
  regs.hl = SPRITE_OBJ_BLOCK; // ld hl,0x6908
  regs.c = SPRITE_X_SHIFT; //    ld c,0x44
  addToSpriteObjectColumn(m); // ROM 0x0038 (rst 0x38) — +0x44 into each record's X byte

  // 6. Seed the blink-sprite code.
  mem.write8(BLINK_SPRITE_CODE, 0x13); // 0x6905

  // 7. Arm the sub-state gate and seed the how-high animation stepper.
  mem.write8(SUBSTATE_TIMER, 0x20); // 0x6009 = 32 frames
  mem.write8(HOW_HIGH_ANIM, 0x80); //  0x6390

  // 8. Advance the sequence: inc the step counter (the one input-dependent byte), then
  //    point SEQ_ADVANCE_PTR at it so the gated advancer advanceSequenceStepWhenTimerExpires steps it next.
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff); // inc (0x6388)
  mem.write16(SEQ_ADVANCE_PTR, BOARD_ADVANCE_STEP); // 0x63C0 = 0x6388 (little-endian)
}
