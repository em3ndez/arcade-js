// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_1a07 -- the bonus-expired state machine's rst-0x28
 * DISPATCHER (ld a,(0x6386) ; rst 0x28 -> jp through dw[0x1A1E,0x1A15,0x1A1F,0x1A2A]).
 * COLLAPSED: the whole 98 t rst-dispatch body folds to one m.step at the jp (hl) target;
 * the balanced rst push/pop (0x1A0B) and the per-handler m.call stay verbatim. See
 * optimized/entry_1a07.js for the fold accounting, the flag analysis (`add a,a` is KEPT
 * because `add hl,de` preserves its S/Z/PV into the idx0 exit F), and the dispatch table.
 *
 * REACHABILITY + ATOMICITY (measured, not assumed). entry_1a07 runs only from loc_197a,
 * which the vblank-NMI handler runs mask-CLEARED. Probed over 1500 attract frames: 916
 * dispatches, ALL with io.nmiMask == 0 (inside the NMI, non-reentrant) and ZERO NMI
 * pushed-PC landings in the body region (0x1A0A / 0x0028-0x0037); driven gameplay agreed
 * (39/39 in-NMI). So it is ATOMIC and the collapse passes the BYTE-EXACT whole-machine
 * gate directly -- STRICT, not the convergent gate.
 *
 * BRANCH COVERAGE. Only state 0 (idx0) occurs naturally (the bonus never expires in these
 * windows), so the whole-machine + unit gates cover idx0; idx1/idx2(both sub-paths)/idx3
 * (both return values) and the idx4+ NotImplemented frontier are SYNTHESISED from crafted
 * entries -- each EQUAL (RAM + full register file + pc + SP) AND pinned to its exact oracle
 * cycle total. Teeth: a wrong body cycle total (whole-machine + crafted), a wrong dispatch
 * target (unit), and a dropped `add a,a` flag (which corrupts the idx0 exit F) are CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_1a07 as translated_1a07 } from "../../translated/state0.js";
import { entry_1a07 as optimized_1a07 } from "../entry_1a07.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { NotImplemented } from "../../../../boards/dkong/io.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1a07;
const FRAMES_WHOLE = 1200; // first entry ~f586; ~600 idx0 dispatches by f1200
const FRAMES_UNIT = 1200;
const RET_ADDR = 0x19bf;   // loc_197a's continuation, on the stack under entry_1a07
const STATE = 0x6386;      // BONUS_EXPIRED_STEP
const BODY_T = 98;         // the collapsed rst-dispatch body total

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed entry_1a07 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1a07]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic collapse)`);
});

test("STRICT-TEETH (cycles): a short body total forks the trajectory and is CAUGHT", () => {
  // The collapse's load-bearing invariant is total-cycle preservation. Shorting the body
  // by 5 t shifts the NMI handler's cost -> the main-loop spin count 0x6019 (PRNG entropy)
  // and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(STATE);
    m.push16(0x1a0b);
    regs.add(regs.a);
    regs.hl = m.pop16();
    regs.e = regs.a;
    regs.d = 0x00;
    regs.addHl(regs.de);
    regs.e = mem.read8(regs.hl);
    regs.hl = (regs.hl + 1) & 0xffff;
    regs.d = mem.read8(regs.hl);
    regs.exDeHl();
    const target = regs.hl;
    m.step(target, BODY_T - 5); // 98 -> 93
    switch (target) {
      case 0x1a1e: m.call(0x1a1e); return true;
      case 0x1a15: m.call(0x1a15); return true;
      case 0x1a1f: m.call(0x1a1f); return true;
      case 0x1a2a: return m.call(0x1a2a);
      default: throw new NotImplemented("frontier");
    }
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry: the idx0 arm, state 0) -------------------------

/** Capture the pristine machine the instant entry_1a07 is first entered (via m.call,
 *  deep in the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1a07(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff and each return. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  const ra = translated_1a07(a);
  const rb = fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    retEqual: ra === rb,
    a, b, ra, rb,
  };
}

test("EQUAL (unit): idiomatic entry_1a07 matches translated in RAM + full register file + pc (natural idx0)", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1a07);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  assert.ok(r.retEqual, "return value must match");
  assert.equal(NATURAL_ENTRY.mem.read8(STATE), 0, "natural entry is state 0 (idx0)");
  console.log(`  EQUAL/unit: RAM + all registers (incl. F) + pc + return identical (natural state-0 entry, ret=${r.rb})`);
});

test("TEETH (unit behavioural): routing the idx0 arm to the WRONG handler is CAUGHT", () => {
  // The natural entry is idx0 (target 0x1A1E -- a no-op ret). A twin that instead
  // dispatches to loc_1a1f (state 2's DELAY handler) runs a different subtree: it
  // overwrites HL and does `dec (0x6387)` in RAM, so RAM + registers diverge.
  const broken_wrongTarget = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(STATE);
    m.push16(0x1a0b);
    regs.add(regs.a);
    regs.hl = m.pop16();
    regs.e = regs.a; regs.d = 0x00;
    regs.addHl(regs.de);
    regs.e = mem.read8(regs.hl); regs.hl = (regs.hl + 1) & 0xffff; regs.d = mem.read8(regs.hl);
    regs.exDeHl();
    const target = regs.hl;
    m.step(target, BODY_T);
    m.call(0x1a1f); return true; // BUG: idx0 routed to loc_1a1f
  };
  const r = runBoth(NATURAL_ENTRY, broken_wrongTarget);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong dispatch target -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM diff at 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? "reg diff at " + r.regs.reg : "pc/sp diff"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: every reachable arm) ---------------

/**
 * Fresh machine seeded so `call 0x1a07 from loc_197a @0x19BC` is modelled: RET_ADDR
 * (0x19BF) on top of the stack (a handler's `ret` pops it), the state byte at 0x6386,
 * and the two bytes the state-2/3 handlers read (0x6387 delay, 0x6216 gate). B/C/HL/DE
 * are pre-set to sentinels so the arms where the handler does NOT overwrite them prove
 * they carry through. `f` seeds the caller's flags (to exercise the `add a,a` -> exit F
 * dependency). `stub19d2` isolates the idx3 caller-skip from loc_197a's 0x19D2 tail.
 */
function seed(state, { d6387 = 0x05, d6216 = 0x01, f = 0x00, stub19d2 = false } = {}) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR);
  const entrySP = m.regs.sp;
  m.mem.write8(0x6386, state);
  m.mem.write8(0x6387, d6387);
  m.mem.write8(0x6216, d6216);
  m.regs.b = 0xbb; m.regs.c = 0xcc; m.regs.hl = 0x1234; m.regs.de = 0x5678;
  m.regs.f = f;
  if (stub19d2) m.routines.set(0x19d2, () => {});
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP + return) AND pin its exact
 *  cycle total against the oracle and against the structural constant `expectCycles`. */
function assertArm(label, state, expectCycles, opts = {}) {
  const A = seed(state, opts);
  const B = seed(state, opts);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  const ra = translated_1a07(A.m);
  const rb = optimized_1a07(B.m);
  const dA = A.m.cycles - ca0, dB = B.m.cycles - cb0;

  const ram = firstStateDiff(A.m.dumpState(), B.m.dumpState(), (off) => A.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(A.m.regs, B.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(A.m.pc, B.m.pc, "pc must match");
  assert.equal(A.m.regs.sp, B.m.regs.sp, "SP must match");
  assert.equal(ra, rb, `${label}: return value mismatch (oracle ${ra} vs optimized ${rb})`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${B.m.pc.toString(16)}, ret=${rb}, ${dB} t == oracle ${dA} t == ${expectCycles} t`);
}

test("BRANCH (unit): idx0 (state 0) -> sub_1a1e no-op ret (98 body + 10 ret = 108 t)", () => {
  assertArm("idx0", 0, 108);
  const { m } = seed(0);
  optimized_1a07(m);
  assert.equal(m.pc, RET_ADDR, "idx0 returns to loc_197a's continuation");
  assert.equal(m.regs.a, 0x00, "idx0: A = 2*state = 0 (handler is a ret, leaves it)");
  assert.equal(m.regs.hl, 0x1a1e, "idx0: HL = target 0x1A1E (handler leaves it)");
  assert.equal(m.regs.de, 0x1a0c, "idx0: DE = table pointer+1 = 0x1A0C");
  assert.equal(m.regs.f, 0x48, "idx0 exit F = add hl,de over add a,a's S/Z/PV = 0x48");
});

test("BRANCH (unit): idx1 (state 1) -> loc_1a15 INIT (98 + 47 = 145 t)", () => {
  assertArm("idx1", 1, 145);
  const { m } = seed(1);
  optimized_1a07(m);
  assert.equal(m.pc, RET_ADDR, "idx1 returns to loc_197a");
  assert.equal(m.mem.read8(0x6386), 0x02, "idx1: loc_1a15 advanced state 1 -> 2");
  assert.equal(m.mem.read8(0x6387), 0x00, "idx1: loc_1a15 cleared the delay counter");
});

test("BRANCH (unit): idx2 (state 2) STAY -- 0x6387=5, dec to 4, ret nz (98 + 32 = 130 t)", () => {
  assertArm("idx2-stay", 2, 130, { d6387: 0x05 });
  const { m } = seed(2, { d6387: 0x05 });
  optimized_1a07(m);
  assert.equal(m.mem.read8(0x6387), 0x04, "idx2-stay: 0x6387 decremented 5 -> 4");
  assert.equal(m.mem.read8(0x6386), 0x02, "idx2-stay: state unchanged (still 2)");
});

test("BRANCH (unit): idx2 (state 2) ADVANCE -- 0x6387=1, dec to 0, -> state 3 (98 + 56 = 154 t)", () => {
  assertArm("idx2-advance", 2, 154, { d6387: 0x01 });
  const { m } = seed(2, { d6387: 0x01 });
  optimized_1a07(m);
  assert.equal(m.mem.read8(0x6387), 0x00, "idx2-advance: 0x6387 decremented 1 -> 0");
  assert.equal(m.mem.read8(0x6386), 0x03, "idx2-advance: loc_1a1f advanced state 2 -> 3");
});

test("BRANCH (unit): idx3 (state 3) STAY -- 0x6216!=0, ret nz -> returns true (98 + 28 = 126 t)", () => {
  assertArm("idx3-true", 3, 126, { d6216: 0x01 });
  const { m } = seed(3, { d6216: 0x01 });
  const ret = optimized_1a07(m);
  assert.equal(ret, true, "idx3 with (0x6216)!=0 returns true (stay in state 3)");
  assert.equal(m.pc, RET_ADDR, "idx3-true returns to loc_197a");
});

test("BRANCH (unit): idx3 (state 3) EXIT -- 0x6216==0, caller-skip -> returns false (98 + 42 = 140 t)", () => {
  // SYNTHESISED with 0x19D2 stubbed to isolate entry_1a07 + loc_1a2a from loc_197a's tail.
  assertArm("idx3-false", 3, 140, { d6216: 0x00, stub19d2: true });
  const { m } = seed(3, { d6216: 0x00, stub19d2: true });
  const ret = optimized_1a07(m);
  assert.equal(ret, false, "idx3 with (0x6216)==0 returns false (caller-skip)");
  assert.equal(m.pc, 0x19d2, "idx3-false jumped to loc_197a's 0x19D2 tail");
});

test("BRANCH (frontier): idx4+ (state 4) -> dw 0x0000 wild jp -- both THROW NotImplemented after the 98 t body", () => {
  const A = seed(4);
  const B = seed(4);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  assert.throws(() => translated_1a07(A.m), NotImplemented, "oracle must throw on state 4");
  assert.throws(() => optimized_1a07(B.m), NotImplemented, "optimized must throw on state 4");
  const dA = A.m.cycles - ca0, dB = B.m.cycles - cb0;
  assert.equal(dB, dA, `frontier: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, BODY_T, `frontier: the 98 t body runs then jp (hl) faults (got ${dA})`);
  assert.equal(A.m.pc, 0x0000, "oracle: PC = the wild jp target 0x0000");
  assert.equal(B.m.pc, 0x0000, "optimized: PC = the wild jp target 0x0000");
  console.log(`  BRANCH/frontier: both threw NotImplemented after ${dB} t == oracle ${dA} t, pc=0x0000`);
});

// -- TEETH (crafted) ----------------------------------------------------------

test("BRANCH-TEETH (cycles): a dropped body charge yields a wrong total and is CAUGHT", () => {
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(STATE);
    m.push16(0x1a0b);
    regs.add(regs.a);
    regs.hl = m.pop16();
    regs.e = regs.a; regs.d = 0x00;
    regs.addHl(regs.de);
    regs.e = mem.read8(regs.hl); regs.hl = (regs.hl + 1) & 0xffff; regs.d = mem.read8(regs.hl);
    regs.exDeHl();
    const target = regs.hl;
    m.step(target, BODY_T - 5); // DROPPED: 98 -> 93
    m.call(0x1a1e); return true;
  };
  const a = seed(0);
  const b = seed(0);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1a07(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});

test("FLAGS-TEETH (idx0): dropping `add a,a`'s flags corrupts the idx0 exit F and is CAUGHT", () => {
  // The FLAGS docstring claims `add a,a` must run verbatim because `add hl,de` PRESERVES
  // its S/Z/PV into the idx0 exit F (the handler is a bare ret that never rewrites F).
  // Seed a caller F with S set (0x80): the oracle overwrites it via `add a,a` (-> exit
  // F=0x48), but a twin that computes A=2*state WITHOUT the flag leaks the seeded S into
  // `add hl,de` -> a different exit F. On state 0, A is 0 either way, so ONLY F reveals it.
  const noAddFlag = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(STATE);
    m.push16(0x1a0b);
    regs.a = (regs.a * 2) & 0xff; // BUG: value only, drops add a,a's flags
    regs.hl = m.pop16();
    regs.e = regs.a; regs.d = 0x00;
    regs.addHl(regs.de);
    regs.e = mem.read8(regs.hl); regs.hl = (regs.hl + 1) & 0xffff; regs.d = mem.read8(regs.hl);
    regs.exDeHl();
    const target = regs.hl;
    m.step(target, BODY_T);
    m.call(0x1a1e); return true;
  };
  const a = seed(0, { f: 0x80 });
  const b = seed(0, { f: 0x80 });
  translated_1a07(a.m);
  noAddFlag(b.m);
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.notEqual(regs, null, "reg-file gate has no teeth for the dropped add a,a flag");
  assert.equal(a.m.regs.f, 0x48, "oracle idx0 exit F = 0x48 (add a,a's Z + add hl,de's F3)");
  assert.notEqual(b.m.regs.f, 0x48, "the dropped-flag twin leaked the seeded S into the exit F");
  console.log(`  FLAGS-TEETH: caught -- oracle F=0x${a.m.regs.f.toString(16)} vs dropped-flag F=0x${b.m.regs.f.toString(16)} (reg diff at ${regs.reg})`);
});
