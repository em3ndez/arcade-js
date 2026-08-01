// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2227 — one arm of the sub_2207 board-object state machine: tick this object's
 * dwell timer, advance its state when the timer elapses, and stamp a shared flag when
 * Mario has reached the object's target position.  ROM 0x2227.
 *
 * sub_2207 walks an 8-byte object record (its base is pushed on the stack and this arm
 * pops it), then dispatches on the object's state byte to one of a few arms; this is
 * the arm for one such state. The record's first three bytes it touches are:
 *   +0  the object's state (advanced by one when the dwell timer elapses)
 *   +1  the dwell timer, counted down one step every time this arm runs
 *   +2  the object's target X — the position Mario must reach (fed to the hit test)
 *
 * What it does:
 *   1. Count the dwell timer (+1) down by one, every pass.
 *   2. If the timer just elapsed (reached zero): advance the object's state (+0), then
 *      hit-test Mario against the object's target X (+2). On a hit, stamp the shared
 *      flag 0x621a with 1 — "reached it on the frame the timer elapsed".
 *   3. If the timer is still running: hit-test Mario against the target X (+2). On a
 *      hit, stamp the shared flag 0x621a with 0.
 *   4. On a MISS the hit test's shared "no hit" tail unwinds two levels up (back to the
 *      grandparent), so this arm's flag stamp is skipped entirely — reproduced here by
 *      the boolean caller-skip `if (!loc_2243(m)) return;`. The dwell timer is still
 *      counted down before the test, and in the timer-elapsed branch the state is still
 *      advanced before the test, so a miss suppresses only the flag stamp.
 *
 * ORACLE BOUNDARY: the record base arrives on the stack, pushed by sub_2207 — which is
 * still the frozen lift — so it is received with a stack pop here, exactly as the lift
 * takes it. When sub_2207 is brought across, this dissolves into a parameter. Likewise
 * the hit test loc_2243 still reads its target through a pointer register, so this arm
 * loads that register with the +2 address right before calling it (the same marshalling
 * the lift's `call` site does); that dissolves into an argument once loc_2243 takes one.
 *
 * NAME: kept the neutral loc_ — the timer/state/hit-test mechanics are pinned to the
 * oracle, but which board object this arm services (and what 0x621a ultimately means)
 * is not corroborated to the routine-name bar. Promote once grounded.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2227.test.js.
 * GATE:     crafted-entry + captured-ancestor. 0x2227 is never dispatched in attract
 *           (sub_2207's board gate skips its whole body there), so realistic states are
 *           captured at the reachable ancestor sub_2207 (ROM 0x2207) and a valid record
 *           base + stack are laid over each; crafted entries then drive all four arms
 *           (timer-running/elapsed x hit/miss) for both record bases. The RAM diff
 *           excludes the dead STACK_SCRATCH — the oracle brackets the hit-test call with
 *           a pushed return that this arm's direct call dissolves, so those bytes differ
 *           and are dead. Teeth: a twin that stamps the flag on a miss, a twin that
 *           stamps the wrong branch value, and a twin that drops the state advance.
 * LIVE-OUT: memory-only — the record's timer (+1) and (in the elapsed branch) state (+0)
 *           bytes, plus the shared flag 0x621a. The caller discards any register result.
 *           The oracle's residual registers/flags and its terminal return are dead ABI;
 *           the test lines pc/SP up with one modeled return, mirroring the dissolved call.
 * NAMES:    loc_2243 (ROM 0x2243) — the hit test, direct-called. The record base and its
 *           +0/+1/+2 fields arrive through the caller's pushed pointer, so like the hit
 *           test's target they carry no fixed ram.js name. 0x621a is a shared object flag
 *           examined and left hex in ram.js (two unrelated arms write it — this one and a
 *           sibling — so one board can't settle it), so it stays a hex literal here.
 */

import { marioReachedTargetColumn as loc_2243 } from "./marioReachedTargetColumn.js"; // ROM 0x2243 — has Mario reached the target X?

const OBJECT_FLAG = 0x621a; // shared object flag; kept hex in ram.js (unsettled, shared byte)

export function loc_2227(m) {
  const { regs, mem } = m;

  // The record base was pushed by sub_2207 (still the frozen lift) — receive it here.
  const base = m.pop16();

  // Count this object's dwell timer (+1) down by one, every pass.
  const timer = (mem.read8(base + 1) - 1) & 0xff;
  mem.write8(base + 1, timer);

  if (timer === 0) {
    // Dwell elapsed: advance the object's state (+0) before the hit test.
    mem.write8(base, mem.read8(base) + 1);

    // Has Mario reached this object's target X (+2)? On a miss the shared caller-skip
    // unwinds two levels, so the flag stamp below is skipped.
    regs.hl = base + 2;
    if (!loc_2243(m)) return;

    // Reached it on the frame the timer elapsed.
    mem.write8(OBJECT_FLAG, 1);
    return;
  }

  // Timer still running: same hit test against the target X (+2).
  regs.hl = base + 2;
  if (!loc_2243(m)) return;

  // Reached it while the timer was still running.
  mem.write8(OBJECT_FLAG, 0);
}
