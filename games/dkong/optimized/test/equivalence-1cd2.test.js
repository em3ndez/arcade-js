// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1cd2 -- the walk/climb MOVE "commit" step (ROM 0x1CD2-0x1CF1,
 * falling into loc_1ceb at 0x1CEB). See optimized/loc_1cd2.js for the full behaviour block.
 * It always adds the signed step B to MARIO_X (0x6203), then branches on BOARD (0x6227):
 *   - ARM 1 -- BOARD != 1: `jp nz,0x1ceb` -- skip the Y clamp, tail-jump to loc_1ceb.
 *   - ARM 2 -- BOARD == 1 (25m): clamp Y against X via entry_2333 (0x2333), store MARIO_Y
 *     (0x6205), then fall through into loc_1ceb.
 * Both arms end in loc_1ceb -> 0x1DA6, run LIVE via m.call.
 *
 * GATE = STRICT whole-machine, MEASURED. loc_1cd2 is ATTRACT-REACHABLE (376 dispatches
 * over 1600 attract frames -- ALL ARM 2, since the demo plays 25m/BOARD==1) and ATOMIC:
 * every one of the 376 dispatches runs mask-cleared inside the vblank NMI (io.nmiMask==0
 * at 376/376) and no NMI pushed-PC ever lands in [0x1cd2,0x1cf2) (0/1594 accepted NMIs).
 * Its collapse preserves each arm's cycle TOTAL exactly and its only writes are WORK RAM
 * (MARIO_X/MARIO_Y, no hardware latch, no raster tear), so it is byte-exact: the STRICT
 * gate passes directly (no convergent gate needed). That gate is timing-sensitive -- a
 * wrong total forks the spin-count PRNG (0x6019) and a later NMI's pushed PC -- so it pins
 * ARM 2's cycle total for free. ARM 1 (BOARD != 1) is NOT reached in 25m attract (0/376)
 * and is proven by an identical-both-sides BOARD poke with explicit cycle teeth.
 *
 * Jobs:
 *   1. STRICT (whole-machine) -- byte-exact EQUAL vs the oracle over 1600 attract frames,
 *      invocation counter proving the override fired (376x).
 *   2. STRICT-TEETH (cycles) -- a twin mischarging ARM 2's post-call fold (17->16 t) shifts
 *      the frame budget -> a later NMI's pushed PC (0x6bf6) -- CAUGHT byte-exact.
 *   3. STRICT-TEETH (branch) -- a twin that always takes ARM 1 (skips the 25m Y clamp)
 *      forks the trajectory (spin-count PRNG 0x6019) -- CAUGHT byte-exact.
 *   4. EQUAL (unit, natural entry) -- optimized loc_1cd2 matches the oracle in RAM + full
 *      register file + pc + SP on the real first dispatch (an ARM-2 climbing state).
 *   5. FULL-BRANCH COVERAGE -- both arms, callees LIVE (their effects covered), EQUAL over
 *      RAM + regs + pc + SP AND oracle==optimized cycle total:
 *        - ARM 2: natural BOARD==1 -> entry_2333 clamp runs.
 *        - ARM 1: BOARD poked to 4 -> clamp skipped.
 *   6. CYCLES (per-arm, absolute) -- callees stubbed to no-ops both sides, loc_1cd2's OWN
 *      charge is EXACTLY ARM 1 = 55 t (45 prologue + 10 jp-taken) and ARM 2 = 108 t
 *      (91 pre-call + 17 post-call). Pins each arm's collapsed total absolutely, incl.
 *      ARM 1 which the whole-machine run never reaches.
 *   7. CYCLE-TEETH (unit) -- a twin dropping ARM 2's post-call charge yields a wrong total,
 *      CAUGHT.
 *   8. TEETH (RAM) -- a twin storing a WRONG MARIO_X (persistent work RAM, survives the tail
 *      chain) is CAUGHT as a state diff at 0x6203. (Chosen over an exit-A teeth: the tail
 *      chain overwrites A, so an A-only teeth washes out at the natural exit -- the doc-06
 *      masking wrinkle.)
 *   9. TEETH (register file) -- with the callees STUBBED (so loc_1cd2's own exit A survives),
 *      a twin corrupting the exit A is CAUGHT as a register diff, proving the unit gate
 *      compares the whole register file.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1cd2 as translated_1cd2 } from "../../translated/state0.js";
import { loc_1cd2 as optimized_1cd2 } from "../loc_1cd2.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { MARIO_X, MARIO_Y, BOARD } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1cd2;
const FRAMES_WHOLE = 1600; // 376 invocations (all ARM 2)
const FRAMES_UNIT = 900; // the unit host must run past the first dispatch to capture it

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC, collapse preserves totals) --

test("STRICT (whole-machine): loc_1cd2 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1cd2]]));
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

test("STRICT-TEETH (cycles): a wrong ARM-2 post-call charge forks the trajectory and is CAUGHT", () => {
  // Charging ARM 2's post-call fold 16 t instead of 17 t shifts the frame's cycle budget ->
  // where a later NMI's pushed PC lands -> the byte-exact trace diverges (stack region).
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.hl = MARIO_X; regs.a = mem.read8(regs.hl); regs.add(regs.b); mem.write8(regs.hl, regs.a);
    regs.a = mem.read8(BOARD); regs.a = regs.dec8(regs.a);
    if (regs.fNZ) { m.step(0x1ceb, 55); return m.call(0x1ceb); }
    regs.h = mem.read8(regs.hl); regs.a = mem.read8(MARIO_Y); regs.l = regs.a;
    m.push16(0x1ce7); m.step(0x2333, 91); m.call(0x2333);
    regs.a = regs.l; mem.write8(MARIO_Y, regs.a);
    m.step(0x1ceb, 16); return m.call(0x1ceb); // DROPPED: the correct post-call total is 17 t
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH/cycles: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

test("STRICT-TEETH (branch): a twin that always skips the 25m clamp forks the trajectory and is CAUGHT", () => {
  // Taking ARM 1 unconditionally skips entry_2333 on BOARD==1 (attract's board), so the
  // clamp never runs and both the cycle path and Mario's Y drift -- CAUGHT byte-exact.
  const skipClamp = (m) => {
    const { regs, mem } = m;
    regs.hl = MARIO_X; regs.a = mem.read8(regs.hl); regs.add(regs.b); mem.write8(regs.hl, regs.a);
    regs.a = mem.read8(BOARD); regs.a = regs.dec8(regs.a);
    m.step(0x1ceb, 55); return m.call(0x1ceb); // BUG: always ARM 1 (no clamp)
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, skipClamp]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong branch decision -- it is worthless");
  console.log(`  STRICT-TEETH/branch: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant loc_1cd2 is first entered (via m.call, deep in
 *  the entry_1ac3 movement cascade). The snapshot override is wired at CONSTRUCTION so it
 *  fires however the routine is reached, then delegates to the oracle so the host proceeds
 *  normally. The captured entry has a LIVE stack (the tail chain's ret/jp lands on a valid
 *  address) and is a natural ARM-2 state (BOARD==1, Mario climbing on 25m). */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1cd2(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

const NOOP = () => {}; // stub for a tail callee, to isolate loc_1cd2's own cycle/register contribution

/** Clone ENTRY, apply identical-both-sides pokes, optionally stub the callees (0x2333 clamp
 *  and 0x1ceb tail) to no-ops so ONLY loc_1cd2's own effect is measured, run `fn`, and
 *  report the routine's full contract relative to the crafted entry. */
function runBranch(pokes, fn, { stubCallees = false } = {}) {
  const c = ENTRY.clone();
  for (const [a, v] of pokes) c.mem.write8(a, v);
  if (stubCallees) { c.routines.set(0x2333, NOOP); c.routines.set(0x1ceb, NOOP); }
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

test("EQUAL (unit): idiomatic loc_1cd2 matches translated in RAM + full register file + pc + SP", () => {
  // Natural entry (no poke) -- the real ARM-2 climbing state; entry_2333 + loc_1ceb run live.
  const o = runBranch([], translated_1cd2);
  const p = runBranch([], optimized_1cd2);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  assert.equal(firstRegDiff(o.machine.regs, p.machine.regs), null, "registers must match");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.sp, p.sp, "SP must match");
  console.log("  EQUAL/unit: RAM + full register file (incl. A, F, SP) + pc identical (natural ARM-2 entry)");
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides BOARD pokes: both arms) ------

/** Prove one arm EQUAL (RAM + full register file + pc + SP) with the callees running LIVE
 *  (so their effects are covered), AND pin its cycle total oracle==optimized. */
function assertArmEqual(label, pokes) {
  const o = runBranch(pokes, translated_1cd2);
  const p = runBranch(pokes, optimized_1cd2);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, `${label}: pc must match`);
  assert.equal(o.sp, p.sp, `${label}: SP must match`);
  assert.equal(o.cycles, p.cycles, `${label}: cycle total mismatch (oracle ${o.cycles} t vs optimized ${p.cycles} t)`);
  console.log(`  BRANCH/${label}: EQUAL -- ${p.cycles} t, pc=0x${p.pc.toString(16)}, sp=0x${p.sp.toString(16)}`);
}

test("BRANCH: ARM 2 -- BOARD==1 (natural 25m) -> entry_2333 clamp runs", () => {
  assertArmEqual("armB-clamp", []); // no poke -- the natural BOARD==1 state
});

test("BRANCH: ARM 1 -- BOARD!=1 (poked to 4) -> clamp skipped, straight to loc_1ceb", () => {
  assertArmEqual("armA-skip", [[BOARD, 0x04]]);
});

// -- CYCLES (per-arm, absolute -- callees stubbed to isolate loc_1cd2's own charge) ----

test("CYCLES: each arm's OWN charge is exactly 55 (ARM 1) / 108 (ARM 2) t", () => {
  // Stub 0x2333 and 0x1ceb to no-ops on BOTH sides so ONLY loc_1cd2's own body is measured,
  // isolating the collapsed per-arm totals -- including ARM 1 (unreached in the whole-machine
  // run) -- absolutely and state-independently.
  const A1 = runBranch([[BOARD, 0x04]], translated_1cd2, { stubCallees: true });
  const A1o = runBranch([[BOARD, 0x04]], optimized_1cd2, { stubCallees: true });
  assert.equal(A1.cycles, 55, "oracle ARM 1 must be 55 t (45 prologue + 10 jp-taken)");
  assert.equal(A1o.cycles, 55, "optimized ARM 1 must be 55 t");
  assert.equal(A1.pc, 0x1ceb, "ARM 1 must end at the jp target 0x1ceb");
  assert.equal(A1o.pc, 0x1ceb, "optimized ARM 1 must end at 0x1ceb");

  const A2 = runBranch([], translated_1cd2, { stubCallees: true });
  const A2o = runBranch([], optimized_1cd2, { stubCallees: true });
  assert.equal(A2.cycles, 108, "oracle ARM 2 must be 108 t (91 pre-call + 17 post-call)");
  assert.equal(A2o.cycles, 108, "optimized ARM 2 must be 108 t");
  assert.equal(A2.pc, 0x1ceb, "ARM 2 must fall through to 0x1ceb");
  assert.equal(A2o.pc, 0x1ceb, "optimized ARM 2 must fall through to 0x1ceb");
  console.log(`  CYCLES: ARM 1 ${A1o.cycles} t (==55), ARM 2 ${A2o.cycles} t (==108) -- all == oracle`);
});

// -- TEETH -------------------------------------------------------------------

test("CYCLE-TEETH: dropping ARM 2's post-call charge yields a wrong total and is CAUGHT", () => {
  const good = runBranch([], optimized_1cd2, { stubCallees: true });
  const dropped = runBranch([], (m) => {
    const { regs, mem } = m;
    regs.hl = MARIO_X; regs.a = mem.read8(regs.hl); regs.add(regs.b); mem.write8(regs.hl, regs.a);
    regs.a = mem.read8(BOARD); regs.a = regs.dec8(regs.a);
    if (regs.fNZ) { m.step(0x1ceb, 55); return m.call(0x1ceb); }
    regs.h = mem.read8(regs.hl); regs.a = mem.read8(MARIO_Y); regs.l = regs.a;
    m.push16(0x1ce7); m.step(0x2333, 91); m.call(0x2333);
    regs.a = regs.l; mem.write8(MARIO_Y, regs.a);
    m.step(0x1ceb, 0); return m.call(0x1ceb); // DROPPED: the correct post-call charge is 17
  }, { stubCallees: true });
  assert.equal(good.cycles, 108, "the correct ARM-2 total is 108 t");
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  CYCLE-TEETH: correct 108 t vs dropped-charge ${dropped.cycles} t -- caught`);
});

test("TEETH (RAM): a twin that stores a WRONG MARIO_X is CAUGHT (persistent, survives the tail chain)", () => {
  // The X store at 0x6203 is persistent work RAM the tail chain does not overwrite, so a
  // corrupted store diverges observably at the natural exit (unlike the exit A, which washes
  // out downstream -- see the next test for how the register file is still gated).
  const wrongX = (m) => {
    const { regs, mem } = m;
    regs.hl = MARIO_X; regs.a = mem.read8(regs.hl); regs.add(regs.b);
    mem.write8(regs.hl, (regs.a ^ 0xff) & 0xff); // BUG: store the wrong X
    regs.a = mem.read8(BOARD); regs.a = regs.dec8(regs.a);
    if (regs.fNZ) { m.step(0x1ceb, 55); return m.call(0x1ceb); }
    regs.h = mem.read8(regs.hl); regs.a = mem.read8(MARIO_Y); regs.l = regs.a;
    m.push16(0x1ce7); m.step(0x2333, 91); m.call(0x2333);
    regs.a = regs.l; mem.write8(MARIO_Y, regs.a);
    m.step(0x1ceb, 17); return m.call(0x1ceb);
  };
  const o = runBranch([], translated_1cd2);
  const b = runBranch([], wrongX);
  const ram = firstStateDiff(o.machine.dumpState(), b.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.ok(ram != null, "harness FAILED to catch a wrong MARIO_X store");
  assert.equal(ram.addr, MARIO_X, `expected the diff at MARIO_X (0x6203), got 0x${(ram.addr ?? 0).toString(16)}`);
  console.log(`  TEETH/RAM: caught at 0x${ram.addr.toString(16)} (oracle 0x${o.machine.mem.read8(MARIO_X).toString(16)} vs broken 0x${b.machine.mem.read8(MARIO_X).toString(16)})`);
});

test("TEETH (register file): a twin corrupting the exit A (callees stubbed) is CAUGHT", () => {
  // With the tail callees stubbed, loc_1cd2's own exit A survives to the register file, so
  // a corrupted A is caught -- proving the unit gate compares the whole register file.
  const corruptExitA = (m) => {
    const { regs, mem } = m;
    regs.hl = MARIO_X; regs.a = mem.read8(regs.hl); regs.add(regs.b); mem.write8(regs.hl, regs.a);
    regs.a = mem.read8(BOARD); regs.a = regs.dec8(regs.a);
    if (regs.fNZ) { m.step(0x1ceb, 55); return m.call(0x1ceb); }
    regs.h = mem.read8(regs.hl); regs.a = mem.read8(MARIO_Y); regs.l = regs.a;
    m.push16(0x1ce7); m.step(0x2333, 91); m.call(0x2333);
    regs.a = regs.l; mem.write8(MARIO_Y, regs.a);
    regs.a ^= 0xff; // BUG: corrupt the exit A
    m.step(0x1ceb, 17); return m.call(0x1ceb);
  };
  const o = runBranch([], translated_1cd2, { stubCallees: true });
  const b = runBranch([], corruptExitA, { stubCallees: true });
  const regs = firstRegDiff(o.machine.regs, b.machine.regs);
  assert.ok(regs != null, "harness FAILED to catch a corrupted exit register");
  assert.equal(regs.reg, "a", `expected the diff at A, got ${regs.reg}`);
  console.log(`  TEETH/regfile: caught at ${regs.reg} (oracle 0x${o.machine.regs.a.toString(16)} vs broken 0x${b.machine.regs.a.toString(16)})`);
});
