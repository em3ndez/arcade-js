// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBoardStepWhenSpritesCleared — one arm of the board-advance sequence:
 * sweep the sprite-object block toward the top and, once it is fully empty, arm the
 * wait timer and step to the next arm of the sequence.  ROM 0x1757.
 *
 * Dispatched from inside the vblank NMI while a board is being torn down
 * (GAME_STATE == 3 -> GAME_SUBSTATE 0x16 board-advance -> loc_1615's rst-0x28 table
 * on the 0x6388 sequence selector). Each frame it runs two sprite passes over the
 * ten-record SPRITE_OBJ_BLOCK and then decides whether the block has finished
 * clearing:
 *
 *   1. animateSpriteObjectBlock (0x306f) — every 8th call, scroll the whole block
 *      up 4px and flip a few records; this is what marches the sprites off the top.
 *   2. cullSpriteObjectsAtTop (0x176c) — zero the X of any record that has risen
 *      above the top line (Y < 0x19), and hand back the scan pointer/stride pair
 *      (HL = block start − 1 = 0x6907, DE = stride − 1 = 3).
 *   3. Advance that pair (inc hl / inc de -> HL = 0x6908 block start, DE = 4 stride)
 *      and ask allSlotsClear (0x1783) whether all ten record X bytes are now zero.
 *
 * If a slot is still occupied, allSlotsClear reports not-clear (the oracle's `jp
 * 0x0026` CALLER-SKIP, expressed here as a false return): abort this arm and try
 * again next frame — the sequence selector does NOT advance. If every slot is clear,
 * arm SUBSTATE_TIMER (0x6009) to 0x40 frames (the dwell before the next sub-state
 * proceeds) and increment the 0x6388 sequence selector so the next NMI dispatches
 * the following arm.
 *
 * All three callees are the already-decompiled idiomatic primitives, called
 * directly; the pointer-advance (inc hl / inc de) between the cull and the scan is
 * this routine's own glue — the base/stride allSlotsClear receives depend on it.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1757.test.js.
 * GATE:     crafted-entry — 0x1757 is UNREACHED in attract (0 dispatches / 2000
 *           frames; its board-advance caller never runs there), so seeds come from
 *           real captured board-setup RAM (hooked at the sibling 0x003d, which fires
 *           with the 0x6908 sprite-object block populated). Crafted entries drive
 *           BOTH the clear arm (advance) and the not-clear arm (abort), and sweep the
 *           0x62AF phase counter so animateSpriteObjectBlock fires and does not; each
 *           runs on a FRESH clone (this routine writes memory). Compared on RAM
 *           (−STACK_SCRATCH) + pc + SP. TEETH: wrong timer value, skipped 0x6388
 *           increment, and dropped pointer-advance twins.
 * LIVE-OUT: memory-only — SUBSTATE_TIMER (0x6009) and the 0x6388 selector on the
 *           clear arm; the 0x62AF phase counter and the swept sprite block always.
 *           The successor (loc_1615's rst-0x28 tail, a plain `ret`) consumes no
 *           register or flag; the oracle's residual A/HL/F are dead ABI, backstopped
 *           by the whole-machine memory gate. The harness supplies the closing `ret`
 *           so pc/SP line up with the oracle (both exit paths land at SP+2, pc =
 *           word@SP — the grandparent return, reached via this routine's own `ret`
 *           on the clear arm and via allSlotsClear's caller-skip on the abort arm).
 * NAMES:    SUBSTATE_TIMER (0x6009), BOARD_ADVANCE_STEP (0x6388) — ram.js. 0x6388 is the
 *           board-advance SEQUENCE SELECTOR that loc_1615's rst-0x28 indexes and each
 *           advance arm increments. The 0x62AF phase counter lives inside
 *           animateSpriteObjectBlock, not here.
 */

import { SUBSTATE_TIMER, BOARD_ADVANCE_STEP } from "./ram.js";
import { animateSpriteObjectBlock } from "./animateSpriteObjectBlock.js"; // ROM 0x306f
import { cullSpriteObjectsAtTop } from "./cullSpriteObjectsAtTop.js"; // ROM 0x176c
import { allSlotsClear } from "./allSlotsClear.js"; // ROM 0x1783

const SUBSTATE_DWELL = 0x40; // frames to hold before the next sub-state proceeds

export function advanceBoardStepWhenSpritesCleared(m) {
  const { regs, mem } = m;

  // Two sprite passes: march the block up (1-in-8) then cull records off the top.
  animateSpriteObjectBlock(m);
  cullSpriteObjectsAtTop(m); // leaves HL = 0x6907 (block − 1), DE = 3 (stride − 1)

  // Advance the cull's pointer/stride pair to the block scan (0x6908, stride 4).
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.de = (regs.de + 1) & 0xffff;

  // A slot still occupied -> not done clearing; abort this arm (caller-skip),
  // leaving the sequence selector untouched so the same arm runs again next frame.
  if (!allSlotsClear(mem, regs.hl, regs.de)) return;

  // Block fully cleared: arm the dwell timer and step to the next sequence arm.
  mem.write8(SUBSTATE_TIMER, SUBSTATE_DWELL);
  mem.write8(BOARD_ADVANCE_STEP, (mem.read8(BOARD_ADVANCE_STEP) + 1) & 0xff);
}
