// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2146 — the object re-launch arm taken while the object's Y is still above the 0xE0 line:
 * seed the object's two step fields, snapshot its current Y into record byte +0x19, and enter
 * the shared zero-fill tail with the result register cleared.
 *
 * WHAT IT DOES, AND WHAT THAT RESTS ON. The caller reads the object's Y and branches here when
 * it is below 0xE0 — larger Y is lower on screen, so this is the arm for an object that has
 * not yet reached that line. The caller's other arm stamps the two step fields with constants
 * instead of seeding them, so this is the side that gives the object a FRESH TRAJECTORY. Three
 * pieces support that reading: the velocity seeder re-derives the object's two step fields
 * from mode and difficulty; the byte copied into +0x19 is read back elsewhere in this cluster,
 * where the object's freshly-stepped Y is compared against it, making the copy a HEIGHT
 * REFERENCE rather than scratch; and the shared tail clears the frames-airborne counter that
 * the ballistic step ramps its gravity term from, together with the fractional low halves of
 * both coordinates. What is NOT established here is what these objects are, or what event
 * brings the caller to this branch — hence the neutral name.
 *
 * THE FIRST CALL'S RESULT IS NOT READ BY THIS CALLER. The fixed-point subtract is pure over
 * three record bytes: it writes no memory and hands its difference back in a register pair.
 * Its other call sites store the difference's two halves straight into record bytes
 * +0x12/+0x13 on the instruction after the call. This one does not, and nothing between here
 * and the register-set exchange at the head of the shared tail reads it either. The call is
 * kept anyway — dropping it because the value looks dead would be a claim about every reader
 * downstream of that exchange rather than about this routine.
 *
 * LIVE-OUT: memory-only, plus the propagated return value. The register cleared before the
 * tail IS live: the tail stores it into three record fields, so it is set explicitly. The
 * flags set alongside it are dead — every bit is rewritten before the first reader.
 */

import { loc_2407 } from "./loc_2407.js";
import { loc_22cb } from "./loc_22cb.js";
import { OBJ_Y } from "./names.js";

// The object's Y as it stood when this arm ran. Its one reader in this cluster subtracts 0x1a
// from the object's freshly-stepped Y and compares the result against this byte, so it serves
// there as a height reference. The field carries no shared name.
const OBJ_Y_SNAPSHOT = 0x19;

export function loc_2146(m) {
  const { regs, mem8 } = m;

  // The fixed-point subtract over this object's record. Its difference is not read back here
  // (see the header); it writes no memory.
  loc_2407(m);

  // Seed the object's two step fields, by mode and difficulty.
  loc_22cb(m);

  // Remember the height the object is at now. The record pointer is read after the two
  // calls; neither of them moves it.
  const record = regs.ix;
  mem8[record + OBJ_Y_SNAPSHOT] = mem8[record + OBJ_Y];

  // The shared tail stores this register into three record fields — the frames-airborne
  // counter and both coordinate fractions — so it must arrive cleared.
  regs.a = 0;
  return m.call(0x2153);
}
