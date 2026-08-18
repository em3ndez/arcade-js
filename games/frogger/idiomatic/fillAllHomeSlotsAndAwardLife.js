// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillAllHomeSlotsAndAwardLife  —  ROM 0x0670  ·  grounding: [seen,poked]
 *
 * WHAT IT IS
 *   The board-complete finisher. Frogger's board ends when the frog has been carried into all five
 *   home bays; the machine then plays a left-to-right "all frogs home" reveal and, at the very end of
 *   that reveal, runs THIS routine to close the board out: it wipes every home bay back to its empty
 *   graphic, restores the sprite-DMA layout, and grants the player one extra life. It runs exactly
 *   ONCE per completed board — not once per frame.
 *
 * WHERE IT SITS
 *   This is the "fill-all" branch (selector value 0x10) of the home-reveal dispatcher
 *   stampHomeBayFrogByColumn (ROM 0x06a2). Each frame of the reveal, the per-frame service routine
 *   hands that dispatcher the current value of the reveal countdown HOME_REVEAL_COUNTDOWN (0x8297) as
 *   a column selector. The countdown sweeps down from 255, and as it passes each bay's column value
 *   (192→bay1, 144→bay2, 112→bay3, 80→bay4, 48→bay5) the dispatcher stamps that bay's completion
 *   frog (tiles 252..255) into its home — dropping a frog into each bay left-to-right. When the
 *   countdown finally drops past 16, the selector reaches 0x10 and the dispatcher delegates HERE to
 *   finish the board. The routine tail-calls awardExtraLife (ROM 0x0a5f) and returns its result.
 *
 * LIVE-OUT
 *   Memory only. It writes 20 VRAM tile cells (a 2x2 quad in each of the five home bays), clears one
 *   state cell, and — through the awardExtraLife tail — a life count, its display mirror, and possibly
 *   one lives-row marker tile. It returns whatever awardExtraLife returns (nothing meaningful) and
 *   leaves no register the caller reads.
 */
import { HOME_SLOT1_VRAM, HOME_SLOT2_VRAM, HOME_SLOT3_VRAM, HOME_SLOT4_VRAM, HOME_SLOT5_VRAM, HOME_COLUMN_STATE } from "./names.js";
import { fillTwoByTwoTileBlock } from "./fillTwoByTwoTileBlock.js";
import { awardExtraLife } from "./awardExtraLife.js";

export function fillAllHomeSlotsAndAwardLife(m) {
  const { mem8 } = m;

  // ── Reset all five home bays to empty ─────────────────────────────────────────────────
  // Each won bay is currently showing the 2x2 completion-frog graphic dropped in during the reveal.
  // Before the next board is laid we paint the empty-home-bay graphic (tile 0x10) back over every bay,
  // wiping this board's frogs away. fillTwoByTwoTileBlock (ROM 0x0695) is the shared 2x2 stamp
  // primitive: given a bay's fixed VRAM base it writes tile 0x10 into the base cell, the cell to its
  // right, and the two cells one screen row (0x20 = 32 columns) below (base, base+1, base+32, base+33).
  // We call it once per bay, in slot order 1..5, with each bay's base — HOME_SLOT1_VRAM (0xab64),
  // HOME_SLOT2_VRAM (0xaaa4), HOME_SLOT3_VRAM (0xa9e4), HOME_SLOT4_VRAM (0xa924), HOME_SLOT5_VRAM
  // (0xa864). The five quads cover disjoint cells, so the order among them does not affect the result.
  fillTwoByTwoTileBlock(m, HOME_SLOT1_VRAM);
  fillTwoByTwoTileBlock(m, HOME_SLOT2_VRAM);
  fillTwoByTwoTileBlock(m, HOME_SLOT3_VRAM);
  fillTwoByTwoTileBlock(m, HOME_SLOT4_VRAM);
  fillTwoByTwoTileBlock(m, HOME_SLOT5_VRAM);

  // ── Restore the normal sprite-DMA layout ──────────────────────────────────────────────
  // HOME_COLUMN_STATE (0x842f) is read by the per-frame sprite-DMA shadow blit to pick the layout of
  // its second copy region: when this cell is 0 the blit runs eight 4-byte passes from the fly-sprite
  // block (FLY_SPRITE_X 0x8040 → OBJRAM 0xb040); when it is non-zero it runs six passes from the
  // sprite-object slots instead (0x8048 → 0xb048). The reveal leaves this cell non-zero; clearing it
  // back to 0 here returns the DMA to its default fly-sprite configuration for the next board.
  mem8[HOME_COLUMN_STATE] = 0;

  // ── Grant the extra life ──────────────────────────────────────────────────────────────
  // awardExtraLife (ROM 0x0a5f) bumps the active player's life count (PLAYER1_LIVES 0x83b8 or
  // PLAYER2_LIVES 0x83b9, chosen by ACTIVE_PLAYER 0x83fd), mirrors the new total into the shared
  // display count LIVES_COUNT (0x83b7), and — unless the lives row is already full at 16 — stamps one
  // more marker tile into the vertical lives row. The `return` makes this a genuine tail-call: awarding
  // the life is the last thing the board-complete finisher does, and its (empty) result is handed
  // straight back to our caller.
  return awardExtraLife(m);
}
