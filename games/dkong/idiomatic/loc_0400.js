// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0400 — the colour-cycle driver entered mid-body at 0x0400: on the 50m arm, stage the
 * sprite-object row's X-shift, then hand off to the per-frame colour-cycle service.  ROM 0x0400.
 *
 * This is the tail of its sibling (entry_03fb, ROM 0x03FB) entered one instruction later, at the
 * board branch. The sibling reaches here having just compared the current board against 50m, so
 * the branch decider is a LIVE-IN flag: the "board is NOT 50m" outcome routes straight to the
 * colour-cycle service, and the "board IS 50m" outcome first stages the 50m row work. This entry
 * point skips the compare and reads that decision from the flag its caller left set.
 *
 *   - board is NOT 50m -> straight into serviceColorCycle (the per-frame colour cascade).
 *   - board IS 50m     -> shift the sprite-object block's X column by object-1's published step,
 *                         stage this frame's row-shift delta, then serviceColorCycle.
 *
 * The 50m arm, in order:
 *   1. Add object-1's signed X-step (M50_OBJ1_STEP) into the X field of all ten sprite-object
 *      records at once, through addToSpriteObjectColumn (the rst-0x38 vector) — repositioning the
 *      whole row horizontally by one number.
 *   2. Read the X byte of the block's third record (which step 1 just shifted), subtract 0x3b, and
 *      store the result as M50_OBJ_ROW_SHIFT — the row-shift delta shiftEvenBoardSpriteColumn reads
 *      back later on the 50m colour-cascade arm. The read happens AFTER the column shift, so the
 *      staged delta reflects the shifted position, not the pre-shift one.
 *   3. Fall into serviceColorCycle, exactly as the not-50m arm does.
 *
 * NOTE: this address is not in the ROM's scheduled-task table, so nothing dispatches it in the
 * current build; it exists only as the shared tail its reachable sibling flows through. Its
 * behaviour is pinned to the oracle and validated by synthesising the entry from that sibling's
 * real captured state (see the gate). NAME kept neutral loc_ — the mechanism is understood, but the
 * routine's own game role (a task handler that never runs) is not corroborated to the name bar.
 *
 * REGISTER-ABI MARSHALLING (dissolves once addToSpriteObjectColumn takes honest args): that callee
 * still reads its target column and delta from registers, so this routine loads exactly what the
 * oracle's rst-0x38 site loads — the X-column base (SPRITE_OBJ_BLOCK) and the signed step
 * (M50_OBJ1_STEP). serviceColorCycle reads all its inputs from RAM, so it is a bare call.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0400.test.js.
 * GATE:     crafted-entry (this address never dispatches, so there are no natural captures — a
 *           counting override confirms 0 entries over a coin+start window). Both branches are
 *           synthesised from the reachable sibling entry_03fb's REAL captured entry state with the
 *           board flag forced each way, plus crafted attract-base entries that drive the sub-0x3b
 *           row-shift over the byte-wrap and force each colour-cycle route (active / repaint /
 *           frame-wrap) beneath both branches. Whole contract each time: RAM − STACK_SCRATCH + pc +
 *           SP; the candidate models its one net return with a single m.ret(). Teeth: a wrong
 *           row-shift store, a dropped sprite-column shift, and an ignored branch flag.
 * LIVE-OUT: memory-only — the callers tail into this routine and read no register afterwards, so
 *           the oracle's residual registers/flags are dead ABI. SP/PC are the single net return the
 *           JS call stack replaces (the harness supplies one m.ret()). The branch flag is a genuine
 *           LIVE-IN from the still-translated caller (read here as the incoming flag).
 * NAMES:    SPRITE_OBJ_BLOCK (0x6908), M50_OBJ1_STEP (0x63a3), M50_OBJ_ROW_SHIFT (0x63b7) — all from
 *           ram.js. The third-record X byte at 0x6910 is record 2's X field inside the named
 *           SPRITE_OBJ_BLOCK span, reached as SPRITE_OBJ_BLOCK + 8 (matching loc_16a3's
 *           SPRITE_OBJ_BLOCK + 0x08). Colour-cycle cells live inside serviceColorCycle.
 */

import { SPRITE_OBJ_BLOCK, M50_OBJ1_STEP, M50_OBJ_ROW_SHIFT } from "./ram.js";
import { addToSpriteObjectColumn } from "./addToSpriteObjectColumn.js"; // ROM 0x0038 (rst 0x38)
import { serviceColorCycle } from "./serviceColorCycle.js"; // ROM 0x0413

export function loc_0400(m) {
  const { regs, mem } = m;

  // Branch decider is a LIVE-IN flag from the caller's board compare: the "not equal to 50m"
  // outcome routes straight to the colour-cycle service with no row work.
  if (regs.fNZ) {
    serviceColorCycle(m);
    return;
  }

  // 50m arm. Shift the X column of all ten sprite-object records by object-1's signed step.
  regs.hl = SPRITE_OBJ_BLOCK; // 0x6908 — the +0 (X) field of the block's first record
  regs.c = mem.read8(M50_OBJ1_STEP);
  addToSpriteObjectColumn(m);

  // Stage this frame's row-shift delta: the (now-shifted) X byte of the third record less 0x3b.
  // The store truncates, so the subtraction's 8-bit wrap needs no explicit mask.
  mem.write8(M50_OBJ_ROW_SHIFT, mem.read8(SPRITE_OBJ_BLOCK + 8) - 0x3b); // record 2's X in SPRITE_OBJ_BLOCK

  // Then the same colour-cycle service the not-50m arm runs.
  serviceColorCycle(m);
}
