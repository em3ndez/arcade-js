// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_202f (ROM 0x202F) — the low-X arm of the object loop's fall setup:
 * stamp the leftward per-frame horizontal step (+0x10:+0x11 of the object record) and continue
 * into the still-frozen tail at ROM 0x2038.
 *
 * WHAT THIS GATE ACTUALLY COVERS, stated before the assertions rather than implied by them:
 *
 *   - REAL CAPTURES, ALL OF THEM. A 2500-frame attract run dispatches 0x202F exactly 11 times.
 *     All 11 are captured and all 11 are replayed — there is no sampling here, so no sampling
 *     policy to defend. They span 7 distinct record bases (0x6700, 0x6720, 0x6740, 0x6760,
 *     0x6780, 0x67A0, 0x67C0), and the test asserts that spread rather than assuming it.
 *   - CRAFTED. The captures present a narrow input shape: the accumulator is 26 on every one of
 *     them and the record's +0x11 byte is 0 on every one of them. The crafted arm re-seeds those
 *     three inputs (+0x10, +0x11 and the accumulator) with 27 combinations attract never shows, on
 *     two different captured record bases — on a SYNTHETIC STACK (SP reset to the top of work RAM
 *     with one plausible caller return pushed: 0x1986, the continuation loc_197a pushes for the
 *     object loop). The stack has to be stocked because the frozen chain below returns through it,
 *     and an empty one dies with an unmapped read at 0x6c00.
 *   - HOW MUCH RUNS PER CASE. loc_202f tail-jumps rather than returning, so every case here runs
 *     the WHOLE frozen chain below it — the record tail at 0x2038, the sprite copy at 0x21BA, and
 *     the rest of that frame's ten-slot object loop — on both sides before anything is compared.
 *     The comparison is therefore of the loop's finished work, not of two stores.
 *   - WHAT IS COMPARED. RAM minus STACK_SCRATCH (the memory-equivalence contract), plus the
 *     forwarded return value. NOT pc and NOT SP: cycle-free code cannot preserve them.
 *   - LIVE-WIRED, as well as replayed. The last test wires the rewrite into a real 1500-frame
 *     attract run and diffs every frame against the all-oracle baseline on the same contract.
 *     1500 because attract's first dispatch of this address is at frame 1163 — a shorter run
 *     compares two traces in which the routine never ran, so the test asserts the dispatch count
 *     rather than trusting the frame budget. The oracle's 42-cycle charge is restored inside the
 *     wiring; without it the run forks on the spin counter around frame 1169 for reasons that
 *     have nothing to do with this routine.
 *   - WHAT IS NOT COVERED. Attract only, and attract is 25m only. That is not a hole in this
 *     particular gate: the loop at ROM 0x1F72 returns immediately unless BOARD is 1, so 0x202F
 *     cannot run on boards 2-4 at all.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-202f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_202f as oracle } from "../../translated/loc_202f.js";
import { loc_202f } from "../loc_202f.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x202f;
const ATTRACT_FRAMES = 2500;
const RET_ADDR = 0x1986; // the continuation loc_197a pushes for the object loop — a real caller return

// Record fields this arm and its frozen tail touch.
const STEP_HI = 0x10; // per-frame horizontal step, high byte
const STEP_LO = 0x11; // per-frame horizontal step, low byte

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const hb = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

// First RAM byte that differs between two machines, skipping the dead STACK_SCRATCH region
// (the memory-equivalence contract is RAM − STACK_SCRATCH). Returns { addr, a, b } | null.
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

// Every real dispatch of 0x202F in an attract run, cloned at the instant of entry. The hook
// delegates to the oracle so the run itself is unperturbed and later dispatches stay real.
let CAPTURES = null;
function captures() {
  if (CAPTURES === null) {
    const caught = [];
    const host = new Machine(ROM, {
      overrides: new Map([[TARGET, (mm) => { caught.push(mm.clone()); return oracle(mm); }]]),
    });
    host.runFrames(ATTRACT_FRAMES);
    CAPTURES = caught;
  }
  return CAPTURES;
}

// Run the oracle and a candidate on two FRESH, byte-identical clones of one entry state, and
// report the first RAM difference plus both return values. The whole frozen chain below 0x202F
// runs on each side.
function runPair(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  const retA = oracle(a);
  const retB = candidate(b);
  return { ram: firstRamDiff(a, b), retA, retB, after: b };
}

// Replay a list of entry states; return the first case that diverges (RAM or return), or null.
function sweep(entries, candidate) {
  for (const [i, e] of entries.entries()) {
    const { ram, retA, retB } = runPair(e, candidate);
    if (ram) return { i, ram };
    if (retA !== retB) return { i, ret: [retA, retB] };
  }
  return null;
}

const describe = (mm) =>
  mm &&
  (mm.ram
    ? `case ${mm.i}: RAM diverges at ${hx(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`
    : `case ${mm.i}: return value diverges (${mm.ret[0]} vs ${mm.ret[1]})`);

// A crafted entry: a real captured machine with a synthetic stack (one plausible caller return
// at the top of work RAM) and the three input bytes attract barely varies re-seeded.
function crafted(base, { stepHi, stepLo, acc }) {
  const e = base.clone();
  e.regs.sp = 0x6c00;
  e.push16(RET_ADDR); // the frozen tail below rets; an empty stack reads unmapped at 0x6c00
  e.mem.write8(e.regs.ix + STEP_HI, stepHi);
  e.mem.write8(e.regs.ix + STEP_LO, stepLo);
  e.regs.a = acc;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

const SEED_HI = [0x00, 0xff, 0x5a];
const SEED_LO = [0x00, 0xa0, 0x3c];
const SEED_ACC = [0x00, 0x1a, 0xff];

function craftedEntries(bases) {
  const out = [];
  for (const base of bases)
    for (const stepHi of SEED_HI)
      for (const stepLo of SEED_LO)
        for (const acc of SEED_ACC) out.push(crafted(base, { stepHi, stepLo, acc }));
  return out;
}

// -- 0. reachability / capture shape ------------------------------------------

test("REACHABILITY: 0x202F is dispatched in attract, across several record bases", () => {
  const caps = captures();
  assert.ok(caps.length > 0, "no real dispatch of 0x202F was captured — the capture suite would be vacuous");

  const bases = [...new Set(caps.map((c) => c.regs.ix))].sort((x, y) => x - y);
  assert.ok(bases.length >= 7, `expected the attract run to present at least 7 record bases, saw ${bases.length}`);

  // The narrowness the crafted arm exists to widen, asserted rather than asserted-about.
  assert.ok(caps.every((c) => c.regs.a === 0x1a), "attract presents exactly one accumulator value here");
  assert.ok(
    caps.every((c) => c.mem.read8(c.regs.ix + STEP_LO) === 0x00),
    "attract presents exactly one prior value for the step's low byte",
  );

  console.log(
    `  REACHABILITY: ${caps.length} dispatches in ${ATTRACT_FRAMES} attract frames; ` +
      `record bases ${bases.map(hx).join(", ")}`,
  );
});

// -- 1. EQUAL on every real dispatch ------------------------------------------

test("EQUAL (all real captures): loc_202f == oracle over RAM − STACK_SCRATCH + return value", () => {
  const caps = captures();
  const bad = sweep(caps, loc_202f);
  assert.equal(bad, null, describe(bad));

  // Non-vacuity: the routine must actually have written the two step bytes on a real entry.
  const e = caps[0];
  const { after } = runPair(e, loc_202f);
  assert.equal(after.mem.read8(e.regs.ix + STEP_HI), 0xff, "the step's high byte must be stamped");
  assert.equal(after.mem.read8(e.regs.ix + STEP_LO), 0xa0, "the step's low byte must be stamped");

  console.log(`  EQUAL/captures: ${caps.length} of ${caps.length} real dispatches replayed — RAM identical`);
});

// -- 2. EQUAL on crafted entries ----------------------------------------------

test("EQUAL (crafted): loc_202f == oracle over seeded step bytes and accumulator", () => {
  const caps = captures();
  const bases = [caps[0], caps[caps.length - 1]];
  const entries = craftedEntries(bases);
  assert.equal(entries.length, bases.length * SEED_HI.length * SEED_LO.length * SEED_ACC.length);

  const bad = sweep(entries, loc_202f);
  assert.equal(bad, null, describe(bad));

  console.log(
    `  EQUAL/crafted: ${entries.length} seeded entries on ${bases.length} record bases ` +
      `(${bases.map((b) => hx(b.regs.ix)).join(", ")}) — RAM identical`,
  );
});

// -- 3. TEETH ------------------------------------------------------------------

// The real routine with exactly one correct behaviour removed, so each twin is a faithful
// re-implementation minus one thing this gate claims to pin.
function brokenLoc202f(m, bug) {
  const { regs, mem8 } = m;
  const record = regs.ix;
  mem8[record + STEP_HI] = bug === "wrongHigh" ? 0x00 : 0xff; // BUG(wrongHigh): step points right
  if (bug !== "dropLow") mem8[record + STEP_LO] = 0xa0; // BUG(dropLow): low byte never stamped
  if (bug !== "dropClear") regs.a = 0; // BUG(dropClear): the tail stores a stale value
  return m.call(0x2038);
}

test("TEETH: a wrong high byte, a dropped low byte and a dropped accumulator clear are all CAUGHT", () => {
  const caps = captures();
  const craftedCases = craftedEntries([caps[0]]);

  // Sanity: the correct routine passes both suites, so a caught twin is a real defect signal.
  assert.equal(sweep(caps, loc_202f), null, "the correct routine must pass the capture suite");
  assert.equal(sweep(craftedCases, loc_202f), null, "the correct routine must pass the crafted suite");

  const caught = {};
  for (const bug of ["wrongHigh", "dropLow", "dropClear"]) {
    const twin = (mm) => brokenLoc202f(mm, bug);
    const onCaptures = sweep(caps, twin);
    const onCrafted = sweep(craftedCases, twin);
    assert.notEqual(onCaptures, null, `the CAPTURE suite failed to catch the "${bug}" twin`);
    assert.notEqual(onCrafted, null, `the CRAFTED suite failed to catch the "${bug}" twin`);
    caught[bug] = describe(onCaptures);
  }

  console.log(`  TEETH: ${Object.entries(caught).map(([k, v]) => `${k} caught (${v})`).join("; ")}`);
});

// -- 4. the live-out claim, measured -------------------------------------------

test("LIVE-OUT (measured): the rewrite wired live keeps a whole attract run identical", () => {
  // 1500, not a round smaller number: attract's first 0x202F dispatch is at frame 1163, so a
  // shorter run compares two traces in which this routine never ran and proves nothing. The
  // dispatch count below is asserted for exactly that reason.
  const FRAMES = 1500;
  const trace = (overrides) => {
    const m = new Machine(ROM, overrides ? { overrides } : {});
    const frames = m.runFrames(FRAMES);
    return { frames, addrOf: (o) => m.stateOffsetToAddr(o) };
  };

  // The oracle charges 42 T-states across ROM 0x202F-0x2037 (4 + 19 + 19). Cycle-free code
  // charges none, which shifts the vblank interrupt and forks the run on the spin counter a few
  // hundred frames later — nothing to do with this routine. Restore the charge, then compare.
  let dispatches = 0;
  const wired = (mm) => {
    dispatches += 1;
    mm.step(0x2030, 4);
    mm.step(0x2034, 19);
    mm.step(0x2038, 19);
    return loc_202f(mm);
  };

  const base = trace(null);
  const cand = trace(new Map([[TARGET, wired]]));
  assert.ok(dispatches > 0, "the live run never dispatched 0x202F — this comparison would be vacuous");

  let firstDiff = null;
  for (let f = 0; f < Math.min(base.frames.length, cand.frames.length) && firstDiff === null; f++) {
    const A = base.frames[f], B = cand.frames[f];
    for (let i = 0; i < A.length; i++) {
      if (A[i] === B[i]) continue;
      const addr = base.addrOf(i);
      if (inStack(addr)) continue;
      firstDiff = { frame: f, addr, a: A[i], b: B[i] };
      break;
    }
  }
  assert.equal(
    firstDiff,
    null,
    firstDiff && `live run diverges at frame ${firstDiff.frame}, ${hx(firstDiff.addr ?? 0)} ` +
      `(${hb(firstDiff.a)}->${hb(firstDiff.b)})`,
  );
  console.log(
    `  LIVE-OUT: ${FRAMES} live frames (${dispatches} real dispatches wired) identical to the ` +
      "all-oracle baseline (RAM − STACK_SCRATCH)",
  );
});
