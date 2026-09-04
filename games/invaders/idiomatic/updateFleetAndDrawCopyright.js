// SPDX-License-Identifier: GPL-3.0-only
import { drawTaitoCopyright } from "./drawTaitoCopyright.js";
import { resolveShotAndFleetEdge } from "./resolveShotAndFleetEdge.js";

// Run the pre-round state-and-fleet update, then tail into drawTaitoCopyright -- a redraw trampoline.
export function updateFleetAndDrawCopyright(m) {
  resolveShotAndFleetEdge(m);
  return drawTaitoCopyright(m);
}
