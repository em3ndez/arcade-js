// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayerScreenOrAttract — hold the game-over screen, then bring up the active player's
 * screen or fall back to attract.
 *
 * This is the game-over sub-state handler. Each frame it redraws the "CREDIT nn" line and counts
 * the sub-state hold timer down; while that timer is still running it does nothing else. When it
 * expires the screen is blanked, the two-byte player index is cleared, and the five player-context
 * records are scanned to decide what comes up next:
 *
 *   - a record holding 1 — player 1 is still up: compose player 1's screen, with the flip key set
 *     to 1;
 *   - else a record holding 3 — player 2 is still up: select player 2, which sets the player index
 *     and then composes with the flip key 0;
 *   - else neither — no player is left in play, so go back to attract.
 *
 * The scan stops at the FIRST matching record, and which of the five slots matched is dead
 * information: none of the three outcomes reads the scan pointer.
 *
 * NOT CLAIMED: what the record values 1 and 3 mean in themselves. The role — scan the records,
 * compose the surviving player's screen, otherwise attract — follows from what the three outcomes
 * do; the values are read back from those outcomes rather than established on their own.
 *
 * LIVE-OUT: memory, plus the flip-screen latch, which is a board output the composing outcomes
 * drive rather than a memory cell.
 */

import { CURRENT_PLAYER, ACTIVE_PLAYER_INDEX, PLAYER_SLOT_RECORDS } from "./names.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { configureFlipScreenAndComposeScreen } from "./configureFlipScreenAndComposeScreen.js";
import { selectPlayer2AndComposeScreen } from "./selectPlayer2AndComposeScreen.js";
import { enterAttractMode } from "./enterAttractMode.js";

// ACTIVE_PLAYER_INDEX is the companion byte to CURRENT_PLAYER: this handler treats the two as one
// two-byte "player index", clearing both up front, and the record==3 arm rewrites both.

// PLAYER_SLOT_RECORDS is the base of the five player-context records this handler scans.
const RECORD_STRIDE = 0x22;
const RECORD_COUNT = 5;

/** True if any of the five records holds `value`. */
function anyRecordEquals(mem, value) {
  let addr = PLAYER_SLOT_RECORDS;
  for (let i = 0; i < RECORD_COUNT; i++, addr = (addr + RECORD_STRIDE) & 0xffff) {
    if (mem.read8(addr) === value) return true;
  }
  return false;
}

export function selectPlayerScreenOrAttract(m) {
  const { regs, mem } = m;

  // Redraw the "CREDIT nn" line every frame.
  drawCreditDisplay(m);

  // Hold the screen until the sub-state timer expires; while it is still counting down, do
  // nothing else this frame.
  if (!tickSubstateTimer(m)) return;

  // Timer expired: blank the playfield + sprite shadow buffer.
  clearPlayfieldAndSprites(m);

  // Clear the two-byte player index; each active-player arm rewrites it.
  mem.write8(ACTIVE_PLAYER_INDEX, 0x00);
  mem.write8(CURRENT_PLAYER, 0x00);

  // Player 1 still up? (a record == 1) -> compose player 1's screen with the flip key set to 1.
  if (anyRecordEquals(mem, 0x01)) {
    regs.a = 0x01;
    configureFlipScreenAndComposeScreen(m);
    return;
  }

  // Player 2 still up? (a record == 3) -> select player 2, which composes with its own flip key.
  if (anyRecordEquals(mem, 0x03)) {
    selectPlayer2AndComposeScreen(m);
    return;
  }

  // Neither player left in play -> return to attract.
  enterAttractMode(m);
}
