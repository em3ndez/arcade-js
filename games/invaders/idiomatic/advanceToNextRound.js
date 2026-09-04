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

// advanceToNextRound — the next-round handoff for the SAME player after clearing a wave.
//
// WHAT IT IS
//   When ALIEN_COUNT reaches zero (the wave is cleared) the main loop hands here. It waits out the
//   handoff, tears the field down, advances THIS player to the next round (bumping their round counter,
//   configuring the new wave's fleet start position, and re-stocking their shields and alien grid), and
//   re-enters the round-start preamble. Despite the historical name it is NOT the two-player switch — the
//   same player plays on; the genuine player switch is newRoundFlow.
//
// ROLE IN THE MACHINE
//   Work RAM is per-player: ACTIVE_PLAYER_PAGE (0x2067) names the active player's 0x21xx/0x22xx page in
//   its low bit and its value. Each player's page holds a round counter at page:0xfe and a field-save
//   record (the fleet's reference-alien coordinate word) at page:0xfc/0xfd. The round-config table
//   loc_1da2 maps the bumped round index to the byte that seeds the new fleet's start — so the fleet
//   begins lower/harder each successive round. The tricky part is that seedWorkRamImage restamps
//   0x2000-0x20bf from ROM, which overwrites ACTIVE_PLAYER_PAGE itself; the select byte is therefore saved
//   and restored around that reseed so the SAME player continues. Per player it also re-stocks shields
//   (initPlayer1/2ShieldBuffers) and re-arms the full alien grid (markAllAliensAliveP1/P2), and for
//   player 2 seeds the port-5 sound shadow. Control ends in restoreShieldsAndEnterRound.
//
// ROM 0x09ef-0x0a3b.  Grounding: [seen] (spine); the seed-preservation / field-config specifics are
// tagged [code] in mechanisms.md.
//
// LIVE-OUT: none — control passes on into the round-start preamble; effects are in per-player work RAM.
export function* advanceToNextRound(m) {
  // Wait out the next-round arm: hold for the handoff window, re-polling the arm trigger each frame.
  yield* waitNextRoundArm(m);
  // Drop the game-active flag and wipe the arena for the duration of the handoff.
  m.mem8[GAME_ACTIVE] = 0x00;
  clearPlayfield(m);
  // Save the active-player select byte BEFORE the work-RAM reseed, which restamps 0x2000-0x20bf from the
  // ROM template and would otherwise clobber ACTIVE_PLAYER_PAGE (0x2067) sitting inside that block...
  const savedPage = m.mem8[ACTIVE_PLAYER_PAGE];
  seedWorkRamImage(m);
  // ...then restore it, so the same player — not the reseed's default — continues into the next round.
  m.mem8[ACTIVE_PLAYER_PAGE] = savedPage;
  const page = m.mem8[ACTIVE_PLAYER_PAGE];
  // Bump this player's own round counter, held at page:0xfe. Mask to the low 3 bits (rounds 0-7) then
  // add one, and store it back — this index selects the new wave's field configuration below.
  const fieldPtr = (page << 8) | 0xfe;
  const idx = u8((m.mem8[fieldPtr] & 0x07) + 1);
  m.mem8[fieldPtr] = idx;
  // Index the round-config table loc_1da2 by the round index: step the pointer forward `idx` entries
  // (the ROM walks it one byte at a time, counting `idx` down to zero) to land on this round's entry.
  let tablePtr = loc_1da2;
  let n = idx;
  do {
    tablePtr = u16(tablePtr + 1);
    n = u8(n - 1);
  } while (n !== 0);
  const tableByte = m.mem8[tablePtr];
  // Stow the config into this player's field-save record at page:0xfc/0xfd — the fleet's reference-alien
  // coordinate word. The table byte becomes the low byte (the round's configured fleet start) and 0x38 is
  // the fixed high byte, so the wave is placed for the new round; loadReferenceAlienState reads this back.
  const recPtr = (page << 8) | 0xfc;
  m.mem8[recPtr] = tableByte;
  m.mem8[recPtr + 1] = 0x38;
  // Re-stock this player's per-page state by the select bit. Player 1 (page bit0 set): refill the shield
  // buffer and mark all 55 aliens alive for page 1. Player 2: additionally seed the port-5 sound shadow
  // to 0x21 (that player's sound-select latch), then refill shields and re-arm the page-2 grid.
  if (page & 1) {
    initPlayer1ShieldBuffers(m);
    markAllAliensAliveP1(m);
  } else {
    m.mem8[SOUND_PORT5_SHADOW] = 0x21;
    initPlayer2ShieldBuffers(m);
    markAllAliensAliveP2(m);
  }
  // Fall into the shared shield/field preamble, which restores the shields to the screen and arms the
  // round (loading the reference-alien field just seeded above).
  yield* restoreShieldsAndEnterRound(m);
}
