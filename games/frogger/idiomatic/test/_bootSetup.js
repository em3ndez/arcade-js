// SPDX-License-Identifier: GPL-3.0-only
/**
 * Shared capture + diff for the boot chain (0x0000 reset vector, 0x02a3 cold-boot init). Both tail into
 * the main loop 0x0341, which re-enters forever when called directly, so the routines map used for the
 * isolated oracle/cand runs severs that sink with an empty generator; each routine then stops at its
 * transfer point and the compared state is the boot init's own work. A post-attract seed is cloned, SP
 * seated at 0x8800 (where the reset vector leaves it), and cells poked; live-out is memory-only, so RAM
 * is compared with the dead stack scratch [0x87e0,0x8800) masked.
 */
import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { buildRoutines } from "../../routines.js";

export { romsPresent };

const STACK_LO = 0x87e0, STACK_HI = 0x8800;
const MAIN_LOOP_HEAD = 0x0341;

// The routines map with the main-loop sink severed, shared by every crafted run.
export const STUBS = buildRoutines();
STUBS.set(MAIN_LOOP_HEAD, function* () {});

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  if (m.stoppedBy !== null) throw new Error(`the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A fresh post-attract clone with the sink severed and SP seated, then mutated by `mut(mem8, machine)`.
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
