// SPDX-License-Identifier: GPL-3.0-only
/**
 * selectPlayerScreenOrAttract — the sub-state-0x14 handler: hold the game-over screen,
 * then bring up the active player's screen or fall back to attract.  ROM 0x141E.
 *
 * Dispatched as in-game sub-state 0x14 (GAME_STATE 3) through the 0x0702 table
 * (dispatchGameState idx 20, `return m.call(0x141e)`), at game over. Each frame it
 * redraws the "CREDIT nn" line and counts down the sub-state hold timer; while the
 * timer is still running it does nothing else. When the timer expires it blanks the
 * screen, clears the two-byte player index, then scans the five PLAYER_SLOT_RECORDS
 * (0x611C, stride 0x22) to decide the next screen:
 *
 *   - a record == 1  -> player 1 is still up: compose player 1's screen
 *                       (configureFlipScreenAndComposeScreen) with the flip key A = 1;
 *   - else a record == 3  -> player 2 is still up: select player 2
 *                       (selectPlayer2AndComposeScreen), which sets the player index and
 *                       then composes with A = 0;
 *   - else neither  -> no player left in play: return to attract (enterAttractMode).
 *
 * The routine dispatches at the FIRST matching record (the oracle's `jp z` exits the
 * scan loop immediately); which of the five slots matched is dead — the dispatch targets
 * never read the scan pointer. Confidence note: the ROLE (scan records -> compose the
 * active player's screen, else attract) is well-corroborated by the three dispatch-tail
 * callees; the exact meaning of the record VALUES 1/3 is inferred from those outcomes,
 * and the record array is PLAYER_SLOT_RECORDS (0x611C) in ram.js, which cites loc_141e
 * (this routine) as its ground-truth reader for the owner-tag values 1/3.
 *
 * Memory-equivalent to the frozen oracle — equivalence-141e.test.js.
 * GATE:     crafted-entry. A coin+start game driven to game over dispatches loc_141e
 *           naturally (GAME_STATE 3 / sub 0x14); that exercises the timer-hold early
 *           return AND the neither-found -> attract arm (a 1-player game's records are all
 *           zero). The record==1 (-> 0x1459) and record==3 (-> 0x144f) arms attract never
 *           reaches are forced by a single-byte upstream nudge — poke one PLAYER_SLOT_RECORDS
 *           record — plus SUBSTATE_TIMER=1 to force expiry, identically on both sides. Fresh clone
 *           per case (writes memory); RAM (ex-STACK_SCRATCH) + io.flipScreen compared.
 * LIVE-OUT: memory-only (+ the 0x7D82 flip-screen latch, a board io output driven by the
 *           tail callees). The successors — the rst-0x28 NMI dispatch and every tail
 *           dispatch — consume no register or flag; the oracle's residual A/B/DE/HL/F and
 *           SP/pc (the dropped stack model) are dead ABI.
 * NAMES:    CURRENT_PLAYER (0x600D), its player-index companion ACTIVE_PLAYER_INDEX (0x600E),
 *           and the scanned record array PLAYER_SLOT_RECORDS (0x611C) from ram.js.
 *           Imports the six idiomatic callees (drawCreditDisplay, tickSubstateTimer,
 *           clearPlayfieldAndSprites, configureFlipScreenAndComposeScreen,
 *           selectPlayer2AndComposeScreen, enterAttractMode).
 */

import { CURRENT_PLAYER, ACTIVE_PLAYER_INDEX, PLAYER_SLOT_RECORDS } from "./ram.js";
import { drawCreditDisplay } from "./drawCreditDisplay.js"; // ROM 0x0616
import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js"; // ROM 0x0874
import { configureFlipScreenAndComposeScreen } from "./configureFlipScreenAndComposeScreen.js"; // ROM 0x1459
import { selectPlayer2AndComposeScreen } from "./selectPlayer2AndComposeScreen.js"; // ROM 0x144F
import { enterAttractMode } from "./enterAttractMode.js"; // ROM 0x1475

// ACTIVE_PLAYER_INDEX (0x600E) is the companion byte to CURRENT_PLAYER (0x600D): loc_141e
// treats 0x600D:0x600E as one two-byte "player index", clearing both up front; the
// record==3 arm rewrites both.

// PLAYER_SLOT_RECORDS (0x611C) is the base of the five stride-0x22 player-context records
// this handler scans (0x611C, 0x613E, 0x6160, 0x6182, 0x61A4).
const RECORD_STRIDE = 0x22;
const RECORD_COUNT = 5;

/** True if any of the five records holds `value` — the oracle's `cp (hl)` scan. */
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

  // Hold the screen until the sub-state timer expires; while it is still counting down,
  // do nothing else this frame (the rst-0x18 caller-skip -> boolean return).
  if (!tickSubstateTimer(m)) return;

  // Timer expired: blank the playfield + sprite shadow buffer.
  clearPlayfieldAndSprites(m);

  // Clear the two-byte player index; each active-player arm rewrites it.
  mem.write8(ACTIVE_PLAYER_INDEX, 0x00);
  mem.write8(CURRENT_PLAYER, 0x00);

  // Player 1 still up? (a record == 1) -> compose player 1's screen with flip key A = 1.
  if (anyRecordEquals(mem, 0x01)) {
    regs.a = 0x01;
    configureFlipScreenAndComposeScreen(m);
    return;
  }

  // Player 2 still up? (a record == 3) -> select player 2, then compose (its own A = 0).
  if (anyRecordEquals(mem, 0x03)) {
    selectPlayer2AndComposeScreen(m);
    return;
  }

  // Neither player left in play -> return to attract.
  enterAttractMode(m);
}
