// SPDX-License-Identifier: GPL-3.0-only
import { initShieldBuffers } from "./initShieldBuffers.js";
import { PLAYER1_SHIELD_BUFFER } from "./names.js";

// initPlayer1ShieldBuffers — stock player 1's shield backup buffer with fresh (undamaged) bunkers.
//
// WHAT IT IS
//   A thin front door that seats the player-1 shield-buffer base address and then replicates the ROM
//   shield template into it. initShieldBuffers copies the 0x2c-byte template (from SHIELD_TEMPLATE) four times
//   into consecutive 0x2c-byte slots — one slot per on-screen bunker — filling the buffer with four
//   pristine shields.
//
// ROLE IN THE MACHINE
//   The buffer is PLAYER1_SHIELD_BUFFER (0x2142), which lives inside player 1's own 0x21xx work-RAM
//   page, so each player keeps its own bunker damage. This routine (and its sibling for player 2) runs
//   when a player's round is being set up, seeding the backup with undamaged shields; later the
//   save/restore body (drawOrSaveShields) captures on-screen bunker damage into this buffer and paints
//   it back around the player switch, so damage persists across turns. The base is passed as HL and the
//   fill itself rides on blockCopy.
//
// ROM 0x01ef.  Grounding: [seen].
//
// LIVE-OUT: HL — the end pointer just past the fourth slot, as initShieldBuffers returns it.
export function initPlayer1ShieldBuffers(m) {
  // Seat HL = player-1 buffer base and replicate the four-slot template. The only thing this wrapper
  // fixes is *which* player's buffer (0x2142); the four-fold template copy is initShieldBuffers' body.
  return initShieldBuffers(m, PLAYER1_SHIELD_BUFFER);
}
