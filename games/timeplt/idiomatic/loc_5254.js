// SPDX-License-Identifier: GPL-3.0-only
/** loc_5254 — close one shot's pass over the target run and open the next shot's.
 *
 * ROM 0x5254-0x5269 (lift: translated/loc_5254.js). Grounding: keep-hex -- no names.js ROUTINES
 * entry. names-debt.txt keeps the loc_ name because 0x5254 has no absolute entry point (a
 * whole-image word scan finds no 0x5254): it is an interior continuation of
 * destroyTargetsHitByShots [seen] (ROM 0x5211-0x5269), the tail that runs after each shot's pass.
 *
 * ROLE IN THE MACHINE. destroyTargetsHitByShots sweeps a run of player shots against a run of
 * targets, one shot per pass (mechanisms.md, "Shots against targets"). This is the loop's back
 * edge: it resets the inner run for the next shot and loops back to the pass (the ROM's
 * `jp nz,0x5211`).
 *
 * The two target cursors are restaged from the pair of cells that hold them, so every shot walks
 * the same run from its head; the per-pass target count comes from the shadow accumulator rather
 * than from whatever the pass just consumed; and the shot cursor steps one record on WITHOUT
 * leaving its page, the carry being dropped. With shots still owed a pass the sweep runs again
 * for the rest of them, and with none left this does nothing further.
 *
 * PARAMETERS (where the values come from, in the ROM's registers): shot = the shot record just
 * swept (IX); shots = the outer count, shots still to sweep including this one (C);
 * targetsPerPass = the inner count saved for every pass (the shadow A'); reach and span = the
 * hit-box half-width and width (L and H), passed on unchanged.
 * LIVE-OUT: memory-only. */

import { u8 } from "../../../core/int.js";
import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";
import { SCRATCH_PTR_A, SCRATCH_PTR_B } from "./names.js";

// Shot records are 16 bytes apart (`add a,0x10` on IXL at 0x5261).
const RECORD_STRIDE = 16;

export function loc_5254(m, shot = m.regs.ix, shots = m.regs.c, targetsPerPass = m.regs.a_, reach = m.regs.l, span = m.regs.h) {
  const { mem16 } = m;

  /* Step 1 -- count this shot off (`dec c` at 0x5265). None left: the whole sweep is over
   * (`ret` at 0x5269). */
  const shotsLeft = u8(shots - 1);
  if (shotsLeft === 0) return;

  /* Step 2 -- the next shot record. The ROM adds 16 to IX's LOW byte only (`ld a,ixl` /
   * `add a,0x10` / `ld ixl,a`), so a carry never reaches the high byte and the cursor stays in
   * its page. Keeping the page is exact for the six-record shot array at 0xAA80, which does not
   * cross one. */
  const nextShot = (shot - (shot & 0xff)) | u8(shot + RECORD_STRIDE);

  /* Step 3 -- restart the inner run and sweep the next shot (0x5254-0x525E, then jp nz,0x5211).
   * The target sprite-entry cursor (the ROM's IY) is reloaded from SCRATCH_PTR_A 0xA991 [seen]
   * and the target record cursor (DE) from SCRATCH_PTR_B 0xA993 [seen]; the caller seated both
   * with the run's start. The inner count for this pass (B) is taken from the shadow A', so it is
   * the full count again -- targetsPerPass is passed both as this pass's count and as the saved
   * count for every later pass. */
  destroyTargetsHitByShots(
    m,
    nextShot,
    mem16[SCRATCH_PTR_A],
    mem16[SCRATCH_PTR_B],
    targetsPerPass,
    targetsPerPass,
    shotsLeft,
    reach,
    span,
  );
}
