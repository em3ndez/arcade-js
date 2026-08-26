// SPDX-License-Identifier: GPL-3.0-only
import { ATTRACT_SUBSTATE } from "./names.js";
import { resetToAttractScreenStart } from "./resetToAttractScreenStart.js";
import { loc_08e9 } from "./loc_08e9.js";
import { paintAttractColorsAndQueueDraws } from "./paintAttractColorsAndQueueDraws.js";
import { loc_0986 } from "./loc_0986.js";
import { buildAttractSpritesAndPrimeTextScript } from "./buildAttractSpritesAndPrimeTextScript.js";
import { typeAttractTextColumn } from "./typeAttractTextColumn.js";
import { advanceAttractSequenceToPlay } from "./advanceAttractSequenceToPlay.js";
import { loc_7442 } from "./loc_7442.js";
import { runObjectAndEnemyActorUpdate } from "./runObjectAndEnemyActorUpdate.js";
import { advanceGameStateOnCreditOrStartPress } from "./advanceGameStateOnCreditOrStartPress.js";

/**
 * dispatchAttractSubstate — attract/demo sequence driver (top-level game state 1).
 *
 * Reads the attract sub-state selector and runs the matching handler from the nine-entry table, then
 * runs the shared epilogue (which returns to this driver's caller). Every handler is a void per-frame
 * step; the epilogue advances the game state on a credit/start press. LIVE-OUT: none.
 */
export function dispatchAttractSubstate(m) {
  switch (m.mem8[ATTRACT_SUBSTATE]) {
    case 0: resetToAttractScreenStart(m); break;
    case 1: loc_08e9(m); break;
    case 2: paintAttractColorsAndQueueDraws(m); break;
    case 3: loc_0986(m); break;
    case 4: buildAttractSpritesAndPrimeTextScript(m); break;
    case 5: typeAttractTextColumn(m); break;
    case 6: advanceAttractSequenceToPlay(m); break;
    case 7: loc_7442(m); break;
    case 8: runObjectAndEnemyActorUpdate(m); break;
  }
  return advanceGameStateOnCreditOrStartPress(m);
}
