// SPDX-License-Identifier: GPL-3.0-only
import { PLAYER_SHOT_STATUS } from "./names.js";
import { startSound } from "./startSound.js";
import { clearSoundPort3Bit } from "./clearSoundPort3Bit.js";

/**
 * updatePlayerShotSound — hold the player-shot sound on while a shot is in flight, off otherwise.
 *
 * WHAT IT IS
 *   A per-frame sound step keyed on the player-shot state. When a player shot exists it raises the port-3
 *   shot-sound bit; when no shot exists it clears that bit. It composes nothing from scratch — it edits a
 *   single bit of the port-3 latch through the shared bit primitives.
 *
 * ROLE IN THE MACHINE
 *   PLAYER_SHOT_STATUS (0x2025) is the player-shot state cell — nonzero while a shot is live/retiring, zero
 *   when there is none. Port 3 carries the discrete one-shot cues, and the game keeps a RAM shadow of that
 *   latch (SOUND_PORT3_SHADOW, 0x2094) so each effect only flips its own bit (see mechanisms.md, "Sound").
 *   startSound (ROM 0x18fa) ORs mask 0x02 (bit 1, the shot cue) into the shadow and mirrors it to port 3;
 *   clearSoundPort3Bit (0x19dc) ANDs the shadow with 0xfd (all bits but bit 1) to turn the cue off. Run each
 *   frame from the in-game main loop's sound services.
 *
 * ROM 0x172c-0x173d.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: SOUND_PORT3_SHADOW and output port 3 updated; the delegated helper leaves the byte in A.
 */
export function updatePlayerShotSound(m) {
  // A shot is present -> raise port-3 bit 1 (mask 0x02); the shadow remembers the rest of the mixer.
  if (m.mem8[PLAYER_SHOT_STATUS] !== 0) return startSound(m, 0x02);

  // No shot -> clear port-3 bit 1 (AND mask 0xfd), silencing the shot cue without disturbing other bits.
  return clearSoundPort3Bit(m, 0xfd);
}
