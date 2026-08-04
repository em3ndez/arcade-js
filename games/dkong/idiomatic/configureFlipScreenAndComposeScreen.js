// SPDX-License-Identifier: GPL-3.0-only
/**
 * configureFlipScreenAndComposeScreen — orient the display for the player who is up,
 * step to the next in-game sub-state, and post this screen's draw tasks.  ROM 0x1459.
 *
 * The interior tail of the sub-state-0x14 handler loc_141e (ROM 0x141E), reached when
 * that handler's scan of the PLAYER_SLOT_RECORDS (0x611C) finds an active player slot and
 * dispatches here with the player key already in the A register:
 *   - a record == 1  -> entered directly with A = 0x01,
 *   - a record == 3  -> via loc_144f (which first sets the player index) with A = 0x00.
 * A is the ONE live-in; everything else this routine touches is memory. It does four
 * things, in order:
 *
 *   1. FLIP-SCREEN. Write (A | DIP_UPRIGHT) to the flip-screen board latch (0x7D82).
 *      So the player key forces the flip bit on (A == 1), while an upright cabinet's
 *      DIP forces it on regardless; only A == 0 on a cocktail cabinet leaves it off —
 *      the mechanism that mirrors the screen for the second player on a cocktail.
 *   2. CLEAR the sub-state timer (0x6009 = SUBSTATE_TIMER) to 0, so the rst-0x18 gate
 *      lets the newly-selected sub-state proceed on the very next frame (the "wait 0"
 *      form of the wait-N-then-advance idiom).
 *   3. ADVANCE the in-game sub-state selector (0x600A = GAME_SUBSTATE) by one, so the
 *      next dispatch runs the following step (0x14 -> 0x15).
 *   4. COMPOSE. Post twelve deferred-work messages onto the task ring via enqueueTask
 *      (the shared task-post primitive; D = opcode, E = argument): [0x03, 0x0D] ..
 *      [0x03, 0x18] — the opcode held at 0x03 while the argument counts 0x0D..0x18.
 *      The main loop drains the ring and dispatches each through the handler table at
 *      ROM 0x0307 (opcode masked to its low 5 bits). Opcode 0x03 is the corroborated
 *      screen-text handler (see enqueueTaskBatch / composeScreenAndAdvanceSubstate), so
 *      these twelve are the screen's text-draw work — "several strings from one
 *      routine." The certain fact is the fixed batch posted; the exact string ids are
 *      not independently decoded here.
 *
 * A LEAF over enqueueTask: reads A + DIP_UPRIGHT + the ring; writes the flip latch, the
 * timer + sub-state bytes, and the task ring (via the callee).
 *
 * Memory-equivalent to the frozen oracle — equivalence-1459.test.js.
 * GATE:     crafted-entry — loc_1459 is NOT reached in attract or a 1-player coin+start
 *           run (its parent's object scan finds no player slot, so loc_141e takes the
 *           record-neither -> loc_1475 arm). Both entry arms are forced from a REAL
 *           loc_141e dispatch (GAME_STATE 3 / GAME_SUBSTATE 0x14, at game over) by a
 *           single-byte upstream nudge — poking one 0x611C record to 1 (A = 0x01) or 3
 *           (A = 0x00) — so the ROM's own loc_141e -> loc_1459 dispatch mints a genuine
 *           entry state. Fresh clone per case; RAM (ex-STACK_SCRATCH) + the 0x7D82 latch
 *           compared. Crafted flip matrix (A x DIP) + full-ring / wrap ring arms cover
 *           the paths the natural entry does not.
 * LIVE-OUT: memory + the 0x7D82 flip-screen latch. Memory: SUBSTATE_TIMER (0x6009),
 *           GAME_SUBSTATE (0x600A), and the task ring + TASK_TAIL (via enqueueTask). The
 *           flip latch is a board io output, outside the RAM dump (pinned via
 *           io.flipScreen). No live registers/flags — loc_1459 tail-returns up the
 *           rst-0x28 NMI dispatch path (its callers loc_141e/loc_144f both `return
 *           m.call(0x1459)`), which consumes none; the oracle's residual A/DE/B/HL/F are
 *           dead ABI. SP/pc are the dropped stack model — the oracle's per-post push/ret
 *           residue lands only in STACK_SCRATCH, excluded by the contract.
 * NAMES:    DIP_UPRIGHT (0x6026), SUBSTATE_TIMER (0x6009), GAME_SUBSTATE (0x600A) from
 *           names.js; imports enqueueTask (the idiomatic ROM 0x309F callee). 0x7D82 (the
 *           flip-screen board latch) is not work RAM, so it stays a local hex constant
 *           (as in configureFlipScreenAndSelectSubstate). The opcode/argument bytes are
 *           the fixed message payloads, kept literal — not RAM addresses.
 */

import { DIP_UPRIGHT, SUBSTATE_TIMER, GAME_SUBSTATE } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";

// Flip-screen control latch (ls259.6h) — board hardware, not work RAM, so a local hex
// constant (matching configureFlipScreenAndSelectSubstate / handler_01c3).
const FLIPSCREEN = 0x7d82;

export function configureFlipScreenAndComposeScreen(m) {
  const { regs, mem } = m;

  // 1. Flip-screen latch = the incoming player key (A) OR the upright-cabinet DIP.
  mem.write8(FLIPSCREEN, (regs.a | mem.read8(DIP_UPRIGHT)) & 0xff);

  // 2. Clear the sub-state timer so the next sub-state proceeds immediately.
  mem.write8(SUBSTATE_TIMER, 0x00);

  // 3. Advance to the next in-game sub-state (8-bit wrap, matching `inc (hl)`).
  mem.write8(GAME_SUBSTATE, (mem.read8(GAME_SUBSTATE) + 1) & 0xff);

  // 4. Post the twelve screen-draw messages [opcode 0x03, argument 0x0D..0x18]. The
  //    payload rides in D/E (enqueueTask's ABI); it reads D/E and never writes them, so
  //    the opcode is set once and only the argument steps between posts.
  regs.d = 0x03;
  for (let arg = 0x0d; arg <= 0x18; arg++) {
    regs.e = arg;
    enqueueTask(m);
  }
}
