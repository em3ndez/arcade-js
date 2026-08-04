// SPDX-License-Identifier: GPL-3.0-only
/**
 * hold50mObjectParked — the parked arm of the 50m board-object state machine: hold the object
 * still while its dwell timer runs down, advance its state when the timer elapses, and stamp a
 * shared flag while Mario is standing on the object's column.  ROM 0x2227.
 *
 * dispatch50mObjectState (ROM 0x2207) walks an 8-byte object record (its base is pushed on the
 * stack and this arm pops it), then dispatches on the object's state byte to one of four arms;
 * this is the arm for state 0. Nothing moves in this state — the object sits at its position
 * counter's minimum, 0x68, which is its HIGHEST point on screen (larger Y is lower; see
 * raise50mObjectAndPark.js's VERTICAL CONVENTION block). The record bytes it touches are:
 *   +0  the object's state (advanced by one when the dwell timer elapses)
 *   +1  the dwell timer, counted down one step every time this arm runs
 *   +2  the object's column — the X Mario must be standing on (fed to the hit test)
 *
 * What it does:
 *   1. Count the dwell timer (+1) down by one, every pass.
 *   2. If the timer just elapsed (reached zero): advance the object's state (+0) — which is
 *      what starts the object moving — then hit-test Mario against the object's column (+2).
 *      On a hit, stamp the shared flag 0x621a with 1 — "he was on the column on the frame
 *      the dwell expired".
 *   3. If the timer is still running: hit-test Mario against the column (+2). On a hit,
 *      stamp the shared flag 0x621a with 0.
 *   4. On a MISS the hit test's shared "no hit" tail unwinds two levels up (back to the
 *      grandparent), so this arm's flag stamp is skipped entirely — reproduced here by
 *      the boolean caller-skip on marioReachedTargetColumn — written `if (!loc_2243(m)) return;`
 *      below only because this file still imports it under its pre-promotion alias (see NAMES).
 *      The dwell timer is still
 *      counted down before the test, and in the timer-elapsed branch the state is still
 *      advanced before the test, so a miss suppresses only the flag stamp.
 *
 * ORACLE BOUNDARY: the record base arrives on the stack. This arm is the last of the four
 * still shaped that way — it receives its base with a stack pop, so the (already idiomatic)
 * dispatcher pushes the base right before calling it purely to feed that pop. The push and
 * the pop dissolve together the moment this arm takes a parameter. Likewise the hit test
 * still reads its target through a pointer register, so this arm loads that register with
 * the +2 address right before calling it (the same marshalling the oracle's `call` site
 * does); that dissolves into an argument once the hit test takes one.
 *
 * NAME: promoted from loc_2227 in understanding pass 15 (proposer != confirmer; the two
 * derivations agree in meaning — the dwell state that holds the object still and releases it
 * when the timer expires). Corroboration from OUTSIDE the routine (R5): its callee
 * marioReachedTargetColumn (ROM 0x2243) is already English-promoted and its accounting closes
 * to the unit in natural play — 209 hit-test entries, 160 misses, 49 hits, and the hit tail
 * at ROM 0x223F fetched exactly 49 times. The dwell itself was measured, not inferred: state 0
 * lasts EXACTLY 256 frames, 11/11 and 12/12 cycles, which is the 0x80 reload the sibling arm
 * raise50mObjectAndPark writes into +1 serviced every other frame (128 x 2) — an outside
 * routine's write predicting this routine's measured dwell. "Parked" is the observed behaviour:
 * the position counter does not change anywhere in this arm. The flag half is carried in the
 * prose and NOT in the name, because 0x621a's consumers were never A/B'd.
 *
 * WHAT THE NAME DOES NOT CLAIM: WHICH 50m object the record drives. Its sprite is isolated and
 * reads as a ladder graphic, and pass 15's blind confirmer named this cluster for a moving
 * ladder; mechanisms.md lists retracting ladders in the 50m cast. The open part is which of
 * that cast it is and whether the travel is a retraction, so the names stay neutral.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2227.test.js.
 * GATE:     crafted-entry + captured-ancestor. 0x2227 is never dispatched in attract
 *           (the 50m board gate in dispatch50mObjectState skips its whole body there —
 *           reconfirmed at 0 bodies across 24,243 attract frames), so realistic states are
 *           captured at the reachable ancestor dispatch50mObjectState (ROM 0x2207) and a
 *           valid record base + stack are laid over each; crafted entries then drive all
 *           four arms (timer-running/elapsed x hit/miss) for both record bases. The RAM diff
 *           excludes the dead STACK_SCRATCH — the oracle brackets the hit-test call with
 *           a pushed return that this arm's direct call dissolves, so those bytes differ
 *           and are dead. Teeth: a twin that stamps the flag on a miss, a twin that
 *           stamps the wrong branch value, and a twin that drops the state advance.
 * LIVE-OUT: memory-only — the record's timer (+1) and (in the elapsed branch) state (+0)
 *           bytes, plus the shared flag 0x621a. The caller discards any register result.
 *           The oracle's residual registers/flags and its terminal return are dead ABI;
 *           the test lines pc/SP up with one modeled return, mirroring the dissolved call.
 * NAMES:    marioReachedTargetColumn (ROM 0x2243) — the hit test, direct-called; it is still
 *           imported here under its pre-promotion `loc_2243` alias. The record base and its +0/+1/+2 fields arrive through the
 *           caller's pushed pointer, so like the hit test's target they carry no fixed names.js
 *           name. 0x621a is a shared object flag examined and left hex in names.js — its two
 *           writers are unrelated subsystems (this arm, and the climb collision at ROM 0x1AFE),
 *           neither reader has been A/B'd, and the second writer has never been observed at
 *           all, so no cell name can be true for both. It stays a hex literal here.
 */

import { marioReachedTargetColumn as loc_2243 } from "./marioReachedTargetColumn.js"; // ROM 0x2243 — the column hit test

const OBJECT_FLAG = 0x621a; // shared object flag; kept hex in names.js (unsettled, shared byte)

export function hold50mObjectParked(m) {
  const { regs, mem } = m;

  // The record base was pushed by dispatch50mObjectState for this pop — receive it here.
  const base = m.pop16();

  // Count this object's dwell timer (+1) down by one, every pass.
  const timer = (mem.read8(base + 1) - 1) & 0xff;
  mem.write8(base + 1, timer);

  if (timer === 0) {
    // Dwell elapsed: advance the object's state (+0) — starting it moving — before the test.
    mem.write8(base, mem.read8(base) + 1);

    // Is Mario standing on this object's column (+2)? On a miss the shared caller-skip
    // unwinds two levels, so the flag stamp below is skipped.
    regs.hl = base + 2;
    if (!loc_2243(m)) return;

    // On the column on the frame the dwell expired.
    mem.write8(OBJECT_FLAG, 1);
    return;
  }

  // Timer still running: same hit test against the object's column (+2).
  regs.hl = base + 2;
  if (!loc_2243(m)) return;

  // On the column while the dwell was still running.
  mem.write8(OBJECT_FLAG, 0);
}
