// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2146 — the arm ROM 0x2118 branches to while the object's Y is still above the 0xE0 line:
 * seed the object's two step fields, snapshot its current Y into record byte +0x19, and enter
 * the shared zero-fill tail with the result register cleared.  ROM 0x2146.
 *
 * WHAT IT DOES, AND WHAT THAT RESTS ON. The caller (ROM 0x2118, still the frozen oracle) reads
 * the object's Y and branches here when it is below 0xE0 — larger Y is lower on screen, so this
 * is the arm for an object that has not yet reached that line — taking its own in-line arm
 * otherwise; that arm stamps the two step fields with constants instead of seeding them. So this
 * is the side that gives the object a fresh trajectory, and each of the three pieces of that
 * reading is corroborated outside this routine: loc_22cb's header names its job as seeding the
 * object's two step fields from mode and difficulty; the byte copied into +0x19 is read back in
 * this same cluster by ROM 0x20EC, which compares the object's freshly-stepped Y against it, so
 * the copy is a HEIGHT REFERENCE and not scratch; and the tail at ROM 0x2153 clears +0x14 — the
 * frames-airborne counter stepBallisticMotion (ROM 0x239C) ramps its gravity term from —
 * together with the fractional low halves of both coordinates. What is NOT established here is
 * what these objects are, or what event brings the caller to this branch; the routine keeps its
 * loc_ name for that reason.
 *
 * THE FIRST CALL'S RESULT IS NOT READ BY THIS CALLER. loc_2407 is a pure fixed-point subtract
 * over three record bytes; it writes no memory and hands its difference back in a register pair.
 * Its two other call sites, ROM 0x1BDF and ROM 0x20C3, store the difference's two halves
 * straight into record bytes +0x12/+0x13 on the instruction after the call. This one does not,
 * and nothing between here and the register-set exchange at the head of the shared tail (ROM
 * 0x21BA) reads it either. The call is kept: it is a real ROM call, and dropping it because the
 * value looks dead would be a claim about every reader downstream of that exchange rather than
 * about this routine.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2146.test.js.
 * GATE:     captured + crafted, both replaying the WHOLE tail chain (0x2153 -> 0x21BA -> the
 *           0x1F72 loop) so a wrong byte anywhere in it surfaces. 0x2146 is reachable in plain
 *           attract and the gate measures it: 34 real dispatches in 12000 frames, ALL 34
 *           replayed (no sampling), covering both of the two velocity-source arms attract
 *           produces (the level arm and the random arm) at three object records. Crafted
 *           entries on those real captures cover what attract does not reach — the difficulty
 *           3/4 and difficulty 5 arms of the velocity seed, a level sweep, and a sweep of the
 *           snapshotted Y over all 256 values. Teeth: a dropped snapshot, a snapshot taken from
 *           the neighbouring record byte, a snapshot written one byte low, a dropped velocity
 *           seed, and a tail entered with the snapshot value instead of zero.
 * LIVE-OUT: memory-only, plus the propagated return value — which came back `undefined` on every
 *           entry the gate runs, the chain ending in a modelled return, so that assertion is weak
 *           on its own and the RAM diff is what carries the gate.
 *           DERIVED: there is exactly ONE caller — ROM 0x2118 holds the only `m.call(0x2146)` in
 *           the frozen layer — and it reaches this routine by a branch, propagating the return
 *           without reading a register back. The register cleared before the tail IS live, since
 *           ROM 0x2153 stores it into three record fields, so it is set explicitly. The FLAGS the
 *           oracle sets alongside it are dead: from here to ROM 0x1F90 there is no conditional
 *           at all — 0x2153's three stores, then 0x21BA's loads, stores and increments — and
 *           between the increment at ROM 0x21C0 and the 16-bit add at ROM 0x1F90 every flag bit
 *           is rewritten before the first reader.
 *           This live-out is DERIVED from the continuations above; there is no committed
 *           live-wire arm in this gate to corroborate it.
 * NAMES:    OBJ_Y (record +0x05) from ram.js. Record byte +0x19 has no ram.js name; it is kept
 *           as a local offset const, like the +0x10/+0x11 step fields its sibling arms leave
 *           unnamed. Direct-called: loc_2407 (ROM 0x2407) and loc_22cb (ROM 0x22CB), both
 *           already idiomatic. The one m.call is ROM 0x2153, which is being decompiled in the
 *           same batch and so is still taken against the frozen oracle.
 */

import { loc_2407 } from "./loc_2407.js"; // ROM 0x2407
import { loc_22cb } from "./loc_22cb.js"; // ROM 0x22CB
import { OBJ_Y } from "./ram.js";

// Record field with no ram.js name: the object's Y as it stood when this arm ran. Its one
// reader in this cluster, ROM 0x20EC, subtracts 0x1A from the object's freshly-stepped Y and
// compares the result against this byte, so it serves there as a height reference.
const OBJ_Y_SNAPSHOT = 0x19;

export function loc_2146(m) {
  const { regs, mem8 } = m;

  // The fixed-point subtract over this object's record. Its difference is not read back here
  // (see the header); it writes no memory.
  loc_2407(m);

  // Seed the object's two step fields, by mode and difficulty.
  loc_22cb(m);

  // Remember the height the object is at now. Read the record pointer after the two calls,
  // as the oracle does — neither of them moves it.
  const record = regs.ix;
  mem8[record + OBJ_Y_SNAPSHOT] = mem8[record + OBJ_Y];

  // The shared tail at ROM 0x2153 stores this register into three record fields — the
  // frames-airborne counter and both coordinate fractions — so it must arrive cleared.
  regs.a = 0;
  return m.call(0x2153);
}
