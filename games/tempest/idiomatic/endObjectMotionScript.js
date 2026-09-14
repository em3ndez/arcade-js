// SPDX-License-Identifier: GPL-3.0-only
import { SCRIPT_WALK_CONTINUE } from "./names.js";

/**
 * endObjectMotionScript — end the current object's motion-script walk. ROM 0x9bca.
 *
 * Role in the machine: enemies and other moving objects in Tempest are driven by small motion
 * scripts that a walker steps through, entry by entry, each frame. A continuation flag
 * (SCRIPT_WALK_CONTINUE, $10a) tells that walker whether to keep consuming entries for the current
 * object. This housekeeping leaf is the script terminator: it clears that flag to zero, which stops
 * the walker's inner loop so it moves on rather than reading past this object's script.
 *
 * Behavior: write 0 into SCRIPT_WALK_CONTINUE ($10a). Live-out: the cleared walk-continuation flag.
 * Grounding: [seen]
 */
export function endObjectMotionScript(m) {
  const { mem8 } = m;
  mem8[SCRIPT_WALK_CONTINUE] = 0; // clear the walk-continuation flag to end this object's script loop
}
