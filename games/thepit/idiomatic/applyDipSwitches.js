// SPDX-License-Identifier: GPL-3.0-only
/**
 * applyDipSwitches — read the cabinet DIP switches and commit their settings to the game's runtime
 * configuration (difficulty and bonus parameters plus the flip-screen hardware).
 *
 * The dip-switch byte is read once and its bits fan out into the gameplay parameter cells round setup
 * later consumes: the two low bits pick coins-per-credit costs for two coin lines (packed as a little-
 * endian word), single bits nudge two counts and the per-step difficulty timer base, two bits set the
 * cocktail flip-screen behaviour, and the top bit diverts to the colour-cycle test screen. The flip
 * decode is the classic cocktail arrangement — one dip makes the flip follow the active player,
 * another inverts the base orientation — driving the flip control lines and, doubled, the sprite bias.
 */

import {
  ACTIVE_PLAYER,
  COINAGE_WORD_A1_B2,
  COINAGE_WORD_A2_B3,
  COINAGE_WORD_A2_B4,
  COINS_PER_CREDIT_A,
  DSW_PORT,
  FLIP_SCREEN_X_LATCH,
  FLIP_SCREEN_Y_LATCH,
  LOOP_DELAY_BASE,
  SPRITE_COORD_BIAS,
  STARTING_MEN,
  STEP_TIMER_BASE,
  COCKTAIL_FLIP_INVERT_SHADOW,
  COCKTAIL_FLIP_FOLLOWS_PLAYER_SHADOW,
} from "./names.js";
import { showColourTestScreen } from "./showColourTestScreen.js";

export function applyDipSwitches(m) {
  const { mem8, mem16 } = m;
  const dsw = mem8[DSW_PORT];

  // Low two bits select coins-per-credit costs, packed low/high; both set = free play (0).
  let coinsPerCreditWord;
  if ((dsw & 0x03) === 0x03) coinsPerCreditWord = 0;
  else if (dsw & 0x01) coinsPerCreditWord = COINAGE_WORD_A2_B3;
  else if (dsw & 0x02) coinsPerCreditWord = COINAGE_WORD_A2_B4;
  else coinsPerCreditWord = COINAGE_WORD_A1_B2;
  mem16[COINS_PER_CREDIT_A] = coinsPerCreditWord;

  mem8[LOOP_DELAY_BASE] = (dsw & 0x04) ? 12 : 10;
  mem8[STEP_TIMER_BASE] = (dsw & 0x08) ? 45 : 55; // smaller base -> faster difficulty steps

  const flipInvert = (dsw & 0x10) ? 1 : 0; // inverts the base screen orientation
  const flipFollowsPlayer = (dsw & 0x20) ? 1 : 0; // cocktail: flip tracks the active player
  mem8[COCKTAIL_FLIP_INVERT_SHADOW] = flipInvert;
  mem8[COCKTAIL_FLIP_FOLLOWS_PLAYER_SHADOW] = flipFollowsPlayer;

  // Flip for whoever is playing now (cocktail flips for player 2, the invert dip toggles it).
  const activePlayer = mem8[ACTIVE_PLAYER];
  const flipScreen = ((activePlayer - 1) & flipFollowsPlayer) ^ flipInvert;
  mem8[FLIP_SCREEN_X_LATCH] = flipScreen; // only the low bit is latched
  mem8[FLIP_SCREEN_Y_LATCH] = flipScreen;
  mem8[SPRITE_COORD_BIAS] = flipScreen << 1; // pixel bias matching the flip (0 upright)

  mem8[STARTING_MEN] = (dsw & 0x40) ? 4 : 3;

  // Top dip diverts to the colour-cycle test screen. Reached inside a gen.next()-driven main, so
  // this is a mid-frame warm restart: restartMain abandons the current main and swaps in that loop.
  if (dsw & 0x80) return m.restartMain(() => showColourTestScreen(m));
}
