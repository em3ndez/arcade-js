// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER } from "./names.js";
import { runPerFrameObjectSubPasses } from "./runPerFrameObjectSubPasses.js";
import { runObjectAndSpawnUpdatePass } from "./runObjectAndSpawnUpdatePass.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";

/**
 * driveObjectsByFrameParityThenBuildSprites — per-frame object driver, split on frame parity.
 *
 * On odd frames runs the group-update pass; on even frames runs the spawn-subtree driver. Either
 * way it then rebuilds the sprite display list for the frame.
 *
 * LIVE-OUT: none — a void per-frame driver; the caller reads no register back.
 */
export function driveObjectsByFrameParityThenBuildSprites(m) {
  if (m.mem8[ROUND_COUNTER] & 0x01) {
    runPerFrameObjectSubPasses(m); // odd frame
  } else {
    runObjectAndSpawnUpdatePass(m); // even frame
  }
  rebuildSpriteDisplayList(m);
}
