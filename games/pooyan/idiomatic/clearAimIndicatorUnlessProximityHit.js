// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { testTargetProximityAndSetAimDirection } from "./testTargetProximityAndSetAimDirection.js";
import {
  SPRITE_DISPLAY_LIST,
  SPRITE_TARGET_SLOTS,
  PROJECTILE_TABLE,
  PLAYER_AIM_FLAGS,
  PROXIMITY_HIT_FLAG,
} from "./names.js";

/**
 * clearAimIndicatorUnlessProximityHit — the "redraw" pass of Pooyan's aim indicator. [seen]
 * ROM 0x6c18-0x6c3e.
 *
 * WHAT IT IS
 *   The arrow the player aims with carries a small on-screen indicator that shows whether the
 *   thing it is pointing at sits above or below the line of fire. Two bits of the player's
 *   aim-state byte drive that indicator: bit2 (AIM_ABOVE) and bit3 (AIM_BELOW). This routine
 *   is the pass that decides, once per frame while the indicator is idle, whether anything is
 *   still close enough to keep the indicator lit — and if nothing is, tears it back down.
 *
 * ROLE IN THE MACHINE
 *   It is a proximity-scan driver. It sweeps three projectile records, asking the per-record
 *   proximity test (testTargetProximityAndSetAimDirection, ROM 0x6c3f) whether each one puts a target inside the aim band
 *   of the single fixed sprite record. The per-record test itself owns the "hit" bookkeeping:
 *   on a hit it lights the correct above/below bit, raises the proximity-hit flag, and reports
 *   the hit back so the sweep can stop early. This routine's own job is only the negative case:
 *   if all three records come back clean, no target is in band, so it wipes the indicator's
 *   above/below bits and clears the proximity-hit flag. The aim-acquisition updater
 *   (acquireTargetLockAndSetAimIndicator) bails whenever that hit flag is nonzero, so clearing
 *   it here is what re-opens target acquisition for the next frame.
 *
 * LIVE-OUT: none. Nothing is handed back to the caller; every effect is in memory — and only
 *   the "no hit anywhere" ending writes anything, clearing the two aim bits on PLAYER_AIM_FLAGS
 *   (0x8a87) and zeroing PROXIMITY_HIT_FLAG (0x8d54). A hit leaves those writes to the per-record
 *   test and returns without touching them.
 */

const RECORD_COUNT = 3;
const AIM_ABOVE = 0x04; // PLAYER_AIM_FLAGS bit2: aim target sits above the line of fire
const AIM_BELOW = 0x08; // PLAYER_AIM_FLAGS bit3: aim target sits below the line of fire

export function clearAimIndicatorUnlessProximityHit(m) {
  const { mem8 } = m;

  // Address the three record streams the scan walks in parallel.
  //   record  — the one fixed reference: the head of the sprite display list (SPRITE_DISPLAY_LIST,
  //             0x8840), the actor whose aim band every target is measured against. It never moves.
  //   target  — the coordinate slot under test (SPRITE_TARGET_SLOTS, 0x887c), advanced by 4 bytes
  //             per pass to step to the next target's x/y pair.
  //   gate    — the projectile record (PROJECTILE_TABLE, 0x8be8), advanced by 0x18 bytes per pass;
  //             its active bit gates whether that pass's target is live and worth testing at all.
  const record = SPRITE_DISPLAY_LIST; // ix, fixed across the scan
  let target = SPRITE_TARGET_SLOTS; //  iy, stride 4
  let gate = PROJECTILE_TABLE; //       hl, stride 0x18

  // Scan the three projectile records. Each pass hands the fixed reference, the current target
  // slot, and the current gate record to the per-record proximity test at ROM 0x6c3f. That test
  // returns true to mean "clean here, keep scanning" and false to mean "a target is in band —
  // it has already lit the aim bits and raised the hit flag, so stop." The moment it reports a
  // hit we return immediately, leaving the indicator lit and the hit flag set. Between passes we
  // step target on by 4 and gate on by 0x18 to reach the next record triple.
  for (let n = 0; n < RECORD_COUNT; n++) {
    if (!testTargetProximityAndSetAimDirection(m, record, target, gate)) return; // a hit aborts the scan
    target = u16(target + 0x04);
    gate = u16(gate + 0x18);
  }

  // Reached only when all three records were clean: nothing is in the aim band this frame. Tear
  // the indicator down — mask off both the above (bit2) and below (bit3) aim bits on
  // PLAYER_AIM_FLAGS (0x8a87), leaving its low input bits untouched — and clear the proximity-hit
  // flag PROXIMITY_HIT_FLAG (0x8d54) back to 0 so the aim-acquisition updater is free to run again.
  mem8[PLAYER_AIM_FLAGS] = mem8[PLAYER_AIM_FLAGS] & ~AIM_ABOVE & ~AIM_BELOW;
  mem8[PROXIMITY_HIT_FLAG] = 0x00;
}
