// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0d5f — board-setup continuation: run the common per-board init, scatter the object records,
 * arm the setup dwell timer and advance the sub-state, stage the sprite-object block, then apply a
 * per-board sprite offset.
 *
 * The tail of the board-setup sub-state. It is reached through the setup dispatch chain by two
 * tail-jumps, so no caller consumes a register it leaves; its work is entirely in memory. In order
 * it:
 *
 *   1. Runs the big common per-board init: clears the player/object RAM, recomputes the bonus
 *      fields from LEVEL, and dispatches the per-board setup (25m/50m/75m/100m) selected by BOARD.
 *      That init has no return of its own — the board-setup arm it dispatches to returns straight
 *      back here.
 *   2. Scatters this board's object-init records into the two object attribute arrays.
 *   3. Arms the setup dwell: SUBSTATE_TIMER to 64 frames, then increments GAME_SUBSTATE — the
 *      "wait 64 frames, then advance one sub-state" idiom that ends board setup.
 *   4. Stages the board's sprite-object graphics from a single template. The block loader copies
 *      the template's first 0x28 bytes into SPRITE_OBJ_BLOCK — the ten 4-byte object records — and,
 *      crucially, LEAVES ITS SOURCE POINTER ADVANCED past what it copied. The 8-byte copy that
 *      follows continues from that same advanced pointer into the head of the sprite buffer, two
 *      more records. The pointer is live across the call and is read from the callee's advanced
 *      value, never re-derived.
 *   5. Applies a per-board sprite offset keyed off BOARD:
 *        - the rivet board: shift the whole X column of the ten records right by 0x44, then two
 *          rivet-layout field nudges (+0x10 twice, then -8 twice, both at stride 4).
 *        - 50m and 75m: no offset — return.
 *        - the girder board: shift the whole Y column up by 4.
 *      The "no offset" case is selected by testing BIT 1 of BOARD, which is faithful for all 256
 *      values of the byte and not only for the four boards in play.
 *
 * CALLEES. All five still take their inputs in the register file rather than as arguments, so at
 * each call site this routine stages the registers they read — the one place registers remain. It
 * reads no live-in register of its own (the first callee overwrites everything before reading
 * anything), so it needs no parameters.
 *
 * NAME. Kept neutral, not promoted: it is a multi-responsibility glue node — delegate init, load
 * records, arm the timer, stage sprites, per-board offset — with no single honest verb, and a crisp
 * English name would over-claim one of its five jobs.
 *
 * LIVE-OUT: memory-only. Reached through two tail jumps that consume no return register.
 */

import { initBoardState } from "./initBoardState.js";
import { loadBoardObjectRecords } from "./loadBoardObjectRecords.js";
import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js";
import { addStrided } from "./addStrided.js";
import { SUBSTATE_TIMER, GAME_SUBSTATE, BOARD, SPRITE_OBJ_BLOCK, SPRITE_BUFFER } from "./names.js";

// The template of sprite-object records copied into the sprite buffer.
const OBJECT_TEMPLATE_SRC = 0x385c;
const HEAD_COPY_BYTES = 8; // the 8 bytes (2 records) copied to the sprite buffer after the block

export function loc_0d5f(m) {
  const { regs, mem } = m;

  // (1) Common per-board init, and the per-board setup dispatch it ends in.
  initBoardState(m);

  // (2) Scatter this board's object-init records into the two object attribute arrays.
  loadBoardObjectRecords(m);

  // (3) Arm the setup dwell timer, then advance the game sub-state by one.
  mem.write8(SUBSTATE_TIMER, 0x40); // wait 64 frames
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff); // then proceed to the next sub-state

  // (4) Stage the sprite-object graphics from the template. The block loader copies its first
  //     0x28 bytes into SPRITE_OBJ_BLOCK and leaves its source pointer advanced past them —
  //     that pointer is LIVE into the head copy below.
  regs.hl = OBJECT_TEMPLATE_SRC;
  loadSpriteObjectBlock(m);

  //     Continue the SAME template stream: copy the next 8 bytes into the head of the sprite
  //     buffer, two more records.
  let src = regs.hl; // advanced by the block loader
  let dst = SPRITE_BUFFER;
  for (let i = 0; i < HEAD_COPY_BYTES; i++) {
    mem.write8(dst, mem.read8(src));
    src = (src + 1) & 0xffff;
    dst = (dst + 1) & 0xffff;
  }
  regs.hl = src; // the block copy's terminal state — dead into the branch below, kept faithful
  regs.de = dst;
  regs.bc = 0;

  // (5) Per-board sprite offset, selected by BOARD.
  const board = mem.read8(BOARD);

  if (board === 4) {
    // Rivet board: shift the X column of all ten records right, then two rivet-layout field
    // nudges. The strided add takes its count, signed delta and stride in registers.
    regs.hl = SPRITE_OBJ_BLOCK; // the X field of each record
    regs.c = 0x44;
    addToSpriteObjectColumn(m);

    regs.de = 0x0004; // stride 4 — and it stays set for the second call too
    regs.b = 0x02;
    regs.c = 0x10;
    regs.hl = SPRITE_BUFFER; // two stride-4 bytes, each += 0x10
    addStrided(m);

    regs.b = 0x02;
    regs.c = 0xf8; // -8
    regs.hl = SPRITE_BUFFER + 3; // two stride-4 bytes
    addStrided(m);
    return;
  }

  // 50m / 75m — bit 1 of BOARD set: no per-board offset.
  if (board & 0x02) return;

  // Girder board: shift the Y column of all ten records up by 4.
  regs.hl = SPRITE_OBJ_BLOCK + 3; // the Y field of each record
  regs.c = 0xfc; // -4
  addToSpriteObjectColumn(m);
}
