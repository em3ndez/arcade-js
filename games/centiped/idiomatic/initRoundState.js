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
 * initRoundState -- the board/round setup routine: it plants every per-round working
 * cell, re-arms the hardware sound latches, rebuilds the segment sprite tables, and
 * then dispatches the playfield reset.
 *
 * ROLE IN THE MACHINE. This is the top of the round-setup chain. When a new board (or
 * a fresh life's board) begins, all the pacing counters, mode latches, spawn timers,
 * and RNG snapshots have to be planted from scratch, the sound hardware reconfigured,
 * and the playfield rebuilt with its mushrooms. initRoundState orchestrates that,
 * calling the leaf seeders in order and finishing with a tail dispatch.
 *
 * STEP BY STEP.
 *  - Sound latches: AUDCTL ($1008) := 0x20 configures the POKEY audio control; SKCTL
 *    ($100f) is bounced 0x00 -> 0x03, the standard "reset then enable" of POKEY's
 *    serial/keyboard control that also re-seeds its polynomial (random) counters.
 *  - Counters: the countdown pair $9b/$9c := 0x0c and the step pair $9d/$9e := 0x02.
 *  - RNG snapshot: $ff (a stored RNG snapshot) is mirrored into three cells
 *    ($88,$53,$83) so several subsystems share one per-round random seed.
 *  - Clears: the SFX timer bank $b2..$b8 (7 cells) and the $a8 slot table (6 cells)
 *    are zeroed with descending-index loops matching the ROM.
 *  - RNG fold into $c8: (RANDOM ^ RANDOM) + $c8. Two back-to-back reads of the POKEY
 *    RNG cancel while the poly counter is idle, so this nets to +0 -- a faithful
 *    reproduction of the ROM's idiom rather than a real state change.
 *  - Spawn timers: SPAWN_TIMER ($a0) and $a2/$a3 := 0xc0.
 *  - Sub-seeders: rebuildSegmentSpriteTables, seedSegmentSpawnState, seedWaveState.
 *
 * THE TAIL DISPATCH. initRoundState has no RTS of its own: it returns
 * resetPlayfieldAndSeedMushrooms(m), whose own tail chain supplies the return to
 * this routine's caller -- the ROM's fall-through-into-the-next-routine idiom.
 *
 * GROUNDING: [code]. LIVE-OUT: AUDCTL, SKCTL, $9b/$9c/$9d/$9e, $88/$53/$83, the
 * $b2..$b8 bank, the $a8 table, $c8, SPAWN_TIMER/$a2/$a3, plus everything the three
 * sub-seeders and the tail reset touch.
 */
export function initRoundState(m) {
  const { mem8 } = m;
  // Configure POKEY audio control for the round.
  mem8[AUDCTL] = 0x20;
  // Countdown pair $9b/$9c seeded to 0x0c.
  mem8[loc_9b] = 0x0c;
  mem8[loc_9c] = 0x0c;
  // Mirror the stored RNG snapshot $ff into three cells so subsystems share one seed.
  const snap = mem8[loc_ff];
  mem8[loc_88] = snap;
  mem8[loc_53] = snap;
  mem8[loc_83] = snap;
  // Step pair $9d/$9e seeded to 0x02.
  mem8[loc_9d] = 0x02;
  mem8[loc_9e] = 0x02;
  // Reset POKEY serial/keyboard control (0x00) before re-enabling it below.
  mem8[SKCTL] = 0x00;
  // Clear the SFX timer bank $b2..$b8 and the $a8 slot table.
  for (let i = 6; i >= 0; i--) mem8[(loc_b2 + i) & 0xff] = 0x00;
  for (let i = 5; i >= 0; i--) mem8[(loc_a8 + i) & 0xff] = 0x00;
  // Fold the hardware RNG into $c8; the two reads cancel while the poly counter is idle.
  mem8[loc_c8] = u8((mem8[POKEY_RANDOM] ^ mem8[POKEY_RANDOM]) + mem8[loc_c8]);
  // Re-enable POKEY serial/keyboard control (0x03); this re-seeds its poly counters.
  mem8[SKCTL] = 0x03;
  // Rebuild the per-segment sprite tables for the new board.
  rebuildSegmentSpriteTables(m);
  // Seed the spawn-timer trio ($a0 SPAWN_TIMER, $a2, $a3) to 0xc0.
  mem8[SPAWN_TIMER] = 0xc0;
  mem8[loc_a2] = 0xc0;
  mem8[loc_a3] = 0xc0;
  // Seed the remaining segment-spawn and wave state via the leaf seeders.
  seedSegmentSpawnState(m);
  seedWaveState(m);
  // No RTS of its own: the playfield reset's tail chain returns to this routine's caller.
  return resetPlayfieldAndSeedMushrooms(m);
}
