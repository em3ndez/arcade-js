// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  SPRITE_DISPLAY_LIST,
  ACTOR_TABLE,
  ENEMY_TARGET_REC0,
  ENEMY_ACTOR_TABLE,
} from "./names.js";
import { copyObjectRecordsToDisplayList } from "./copyObjectRecordsToDisplayList.js";
import { buildDisplayEntriesFromMovingObjects } from "./buildDisplayEntriesFromMovingObjects.js";
import { tickCounterAndMirrorIfFlipped } from "./tickCounterAndMirrorIfFlipped.js";
/**
 * rebuildSpriteDisplayList — restage the whole sprite display list from the object-record banks,
 * once per frame.
 *
 * ROM 0x02ef. Grounding: [seen].
 *
 * WHAT IT IS
 *   The video hardware draws its moving objects from a flat table of four-byte sprite entries, but
 *   the game reasons about those objects in wide, scattered game-logic records (a player actor, a
 *   pair of hunter/target records, eighteen general moving objects, a two-entry arrow/launch
 *   group). Nothing draws straight from those records. Instead, every frame, this routine harvests
 *   them into one contiguous, hardware-shaped list — the 24-entry, stride-4 SPRITE_DISPLAY_LIST at
 *   0x8840 — which a later step copies out to the sprite banks. This is the gather stage that turns
 *   the game's internal object state into something the raster can scan.
 *
 * ROLE IN THE MACHINE
 *   The 24 entries are stitched together from four record groups laid down in a fixed order, and
 *   that order IS the list layout: entries 0-1 are the two lead actors, entries 2-3 the two
 *   hunter/target records, entries 4-21 the eighteen moving objects (Pooyans, arrows, balloons,
 *   stones), and entries 22-23 the two arrow/launch records. Each four-byte entry is a Y byte, an
 *   attribute byte (colour in the low nibble, two flip bits up top), an X byte, and a tile-code
 *   byte. The first three groups are packed by a plain field-reorder copy; the eighteen moving
 *   objects need their two coordinate bytes derived from 16-bit sub-pixel positions, so they take a
 *   different builder. After the list is full, the arrow group's two sprite-Y bytes each get nudged
 *   down one pixel — a small per-frame drift baked into the rebuild — and the second of them is
 *   handed to the shared tail that also decides, from the cabinet's orientation, whether the whole
 *   list must be vertically mirrored before it reaches the raster.
 *
 * LIVE-OUT: memory only — the rebuilt SPRITE_DISPLAY_LIST (0x8840). No register value is meant to
 *   survive; the caller falls straight through into the same shared tail this ends on.
 */

// Object records are spaced 0x18 bytes apart in their arena; every group harvested below steps its
// source pointer by this pitch to reach the next record.
const RECORD_STRIDE = 0x18;
// Each of the three plain (non-moving-object) groups contributes exactly two entries to the list.
const GROUP_COUNT = 0x02;
// The eighteen general moving-object records that fill the middle of the list (entries 4-21).
const MOVING_COUNT = 0x12;
// The arrow/launch pair lives 0x30 bytes into the actor arena (arena slot 2), just past the lead
// actors; it supplies the final two list entries.
const ARROW_GROUP = 0x30;
// Byte offset of the arrow group's first sprite-Y byte within the list: 0x58 = 4*22, i.e. the Y of
// entry 22, the first of the two arrow entries.
const ARROW_SPRITE_Y_A = 0x58;
// Byte offset of the arrow group's second sprite-Y byte: 0x5c = 4*23, the Y of entry 23; this is
// the byte handed to the shared tail to be ticked (and to gate the flip-mirror pass).
const ARROW_SPRITE_Y_B = 0x5c;

export function rebuildSpriteDisplayList(m) {
  // Work RAM as a flat byte array; the sprite display list and the arrow Y byte are ordinary cells
  // read and written through it.
  const { mem8 } = m;

  // Group 1 — the two lead actors (entries 0-1). Harvest four attribute fields out of each actor
  // record at ACTOR_TABLE (0x8a80) and pack them, in hardware order, into the head of the display
  // list at SPRITE_DISPLAY_LIST (0x8840). The returned pointer is where the next group continues,
  // so the list writes chain end-to-end without recomputing an offset.
  let list = copyObjectRecordsToDisplayList(m, SPRITE_DISPLAY_LIST, ACTOR_TABLE, RECORD_STRIDE, GROUP_COUNT);
  // Group 2 — the two hunter/target records (entries 2-3). Same field-reorder copy, sourced from
  // the I-parity target pair at ENEMY_TARGET_REC0 (0x8c90), continuing from the chained pointer.
  list = copyObjectRecordsToDisplayList(m, list, ENEMY_TARGET_REC0, RECORD_STRIDE, GROUP_COUNT);
  // Group 3 — the eighteen general moving objects (entries 4-21), sourced from ENEMY_ACTOR_TABLE
  // (0x8ae0). These need real coordinate math: each object's on-screen X and Y are derived from a
  // 16-bit sub-pixel position, not copied raw, so this uses the coordinate-deriving builder rather
  // than the plain harvester. It advances the same chained list pointer past eighteen entries.
  list = buildDisplayEntriesFromMovingObjects(m, list, ENEMY_ACTOR_TABLE, RECORD_STRIDE, MOVING_COUNT);
  // Group 4 — the two arrow/launch records (entries 22-23), sourced from the actor arena at
  // ACTOR_TABLE + ARROW_GROUP (0x8a80 + 0x30 = 0x8ab0). Plain field-reorder copy again; this fills
  // the tail of the list, so its returned pointer is not needed.
  copyObjectRecordsToDisplayList(m, list, ACTOR_TABLE + ARROW_GROUP, RECORD_STRIDE, GROUP_COUNT);

  // Post-pack drift on the arrow group. Both arrow entries' Y bytes are decremented one pixel each
  // every frame the list is rebuilt, walking the launched arrows upward across the screen. The
  // first arrow's Y sits at SPRITE_DISPLAY_LIST + ARROW_SPRITE_Y_A (0x8840 + 0x58 = 0x8898).
  const yA = SPRITE_DISPLAY_LIST + ARROW_SPRITE_Y_A;
  mem8[yA] = u8(mem8[yA] - 1); // drop the first arrow sprite one pixel (8-bit wrap)
  // The second arrow's Y (0x8840 + 0x5c = 0x889c) gets the same one-pixel drop, but it is applied
  // by the shared per-frame tail, which decrements the byte handed to it AND then — reading the
  // cabinet's screen-orientation flag — vertically mirrors the entire freshly-built list when the
  // screen is flipped, so every sprite lands correctly on the mirrored raster.
  tickCounterAndMirrorIfFlipped(m, SPRITE_DISPLAY_LIST + ARROW_SPRITE_Y_B); // drop the second, then flip-mirror if the screen is inverted
}
