// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { LANE_FILL_INIT, INITIAL_ACTIVE_COUNT, FIRE_GATE, LANE_LIMIT } from "./names.js";

// Seed a 17-byte parameter block: one header cell takes the first source byte,
// then a run of 16 body cells all take the second source byte.
export function seedPerLaneSpikeArray(m) {
  const { mem8 } = m;
  mem8[FIRE_GATE] = mem8[INITIAL_ACTIVE_COUNT];
  const fill = mem8[LANE_FILL_INIT];
  for (let x = 0x0f; x >= 0; x--) mem8[u16(LANE_LIMIT + x)] = fill;
}
