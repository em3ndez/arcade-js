// SPDX-License-Identifier: GPL-3.0-only
import { waitNextRoundArm } from "./waitNextRoundArm.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { seedWorkRamImage } from "./seedWorkRamImage.js";
import { initPlayer1ShieldBuffers } from "./initPlayer1ShieldBuffers.js";
import { markAllAliensAliveP1 } from "./markAllAliensAliveP1.js";
import { initPlayer2ShieldBuffers } from "./initPlayer2ShieldBuffers.js";
import { markAllAliensAliveP2 } from "./markAllAliensAliveP2.js";
import { restoreShieldsAndEnterRound } from "./restoreShieldsAndEnterRound.js";
import { u8, u16 } from "../../../core/int.js";
import { GAME_ACTIVE, ACTIVE_PLAYER_PAGE, SOUND_PORT5_SHADOW, loc_1da2 } from "./names.js";

// Player-switch handoff after a round is cleared: wait for the arm trigger, clear GAME_ACTIVE and the
// play-field, then hand the turn to the next player. The select byte is preserved across the work-RAM
// reseed, its player index is advanced within the field page, the next field page is looked up from the
// index table and stowed in the record, and the incoming player's shields + alien field are seeded before
// re-entering the shield/field preamble. Generator; memory + IO.
export function* loc_09ef(m) {
  yield* waitNextRoundArm(m);
  m.mem8[GAME_ACTIVE] = 0x00;
  clearPlayfield(m);
  const savedPage = m.mem8[ACTIVE_PLAYER_PAGE];
  seedWorkRamImage(m);
  m.mem8[ACTIVE_PLAYER_PAGE] = savedPage;
  const page = m.mem8[ACTIVE_PLAYER_PAGE];
  const fieldPtr = (page << 8) | 0xfe;
  const idx = u8((m.mem8[fieldPtr] & 0x07) + 1);
  m.mem8[fieldPtr] = idx;
  let tablePtr = loc_1da2;
  let n = idx;
  do {
    tablePtr = u16(tablePtr + 1);
    n = u8(n - 1);
  } while (n !== 0);
  const tableByte = m.mem8[tablePtr];
  const recPtr = (page << 8) | 0xfc;
  m.mem8[recPtr] = tableByte;
  m.mem8[recPtr + 1] = 0x38;
  if (page & 1) {
    initPlayer1ShieldBuffers(m);
    markAllAliensAliveP1(m);
  } else {
    m.mem8[SOUND_PORT5_SHADOW] = 0x21;
    initPlayer2ShieldBuffers(m);
    markAllAliensAliveP2(m);
  }
  yield* restoreShieldsAndEnterRound(m);
}
