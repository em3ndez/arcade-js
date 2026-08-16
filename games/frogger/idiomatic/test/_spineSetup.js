// SPDX-License-Identifier: GPL-3.0-only
/**
 * Shared capture + diff for the new-game / continue / next-life spine routines (0x0457, 0x048f,
 * 0x04f3, 0x0547). Each tail-transfers into the pace tail (0x0368) and the cold-start body reaches
 * the mid-entry 0x0567, both of which re-enter the main loop forever when called directly. So the
 * routines map used for the isolated oracle/cand runs severs those two sinks with empty generators;
 * every routine then stops at its transfer point and the compared state is the routine's own setup.
 * A post-attract seed is cloned, SP seated at 0x8800, and the branch cells poked; live-out is
 * memory-only, so RAM is compared with the dead stack scratch [0x87e0,0x8800) masked.
 */
import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";

export { romsPresent };

const STACK_LO = 0x87e0, STACK_HI = 0x8800;
const PACE_TAIL = 0x0368, COLD_START_MID_BODY = 0x0567;

// The routines map with the two spine sinks severed, shared by every crafted run.
export const STUBS = buildRoutines();
STUBS.set(PACE_TAIL, function* () {});
STUBS.set(COLD_START_MID_BODY, function* () {});

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  if (m.stoppedBy !== null) throw new Error(`the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A fresh post-attract clone with the sinks severed and SP seated, then mutated by `mut(mem8, machine)`.
export function craft(mut) {
  const e = seedMachine().clone();
  e.routines = STUBS;
  e.regs.sp = STACK_HI;
  if (mut) mut(e.mem8, e);
  return e;
}

// null == RAM-equivalent (dead stack scratch masked); else a string naming the first differing address.
export function ramDiff(oracle, cand, entry) {
  const a = entry.clone(); a.routines = STUBS; oracle(a);
  const b = entry.clone(); b.routines = STUBS; cand(b);
  const A = a.dumpState(), B = b.dumpState();
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (A[i] === B[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= STACK_LO && addr < STACK_HI) continue;
    return `0x${(addr ?? 0).toString(16)}: ${A[i]} vs ${B[i]}`;
  }
  return null;
}
