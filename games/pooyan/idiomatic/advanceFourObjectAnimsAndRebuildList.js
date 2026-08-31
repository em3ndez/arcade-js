// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SPRITE_OBJECT_TABLE } from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
/**
 * advanceFourObjectAnimsAndRebuildList — animate four object records, then restage the sprite list.
 *
 * WHAT IT IS
 *   The per-frame "step the moving pictures, then repaint them" worker. It walks the first four
 *   records of one object-record pool, advancing each one's on-screen animation by a single
 *   frame's worth of time, and then rebuilds the whole hardware-shaped sprite display list so the
 *   freshly-stepped frames reach the raster on the same frame they change.
 *
 * ROM 0x09f8. Grounding: [seen].
 *
 * ROLE IN THE MACHINE
 *   Reached from the attract/idle per-frame handlers, which use it as their sprite heartbeat:
 *   whatever demo actors are on screen, this is the step that ticks their animation and restages
 *   the list every frame. The four records it steps are the head of SPRITE_OBJECT_TABLE (0x8b70),
 *   the secondary object-record pool that lives inside the wider moving-object arena. Those same
 *   records are among the objects the display-list rebuild harvests immediately afterwards, so
 *   animating them first and rebuilding second is what makes their new tile/attribute land in the
 *   list on the very frame it changes.
 *
 *   Object records are a flat array spaced 0x18 bytes apart; each carries its own animation
 *   program (a script pointer and a frame-hold counter) alongside the tile/attribute/position
 *   bytes the display-list builder reads back out. advanceObjectAnimationFrame (ROM 0x4006) is the
 *   general per-object sequencer that owns one such program; this routine simply drives it across
 *   four consecutive records, then hands off to the once-per-frame display-list rebuild.
 *
 * LIVE-OUT: none — memory only. Both stages write RAM and leave nothing a caller reads back
 * (the tail rebuild is itself a void per-frame worker).
 */

const RECORD_STRIDE = 0x18; // object-record pitch: consecutive records sit 0x18 bytes apart in the pool
const RECORD_COUNT = 0x04; // records advanced per pass: the first four slots of the pool

export function advanceFourObjectAnimsAndRebuildList(m) {
  // Point at the base of the object-record pool SPRITE_OBJECT_TABLE (0x8b70) and step exactly four
  // consecutive records. Each pass advances that one record's animation by a single frame via
  // advanceObjectAnimationFrame (ROM 0x4006): it either counts down the record's frame-hold — the
  // number of frames the current picture stays on screen — or, when that hold has expired, pulls
  // the next {tile, attribute, hold} entry from the record's own animation script and stores it
  // back into the record. Then the pointer walks forward one full 0x18-byte record.
  let rec = SPRITE_OBJECT_TABLE;
  for (let n = 0; n < RECORD_COUNT; n++) {
    advanceObjectAnimationFrame(m, rec); // step this record's animation one frame
    rec = u16(rec + RECORD_STRIDE); // advance to the next record (16-bit address wrap)
  }

  // With those four records freshly stepped, rebuild the 24-entry, stride-4 sprite display list at
  // SPRITE_DISPLAY_LIST (0x8840) from the whole object world via rebuildSpriteDisplayList (ROM
  // 0x02ef). The rebuild re-harvests every object record — including the four just animated — into
  // the flat, hardware-shaped list, so this frame's new tile/attribute/position bytes are exactly
  // what the later copy-out step blits into the hardware sprite banks.
  rebuildSpriteDisplayList(m); // rebuild the display list from the stepped records
}
