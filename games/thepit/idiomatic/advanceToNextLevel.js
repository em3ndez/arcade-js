// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceToNextLevel — clear the current level and set up the next one.  ROM 0x02fd.
 *
 * When a level ends, one of two things happened: the player lost a life, or they
 * finished the level. The per-frame round-boundary gate splits those two outcomes and
 * routes the "finished the level" outcome here (the lost-a-life outcome goes to the
 * teardown/turn-switch dispatcher instead). This routine advances the game one level:
 *
 *   1. Bump the level counter — this is the single place the game counts a level
 *      cleared, and every difficulty subsystem reads that counter to get harder.
 *   2. Persist the player's progress into their backup record, so the new level number
 *      survives the two-player turn switch.
 *   3. Rebuild the whole screen for the new level (clear sprites, wipe the tilemap,
 *      flood the colour field), then show the between-levels bonus/status screen and
 *      hold it while it tallies.
 *   4. Persist the progress again — the bonus screen added to the score, so the backup
 *      is refreshed with the new total.
 *   5. Fall into the round (re)init that seats the next level and enters its play loop.
 *
 * One guard runs first: if there is no live one-or-two-player game in progress (the
 * attract/game-over state), there is no level to advance, so it hands straight to the
 * reset epilogue that begins a fresh cycle and touches nothing else.
 *
 * Memory-equivalent to the frozen oracle — equivalence-02fd.test.js.
 * GATE:     crafted-entry — 0x02fd never dispatches in attract (the demo never clears a
 *           level), so the gate captures the sibling round-boundary dispatch 0x0278
 *           (reached at boot; both are tail-jumped from the same timer-expiry gate, so
 *           its entry state is faithful) and pokes GAME_MODE to force each branch. Both
 *           successors run for real down to the never-returning main loop — the advance
 *           branch through initRoundAndEnterMainLoop, the bail branch through resetStateAndShowSetup's reset cascade — so
 *           both arms run under one shared watchdog hook that drains the setup/paint
 *           frame-waits and stops at the main loop's entry. RAM diff excludes the dead
 *           top-of-stack scratch. Teeth: a twin that skips the level bump (caught at LEVEL)
 *           and a twin that bails where it should advance (the two chains diverge in RAM).
 * LIVE-OUT: memory-only — the bumped LEVEL, the persisted player-record backups, the
 *           rebuilt board display + bonus screen, and which successor the tail hand-off
 *           reaches. No register or flag is read back; every exit is a tail hand-off.
 * NAMES:    GAME_MODE (0x8001), LEVEL (0x8028) from ram.js. initRoundAndEnterMainLoop is the round-setup
 *           successor (the advance destination), kept as an m.call boundary (0x031a) — it
 *           falls into the never-returning main loop, so it stays a stubbable/boundable
 *           registry boundary rather than a direct call. resetStateAndShowSetup (the bail destination) is
 *           idiomatic and called directly.
 */

import { GAME_MODE, LEVEL } from "./ram.js";
import { saveActivePlayerRecord } from "./saveActivePlayerRecord.js";
import { setupBoardDisplay } from "./setupBoardDisplay.js";
import { showBonusScreen } from "./showBonusScreen.js";
import { resetStateAndShowSetup } from "./resetStateAndShowSetup.js";

// The board-mode byte that setupBoardDisplay records and reuses as the screen-wide
// fill colour when it rebuilds the display for the new level.
const NEXT_LEVEL_BOARD_MODE = 160;

export function advanceToNextLevel(m) {
  const { mem8 } = m;

  // No live game in progress (attract / game over) means there is no level to advance;
  // hand off to the reset epilogue that begins a fresh cycle.
  if (mem8[GAME_MODE] >= 3) return resetStateAndShowSetup(m);

  // Count this level cleared.
  mem8[LEVEL] = mem8[LEVEL] + 1;

  // Persist the new level number into the player's backup so it survives the turn switch.
  saveActivePlayerRecord(m);

  // Rebuild the whole screen for the new level, then show and hold the between-levels
  // bonus/status screen (which also adds to the score as it tallies).
  setupBoardDisplay(m, NEXT_LEVEL_BOARD_MODE);
  showBonusScreen(m);

  // Persist again to capture the score the bonus screen just added.
  saveActivePlayerRecord(m);

  // Fall into the round (re)init that seats the next level and enters its play loop.
  // m.call boundary: tail hand-off into the never-returning round init (initRoundAndEnterMainLoop 0x031a,
  // which falls into mainLoop); a direct call is behaviorally identical and a terminal-test
  // would be a fragile artifact.
  return m.call(0x031a);
}
