// SPDX-License-Identifier: GPL-3.0-only
import { savePlayer1Shields } from "./savePlayer1Shields.js";
import { savePlayer2Shields } from "./savePlayer2Shields.js";
import { stageActivePlayerFieldSave } from "./stageActivePlayerFieldSave.js";
import { seedWorkRamImage } from "./seedWorkRamImage.js";
import { waitLongDelay } from "./waitLongDelay.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { decrementShipsAndDrawReadout } from "./decrementShipsAndDrawReadout.js";
import { startRoundFlow } from "./startRoundFlow.js";
import { ACTIVE_PLAYER_PAGE, SOUND_PORT5_SHADOW, loc_2011 } from "./names.js";

/**
 * newRoundFlow — hand the machine from the outgoing player to the incoming player for a new turn.
 *
 * WHAT IT IS
 *   The player-switch round restart (a two-player game alternates turns; this runs at each swap). It
 *   stows everything the outgoing player must keep across their wait — their bunker shields and their
 *   fleet state — reseeds work RAM for the incoming player, republishes the per-player select byte and
 *   sound tone, waits out a splash, then clears the field and enters the incoming player's round.
 *
 * ROLE IN THE MACHINE
 *   One of the three restart flows the player-ship handler arms (mechanisms.md, round restarts). The
 *   active player is named by ACTIVE_PLAYER_PAGE (0x2067): bit 0 set == player 1 (page 0x21xx), clear ==
 *   player 2 (page 0x22xx). Because seedWorkRamImage overwrites ACTIVE_PLAYER_PAGE, the select byte is
 *   captured up front and used to drive every per-player branch. Outgoing shields are captured by
 *   savePlayer1Shields / savePlayer2Shields; the outgoing fleet reference is staged into that player's
 *   0xfb..0xfd save record via stageActivePlayerFieldSave; the incoming player then gets its page byte
 *   (0x21 / 0x22), its sound-select shadow (off for P1, the alternate tone for P2), a spent ship, and a
 *   cleared field before re-entering startRoundFlow. A generator (waitLongDelay / the round chain yield).
 *   loc_2011 keeps a placeholder name — it is the low byte of the first GAME_OBJECT_TABLE (0x2010) record's
 *   frame timer, cleared here so that object record is idle for the new round.
 *
 * ROM 0x02ed-0x02f7.  Grounding: [seen] leaves; flow documented in mechanisms.md (round restarts).
 *
 * LIVE-OUT: memory + IO; tails into startRoundFlow.
 */
export function* newRoundFlow(m) {
  // Snapshot who is active BEFORE the reseed clobbers ACTIVE_PLAYER_PAGE; every branch below reads it.
  // Save the OUTGOING player's shields to their own page buffer so their bunker damage persists.
  const savedPage = m.mem8[ACTIVE_PLAYER_PAGE];
  if (savedPage & 1) savePlayer1Shields(m);
  else savePlayer2Shields(m);

  // Stage the outgoing player's fleet state: stageActivePlayerFieldSave returns the field-save record
  // pointer ((page<<8)|0xfc), the working count (loc_2008), and the reference-alien coordinate word
  // (loc_2009). Write the coord word to 0xfc/0xfd and the count to 0xfb so the fleet resumes on their
  // next turn exactly where it was.
  const [recPtr, count, srcWord] = stageActivePlayerFieldSave(m);
  m.mem8[recPtr] = srcWord;
  m.mem8[recPtr + 1] = srcWord >> 8;
  m.mem8[recPtr - 1] = count;
  // Reseed the 0xc0-byte object/sprite work area from ROM for the incoming player (this overwrites
  // ACTIVE_PLAYER_PAGE, which is why savedPage was captured above).
  seedWorkRamImage(m);

  // Republish state for the INCOMING player (the other one): page byte 0x21 (P1) / 0x22 (P2), and the
  // port-5 sound-select — off (0x00) for player 1, the alternate tone (0x20) for player 2.
  const pageTile = savedPage & 1 ? 0x22 : 0x21;
  const soundSelect = savedPage & 1 ? 0x20 : 0x00;
  m.mem8[ACTIVE_PLAYER_PAGE] = pageTile;
  // Hold the round-start splash on screen for the long delay window.
  yield* waitLongDelay(m);
  // Idle the first object record (clear the low byte of its frame timer) so the new round starts clean.
  m.mem8[loc_2011] = 0x00;
  // Emit the incoming player's sound-select on port 5 and seat the port-5 shadow to match (soundSelect+1).
  m.io.portOut(0x05, soundSelect);
  m.mem8[SOUND_PORT5_SHADOW] = soundSelect + 1;
  // Wipe the playfield, spend one of the incoming player's ships and repaint the lives readout, then
  // enter the round-start chain (splash, field/shield restore, mark active, into the main loop).
  clearPlayfield(m);
  decrementShipsAndDrawReadout(m);
  yield* startRoundFlow(m);
}
