// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1ff6 — the shared tail of the 25m object sweep's two horizontal-step arms: re-glue the
 * stepped object to the girder slope, refresh its sprite orientation, then hand the record to one
 * of four still-frozen continuations — or to none, when the bounds gate takes the sweep over
 * itself.  ROM 0x1FF6.
 *
 * The object is one record of OBJ_ARRAY_67, walked by the ten-slot loop at ROM 0x1F72 — which
 * runs only while BOARD is 1 — and the loop keeps the record's base in the index register. Both
 * entry arms (ROM 0x1FE5 rightward, ROM 0x1FEF leftward) have already moved OBJ_X by one and
 * left their slope-step selector in the alternate register bank; everything below reads the
 * record fresh.
 *
 * READ:    OBJ_X (+3), OBJ_Y (+5), both off the record base.
 * WRITTEN: OBJ_Y (+5) on every arm but the first; the two horizontal-step bytes +0x10/+0x11 on
 *          the high-X arm only. Everything else this routine changes is changed by a callee.
 *
 * THE FIVE ARMS, in the order the routine tests them, with the dispatch counts a 3000-frame
 * attract run produced (4742 in total):
 *   1. OBJ_X ≡ 3 (mod 8) — hand the record's X and Y over in the registers and jump to ROM
 *      0x215F, before any of the work below. One X value in eight, so it fires steadily: 605.
 *   2. otherwise the slope snap and the orientation refresh run, and the bounds gate at ROM
 *      0x24B4 decides. On the gate's own last arm it takes the sweep over — it discards this
 *      routine's return address and continues at ROM 0x21BA — and there is nothing left to do
 *      here. Attract never produces it: 0.
 *   3. gate passed, OBJ_X below 28 — jump to ROM 0x202F, which stamps the leftward horizontal
 *      step. 11.
 *   4. gate passed, OBJ_X inside [28, 228) — the object is mid-playfield; jump to the shared
 *      sprite copy at ROM 0x21BA. The overwhelming majority: 4112.
 *   5. gate passed, OBJ_X at 228 or above — stamp the mirrored rightward step, +96, into the
 *      record's own horizontal-step bytes and fall into ROM 0x2038. 14.
 *
 * WHAT THE ROLE LINE RESTS ON, since two of its three claims are not visible in this body:
 *   - THE SLOPE SNAP. snapYToGirder (ROM 0x2333) is decompiled and gated, and its header states
 *     the mechanism: the 25m girders run a shallow diagonal, so a mover crossing into a new
 *     16-px column has its Y nudged one pixel to stay on the slope. It is called here with the
 *     record's X, its Y less three, and the entry arm's step selector, and the three come back
 *     on afterwards — so what is corrected is a coordinate three pixels off the record's Y, not
 *     the Y itself. WHAT THOSE THREE PIXELS ARE IS NOT DETERMINED HERE. The snapper's other
 *     object call site (ROM 0x33D2) hands it a different pair of record bytes (+0x0E:+0x0F) and
 *     applies no offset at all, so the three are this call site's, not the snapper's.
 *   - THE HORIZONTAL STEP. loc_202f's header derives +0x10/+0x11 as a big-endian signed 16-bit
 *     per-frame X step in 1/256-px units from its decompiled CONSUMER, stepBallisticMotion (ROM
 *     0x239C), which adds the pair to the record's +0x03:+0x04 coordinate every airborne frame;
 *     ram.js corroborates the sign convention on Mario's identically-shaped record
 *     (MARIO_AIR_VX_HI:MARIO_AIR_VX_LO, +128 rightward / −128 leftward). The value written here,
 *     +96, is the exact mirror of the −96 loc_202f writes at the other end.
 *   - "ORIENTATION REFRESH" for ROM 0x23DE is that routine's own gated role line, not a reading
 *     of this one; all this routine supplies is the record base and the entry arm's direction
 *     code, both already in the registers.
 *
 * NOT CLAIMED. Where the object ENDS UP after either edge arm: the vertical half of that motion
 * record is written by the still-frozen ROM 0x2038, and nothing here was observed on screen. Nor
 * is it claimed that the two edge arms are rare BECAUSE they are edges — 14 and 11 dispatches is
 * what attract produced, and attract is one demo.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register. Three of the four
 * continuations (ROM 0x24B4, 0x202F, 0x2038) read that register directly, so a caller passing a
 * different record would be obeyed by the lines below and ignored one call later. It becomes an
 * honest parameter once those are decompiled, not before. The direction code is likewise never
 * touched here — loc_23de reads it off the machine itself.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1ff6.test.js.
 * GATE:     real captures + one crafted arm. All 4742 dispatches in a 3000-frame attract run are
 *           replayed inline, each on a pair of fresh override-free machines, with every frozen
 *           continuation running for real on both sides; that covers all 7 record bases attract
 *           makes live and four of the five arms above. The remaining arm — the bounds gate
 *           taking the sweep over — is never taken in attract (0 of 4742), so it is reached by a
 *           crafted entry built on a real capture. Compared: RAM minus STACK_SCRATCH, the forwarded
 *           return value, pc and SP. STACK_SCRATCH is excluded because the two brackets around
 *           ROM 0x2333 and ROM 0x23DE are dissolved here (both callees are idiomatic) while the
 *           bracket around ROM 0x24B4 is kept, so the stack region legitimately differs; pc and
 *           SP are compared because the frozen continuations maintain both for either side.
 *           Attract is 25m only — but so is this cluster, since the loop at ROM 0x1F72 returns
 *           immediately unless BOARD is 1.
 * LIVE-OUT: memory, plus three register hand-offs to still-frozen code, each named for the
 *           continuation that consumes it: X and Y in the registers for ROM 0x215F (which reads
 *           them as its first two acts), and a zeroed accumulator for ROM 0x2038 (which stores
 *           it into +0x04, +0x06, +0x0E and +0x14). Everything else the oracle leaves is dropped:
 *           the accumulator on the two middle arms (ROM 0x202F clears it before its first use,
 *           ROM 0x21BA loads it from the record), the X/Y copies on those same arms, the
 *           decrement ROM 0x2333 applies to the step selector, and every flag. Derived from all
 *           four continuations, then MEASURED, and the measurement is in the gate: this rewrite
 *           wired live at 0x1FF6 for a 6000-frame cycle-free attract run — 7803 dispatches, all
 *           four attract arms — against a baseline differing in nothing else leaves every frame's
 *           live state identical; and a second run of the ORACLE with exactly the dropped set
 *           scrambled at the instant control leaves this routine, on all 7803 hand-offs, leaves it
 *           identical too. The second run is what makes "dropped" a measurement rather than an
 *           inference from reading the callees, and it carries its own non-vacuity check — the
 *           same poison aimed at the KEPT registers does diverge.
 * NAMES:    OBJ_X and OBJ_Y from ram.js. The horizontal-step pair +0x10/+0x11 has no registry
 *           entry — stepBallisticMotion reads the same two bytes as bare record offsets — so it
 *           is a file-local const here; OBJ_ARRAY_67, BOARD, MARIO_AIR_VX_HI and MARIO_AIR_VX_LO
 *           are named in the prose above and not imported. ROM 0x215F, 0x202F, 0x21BA, 0x2038 and
 *           0x24B4 are all still frozen and stay registry calls.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y } from "./ram.js";
import { snapYToGirder } from "./snapYToGirder.js";
import { loc_23de } from "./loc_23de.js";

// The record's big-endian signed 16-bit per-frame horizontal step, high byte first. No ram.js
// name: stepBallisticMotion, the routine that consumes the pair, reads it as bare record offsets
// too, and naming it in the registry is the lead's call, not this file's.
const STEP_X_HI = 0x10;
const STEP_X_LO = 0x11;

// The step stamped at the high-X end: +96 in the record's 1/256-px units, three eighths of a pixel
// per frame rightward — the mirror of the −96 ROM 0x202F stamps at the low end.
const STEP_X_RIGHT = 96;

// The X window in which the object simply keeps walking. Below the low edge ROM 0x202F stamps the
// leftward step; at or above the high edge this routine stamps the rightward one.
const X_LOW_EDGE = 28;
const X_HIGH_EDGE = 228;

// The girder snapper is handed a coordinate three pixels off the record's Y, and the three go
// back on its answer. See the header — what the offset represents is not determined here.
const SNAP_OFFSET = 3;

// The return address the oracle pushes for the bounds gate at ROM 0x24B4. The gate consumes it
// on the arm where it takes the sweep over, so the bracket has to be here until that routine is
// decompiled and the call becomes a direct one.
const GATE_RETURN = 0x2017;

export function loc_1ff6(
  m,
  slopeStep = m.regs.b /* oracle-boundary default: both entry arms (ROM 0x1FE5, ROM 0x1FEF) still frozen */,
) {
  const { mem8, regs } = m;
  const record = regs.ix;

  const x = mem8[record + OBJ_X];

  // One X in eight goes straight out to ROM 0x215F, before any of the work below. That routine
  // reads both coordinates out of the registers, so they are handed over there.
  if ((x & 7) === 3) {
    regs.h = x;
    regs.l = mem8[record + OBJ_Y];
    return m.call(0x215f);
  }

  // Re-glue the object to the girder slope it just stepped along.
  mem8[record + OBJ_Y] = u8(
    snapYToGirder(x, u8(mem8[record + OBJ_Y] - SNAP_OFFSET), slopeStep) + SNAP_OFFSET,
  );

  // Refresh the sprite's orientation bits for this object; it takes the record base and the
  // entry arm's direction code off the machine.
  loc_23de(m);

  // The bounds gate. On its own last arm it discards the return address pushed here and carries
  // the sweep on at ROM 0x21BA itself, so there is nothing further to do on this record.
  m.push16(GATE_RETURN);
  if (!m.call(0x24b4)) return;

  // Re-read X rather than reuse the value from the top, as the ROM does: the bounds gate writes
  // that field itself, though only on the arm that never comes back here.
  const xNow = mem8[record + OBJ_X];
  if (xNow < X_LOW_EDGE) return m.call(0x202f);
  if (xNow < X_HIGH_EDGE) return m.call(0x21ba);

  // Past the high edge: stamp the rightward horizontal step and hand the record to the shared
  // writer that sets the rest of the motion fields.
  mem8[record + STEP_X_HI] = STEP_X_RIGHT >> 8;
  mem8[record + STEP_X_LO] = STEP_X_RIGHT;
  regs.a = 0; // ROM 0x2038 stores the accumulator into four further record bytes
  return m.call(0x2038);
}
