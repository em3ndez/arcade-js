// SPDX-License-Identifier: GPL-3.0-only
import { SOUND_PORT5_SHADOW, loc_2087, SAUCER_HIT_SPRITE } from "./names.js";
import { latchSoundPort5 } from "./latchSoundPort5.js";
import { drawSaucerSprite } from "./drawSaucerSprite.js";

// playSaucerHitSoundAndDrawSprite — fires the mystery-saucer's death: the UFO-explosion tone and the
// burst graphic, together.
//
// WHAT IT IS
//   Called when the player's shot brings the saucer down. It turns on the saucer-hit sound by raising a
//   bit in the port-5 shadow and latching it, then repoints the saucer's sprite record at the explosion
//   graphic and draws that column — so the bang and the burst arrive on the same frame.
//
// ROLE IN THE MACHINE
//   Sound: port 5 carries the fleet-march "footsteps" (its low nibble) and the two latched high-select
//   bits (mask 0x30). This routine ORs bit 4 (0x10) into SOUND_PORT5_SHADOW (0x2098) and latches it
//   through latchSoundPort5, which masks to 0x30 and writes port 5 — sounding the UFO-explosion tone.
//   Because that hit tone lives inside the 0x30 mask the fleet-march routines deliberately preserve, the
//   march can keep rotating its low nibble without clobbering a saucer-hit that is still ringing. Sprite:
//   it stores the explosion-graphic table pointer SAUCER_HIT_SPRITE (0x1d7c) into the saucer sprite
//   record's graphics-pointer word at loc_2087 (0x2087), then drawSaucerSprite resolves that record to a
//   screen address + gfx pointer (resolveSpriteScreenAddr) and blits the column (drawSpriteColumn).
//
// ROM 0x074b.  Grounding: [seen].
//
// LIVE-OUT: HL/DE/C left by drawSaucerSprite's blit tail (not consumed by the caller); the observable
// effects are the port-5 latch, the updated sprite record, and the drawn burst.
export function playSaucerHitSoundAndDrawSprite(m) {
  // Raise the saucer-hit select bit (0x10) in the port-5 shadow and capture the new shadow byte in `a`.
  // Editing the RAM shadow rather than composing the port from scratch keeps the fleet-march low-nibble
  // tone and the other high-select bit intact.
  const a = (m.mem8[SOUND_PORT5_SHADOW] |= 0x10);
  // Latch it out: latchSoundPort5 masks to the two high sound-select bits (0x30) and writes port 5,
  // sounding the UFO-explosion tone.
  latchSoundPort5(m, a);
  // Repoint the saucer sprite record's graphics-pointer word at the explosion-graphic table, so the next
  // draw shows the burst instead of the intact saucer.
  m.mem16[loc_2087] = SAUCER_HIT_SPRITE;
  // Draw it: resolve the record to a screen address + gfx pointer and blit the sprite column. The burst
  // therefore appears the same frame the hit tone is latched.
  return drawSaucerSprite(m);
}
