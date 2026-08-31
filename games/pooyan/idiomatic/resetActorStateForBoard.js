// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import {
  SPEED_INDEX,
  PLAY_STATE_INDEX,
  PLAY_TIMER_GATE_P1,
  PLAY_TIMER_GATE_P2,
  loc_89e3,
  LATCHED_ENEMY_X,
  LIVES_DSW,
  PLAYER0_LIVES,
  PLAYER1_LIVES,
  PLAYER0_STATE_BANK,
  PLAYER1_STATE_BANK,
  DIFFICULTY_DSW,
  GAME_ACTIVE_FLAG,
  LAUNCH_ARMED_FLAG,
  LAUNCH_STATE,
  loc_8f0e,
  loc_8f0f,
} from "./names.js";
/**
 * resetActorStateForBoard — wipe and re-seed the actor/sprite working state for a fresh board.
 *
 * WHAT IT IS
 *   ROM 0x0e00-0x0e45. The one-shot "clean slate" for the playfield's live actors. Whenever a
 *   board is (re)built — at the start of a life, on a board rebuild, or when the turn passes to
 *   the other player — this blanks the working state the per-frame engine reads, then plants the
 *   fixed opening values a new board expects. After it runs, the machine is primed to fill the
 *   background tilemap and, if a game is actually live, to begin spawning enemies.
 *
 * ROLE IN THE MACHINE
 *   The active player's actors and per-round scratch all live in a single "live page" based at
 *   SPEED_INDEX (0x8900): a 0xbf-byte region whose first 0x3f bytes are the swappable per-player
 *   block. Each player also owns a saved state bank a fixed distance above the live page —
 *   PLAYER0_STATE_BANK (0x8940) and PLAYER1_STATE_BANK (0x8980), 0x3f bytes each — that the
 *   turn-switch logic block-copies in and out of the live page so a player resumes where they
 *   paused. This routine clears the live page outright and seeds the fixed opening entries into
 *   BOTH players' banks, so whichever player takes the board restores a correctly-primed bank. It
 *   is reached from the start-of-life setup (startNewGamePlay) and from the board-build /
 *   player-switch paths.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT
 *   - A = 0 — both exits leave the accumulator zero.
 *   - The memory writes are the real product: a cleared live page (0x8900..0x89be), cleared
 *     round-phase flags, each player's bank seeded with lives / opening X / sprite colour, the
 *     tilemap fill armed, and — only while a game is live — the launch state-machine flags cleared.
 */
const OPENING_X = 0x20; // opening sprite X planted into byte 1 of each player's saved bank
const LIVE_PAGE_LEN = 0xbf; // length of the live actor/state page cleared on every board reset

export function resetActorStateForBoard(m) {
  const { mem8 } = m;

  // Blank the entire live actor/state page at SPEED_INDEX (0x8900) — 0xbf bytes — so no stale
  // actor record, velocity, or per-round scratch carries over into the new board. This is the
  // working copy the per-frame engine reads; the turn-switch logic later block-copies a player's
  // saved bank over the top of it.
  fillByteRun(m, SPEED_INDEX, 0, LIVE_PAGE_LEN); // clear the live-state page
  // Reset the loose round-phase flags that live outside the wholesale-cleared page, so the board
  // starts from a known state:
  //   PLAY_STATE_INDEX (0x880a)             — the in-play sub-state index; 0 restarts the round
  //     at phase 0.
  //   PLAY_TIMER_GATE_P1/P2 (0x89e1/0x89e2) — the two BCD play-timer gates; a nonzero gate freezes
  //     that player's clock, so clearing both lets each timer tick while its player is active.
  //   loc_89e3 (0x89e3)                     — the flag byte immediately after the two timer gates,
  //     cleared alongside them.
  //   LATCHED_ENEMY_X (0x8f5b)              — the latched enemy screen-X recorded by the enemy
  //     approach animation; cleared so no stale latched value bleeds into the new board.
  mem8[PLAY_STATE_INDEX] = 0;
  mem8[PLAY_TIMER_GATE_P1] = 0;
  mem8[PLAY_TIMER_GATE_P2] = 0;
  mem8[loc_89e3] = 0;
  mem8[LATCHED_ENEMY_X] = 0;

  // Seed both players' remaining-lives counters from the cabinet lives switch LIVES_DSW (0x8807).
  // PLAYER0_LIVES / PLAYER1_LIVES sit at bank+8 (0x8948 / 0x8988); each drains toward zero as that
  // player dies and gates the player-switch / game-over decision. Seeding BOTH here means a
  // two-player game has both counters primed before either takes the board.
  const lives = mem8[LIVES_DSW];
  mem8[PLAYER0_LIVES] = lives;
  mem8[PLAYER1_LIVES] = lives;
  // Plant the fixed opening sprite X into byte 1 of each player's saved bank (0x8941 / 0x8981), so
  // a restored bank starts the player actor at the standard entry column.
  mem8[PLAYER0_STATE_BANK + 1] = OPENING_X;
  mem8[PLAYER1_STATE_BANK + 1] = OPENING_X;

  // Byte 0 of each bank (0x8940 / 0x8980) is the player sprite's colour; seed it from the
  // difficulty switch DIFFICULTY_DSW (0x8820) so the palette selection tracks the cabinet setting.
  const colour = mem8[DIFFICULTY_DSW];
  mem8[PLAYER0_STATE_BANK] = colour;
  mem8[PLAYER1_STATE_BANK] = colour;

  // Arm the row-by-row tilemap fill from the fixed top of the playfield tile plane, so the
  // background grid is repainted top-to-bottom for the new board.
  armTileFillFromPlayfieldBase(m); // arm the row-by-row tile fill

  // GAME_ACTIVE_FLAG (0x8806) is the in-play gate: set at start-of-life, cleared at game-over and
  // throughout attract. When it is clear the board is being set up outside a live game (attract /
  // idle), so the reset stops here — there is no launch state machine running to clean up — leaving
  // the accumulator zero.
  if (mem8[GAME_ACTIVE_FLAG] === 0) return (m.regs.a = 0); // idle -> stop here, A cleared

  // A game is live, so also reset the arrow/rope launch state machine for the new board:
  //   LAUNCH_ARMED_FLAG (0x8f3f) — the one-shot "launch is armed" flag.
  //   LAUNCH_STATE (0x8f30)      — the launch state-machine selector, returned to its idle state.
  //   loc_8f0e / loc_8f0f (0x8f0e / 0x8f0f) — two adjacent launch-page cells cleared with them.
  // Then leave the accumulator zero, matching the idle exit above.
  mem8[LAUNCH_ARMED_FLAG] = 0;
  mem8[LAUNCH_STATE] = 0;
  mem8[loc_8f0e] = 0;
  mem8[loc_8f0f] = 0;
  return (m.regs.a = 0);
}
