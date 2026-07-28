// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_30ed -- the ORCHESTRATOR at the head of the >=0x3000
 * object-processing chain (call 0x30fa ; call 0x313c ; call 0x31b1 ; call 0x34f3 ; ret).
 * Two of the four callees are CALLER-SKIP guards, boolean-guarded with
 * `if (!m.call(0xADDR)) return;`; the other two are plain calls. See
 * optimized/entry_30ed.js for the full behaviour block.
 *
 * NO cycle collapse is possible here (every instruction is a control transfer, so the
 * per-instruction charges are already minimal and are kept EXACTLY as the oracle) --
 * the rewrite is purely names, structure, and the docstring.
 *
 * REACHABILITY (measured, not assumed -- the oracle's "not yet wired" docstring is
 * STALE). loc_197a's NMI-cascade dispatches entry_30ed. Probed: 816 dispatches over
 * 1400 attract frames (first ~frame 586, once the demo starts PLAYING 25m). All three
 * reachable arms occur NATURALLY -- guard-1 skip 408x, guard-2 skip 142x, full cascade
 * 266x -- so the whole-machine gate is non-vacuous AND exercises every branch.
 *
 * ATOMIC, so the STRICT byte-exact whole-machine gate is the right license. Probed:
 * every entry_30ed dispatch occurs INSIDE the NMI handler (io.nmiMask==0 at 816/816;
 * outside-NMI 0), where entry_0066 cleared the NMI mask so the interrupt cannot
 * re-enter -- and the NMI's pushed PC never lands in [0x30ED,0x30F9] (0 landings over
 * 1394 NMIs; none in the 0x3000-0x34FF chain; all in the 0x02BD-0x0372 main-loop band).
 * Because the rewrite ALSO keeps the oracle's exact per-instruction cycle distribution,
 * it is byte-exact and the strict gate passes over an 800+-invocation window.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry and its behavioural teeth; FULL-BRANCH coverage of
 * all three reachable arms from crafted identical-both-sides pokes (EQUAL over
 * RAM+regs+pc+SP AND each arm's exact cycle TOTAL); and a dropped-charge cycle twin
 * CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_30ed as translated_30ed } from "../../translated/state0.js";
import { entry_30ed as optimized_30ed } from "../entry_30ed.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x30ed;
const FRAMES_WHOLE = 1400; // past the ~f586 first dispatch; ~816 invocations across all 3 arms
const FRAMES_UNIT = 650; // the unit host must run past the first dispatch (~f586) to capture it

const RET_ADDR = 0x4d17; // sentinel caller-return address for crafted entries

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC, no collapse) --

test("STRICT (whole-machine): entry_30ed is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_30ed]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic)`);
});

test("STRICT-TEETH (cycles): a wrong call charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging the first `call`
  // 16 t instead of 17 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const call = (returnAddr, target) => {
      m.push16(returnAddr);
      m.step(target, target === 0x30fa ? 16 : 17); // DROPPED: 17 -> 16 on the first call
      return m.call(target);
    };
    if (!call(0x30f0, 0x30fa)) return;
    if (!call(0x30f3, 0x313c)) return;
    call(0x30f6, 0x31b1);
    call(0x30f9, 0x34f3);
    m.ret();
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant entry_30ed is first entered (via m.call,
 *  deep in the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_30ed(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_30ed(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic entry_30ed matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_30ed);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural entry)");
});

test("TEETH (unit behavioural): ignoring guard #2's skip boolean is CAUGHT", () => {
  // The natural first entry takes the GUARD-2 SKIP arm (measured): guard 1 returns
  // true, entry_313c then SPLICES (0 objects) and returns false, so the oracle bails.
  // A twin that ignores that boolean keeps running -- pushing calls onto the already
  // unwound stack -- so its RAM/pc/SP diverge from the oracle's early return.
  const broken_ignoreSkip = (m) => {
    const call = (returnAddr, target) => {
      m.push16(returnAddr);
      m.step(target, 17);
      return m.call(target);
    };
    if (!call(0x30f0, 0x30fa)) return;
    call(0x30f3, 0x313c); // BUG: skip boolean ignored -- continues even after the splice
    call(0x30f6, 0x31b1);
    call(0x30f9, 0x34f3);
    m.ret();
  };
  const r = runBoth(NATURAL_ENTRY, broken_ignoreSkip);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch an ignored skip boolean -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${!r.pcEqual ? "pc" : !r.spEqual ? "SP" : r.regs ? r.regs.reg : "ram"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides pokes: all 3 arms) ------

/**
 * Fresh machine with a valid stack (a sentinel caller-return frame) and RAM poked so
 * the game's OWN callees drive entry_30ed down the chosen arm -- the sanctioned
 * identical-both-sides poke (the decompiler-pipeline doc pattern 3), applied to both oracle and optimized
 * clones through the same seed:
 *   - fresh                 -> guard #1 (0x3110) splices ((0x601a&1)!=1)      -> guard1-skip
 *   - 0x601a=1              -> guard #1 normal; entry_313c sees 0 objects -> splice -> guard2-skip
 *   - 0x601a=1 AND 0x6400=1 -> both guards normal -> run 0x31b1 + 0x34f3 + ret -> full cascade
 */
function seed(pokes) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // entry_30ed's own caller-return frame
  const entrySP = m.regs.sp;
  for (const [a, v] of pokes) m.mem.write8(a, v);
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total: optimized must equal the oracle, and (for a regression guard) the oracle
 *  total must equal the structural constant `expectCycles`. */
function assertArm(label, pokes, expectCycles) {
  const a = seed(pokes);
  const b = seed(pokes);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_30ed(a.m);
  optimized_30ed(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  // Every arm unwinds to the caller sentinel with the stack balanced.
  assert.equal(b.m.pc, RET_ADDR, `${label}: must return/unwind to the caller sentinel`);
  assert.equal(b.m.regs.sp, a.entrySP + 2, `${label}: stack must be balanced (caller frame consumed)`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): guard-1 skip -- fresh RAM, 0x3110 splices past entry_30ed", () => {
  assertArm("guard1-skip", [], 188);
});

test("BRANCH (unit): guard-2 skip -- 0x601a=1, entry_313c splices on 0 objects", () => {
  assertArm("guard2-skip", [[0x601a, 1]], 1069);
});

test("BRANCH (unit): full cascade -- 0x601a=1 & 0x6400=1, all four calls + ret", () => {
  assertArm("full-cascade", [[0x601a, 1], [0x6400, 1]], 2893);
});

test("BRANCH-TEETH (cycles): a dropped call charge yields a wrong total and is CAUGHT", () => {
  // Full-cascade path charged 16 t on the last call instead of 17 -> total no longer
  // matches the oracle. Uses the crafted full-cascade seed so the arm is deterministic.
  const dropped = (m) => {
    const call = (returnAddr, target) => {
      m.push16(returnAddr);
      m.step(target, target === 0x34f3 ? 16 : 17); // DROPPED: 17 -> 16 on the last call
      return m.call(target);
    };
    if (!call(0x30f0, 0x30fa)) return;
    if (!call(0x30f3, 0x313c)) return;
    call(0x30f6, 0x31b1);
    call(0x30f9, 0x34f3);
    m.ret();
  };
  const a = seed([[0x601a, 1], [0x6400, 1]]);
  const b = seed([[0x601a, 1], [0x6400, 1]]);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_30ed(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
