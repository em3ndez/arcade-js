// SPDX-License-Identifier: GPL-3.0-only
/**
 * applyDipSwitches — read the cabinet DIP switches and commit their settings to the
 * game's runtime configuration (difficulty/bonus parameters + the flip-screen hardware).  ROM 0x4b55.
 *
 * The dip-switch byte is read once and its bits fan out into the block of gameplay
 * parameter cells the round setup later consumes:
 *   - the two low bits pick the coins-per-credit costs for two coin lines, packed as a
 *     little-endian word (low = COINS_PER_CREDIT_A, high = COINS_PER_CREDIT_B); these are
 *     the coin costs serviceVblankNmi spends to start a game, NOT a bonus/lives setting,
 *   - one bit each nudges two counts and the per-step difficulty timer base
 *     (STEP_TIMER_BASE — a smaller base steps faster),
 *   - two bits configure the cabinet's flip-screen / cocktail behaviour, and
 *   - the top bit, if set, diverts to the colour-cycle test screen.
 *
 * The flip-screen decode is the classic cocktail arrangement: one dip makes the flip
 * FOLLOW the active player (so player 2 sees the cabinet the right way up across the
 * table), another dip inverts the base orientation. The resulting flip bit is driven
 * onto the two flip-screen control lines and, doubled, into the sprite coordinate bias
 * that shifts sprites to match the flipped picture (zero in an un-flipped upright cabinet).
 *
 * Memory-equivalent to the frozen oracle — equivalence-4b55.test.js.
 * GATE:     crafted-entry — real captured boot dispatch (RAM-EQUAL) + an exhaustive sweep
 *           of the dip byte (0..127, top bit clear) crossed with the active-player byte
 *           (0..255), covering every decode branch. The top-bit test-screen arm tail-jumps
 *           into showColourTestScreen (its own gate: equivalence-4f47), which only makes
 *           progress under the live frame loop, so it is equal by construction (the same
 *           call on both arms) and is not exercised by this sweep.
 * LIVE-OUT: memory-only — the parameter block 0x804c..0x8053; it also drives the two
 *           flip-screen control lines (I/O, outside the RAM diff, driven for the live
 *           game). No register or flag is read by the caller.
 * NAMES:    STEP_TIMER_BASE (0x804f), SPRITE_COORD_BIAS (0x8051), ACTIVE_PLAYER (0x8002),
 *           the coins-per-credit costs COINS_PER_CREDIT_A (0x804c)/COINS_PER_CREDIT_B
 *           (0x804d), the loop-delay base LOOP_DELAY_BASE (0x804e), and the starting-men
 *           count STARTING_MEN (0x8053) from names.js; the write-only flip flags
 *           0x8050/0x8052 stay hex; 0xb000/0xb006/0xb007 are I/O ports, not work RAM.
 */

import { STEP_TIMER_BASE, SPRITE_COORD_BIAS, ACTIVE_PLAYER, COINS_PER_CREDIT_A, LOOP_DELAY_BASE, STARTING_MEN } from "./names.js";
import { showColourTestScreen } from "./showColourTestScreen.js";

export function applyDipSwitches(m) {
  const { mem8, mem16 } = m;
  const dsw = mem8[0xb000];

  // Low two bits select the coins-per-credit costs for two coin lines, packed as a
  // little-endian word (low byte = COINS_PER_CREDIT_A, high byte = COINS_PER_CREDIT_B).
  // serviceVblankNmi subtracts these from the credit count to pay for a start; both bits
  // set writes cost 0 = free play. Otherwise bit 0 takes priority over bit 1.
  let coinsPerCreditWord;
  if ((dsw & 0x03) === 0x03) coinsPerCreditWord = 0x0000;
  else if (dsw & 0x01) coinsPerCreditWord = 0x0302;
  else if (dsw & 0x02) coinsPerCreditWord = 0x0402;
  else coinsPerCreditWord = 0x0201;
  mem16[COINS_PER_CREDIT_A] = coinsPerCreditWord;

  // Two counts and the difficulty step-timer base, each a constant its dip lowers.
  mem8[LOOP_DELAY_BASE] = (dsw & 0x04) ? 12 : 10;
  mem8[STEP_TIMER_BASE] = (dsw & 0x08) ? 45 : 55; // smaller base -> faster steps

  // Flip-screen / cocktail configuration.
  const flipInvert = (dsw & 0x10) ? 1 : 0; // inverts the base screen orientation
  const flipFollowsPlayer = (dsw & 0x20) ? 1 : 0; // cocktail: flip tracks the active player
  mem8[0x8050] = flipInvert;
  mem8[0x8052] = flipFollowsPlayer;

  // Is the picture flipped for whoever is playing right now? In cocktail mode it flips
  // for player 2; the invert dip then toggles it. The player index is 1 or 2.
  const activePlayer = mem8[ACTIVE_PLAYER];
  const flipScreen = ((activePlayer - 1) & flipFollowsPlayer) ^ flipInvert;
  mem8[0xb006] = flipScreen; // flip-screen control lines (only the low bit is latched)
  mem8[0xb007] = flipScreen;
  mem8[SPRITE_COORD_BIAS] = flipScreen << 1; // sprite pixel bias matching the flip (0 upright)

  // One more count from bit 6.
  mem8[STARTING_MEN] = (dsw & 0x40) ? 4 : 3;

  // The top dip is the colour-cycle test screen: the oracle tail-jumps to it and NEVER returns
  // here (its own loop runs the test), abandoning this routine's caller. showColourTestScreen is a
  // spine generator and applyDipSwitches is always reached from within a gen.next()-driven main
  // generator, so this is a mid-frame warm restart: m.restartMain throws RESTART, the engine
  // abandons the current main and swaps in the colour-test loop. (showColourTestScreen calls back
  // into this routine, an ES-module cycle; the import binds at runtime inside this branch.)
  if (dsw & 0x80) return m.restartMain(() => showColourTestScreen(m));
}
