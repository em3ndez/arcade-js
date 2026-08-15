// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0de0 — the attract board-demo cell assembler: once the dwell counter expires, place one
 * river-object cell for the current phase (stamp its 2x2 tile corner, clear its object block), then
 * step the phase counter, reloading it and resetting the attract sequencer when all seven are placed.
 * LIVE-OUT: memory-only.
 */
import { loc_800d, loc_800f, loc_83bc, loc_83d7, loc_83bf, loc_83bb, loc_8040, loc_a8c6 } from "./names.js";
import { setAttractIdleMode } from "./setAttractIdleMode.js";

const DWELL_RELOAD = 32;
const PHASE_COUNT = 7;
const CELL_VRAM_STRIDE = 96; // between successive phase cells' VRAM corners
const OBJ_CELL_STRIDE = 4;
const CLEAR_BYTES = 4;
const ROW = 32; // one tilemap row down

// base tile per phase 1..7 (index 0 unused); several phases repeat a value, so it is a table
const BASE_TILE = [0, 216, 248, 244, 244, 220, 216, 212];

export function loc_0de0(m) {
  const { mem8 } = m;

  mem8[loc_800d] = 3;
  mem8[loc_800f] = 3;

  mem8[loc_83bc] = (mem8[loc_83bc] - 1) & 0xff;
  if (mem8[loc_83bc] !== 0) return; // still dwelling
  mem8[loc_83bc] = DWELL_RELOAD;

  const phase = mem8[loc_83d7];
  const src = (loc_a8c6 + CELL_VRAM_STRIDE * (phase - 1)) & 0xffff;
  const obj = (loc_8040 + OBJ_CELL_STRIDE * (PHASE_COUNT - phase)) & 0xffff;
  const tile = BASE_TILE[phase];

  mem8[src] = tile;
  mem8[(src + 1) & 0xffff] = (tile + 1) & 0xff;
  mem8[(src + ROW) & 0xffff] = (tile + 2) & 0xff;
  mem8[(src + ROW + 1) & 0xffff] = (tile + 3) & 0xff;

  for (let i = 0; i < CLEAR_BYTES; i++) mem8[(obj + i) & 0xffff] = 0;

  mem8[loc_83d7] = (mem8[loc_83d7] - 1) & 0xff;
  if (mem8[loc_83d7] !== 0) return; // cells remain

  mem8[loc_83d7] = PHASE_COUNT;
  mem8[loc_83bf] = 0;
  mem8[loc_83bb] = 0;
  setAttractIdleMode(m); // tail into the credits-present attract-idle tail
}
