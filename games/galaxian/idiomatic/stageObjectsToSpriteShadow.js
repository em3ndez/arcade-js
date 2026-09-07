// SPDX-License-Identifier: GPL-3.0-only
//
// stageObjectsToSpriteShadow -- ROM 0x0bbe. Grounding: [seen].
//
// WHAT IT IS
//   The per-frame sprite-staging driver. It turns the eight live object records into eight hardware sprite
//   records, so whatever the object AI moved this frame becomes visible next frame. Run once per frame
//   from the shared subsystem-update group (e.g. dwellThenAdvanceSequence and the attract handlers).
//
// ROLE IN THE MACHINE
//   Source objects are 32-byte records based at SPRITE_SOURCE_OBJ_BASE (0x42b0, names.js); the destination
//   is the four-byte sprite-shadow records at SPRITE_SHADOW_BASE (0x4060), the RAM the vblank service later
//   copies out to the sprite hardware. The eight objects are laid down as a band of 3 then a band of 5 --
//   the two bands the original ROM emitted -- each band sharing one vertical (Y) offset. The per-record
//   conversion (position copy, heading-to-attribute fold, off-screen parking) is renderObjectSprite
//   (0x0c20, [seen]); this driver only picks the offsets and chains the two bands.
//
//   The orientation flag loc_4018 (0x4018) bit 0 is the cocktail/flip bit: it selects whether the first
//   band sits at Y offset 9 or 7, while the tail band settles at 8 either way (9-1 or 7+1).
//
// LIVE-OUT
//   Eight sprite-shadow records at 0x4060 (stride 4) rewritten for this frame; no return value.
import { renderObjectSprite } from "./renderObjectSprite.js";
import { loc_4018, SPRITE_SOURCE_OBJ_BASE, SPRITE_SHADOW_BASE } from "./names.js";

const OBJ_STRIDE = 32;    // bytes per source object record
const SPRITE_STRIDE = 4;  // bytes per staged sprite record

export function stageObjectsToSpriteShadow(m) {
  // Read the orientation/flip bit and derive the two band offsets. Both orientations converge on 8 for the
  // tail band; only the first band's offset differs (9 when flipped, 7 otherwise).
  const flip = m.mem8[loc_4018] & 0x01;
  const firstOffset = flip ? 9 : 7;
  const tailOffset = firstOffset + (flip ? -1 : 1); // both orientations settle at 8

  // First band: three objects from the source base into the shadow base. stageBand returns the pointers
  // sitting just past the band, so the second band picks up contiguously with no re-derivation.
  const [obj, sprite] = stageBand(m, SPRITE_SOURCE_OBJ_BASE, SPRITE_SHADOW_BASE, 3, firstOffset);
  // Tail band: the remaining five objects at the settled offset.
  stageBand(m, obj, sprite, 5, tailOffset);
}

// Stage `rows` consecutive objects into consecutive sprite records at one shared Y offset;
// return the next [obj, sprite] so the bands chain contiguously.
function stageBand(m, obj, sprite, rows, yOffset) {
  // Walk the band record-by-record, converting each object into its sprite shadow at the shared offset and
  // stepping both the source (stride 32) and destination (stride 4) pointers.
  for (let i = 0; i < rows; i++) {
    renderObjectSprite(m, obj, sprite, yOffset);
    obj += OBJ_STRIDE;
    sprite += SPRITE_STRIDE;
  }
  // Hand back the advanced pointers so the caller can chain the next band without recomputing them.
  return [obj, sprite];
}
