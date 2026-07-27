// SPDX-License-Identifier: GPL-3.0-only
/**
 * startGame — set up a fresh game once a credit is registered, then enter play.  ROM 0x022d.
 *
 * Runs the instant the coin logic banks a credit and picks the starting player/mode: it
 * rebuilds the machine for a brand-new game and then falls straight into the main round
 * loop, so it never returns to its caller.
 *
 * The setup, in order:
 *   - Clears the round-variant selector, arms the per-frame interrupt, unmutes the
 *     sound, and blanks the whole screen — a clean slate for the first board.
 *   - Requests the game-start sound and clears the score plus the sound queue.
 *   - Decodes the dip switches into this game's difficulty/lives parameters, then seeds
 *     the round state from them: a dip-derived parameter into its live byte, the
 *     starting level of 1, and the men-left count from the dip starting-lives value.
 *   - Primes BOTH players' saved records from those fresh defaults (so player 2's turn
 *     starts clean too), loads the starting player's record into the live slot, and
 *     counts the man about to play into the men-left total.
 *
 * Touches only work RAM and the screen it rebuilds; returns nothing — control passes to
 * the main round loop and stays there.
 *
 * Memory-equivalent to the frozen oracle — equivalence-022d.test.js.
 * GATE:     crafted-entry — a credit is never banked in a plain attract run, so this is
 *           never dispatched; the gate runs it from a real captured attract state (a
 *           sound-request entry). It falls into the now-idiomatic round loop (loc_0278),
 *           so both sides run the real round-boundary chain and converge at the true
 *           oracle leaves (0x031a setup / 0x01f9 reset), stubbed identically on both
 *           sides; the gate compares RAM outside the dead Z80 stack scratch below the
 *           stack top. Teeth: a corrupted starting level and a corrupted men-left count.
 * LIVE-OUT: memory-only — the seeded round-state bytes, both players' primed records,
 *           the loaded live record, and the blanked screen / flooded colour RAM. No
 *           register or flag is live out (it falls into the main loop, not a caller).
 * NAMES:    VARIANT 0x8048, LEVEL 0x8028, GAME_MODE 0x8001, GAME_STATE2 0x8002 (the 1/2
 *           player selector the record save/load reads). The dip-derived source bytes
 *           0x804e / 0x8053 and the round-state bytes they feed (0x8011, and 0x802b the
 *           men-left counter) have no ram.js name yet, so they stay hex.
 */

import { VARIANT, LEVEL, GAME_MODE, GAME_STATE2 } from "./ram.js";
import { loc_0278 } from "./loc_0278.js";
import { enableNmi } from "./enableNmi.js";
import { enableSound } from "./enableSound.js";
import { blankScreen } from "./blankScreen.js";
import { requestSound4 } from "./requestSound4.js";
import { resetScoreAndSoundQueue } from "./resetScoreAndSoundQueue.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { saveActivePlayerRecord } from "./saveActivePlayerRecord.js";
import { loadPlayerState } from "./loadPlayerState.js";

export function startGame(m) {
  const { mem8 } = m;

  // Clear the round-variant selector, arm the per-frame interrupt and sound, and blank
  // the whole screen so the first board is built on a clean slate.
  mem8[VARIANT] = 0;
  enableNmi(m);
  enableSound(m);
  blankScreen(m);

  // Play the game-start sound and clear the score plus the sound queue for a fresh game.
  requestSound4(m);
  resetScoreAndSoundQueue(m);

  // Decode the dip switches into this game's difficulty/lives parameters, then seed the
  // round state from them: a dip-derived parameter into its live byte, the starting
  // level of 1, and the men-left count from the dip starting-lives value.
  applyDipSwitches(m);
  mem8[0x8011] = mem8[0x804e];
  mem8[LEVEL] = 1;
  mem8[0x802b] = mem8[0x8053];

  // Prime both players' saved records from these fresh defaults so either player's turn
  // starts clean; the selector byte names which player's record to write.
  mem8[GAME_STATE2] = 1;
  saveActivePlayerRecord(m);
  mem8[GAME_STATE2] = 2;
  saveActivePlayerRecord(m);

  // Load the starting player's record (the player the coin logic selected) into the live
  // slot, then count the man about to play into the men-left total.
  mem8[GAME_STATE2] = mem8[GAME_MODE];
  loadPlayerState(m);
  mem8[0x802b] = mem8[0x802b] + 1;

  // Fall straight into the main round loop (loc_0278, now idiomatic); it never returns
  // here — its own successor chain carries control on into the game.
  return loc_0278(m);
}
