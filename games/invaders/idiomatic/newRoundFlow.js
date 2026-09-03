// SPDX-License-Identifier: GPL-3.0-only
import { savePlayer1Shields } from "./savePlayer1Shields.js";
import { savePlayer2Shields } from "./savePlayer2Shields.js";
import { stageActivePlayerFieldSave } from "./stageActivePlayerFieldSave.js";
import { seedWorkRamImage } from "./seedWorkRamImage.js";
import { loc_0ab6 } from "./loc_0ab6.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { decrementShipsAndDrawReadout } from "./decrementShipsAndDrawReadout.js";
import { loc_07f9 } from "./loc_07f9.js";
import { ACTIVE_PLAYER_PAGE, SOUND_PORT5_SHADOW, loc_2011 } from "./names.js";

// New-round handoff: save the outgoing player's shields (by select bit), stow the field count and source
// word into the active record, reseed work RAM, then republish the select byte, sound-select shadow, and
// port for the incoming player -- 0x21 / off for player 1, 0x22 / the alternate tone for player 2. After
// a splash delay it clears the field, decrements the reserve-ship readout, and enters the round-start
// entry. The select byte read at the top is threaded across the reseed to pick both branches. Generator;
// memory + IO.
export function* newRoundFlow(m) {
  const savedPage = m.mem8[ACTIVE_PLAYER_PAGE];
  if (savedPage & 1) savePlayer1Shields(m);
  else savePlayer2Shields(m);

  const [recPtr, count, srcWord] = stageActivePlayerFieldSave(m);
  m.mem8[recPtr] = srcWord;
  m.mem8[recPtr + 1] = srcWord >> 8;
  m.mem8[recPtr - 1] = count;
  seedWorkRamImage(m);

  const pageTile = savedPage & 1 ? 0x22 : 0x21;
  const soundSelect = savedPage & 1 ? 0x20 : 0x00;
  m.mem8[ACTIVE_PLAYER_PAGE] = pageTile;
  yield* loc_0ab6(m);
  m.mem8[loc_2011] = 0x00;
  m.io.portOut(0x05, soundSelect);
  m.mem8[SOUND_PORT5_SHADOW] = soundSelect + 1;
  clearPlayfield(m);
  decrementShipsAndDrawReadout(m);
  yield* loc_07f9(m);
}
