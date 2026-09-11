// SPDX-License-Identifier: GPL-3.0-only
// Tempest video = the byte-exact vector pipeline (boards/tempest/{avg.js,vector-raster.js}). The AVG walks
// the current vector RAM/ROM display list into an add_point list; vector-raster.js rasterizes it to a
// 480x640 RGB888 frame identical to MAME's headless AVI (verified: 349 complete-list frames 0/921600 vs
// MAME). ROT270 and the 480x640 target are baked into the transform (see vector-raster.js), so the frame is
// already display-oriented -- no further rotation downstream.
//
// AVG list lifecycle (§2): MAME keeps the AVG in an endless JMPL-0 loop; the displayed list is the last
// JMPL-0 flush. Here renderFrame walks vector RAM from pc=0 at frame time. If the current walk produces no
// complete list (a mid-rebuild HALT with no content), the previously flushed list persists (MAME behaviour).

import { renderFrame as rasterize, FRAME_W, FRAME_H } from "./vector-raster.js";

export const SCREEN_W = FRAME_W; // 480
export const SCREEN_H = FRAME_H; // 640

// Produce the current frame as RGB888 (top-to-bottom, R,G,B), 480x640. `machine` supplies io.avg.
export function renderFrameRGB(machine) {
  const avg = machine.io.avg;
  const points = avg.run();
  if (points.length > 0) machine._lastVectorList = points;
  const list = points.length > 0 ? points : machine._lastVectorList || [];
  return rasterize(list);
}
