// SPDX-License-Identifier: GPL-3.0-only
/**
 * idiomaticMidNmi -- the mid-screen interrupt body: a direct-JS engine-seam leaf fired before the vblank
 * body at each generator yield. Memory + IO only, no interrupt stack. It stamps the draw-phase flag to the
 * mid raster half; ends immediately unless GAME_ACTIVE; then draws only when in-game (GAME_IN_PROGRESS) or
 * the once-per-N-frame TASK_FLAGS bit0 gate is set, running the object walker over the mid record table and
 * the mid draw-scan. Both are now idiomatic direct calls; the draw-scan may arm a round-ending warm
 * restart, which the object-walker guard above lets take over the frame. Like the vblank in-game tail,
 * both are unreached by the attract boot (which never enters in-game play), covered by the acceptance gates.
 */
import {
  DRAW_PHASE_FLAG, GAME_ACTIVE, GAME_IN_PROGRESS, TASK_FLAGS,
  OBJECT_TABLE_MID,
} from "./names.js";
import { loc_024b } from "./loc_024b.js";
import { loc_0141 } from "./loc_0141.js";

export function idiomaticMidNmi(m) {
  m.mem8[DRAW_PHASE_FLAG] = 0; // mid raster half
  if (m.mem8[GAME_ACTIVE] === 0) return;
  // In-game always draws; the attract demo gates on the TASK_FLAGS bit0 rotate-out.
  if (m.mem8[GAME_IN_PROGRESS] === 0 && (m.mem8[TASK_FLAGS] & 0x01) === 0) return;
  loc_024b(m, OBJECT_TABLE_MID); // walk the mid-screen object-record table
  if (m.nextMain) return; // a handler armed a warm restart: mirror the SP-reseat abandonment (skip the mid draw-scan this frame)
  loc_0141(m); // pick the next alien to paint; may itself arm a round-ending warm restart, consumed by the engine after this frame
}
