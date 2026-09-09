// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_53, loc_83, loc_88, loc_9b, loc_9c, loc_9d, loc_9e,
  loc_a2, loc_a3, loc_a8, loc_b2, loc_c8, loc_ff,
  SPAWN_TIMER, POKEY_RANDOM, AUDCTL, SKCTL,
} from "./names.js";
import { rebuildSegmentSpriteTables } from "./rebuildSegmentSpriteTables.js";
import { seedSegmentSpawnState } from "./seedSegmentSpawnState.js";
import { seedWaveState } from "./seedWaveState.js";
import { resetPlayfieldAndSeedMushrooms } from "./resetPlayfieldAndSeedMushrooms.js";

/**
 * initRoundState -- board/round setup. Seeds the sound-control and mode latches, the
 * countdown pair $9b/$9c and step pair $9d/$9e, mirrors the RNG snapshot $ff into three
 * cells, clears the SFX timer bank and the $a8 slot table, folds the hardware RNG into $c8
 * (a self-XOR that nets zero while the poly counter is idle), rebuilds the segment sprite
 * tables, seeds the spawn-timer trio, then tail-dispatches the playfield reset whose own
 * tail chain supplies the return. [code]
 */
export function initRoundState(m) {
  const { mem8 } = m;
  mem8[AUDCTL] = 0x20;
  mem8[loc_9b] = 0x0c;
  mem8[loc_9c] = 0x0c;
  const snap = mem8[loc_ff];
  mem8[loc_88] = snap;
  mem8[loc_53] = snap;
  mem8[loc_83] = snap;
  mem8[loc_9d] = 0x02;
  mem8[loc_9e] = 0x02;
  mem8[SKCTL] = 0x00;
  // Clear the SFX timer bank $b2..$b8 and the $a8 slot table.
  for (let i = 6; i >= 0; i--) mem8[(loc_b2 + i) & 0xff] = 0x00;
  for (let i = 5; i >= 0; i--) mem8[(loc_a8 + i) & 0xff] = 0x00;
  // Fold the hardware RNG into $c8; the two reads cancel while the poly counter is idle.
  mem8[loc_c8] = u8((mem8[POKEY_RANDOM] ^ mem8[POKEY_RANDOM]) + mem8[loc_c8]);
  mem8[SKCTL] = 0x03;
  rebuildSegmentSpriteTables(m);
  mem8[SPAWN_TIMER] = 0xc0;
  mem8[loc_a2] = 0xc0;
  mem8[loc_a3] = 0xc0;
  seedSegmentSpawnState(m);
  seedWaveState(m);
  // No RTS of its own: the playfield reset's tail chain returns to this routine's caller.
  return resetPlayfieldAndSeedMushrooms(m);
}
