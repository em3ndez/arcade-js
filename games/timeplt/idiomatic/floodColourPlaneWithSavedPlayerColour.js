// SPDX-License-Identifier: GPL-3.0-only
/** floodColourPlaneWithSavedPlayerColour — flood the playfield's colour plane with one byte, then hand the sequence its next
 * step. The byte comes from one of two parallel cells, picked by a selector that says which of
 * two players is up. The area covered is a rectangle inset from the plane's edges, painted a row
 * at a time; when the picture is turned round the painting runs from the far corner backwards
 * instead, which changes the ORDER cells are touched in and not WHICH, so the two directions
 * leave the plane identical. A separate countdown is stepped down by one on the way out.
 * LIVE-OUT: memory only. */

import { ACTIVE_PLAYER, COLOUR_FLOOD_COUNTDOWN, INTRO_ANIMATION_STEP, PLAYER_ONE_PEN_COLOUR, PLAYER_TWO_PEN_COLOUR, SCREEN_UNFLIPPED } from "./names.js";

const NEXT_STEP = 5;

const FIRST_CELL = 0xa044;
const LAST_CELL = 0xa3be;
const ROW_STRIDE = 32;
const ROWS = 28;
const CELLS_PER_ROW = 27;

export function floodColourPlaneWithSavedPlayerColour(m) {
  const { mem8 } = m;
  mem8[INTRO_ANIMATION_STEP] = NEXT_STEP;

  const source = mem8[ACTIVE_PLAYER] === 0 ? PLAYER_ONE_PEN_COLOUR : PLAYER_TWO_PEN_COLOUR;
  const colour = mem8[source];
  const backwards = mem8[SCREEN_UNFLIPPED] === 0;

  for (let row = 0; row < ROWS; row++) {
    const start = backwards ? LAST_CELL - ROW_STRIDE * row : FIRST_CELL + ROW_STRIDE * row;
    for (let cell = 0; cell < CELLS_PER_ROW; cell++) {
      mem8[backwards ? start - cell : start + cell] = colour;
    }
  }

  mem8[COLOUR_FLOOD_COUNTDOWN] = mem8[COLOUR_FLOOD_COUNTDOWN] - 1;
}
