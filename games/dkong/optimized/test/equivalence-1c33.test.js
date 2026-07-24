// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_1c33 (ROM 0x1C33-0x1C39): the roll-over hook +
 * tail to the player sprite copy, at the end of one arm of Mario's per-frame update
 * tree (loc_1bb2 -> ... -> entry_1c05, which `jp nz`s here). It does `inc a`,
 * `call z,0x2954` (entry_2954, only when the phase counter rolled over), then
 * unconditionally `jp 0x1da6` (entry_1da6, the player -> display-buffer sprite copy).
 *
 * REACHABILITY. loc_1c33 is NOT a dispatch target; it is reached only via
 * `m.call(0x1c33)` from entry_1c05. It fires 39x in the ATTRACT demo (first at
 * frame ~587) and 0x in a 1200-frame 25m gameplay tape — so ATTRACT is the scenario,
 * and it reaches BOTH arms naturally (the normal NZ arm 37x, the roll-over Z arm 2x).
 * The unit snapshot override is installed at CONSTRUCTION, so it captures the entry
 * however the routine is reached (dispatch OR m.call); it needs maxFrames past ~587.
 *
 * Seven jobs:
 *   1. CONVERGENT (whole-machine) -- collapsed loc_1c33 CONVERGES vs its oracle under
 *      the attract scenario: pixels ground truth, dead stack excluded, non-stack state
 *      + pixels must reconverge. See the CYCLE DECISION note below for why convergent.
 *   2. EQUAL (unit) -- translated vs optimized leave identical RAM + full register
 *      file (incl. F, SP) + pc from the captured entry. The natural first entry has
 *      A=0xED (the NZ / normal arm), so the unit EQUAL exercises the normal path.
 *   3. BRANCH + CONTRACT COVERAGE -- both arms are synthesised by setting the entry
 *      register A identically on both sides, then diffed RAM + regs + pc AND checked
 *      for the exact SP and CYCLE TOTAL (through the callees, resolved to the oracle):
 *        - A=0x01  (inc -> 0x02, NZ):  call z NOT taken -> tail  = 136 t
 *        - A=0xFF  (inc -> 0x00, Z):   call z taken (entry_2954) -> tail = 696 t
 *   4. BRANCH-TEETH (cycles) -- a variant that drops one m.step charge yields a wrong
 *      total and is CAUGHT, proving the cycle-total assertion has teeth.
 *   5. TEETH (convergent) -- a cycle-broken twin (wrong total) forks the PRNG (spin
 *      count 0x6019), a PERSISTENT non-stack divergence the convergent gate CATCHES.
 *   6. TEETH (unit) -- a twin that skips the entry_1da6 tail jump leaves the player
 *      sprite buffer (0x694C) stale; CAUGHT, naming 0x694C. (loc_1c33 has no store of
 *      its own, so its observable output IS the tail's sprite copy.)
 *
 * THE CYCLE DECISION. loc_1c33 is COLLAPSED to one m.step per branch TOTAL (normal
 * 24 t; roll-over 21 t before entry_2954 + 10 t before entry_1da6), each equal to the
 * oracle's. It is a callee of loc_197a, the per-frame cascade docs/06 names as
 * INTERRUPTIBLE in gameplay. On the ONLY reached path (attract) the NMI mask is
 * measured OFF for all 39 invocations, so the collapse is byte-exact there -- but
 * atomicity is a property of every call path, so a collapse is licensed by the
 * CONVERGENT gate (safe whether or not an NMI ever lands inside). A wrong TOTAL still
 * forks the PRNG regardless of the mask (job 5).
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1c33 as translated_1c33 } from "../../translated/state0.js";
import { loc_1c33 as optimized_1c33 } from "../loc_1c33.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1c33;
const FRAMES = 700; // loc_1c33 first fires at attract frame ~587; give margin.

// entry_1da6 (the tail) copies MARIO_X (0x6203) into the player sprite buffer at
// 0x694C. Both stay hex -- 0x6203 is the named MARIO_X's base and 0x694C is an
// unnamed sprite-buffer slot; here they are only the observable target of the tail.
const MARIO_X = 0x6203;
const SPRITE_BUF = 0x694c;

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers, but the
 * normal (NZ) arm charges 19 t instead of 24 t. A wrong total shifts the main loop's
 * spin count (0x6019, the PRNG entropy), forking the RANDOM stream -- a PERSISTENT
 * non-stack divergence, never a heal. This is the teeth for the collapse's
 * load-bearing invariant (total-cycle preservation).
 */
function cyclebroken_1c33(m) {
  const { regs } = m;
  regs.a = regs.inc8(regs.a);
  if (regs.fZ) {
    m.push16(0x1c37);
    m.step(0x2954, 21);
    m.call(0x2954);
    m.step(0x1da6, 10);
    return m.call(0x1da6);
  }
  m.step(0x1da6, 19); // DROPPED 5 t: the correct normal-arm total is 24 t
  return m.call(0x1da6);
}

/**
 * Tail-skip twin for the UNIT gate: behaviourally the optimized routine on the NZ arm
 * EXCEPT it never tail-jumps to entry_1da6, so the player sprite buffer (0x694C..) is
 * left stale. loc_1c33 has no store of its own; its observable output is precisely
 * that tail sprite copy, so this is the "wrong output" bug for this routine.
 */
function tailskip_1c33(m) {
  const { regs } = m;
  regs.a = regs.inc8(regs.a);
  if (regs.fZ) {
    m.push16(0x1c37);
    m.step(0x2954, 21);
    m.call(0x2954);
    m.step(0x1da6, 10);
    return m.call(0x1da6);
  }
  m.step(0x1da6, 24);
  return; // BUG: the `jp 0x1da6` tail is dropped -- 0x694C never refreshed
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loc_1c33 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_1c33]]), { scenario: SCENARIOS.attract });

  assert.ok(
    r.invocations.get(TARGET) >= 1,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, ` +
      `pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized loc_1c33 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_1c33, optimized_1c33, { maxFrames: FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural NZ entry, A=0xED)");
});

// -- BRANCH + CONTRACT COVERAGE ----------------------------------------------

/** Capture the pristine machine the instant loc_1c33 is first entered (via m.call)
 *  in the attract demo. A constructor override snapshots the entry, then delegates
 *  to the oracle so the host run proceeds normally. */
function captureEntry(maxFrames = FRAMES) {
  let entry = null;
  const snap = new Map([[TARGET, (mm, ...a) => {
    if (entry === null) entry = mm.clone();
    return translated_1c33(mm, ...a);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}

/** Clone `entry`, set the entry register A (the branch selector for loc_1c33), run
 *  `fn`, and report the contract: resulting SP + PC, the machine, and the cycles the
 *  routine charged (relative to entry, so it is base-independent). */
function runBranch(entry, aval, fn) {
  const c = entry.clone();
  c.regs.a = aval;
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

/** Prove one synthesised branch EQUAL across the WHOLE contract: RAM, registers, pc,
 *  SP, and the absolute cycle total (structural, entry-independent) so a wrong total
 *  on this arm has committed teeth. */
function assertBranchEqual(label, aval, expect) {
  const entry = captureEntry();
  const o = runBranch(entry, aval, translated_1c33);
  const p = runBranch(entry, aval, optimized_1c33);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match between oracle and optimized");
  assert.equal(o.sp, p.sp, "SP must match the oracle");
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  assert.equal(o.cycles, expect.cycles, `oracle cycle total should be ${expect.cycles} on this arm`);
  console.log(`  BRANCH/${label}: EQUAL -- SP 0x${p.sp.toString(16)}, ${p.cycles} t`);
}

test("BRANCH (unit): A=0x01 -- call z NOT taken, tail to entry_1da6, 136 t", () => {
  assertBranchEqual("NZ-normal", 0x01, { cycles: 136 });
});

test("BRANCH (unit): A=0xFF -- roll-over, call z taken (entry_2954) + tail, 696 t", () => {
  assertBranchEqual("Z-rollover", 0xff, { cycles: 696 });
});

test("BRANCH-TEETH (cycles): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const entry = captureEntry();
  const good = runBranch(entry, 0x01, optimized_1c33);
  const dropped = runBranch(entry, 0x01, cyclebroken_1c33); // normal arm charges 19 t, not 24 t
  assert.equal(good.cycles, 136, "the correct NZ-normal total is 136 t");
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: correct 136 t vs dropped-charge ${dropped.cycles} t -- caught`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_1c33]]), { scenario: SCENARIOS.attract });

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}` +
      `${r.statePersistent.length ? " (" + r.statePersistent.slice(0, 4).map((s) => "0x" + s.addr.toString(16)).join(",") + ")" : ""}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

test("TEETH (unit): a dropped entry_1da6 tail leaves the sprite buffer stale -- CAUGHT, names 0x694C", () => {
  // Poke MARIO_X and the sprite-buffer slot to DIFFER identically on both sides, so the
  // oracle's tail copy (0x694C := MARIO_X) visibly differs from the twin that skips it.
  const entry = captureEntry();
  const setup = (c) => { c.regs.a = 0x01; c.mem.write8(MARIO_X, 0x5a); c.mem.write8(SPRITE_BUF, 0xa5); };

  const a = entry.clone(); setup(a); translated_1c33(a);
  const b = entry.clone(); setup(b); tailskip_1c33(b);

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.ok(ram != null, "harness FAILED to catch the dropped tail -- it is worthless");
  assert.equal(
    ram.addr,
    SPRITE_BUF,
    `expected first diff at the sprite buffer 0x${SPRITE_BUF.toString(16)}, got 0x${(ram.addr ?? 0).toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (oracle ${ram.a} vs tail-skipped ${ram.b})`);
});
