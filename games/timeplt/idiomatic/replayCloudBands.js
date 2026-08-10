// SPDX-License-Identifier: GPL-3.0-only
/** replayCloudBands — repaint the frame's multiplexed clouds in bands from m.beamPlan. Final RAM keeps
 * only each slot's far-half appearance; reconstruct the near half, paint the rows above its flip line
 * (113 - final Y, since a mid-frame write shows below the beam) in beam order, restore the far half. */

import { u8 } from "../../../core/int.js";

const HALF = 128;

export function replayCloudBands(m) {
  const plan = m.beamPlan;
  if (!plan || plan.length === 0) return;
  const { mem8 } = m;
  const slots = plan.map(({ y, x }) => ({ y, x, row: 113 - mem8[y] }));

  for (const s of slots) {
    mem8[s.y] = u8(mem8[s.y] + HALF);
    mem8[s.x] = u8(mem8[s.x] - HALF);
  }
  slots.sort((a, b) => a.row - b.row);
  for (const s of slots) {
    m.paintBeamBand(s.row);
    mem8[s.y] = u8(mem8[s.y] - HALF);
    mem8[s.x] = u8(mem8[s.x] + HALF);
  }
  m.beamPlan = [];
}
