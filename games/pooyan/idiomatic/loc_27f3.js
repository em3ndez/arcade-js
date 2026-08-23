// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand0A } from "./queueSoundCommand0A.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import {
  ARROW_Y,
  LAUNCH_FLIP_COUNTDOWN,
  SHARED_PHASE_COUNTDOWN,
  LAUNCH_TILE_VRAM,
  LAUNCH_TILE_SRC,
  LAUNCH_TILE_SRC_ALT,
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  LAUNCH_STATE,
  PLAY_MODE_LATCH,
  LAUNCH_ARMED_FLAG,
  LAUNCH_HUD_TILE,
  loc_8a99,
  loc_8a86,
  loc_8a9e,
  loc_8aa7,
} from "./names.js";
/**
 * loc_27f3 — launch state 1: either animate the arrow tile or seed a new hunter.
 *
 * While the arrow is at or above its gate height it runs a flip countdown; each time that
 * reaches zero it reseeds it, steps a shared phase byte, and tail-blits one of two arrow
 * tiles chosen by that byte's parity. Below the gate it scans the two enemy-target records
 * for a free one; finding none it returns. A free record advances the launch state, marks
 * the record, queues a display command, blits the alternate tile, may light a HUD cell, and
 * seeds three record fields (the middle one a biased copy of a source coordinate).
 *
 * LIVE-OUT: memory only — a dispatched state handler; the caller reads no register back. The
 * frozen layer's dead `ex af,af'; add a,l` on the HUD-off path touches only the shadow
 * accumulator (no memory, unconsumed), so it is dropped.
 */

const ARROW_Y_GATE = 0x34; //     at/above this the arrow animates; below it seeds a hunter
const FLIP_RESEED = 0x10; //      flip countdown reload value
const HUNTER_STATE = 0x02; //     launch state + record marker written when a slot is seeded
const HUD_TILE = 0x10; //         tile written into the HUD cell when lit
const SEED_Y_BIAS = 0x0c; //      bias added to the source coordinate for the seeded field

export function loc_27f3(m) {
  const { mem8 } = m;

  if (mem8[ARROW_Y] >= ARROW_Y_GATE) {
    mem8[LAUNCH_FLIP_COUNTDOWN] = mem8[LAUNCH_FLIP_COUNTDOWN] - 1;
    if (mem8[LAUNCH_FLIP_COUNTDOWN] !== 0) return; // countdown not yet elapsed
    mem8[LAUNCH_FLIP_COUNTDOWN] = FLIP_RESEED;
    mem8[SHARED_PHASE_COUNTDOWN] = mem8[SHARED_PHASE_COUNTDOWN] + 1;
    const src = mem8[SHARED_PHASE_COUNTDOWN] & 0x01 ? LAUNCH_TILE_SRC : LAUNCH_TILE_SRC_ALT;
    return blit2x2TileBlock(m, LAUNCH_TILE_VRAM, src);
  }

  const free = [ENEMY_TARGET_REC0, ENEMY_TARGET_REC1].find((rec) => mem8[rec] === 0);
  if (free === undefined) return; // no free target record

  mem8[LAUNCH_STATE] = HUNTER_STATE;
  mem8[free] = HUNTER_STATE;
  queueSoundCommand0A(m);
  blit2x2TileBlock(m, LAUNCH_TILE_VRAM, LAUNCH_TILE_SRC_ALT);
  if ((mem8[PLAY_MODE_LATCH] | mem8[LAUNCH_ARMED_FLAG]) !== 0) mem8[LAUNCH_HUD_TILE] = HUD_TILE;
  mem8[loc_8a99] = 0x01;
  mem8[loc_8a9e] = mem8[loc_8a86] + SEED_Y_BIAS;
  mem8[loc_8aa7] = 0x10;
}
