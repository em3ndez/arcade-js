// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampAttractDemoCell — the attract board-demo cell assembler: once the dwell counter expires, place one
 * river-object cell for the current phase (stamp its 2x2 tile corner, clear its object block), then
 * step the phase counter, reloading it and resetting the attract sequencer when all seven are placed.
 * LIVE-OUT: memory-only.
 */
import { OBJECT_ANIM_STATE_800D, DEMO_SCROLL_REGISTER, ATTRACT_DEMO_DWELL, ATTRACT_DEMO_PHASE_COUNTER, ATTRACT_SEQUENCER_PHASE, ATTRACT_PHASE_COMPANION, FLY_SPRITE_X, ATTRACT_DEMO_CORNER_VRAM } from "./names.js";
import { setAttractIdleMode } from "./setAttractIdleMode.js";

const DWELL_RELOAD = 32;
const PHASE_COUNT = 7;
const CELL_VRAM_STRIDE = 96; // between successive phase cells' VRAM corners
const OBJ_CELL_STRIDE = 4;
const CLEAR_BYTES = 4;
const ROW = 32; // one tilemap row down

// base tile per phase 1..7 (index 0 unused); several phases repeat a value, so it is a table
const BASE_TILE = [0, 216, 248, 244, 244, 220, 216, 212];

export function stampAttractDemoCell(m) {
  const { mem8 } = m;

  mem8[OBJECT_ANIM_STATE_800D] = 3;
  mem8[DEMO_SCROLL_REGISTER] = 3;

  mem8[ATTRACT_DEMO_DWELL] = (mem8[ATTRACT_DEMO_DWELL] - 1) & 0xff;
  if (mem8[ATTRACT_DEMO_DWELL] !== 0) return; // still dwelling
  mem8[ATTRACT_DEMO_DWELL] = DWELL_RELOAD;

  const phase = mem8[ATTRACT_DEMO_PHASE_COUNTER];
  const src = (ATTRACT_DEMO_CORNER_VRAM + CELL_VRAM_STRIDE * (phase - 1)) & 0xffff;
  const obj = (FLY_SPRITE_X + OBJ_CELL_STRIDE * (PHASE_COUNT - phase)) & 0xffff;
  const tile = BASE_TILE[phase];

  mem8[src] = tile;
  mem8[(src + 1)] = (tile + 1) & 0xff;
  mem8[(src + ROW)] = (tile + 2) & 0xff;
  mem8[(src + ROW + 1)] = (tile + 3) & 0xff;

  for (let i = 0; i < CLEAR_BYTES; i++) mem8[(obj + i)] = 0;

  mem8[ATTRACT_DEMO_PHASE_COUNTER] = (mem8[ATTRACT_DEMO_PHASE_COUNTER] - 1) & 0xff;
  if (mem8[ATTRACT_DEMO_PHASE_COUNTER] !== 0) return; // cells remain

  mem8[ATTRACT_DEMO_PHASE_COUNTER] = PHASE_COUNT;
  mem8[ATTRACT_SEQUENCER_PHASE] = 0;
  mem8[ATTRACT_PHASE_COMPANION] = 0;
  setAttractIdleMode(m); // tail into the credits-present attract-idle tail
}
