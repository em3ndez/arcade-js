// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2101 — offer the object to the bottom-of-screen retirement gate, and continue into the
 * left-edge check only if that gate let the object live.  ROM 0x2101.
 *
 * Three ROM bytes: one call, then the fall-through into the routine that follows it. Both
 * destinations are still frozen, so what this file carries is not arithmetic but the CONTROL
 * PROTOCOL between them — which is the entire content of these three bytes.
 *
 * The gate at ROM 0x24B4 is CALLER-SKIPPING. On the arm where it retires the object it takes the
 * return address this routine placed for it off the stack and jumps into the shared object-sprite
 * tail, so control never comes back here and the fall-through must not run. Its frozen oracle
 * reports that by answering false; obeying that answer is the one thing this routine has to get
 * right, and it is the only branch it has. On every other arm the gate returns normally and the
 * object continues into the check at ROM 0x2104.
 *
 * What the two destinations gate on is read out of their frozen oracles, not derived here: ROM
 * 0x24B4 retires the object only when its OBJ_Y has reached 0xE8 with its OBJ_X inside a narrow
 * band, and ROM 0x2104 retires it when OBJ_X + 8 falls below 16, i.e. as it wraps off the left
 * edge. NOT CLAIMED: which game event puts an object in either position, and why the two limits
 * are checked at this point in the cascade rather than another.
 *
 * Reads and writes no memory of its own. The record pointer both destinations work from stays in
 * the index register rather than becoming a parameter — they read it straight off the machine
 * while they are frozen, so a caller passing anything else would be obeyed by nobody. It becomes
 * an honest parameter once they are decompiled.
 *
 * The stack push below is the frozen call bracket, kept deliberately: the gate's oracle consumes
 * it (by returning through it, or by discarding it on the retirement arm), and the translated
 * caller layer pairs every registry dispatch with one. It dissolves along with the two registry
 * calls when the rest of this cluster lands.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2101.test.js.
 * GATE:     ATTRACT captures + a crafted retirement arm + a stubbed protocol replay. A 1200-frame
 *           attract run dispatches this 31 times across 25 distinct entry shapes and ALL 31 are
 *           replayed inline at the dispatch, oracle against rewrite on byte-identical clones —
 *           no sampling. Every one of those 31 takes the same branch (the gate returns), so the
 *           retirement arm is reached only by CRAFT: each capture is re-run with the record's
 *           OBJ_Y and OBJ_X poked into the gate's firing band, 3 band positions x 31 captures =
 *           93 replays, with the gate's own oracle asserting the arm really flipped. A third arm
 *           replaces both destinations with stubs on each clone and compares the resulting call
 *           sequence, so the "call, then continue only on a true answer" protocol is checked
 *           against a verdict this harness chooses rather than one attract happens to produce.
 *           Finally the rewrite drives a whole 1400-frame cycle-free attract run live (47
 *           dispatches) against the all-oracle baseline.
 *           NOT covered: credited play, boards past 25m, and the gate's third early-return arm —
 *           attract reaches none of those. Teeth: four broken twins, and the three arms catch
 *           disjoint sets of them (details in the test header).
 * LIVE-OUT: the return value, and nothing else — measured, not assumed. This routine writes no
 *           register, no flag and no memory cell of its own, so everything in the machine at exit
 *           was put there by the two frozen destinations, which the rewrite reaches through the
 *           same registry the oracle uses. Its single caller (ROM 0x20EC, the only one — the
 *           whole translated tree names this address nowhere else, and it arrives by falling
 *           through rather than by a call) hands the result straight back to its own caller, so
 *           the value has to travel and the gate asserts it on every replay. The measurement:
 *           across all 31 natural and 93 crafted replays the FULL state dump — including the
 *           stack scratch — plus the program counter, the stack pointer and the returned value
 *           are identical to the oracle's, and the live run is byte-identical on the full dump
 *           for all 1400 frames. The one measured difference is 17 T-states per dispatch, the
 *           call instruction the cycle-free layer does not charge.
 * NAMES:    none imported — this routine names no cell. OBJ_X and OBJ_Y appear above only to say
 *           what the frozen destinations read; they are not touched here.
 */

export function loc_2101(m) {
  // The frozen call bracket for the retirement gate: the return address is the fall-through.
  m.push16(0x2104);

  // A false answer means the gate retired the object, took that return address back off the
  // stack itself and diverted into the shared object-sprite tail. Control has already left.
  if (!m.call(0x24b4)) return undefined;

  // Still live: continue into the left-edge check, and hand back whatever it resolves to.
  return m.call(0x2104);
}
