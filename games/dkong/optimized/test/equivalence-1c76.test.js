// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_1c76 -- the airborne handler's LANDED-CHECK (ROM 0x1C76-0x1C8E,
 * tail-jumping to entry_1da6 at 0x1DA6). See optimized/entry_1c76.js for the full behaviour
 * block. It computes A = MARIO_Y(0x6205) - 0x0F, compares it against MARIO_AIR_START_Y(0x620E),
 * and branches on the carry:
 *   - ARM C  (carry set)  -- short fall within the 15px grace: NOT fatal, writes NO memory,
 *     tail-jumps to entry_1da6. This is the ONLY arm attract reaches.
 *   - ARM NC (no carry)   -- the fall reached/passed take-off height: FATAL. Sets
 *     MARIO_FATAL_FALL(0x6220)=1 and SND_TRIGGER[4](0x6084)=3, then tail-jumps to entry_1da6.
 * Both arms end in entry_1da6 (the sprite-record copy), run LIVE via m.call.
 *
 * GATE = STRICT whole-machine, MEASURED. entry_1c76 is ATTRACT-REACHABLE (83 dispatches over
 * 1600 attract frames -- ALL ARM C, since the demo never fatally falls) and ATOMIC: every one
 * of the 83 dispatches runs mask-cleared inside the vblank NMI (io.nmiMask==0 at 83/83) and no
 * NMI pushed-PC ever lands in [0x1c76,0x1c8f) (0/~1994 accepted NMIs). Its collapse preserves
 * each arm's cycle TOTAL exactly; ARM C writes no memory and ARM NC only WORK RAM (0x6220 /
 * 0x6084 -- neither is a hardware latch, no raster tear), so it is byte-exact: the STRICT gate
 * passes directly (no convergent gate needed). That gate is timing-sensitive -- a wrong total
 * forks the spin-count PRNG (0x6019) and a later NMI's pushed PC -- so it pins ARM C's total
 * for free. ARM NC (the FATAL fall) is NOT reached in attract (0/83) and is proven by an
 * identical-both-sides poke of MARIO_AIR_START_Y (forcing no-carry) with explicit cycle teeth.
 *
 * Jobs:
 *   1. ATOMICITY (measured) -- every dispatch mask-cleared, 0 NMI landings inside the span;
 *      reports the dispatch count + arm split (this is what LICENSES the STRICT gate).
 *   2. STRICT (whole-machine) -- byte-exact EQUAL vs the oracle over 1600 attract frames, with
 *      an invocation counter proving the override fired (83x).
 *   3. STRICT-TEETH (cycles) -- a twin mischarging ARM C (47->42 t) shifts the frame budget ->
 *      the spin-count PRNG / a later NMI's pushed PC -- CAUGHT byte-exact.
 *   4. STRICT-TEETH (branch) -- a twin that always takes ARM NC (marks a non-fatal fall fatal)
 *      forks the trajectory (0x6220 + spin-count PRNG) -- CAUGHT byte-exact.
 *   5. EQUAL (unit, natural entry) -- optimized entry_1c76 matches the oracle in RAM + full
 *      register file + pc + SP on the real first dispatch (an ARM-C short-fall state).
 *   6. FULL-BRANCH COVERAGE -- both arms, callee LIVE, EQUAL over RAM + regs + pc + SP AND
 *      oracle==optimized cycle total:
 *        - ARM C:  natural short fall -> entry_1da6.
 *        - ARM NC: MARIO_AIR_START_Y poked to 0 -> fatal path -> entry_1da6.
 *   7. CYCLES (per-arm, absolute) -- callee stubbed to a no-op both sides, entry_1c76's OWN
 *      charge is EXACTLY ARM C = 47 t and ARM NC = 97 t, each ending at 0x1DA6. Pins each
 *      collapsed total absolutely, incl. ARM NC which the whole-machine run never reaches.
 *   8. CYCLE-TEETH (unit) -- a twin dropping ARM NC's charge yields a wrong total, CAUGHT.
 *   9. TEETH (RAM) -- a twin storing a WRONG MARIO_FATAL_FALL (persistent work RAM, survives
 *      the tail chain) on ARM NC is CAUGHT as a state diff at 0x6220.
 *  10. TEETH (register file) -- with the tail callee STUBBED (so entry_1c76's own exit A
 *      survives), a twin corrupting the ARM-C exit A is CAUGHT as a register diff, proving the
 *      unit gate compares the whole register file. (The natural exit washes A out via the tail
 *      chain -- the doc-06 masking wrinkle -- so the RAM teeth target persistent RAM and the
 *      register teeth stub the callee.)
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_1c76 as translated_1c76 } from "../../translated/state0.js";
import { entry_1c76 as optimized_1c76 } from "../entry_1c76.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { MARIO_Y, MARIO_AIR_START_Y, MARIO_FATAL_FALL, SND_TRIGGER } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1c76;
const RANGE = [0x1c76, 0x1c8f]; // [lo, hi) the routine's own ROM span, for NMI-landing checks
const FRAMES_WHOLE = 1600; // 83 invocations (all ARM C)
const FRAMES_UNIT = 900; // the unit host must run past the first dispatch (~f607)
const SND_FALL = SND_TRIGGER + 4; // 0x6084 -- the landing/thud sound trigger (work RAM)

// -- ATOMICITY (measured -- this is what licenses the STRICT gate) -------------

test("ATOMICITY: every entry_1c76 dispatch runs mask-cleared and no NMI lands inside it", () => {
  // Snapshot override records io.nmiMask at each entry (and which arm the fall-height compare
  // takes), then delegates to the oracle so the game proceeds. fireNmi is wrapped to record
  // every pushed PC and flag any that lands in the routine's own ROM span (a mid-routine NMI).
  const masks = [];
  const arm = { C: 0, NC: 0 };
  const snap = new Map([[TARGET, (mm) => {
    masks.push(mm.io.nmiMask);
    const a1 = (mm.mem.read8(MARIO_Y) - 0x0f) & 0xff; // sub 0x0f
    if (a1 - mm.mem.read8(MARIO_AIR_START_Y) < 0) arm.C++; else arm.NC++; // cp -> carry?
    return translated_1c76(mm);
  }]]);
  const m = new Machine(ROM, { overrides: snap });
  const pushedInRange = [];
  let nmis = 0;
  const origFireNmi = m.fireNmi.bind(m);
  m.fireNmi = function () {
    nmis++;
    if (this.pcKnown && this.pc >= RANGE[0] && this.pc < RANGE[1]) pushedInRange.push(this.pc);
    return origFireNmi();
  };
  m.runFrames(FRAMES_WHOLE);

  assert.ok(masks.length >= 1, "entry_1c76 was never dispatched -- widen the window");
  assert.ok(masks.every((v) => v === 0), `io.nmiMask must be 0 at every dispatch (saw ${[...new Set(masks)]})`);
  assert.equal(pushedInRange.length, 0, `an NMI pushed a PC inside [0x1c76,0x1c8f): ${pushedInRange.map((p) => "0x" + p.toString(16))}`);
  console.log(`  ATOMICITY: ${masks.length} dispatches (arm C ${arm.C}, arm NC ${arm.NC}), all mask-cleared; 0/${nmis} NMIs landed inside -> STRICT licensed`);
});

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed entry_1c76 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1c76]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic, collapse total-preserving)`);
});

test("STRICT-TEETH (cycles): a wrong ARM-C total forks the trajectory and is CAUGHT", () => {
  // Shorting ARM C by 5 t (47 -> 42) shifts the frame's cycle budget -> the spin count 0x6019
  // (PRNG entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(MARIO_Y); regs.hl = MARIO_AIR_START_Y; regs.sub(0x0f); regs.cp(mem.read8(regs.hl));
    if (regs.fC) { m.step(0x1da6, 42); return m.call(0x1da6); } // 47 -> 42
    regs.a = 0x01; mem.write8(MARIO_FATAL_FALL, regs.a); regs.hl = SND_FALL; mem.write8(regs.hl, 0x03);
    m.step(0x1da6, 97); return m.call(0x1da6);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH/cycles: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

test("STRICT-TEETH (branch): a twin that marks every fall fatal forks the trajectory and is CAUGHT", () => {
  // Dropping the `jp c` early-out takes the FATAL arm even on attract's short falls, so
  // MARIO_FATAL_FALL is wrongly set (and the cycle path lengthens) -- CAUGHT byte-exact.
  const alwaysFatal = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(MARIO_Y); regs.hl = MARIO_AIR_START_Y; regs.sub(0x0f); regs.cp(mem.read8(regs.hl));
    // BUG: no `if (regs.fC) return ...` -- always fall through to the fatal path.
    regs.a = 0x01; mem.write8(MARIO_FATAL_FALL, regs.a); regs.hl = SND_FALL; mem.write8(regs.hl, 0x03);
    m.step(0x1da6, 97); return m.call(0x1da6);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, alwaysFatal]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong branch decision -- it is worthless");
  console.log(`  STRICT-TEETH/branch: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant entry_1c76 is first entered (via m.call, deep in
 *  the entry_1ac3 airborne cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle so the host proceeds normally.
 *  The captured entry has a LIVE stack (the tail chain's ret lands on a valid address) and is a
 *  natural ARM-C state (a short, non-fatal fall). */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1c76(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

const NOOP = () => {}; // stub for the tail callee, to isolate entry_1c76's own cycle/register contribution

/** Clone ENTRY, apply identical-both-sides pokes, optionally stub the tail callee (0x1da6) to a
 *  no-op so ONLY entry_1c76's own effect is measured, run `fn`, and report the routine's full
 *  contract relative to the crafted entry. */
function runBranch(pokes, fn, { stubCallee = false } = {}) {
  const c = ENTRY.clone();
  for (const [a, v] of pokes) c.mem.write8(a, v);
  if (stubCallee) c.routines.set(0x1da6, NOOP);
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

test("EQUAL (unit): idiomatic entry_1c76 matches translated in RAM + full register file + pc + SP", () => {
  // Natural entry (no poke) -- the real ARM-C short-fall state; entry_1da6 runs live.
  const o = runBranch([], translated_1c76);
  const p = runBranch([], optimized_1c76);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  assert.equal(firstRegDiff(o.machine.regs, p.machine.regs), null, "registers must match");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.sp, p.sp, "SP must match");
  console.log("  EQUAL/unit: RAM + full register file (incl. A, F, SP) + pc identical (natural ARM-C entry)");
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides pokes: both arms) ------

/** Prove one arm EQUAL (RAM + full register file + pc + SP) with the tail callee running LIVE
 *  (so its effect is covered), AND pin its cycle total oracle==optimized. */
function assertArmEqual(label, pokes) {
  const o = runBranch(pokes, translated_1c76);
  const p = runBranch(pokes, optimized_1c76);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, `${label}: pc must match`);
  assert.equal(o.sp, p.sp, `${label}: SP must match`);
  assert.equal(o.cycles, p.cycles, `${label}: cycle total mismatch (oracle ${o.cycles} t vs optimized ${p.cycles} t)`);
  console.log(`  BRANCH/${label}: EQUAL -- ${p.cycles} t, pc=0x${p.pc.toString(16)}, sp=0x${p.sp.toString(16)}`);
}

test("BRANCH: ARM C -- natural short fall (carry) -> not fatal, straight to entry_1da6", () => {
  assertArmEqual("armC-short", []); // no poke -- the natural carry-set state
});

test("BRANCH: ARM NC -- MARIO_AIR_START_Y poked to 0 (no carry) -> fatal path -> entry_1da6", () => {
  assertArmEqual("armNC-fatal", [[MARIO_AIR_START_Y, 0x00]]);
});

// -- CYCLES (per-arm, absolute -- callee stubbed to isolate entry_1c76's own charge) ----

test("CYCLES: each arm's OWN charge is exactly 47 (ARM C) / 97 (ARM NC) t", () => {
  // Stub 0x1da6 to a no-op on BOTH sides so ONLY entry_1c76's own body is measured, isolating
  // the collapsed per-arm totals -- including ARM NC (unreached in the whole-machine run) --
  // absolutely and state-independently.
  const C = runBranch([], translated_1c76, { stubCallee: true });
  const Co = runBranch([], optimized_1c76, { stubCallee: true });
  assert.equal(C.cycles, 47, "oracle ARM C must be 47 t (37 prologue + 10 jp-c-taken)");
  assert.equal(Co.cycles, 47, "optimized ARM C must be 47 t");
  assert.equal(C.pc, 0x1da6, "ARM C must end at the jp target 0x1da6");
  assert.equal(Co.pc, 0x1da6, "optimized ARM C must end at 0x1da6");

  const NC = runBranch([[MARIO_AIR_START_Y, 0x00]], translated_1c76, { stubCallee: true });
  const NCo = runBranch([[MARIO_AIR_START_Y, 0x00]], optimized_1c76, { stubCallee: true });
  assert.equal(NC.cycles, 97, "oracle ARM NC must be 97 t (37 prologue + 10 jp-c-not-taken + 50 body)");
  assert.equal(NCo.cycles, 97, "optimized ARM NC must be 97 t");
  assert.equal(NC.pc, 0x1da6, "ARM NC must end at the jp target 0x1da6");
  assert.equal(NCo.pc, 0x1da6, "optimized ARM NC must end at 0x1da6");
  console.log(`  CYCLES: ARM C ${Co.cycles} t (==47), ARM NC ${NCo.cycles} t (==97) -- all == oracle`);
});

// -- TEETH -------------------------------------------------------------------

test("CYCLE-TEETH: dropping ARM NC's charge yields a wrong total and is CAUGHT", () => {
  const good = runBranch([[MARIO_AIR_START_Y, 0x00]], optimized_1c76, { stubCallee: true });
  const dropped = runBranch([[MARIO_AIR_START_Y, 0x00]], (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(MARIO_Y); regs.hl = MARIO_AIR_START_Y; regs.sub(0x0f); regs.cp(mem.read8(regs.hl));
    if (regs.fC) { m.step(0x1da6, 47); return m.call(0x1da6); }
    regs.a = 0x01; mem.write8(MARIO_FATAL_FALL, regs.a); regs.hl = SND_FALL; mem.write8(regs.hl, 0x03);
    m.step(0x1da6, 92); return m.call(0x1da6); // DROPPED: the correct ARM-NC total is 97 t
  }, { stubCallee: true });
  assert.equal(good.cycles, 97, "the correct ARM-NC total is 97 t");
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  CYCLE-TEETH: correct 97 t vs dropped-charge ${dropped.cycles} t -- caught`);
});

test("TEETH (RAM): a twin that stores a WRONG MARIO_FATAL_FALL is CAUGHT (persistent, survives the tail chain)", () => {
  // The fatal-flag store at 0x6220 is persistent work RAM the tail chain (entry_1da6) does not
  // overwrite, so a corrupted store diverges observably at the natural exit (unlike the exit A,
  // which washes out downstream -- see the next test for how the register file is still gated).
  const wrongFatal = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(MARIO_Y); regs.hl = MARIO_AIR_START_Y; regs.sub(0x0f); regs.cp(mem.read8(regs.hl));
    if (regs.fC) { m.step(0x1da6, 47); return m.call(0x1da6); }
    regs.a = 0x01; mem.write8(MARIO_FATAL_FALL, 0x02); // BUG: store 0x02, not 0x01
    regs.hl = SND_FALL; mem.write8(regs.hl, 0x03);
    m.step(0x1da6, 97); return m.call(0x1da6);
  };
  const o = runBranch([[MARIO_AIR_START_Y, 0x00]], translated_1c76);
  const b = runBranch([[MARIO_AIR_START_Y, 0x00]], wrongFatal);
  const ram = firstStateDiff(o.machine.dumpState(), b.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.ok(ram != null, "harness FAILED to catch a wrong MARIO_FATAL_FALL store");
  assert.equal(ram.addr, MARIO_FATAL_FALL, `expected the diff at MARIO_FATAL_FALL (0x6220), got 0x${(ram.addr ?? 0).toString(16)}`);
  console.log(`  TEETH/RAM: caught at 0x${ram.addr.toString(16)} (oracle 0x${o.machine.mem.read8(MARIO_FATAL_FALL).toString(16)} vs broken 0x${b.machine.mem.read8(MARIO_FATAL_FALL).toString(16)})`);
});

test("TEETH (register file): a twin corrupting the ARM-C exit A (callee stubbed) is CAUGHT", () => {
  // With the tail callee stubbed, entry_1c76's own exit A (= MARIO_Y-0x0F on ARM C) survives to
  // the register file, so a corrupted A is caught -- proving the unit gate compares the whole
  // register file.
  const corruptExitA = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(MARIO_Y); regs.hl = MARIO_AIR_START_Y; regs.sub(0x0f); regs.cp(mem.read8(regs.hl));
    regs.a ^= 0xff; // BUG: corrupt the exit A before the ARM-C handoff
    if (regs.fC) { m.step(0x1da6, 47); return m.call(0x1da6); }
    regs.a = 0x01; mem.write8(MARIO_FATAL_FALL, regs.a); regs.hl = SND_FALL; mem.write8(regs.hl, 0x03);
    m.step(0x1da6, 97); return m.call(0x1da6);
  };
  const o = runBranch([], translated_1c76, { stubCallee: true });
  const b = runBranch([], corruptExitA, { stubCallee: true });
  const regs = firstRegDiff(o.machine.regs, b.machine.regs);
  assert.ok(regs != null, "harness FAILED to catch a corrupted exit register");
  assert.equal(regs.reg, "a", `expected the diff at A, got ${regs.reg}`);
  console.log(`  TEETH/regfile: caught at ${regs.reg} (oracle 0x${o.machine.regs.a.toString(16)} vs broken 0x${b.machine.regs.a.toString(16)})`);
});
