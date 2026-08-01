// SPDX-License-Identifier: GPL-3.0-only
/**
 * reloadObjectBlockAndAdvanceStep — reload the board's sprite-object block from its
 * ROM template, patch three record fields, and advance the board-advance step index.
 * ROM 0x16ee.
 *
 * One phase of the board-advance sequence run while GAME_SUBSTATE (0x600A) == 0x16
 * (board cleared / advance). The dispatcher loc_1615 steps through the byte at 0x6388
 * as its rst-0x28 index into the per-board sub-dispatch tables; this handler is reached
 * from it via loc_16bb -> loc_16e1 (a direct call). Its whole job is to (re)stage the
 * scene's sprite-object records and then bump 0x6388 so the next frame dispatches the
 * following phase:
 *
 *   - Reload the 40-byte (10-record x 4) sprite-object block from the ROM template at
 *     0x388C into SPRITE_OBJ_BLOCK (loadSpriteObjectBlock; HL is the copy source). This
 *     is the same template the opening climb cutscene loads (loc_0abf/runIntroClimbStep).
 *   - Patch three record field-0 bytes AFTER the copy — record 1 (0x690C) <- 0x66,
 *     record 7 (0x6924) <- 0, record 9 (0x692C) <- 0. Each address sits inside the block
 *     the copy just filled, so the copy MUST run first or the patch is lost: WRITE ORDER
 *     matters (ROM has 0x00/0x6B/0x6A at those offsets, none equal to the patched value).
 *   - Clear the board-object bookkeeping byte 0x62AF.
 *   - inc (0x6388) — advance to the next board-advance dispatch step.
 *
 * The sibling sub_168a does the identical reload + patch under a timer gate and a
 * different tail; this variant skips the gate and instead advances the step counter.
 * No hardware (0x7Dxx) writes — every store is work RAM. The only callee is the landed
 * idiomatic leaf loadSpriteObjectBlock, called directly (no register-ABI marshalling).
 *
 * Meaning confidence: the two observable actions — reload+patch the object block and
 * increment the step index — are read directly off the opcodes and named memory; the
 * surrounding "which board-advance phase" framing is inferred from the loc_1615 dispatch
 * context. The name claims only the actions, not the phase.
 *
 * Memory-equivalent to the frozen oracle — equivalence-16ee.test.js.
 * GATE:     crafted-entry — attract never completes a board, so 0x16ee is dispatched
 *           ZERO times in a long attract run (REALISM records this). Gated on real booted
 *           attract states, cloned, with the one input byte (0x6388) surgically poked
 *           identically on both sides: an EXHAUSTIVE sweep of 0x6388 0..255 (the only
 *           input-dependent output is its `inc`, incl. the 0xFF->0x00 wrap); everything
 *           else is a constant copy+patch. Teeth: a write-order corruption of 0x690C and
 *           a dropped 0x6388 advance.
 * LIVE-OUT: memory-only. Reached through the rst-0x28 board-advance dispatch tail
 *           (loc_1615), which discards the handler's registers/flags — the oracle's
 *           residual A/HL/DE/BC/flags are dead ABI, and its SP/pc are the Z80 call
 *           mechanism the JS call stack replaces (not part of the contract).
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908) from ram.js. Hex-kept: ROM template source 0x388C
 *           (an immediate), 0x62AF (an unnamed board-object bookkeeping byte), and 0x6388
 *           (the board-advance dispatch step index loc_1615 reads).
 */

import { loadSpriteObjectBlock } from "./loadSpriteObjectBlock.js"; // ROM 0x004e
import { SPRITE_OBJ_BLOCK } from "./ram.js";

const OBJECT_RECORDS_SRC = 0x388c; // ROM template of 10 sprite-object records (shared w/ the intro climb phase)
const BOARD_OBJECT_SCRATCH = 0x62af; // unnamed board-object bookkeeping byte, cleared here
const BOARD_ADVANCE_STEP = 0x6388; // step index loc_1615 (sub-state 0x16) rst-0x28-dispatches on

export function reloadObjectBlockAndAdvanceStep(m) {
  const { regs, mem } = m;

  // Reload the 40-byte sprite-object block from the ROM template (HL is the source).
  regs.hl = OBJECT_RECORDS_SRC;
  loadSpriteObjectBlock(m);

  // Patch three record field-0 bytes AFTER the copy — each is inside the block the copy
  // just filled, so it overwrites the template value (write order is load-bearing).
  mem.write8(SPRITE_OBJ_BLOCK + 0x04, 0x66); // 0x690C — record 1, field 0
  mem.write8(SPRITE_OBJ_BLOCK + 0x1c, 0x00); // 0x6924 — record 7, field 0
  mem.write8(SPRITE_OBJ_BLOCK + 0x24, 0x00); // 0x692C — record 9, field 0

  // Clear the board-object bookkeeping byte.
  mem.write8(BOARD_OBJECT_SCRATCH, 0x00); // 0x62AF

  // inc (0x6388) — advance to the next board-advance dispatch step.
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
