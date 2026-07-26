// SPDX-License-Identifier: GPL-3.0-only
/**
 * branch_20ec — hand-optimized rewrite of the translated routine at ROM 0x20EC,
 * proven equal to its oracle by the equivalence harness.
 *
 * WHAT IT DOES. One of sub_1f72's per-slot object branches, dispatched from
 * loc_1f93 (`ld a,(ix+1); dec a; jp z,0x20ec` @ 0x1F97 — this is the (ix+1)==1
 * object class). It runs the per-object physics-and-visibility step:
 *
 *   1. `exx` into the shadow set (the object-loop's per-branch working convention;
 *      exx swaps BC/DE/HL only — IX/IY/AF/SP are untouched, so the `(ix+d)` record
 *      reads below still index the object record via the MAIN IX).
 *   2. `call 0x239c` — the per-object gravity / velocity step (updates the object's
 *      motion; leaves the coordinate this gate reads in H).
 *   3. A PROXIMITY / LIMIT GATE: A = (post-gravity H) - 0x1a, compared with the
 *      object's limit field (ix+0x19). If A <u B (carry) → loc_2104 (0x2104), the
 *      on-screen bounds check that either re-renders ((ix+3)+8 ≥ 0x10) or
 *      deactivates the slot.
 *   4. Otherwise `call 0x2a2f` — the collision query (returns hit/miss in A). A
 *      nonzero result (`and a` → NZ) → entry_2118 (0x2118), the collision reaction
 *      (velocity/sprite-state setup); a zero result falls through to loc_2101
 *      (0x2101), the `call 0x24b4` tail that then joins loc_2104.
 *
 * All three exits are tail-jumps (via m.call, the routine registry) into the rest
 * of the object cascade, so branch_20ec's observable effect is proven by running
 * the whole downstream chain on both the oracle and this rewrite (the unit gate) or
 * over the real attract trajectory (the whole-machine gate).
 *
 * NO RAM NAME IS IMPORTED. The only address literals are ROM control-flow targets
 * (kept hex, like the oracle and the exemplars) and the object-record offset
 * (ix+0x19) — a record-relative field kept hex per the record-offset trap (it
 * indexes the object's own layout, not a sortable RAM address). See the report.
 *
 * REGISTER CHURN — NONE is droppable, so every op is kept verbatim; the win here is
 * the CYCLE COLLAPSE + structure + this docstring (same shape as sub_2a22 / loc_21ba,
 * which also had almost no droppable churn):
 *   - `ld a,h` / `sub 0x1a` / `cp b` compute the carry the `jp c` reads, so the sub
 *     and cp are load-bearing even though A is dead at the loc_2104 boundary
 *     (loc_2104's first op `ld a,(ix+3)` overwrites it). Kept verbatim.
 *   - `ld b,(ix+0x19)` supplies B; B is carried live into loc_2104. Kept verbatim.
 *   - `and a` sets the Z the `jp nz` reads (A is 0x2a2f's result; `and a` leaves A
 *     unchanged). Kept verbatim.
 *
 * FLAGS — KEPT verbatim, so the exit F is byte-exact at every m.call boundary and
 * no "dead flag" argument is needed:
 *   - `jp c` reads carry from `cp b`; `jp nz` reads Z from `and a`. Both flag ops
 *     stay, so the branch decisions and the F handed to loc_2104 / entry_2118 /
 *     loc_2101 all match the oracle. (Each of those callees overwrites F before
 *     reading it, so the incoming F is in fact dead — but reproducing it exactly is
 *     free here and removes all doubt; the unit gate compares the whole F incl. F3/F5.)
 *
 * CYCLES — COLLAPSED to one m.step per straight-line block, EXACT total per arm,
 * with the two CALL boundaries (0x239c, 0x2a2f) kept verbatim (push16 + the call's
 * own 17 t + m.call — a callee reached at the oracle's exact cumulative cycle keeps
 * its own writes). No hardware-latch write occurs in any collapsed block (blocks
 * P1/P2 are pure reads/reg ops — the `ld b,(ix+0x19)` read of work-RAM 0x6xxx is not
 * a latch), so no bus-cycle boundary is hidden by a fold. Per-arm OWN totals
 * (excluding the callee bodies), verified against the oracle's per-instruction sum:
 *   - block P1 = ld a,h 4 + sub 7 + ld b 19 + cp b 4 = 34 t
 *   - ARM 1 (jp c taken → loc_2104):  exx 4 + call239c 17 + [P1 34 + jp c 10 = 44] = 65 t
 *   - ARM 2 (collision → entry_2118): 4 + 17 + [P1 34 + jp c NT 10 = 44] + call2a2f 17
 *                                       + [and a 4 + jp nz taken 10 = 14]           = 96 t
 *   - ARM 3 (fall-through → loc_2101): 4 + 17 + 44 + 17 + [and a 4 + jp nz NT 5 = 9] = 91 t
 *   (The `jp nz` NOT-taken charge is 5 t, not 10 — a quirk carried verbatim from the
 *   frozen oracle's model of the `defb`-hidden fall-through into loc_2101; total is
 *   reproduced exactly, not reasoned from a textbook Z80 timing.)
 * total-preservation keeps the main-loop spin count 0x6019 (the PRNG entropy)
 * deterministic on every arm, so the strict whole-machine gate stays byte-exact.
 *
 * GATE = STRICT whole-machine (byte-exact), because branch_20ec is ATOMIC — MEASURED,
 * not assumed. Over a 900-frame all-oracle attract run it is dispatched 177 times
 * (first at frame 613, once the demo starts PLAYING 25m — matching the reachability
 * note "attract=177, hot"), and EVERY entry occurs INSIDE the NMI handler with the
 * NMI mask CLEARED (in-NMI 177/177, mask-set 0/0), so the NMI cannot re-enter; the
 * NMI's pushed PC never lands in [0x20EC,0x2100] (0 landings / 900 frames). An atomic
 * byte-exact collapse pushes no mistimed PC and tears no raster, so it passes the
 * strict gate directly — no convergent gate needed (same evidence class as the
 * sibling loc_21ba). All three arms are exercised naturally in attract (arm1=140,
 * arm2=6, arm3=31 over 900 frames), and each arm is additionally pinned by a crafted
 * cycle test in equivalence-20ec.test.js.
 */

// (ix+0x19): the per-object LIMIT field the proximity gate compares against. Kept
// hex (record-offset trap — it indexes the object's own record layout, not a
// sortable RAM address). Its precise physical meaning is not independently
// evidenced here, so it is not proposed for ram.js.
const LIMIT_FIELD = 0x19;
// 0x1a: a fixed bias subtracted from the post-gravity H before the limit compare.
// Left literal — meaning not independently evidenced (reported, not claimed).
const PROX_BIAS = 0x1a;

export function branch_20ec(m) {
  const { regs, mem } = m;
  const record = (off) => (regs.ix + off) & 0xffff; // main IX (exx leaves IX untouched)

  // exx -> shadow set. Single instruction, its own 4 t charge; the CALL below is a
  // boundary the fold must not cross.
  regs.exx();
  m.step(0x20ed, 4);

  // call 0x239c -- per-object gravity / velocity step. Boundary kept verbatim.
  m.push16(0x20f0);
  m.step(0x239c, 17);
  m.call(0x239c);

  // Proximity / limit gate. A = (post-gravity H) - 0x1a; B = the object's limit
  // field. `cp b` sets the carry the `jp c` reads (A <u B). All three ops are
  // load-bearing (carry + live B), so they stay verbatim.
  regs.a = regs.h; // ld a,h
  regs.sub(PROX_BIAS); // sub 0x1a
  regs.b = mem.read8(record(LIMIT_FIELD)); // ld b,(ix+0x19)
  regs.cp(regs.b); // cp b
  if (regs.fC) {
    // ARM 1: block P1 (34 t) + jp c taken (10 t) = 44 t, land PC at 0x2104.
    m.step(0x2104, 44);
    return m.call(0x2104); // -> loc_2104 (bounds check / deactivate)
  }
  // jp c NOT taken: same P1 (34) + jp c NT (10) = 44 t, land PC at 0x20FA.
  m.step(0x20fa, 44);

  // call 0x2a2f -- collision query, returns hit(!=0)/miss(0) in A. Boundary verbatim.
  m.push16(0x20fd);
  m.step(0x2a2f, 17);
  m.call(0x2a2f);

  // Collision result. `and a` sets Z from A (A unchanged); `jp nz` reads it.
  regs.and(regs.a); // and a
  if (regs.fNZ) {
    // ARM 2: and a (4 t) + jp nz taken (10 t) = 14 t, land PC at 0x2118.
    m.step(0x2118, 14);
    return m.call(0x2118); // -> entry_2118 (collision reaction)
  }
  // ARM 3: and a (4 t) + jp nz NOT taken (5 t) = 9 t, land PC at 0x2101.
  m.step(0x2101, 9);
  return m.call(0x2101); // -> loc_2101 (call 0x24b4 tail -> loc_2104)
}
