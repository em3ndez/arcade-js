// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER } from "./names.js";
import { runPerFrameObjectSubPasses } from "./runPerFrameObjectSubPasses.js";
import { runObjectAndSpawnUpdatePass } from "./runObjectAndSpawnUpdatePass.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";

/**
 * driveObjectsByFrameParityThenBuildSprites — per-frame object driver, split on frame parity.
 *
 * WHAT IT IS
 *   The per-frame heartbeat for everything that moves on screen. Once a frame the machine's
 *   sub-state dispatcher lands on this handler (it is entry 13 of that dispatch table) and asks it
 *   to do two things in sequence: (1) advance the game-logic object records for this frame, and
 *   (2) restage the hardware sprite list from those records so the raster can draw them. The first
 *   job is deliberately split into two alternating variants; the second job runs every frame no
 *   matter which variant fired.
 *
 * WHY THE SPLIT
 *   Driving the whole object world every frame would be more work than one frame's budget wants to
 *   carry, so the object update is amortised across an A/B pair of frames. The low bit of
 *   ROUND_COUNTER (0x8907) is the A/B selector: on one parity the machine runs the enemy-group
 *   update (allocate / step / allocate-again / drive), on the other parity it runs the
 *   fountain/spawn subtree (the two-tile fountain blitter and the actor/enemy state passes).
 *   Whatever the object records end up holding after that, the sprite display list is rebuilt from
 *   scratch every frame so the picture on screen never stalls or tears between the two variants.
 *
 * ROLE IN THE MACHINE
 *   This is the object arm of the active-play loop: it is where "the enemies and objects take their
 *   turn this frame, then get handed to the video hardware." It reads no gameplay input of its own
 *   — it is pure sequencing. All of its effects land in the shared object-record banks and timer
 *   cells in work RAM (touched by the two update variants) and in the sprite display list at 0x8840
 *   (rebuilt by the final step).
 *
 * ROM address: 0x1c53 (0x1c53-0x1c65).
 * Grounding: [seen].
 *
 * LIVE-OUT: none — a void per-frame driver; the caller reads no register back. Every result of the
 * frame is a side effect in memory: the updated object records, and the freshly built sprite list.
 */
export function driveObjectsByFrameParityThenBuildSprites(m) {
  // Read the round counter ROUND_COUNTER (0x8907) and test its low bit. That bit is the A/B parity
  // selector for the object update: it chooses which of the two half-a-frame's-worth object-update
  // variants below runs this frame. (0x8907 also carries the BCD round number and other difficulty
  // bits, but only bit 0 matters to this fork.)
  if (m.mem8[ROUND_COUNTER] & 0x01) {
    // Parity odd: run the per-frame object GROUP update. This is the four-pass enemy-object
    // sequencer (runPerFrameObjectSubPasses, 0x68f8): a delay-gated paired-enemy allocator, the
    // eight descending-object stepper, a blink-gated flat-pool allocator, then the main per-object
    // driver / tilemap guard — in that fixed order, all working through the shared object records.
    runPerFrameObjectSubPasses(m); // odd frame
  } else {
    // Parity even: run the fountain/spawn subtree instead (runObjectAndSpawnUpdatePass, 0x64e2). It
    // seeds the two-tile fountain blitter, dispatches the fountain record's per-frame state handler,
    // runs the three-record enemy-actor state pass, then the enemy-record state dispatch — the
    // spawn-side counterpart to the odd-frame group update.
    runObjectAndSpawnUpdatePass(m); // even frame
  }
  // Whichever variant ran, rebuild the sprite display list for this frame (rebuildSpriteDisplayList,
  // 0x02ef). It harvests the scattered game-logic object records into the flat, hardware-shaped
  // 24-entry, stride-4 SPRITE_DISPLAY_LIST at 0x8840 (lead actors, hunter/target pair, the eighteen
  // moving objects, the arrow/launch pair), applies the arrow group's one-pixel Y drift, and lets
  // the shared tail mirror the list for the cabinet's orientation. This is what a later step copies
  // out to the sprite hardware, so it must run every frame regardless of the parity branch above.
  rebuildSpriteDisplayList(m);
}
