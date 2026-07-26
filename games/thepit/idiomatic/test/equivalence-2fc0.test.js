// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_2fc0 (ROM 0x2fc0, The Pit) — the per-frame phase
 * clock for the background flip animation: tick the phase countdown, and route the
 * frame to the publish tail (off-beat), the oscillator body (on-beat), or the reload
 * + tile-flip + commit tail (countdown expired).
 *
 * THREE WRINKLES this routine forces, all handled with a crafted entry:
 *
 *   1. loc_2fc0 is NEVER entered through this address in attract. Its subsystem does
 *      run there (the sibling monolith loc_2f71 dispatches ~460x per 1000 frames),
 *      but that sibling INLINES the same body instead of calling 0x2fc0, so 0x2fc0 is
 *      never dispatched on its own. A real machine state is therefore captured at the
 *      sibling loc_2f71's entry, and loc_2fc0 is invoked on clones of it — the exact
 *      crafted-entry escape hatch for an unreached entry. The sibling's own inline
 *      logic never touches the phase counter or the flip tile before the point 0x2fc0
 *      would run, so its entry state IS a valid loc_2fc0 entry.
 *
 *   2. Two of loc_2fc0's continuations are still untranslated (0x2fe3 the oscillator
 *      body, 0x3029 the publish tail): calling them would throw. Both the oracle and
 *      the idiomatic routine delegate to them identically, so each is replaced by ONE
 *      stub installed on both sides at once. Each stub writes a DISTINCT mark byte and
 *      sets a distinct exit, so which continuation was taken is visible to the diff —
 *      a mis-route is caught — but because the stub is the same function on both sides
 *      it can never manufacture or hide a difference between them.
 *
 *   3. loc_2fc0 is a tail-jumping routine whose caller consumes no register, so its
 *      honest live-out is MEMORY-ONLY. The oracle threads intermediate flag/register
 *      values through every step; the idiomatic rewrite correctly drops those dead
 *      values, so the two agree on memory + exit pc but NOT on the leftover register
 *      file. The gate therefore compares memory (+ exit pc), never the full register
 *      file — exactly the memory-equivalence contract for a dead-register live-out.
 *
 * EQUAL is proven two ways: over every naturally-occurring phase/tile state captured
 * at the sibling, AND an EXHAUSTIVE sweep of the phase counter (all 256 entry values)
 * crossed with the flip tiles, which reaches all three arms including inputs attract
 * never produces. The teeth twins (wrong reload, mis-route, dropped flip) are caught.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-2fc0.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2fc0 as oracle } from "../../translated/loc_2fc0.js";
import { loc_2fc0 as idiomatic } from "../loc_2fc0.js";
import { loc_2f71 } from "../../translated/loc_2f71.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) =>
      nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x2fc0; // loc_2fc0
const SIB = 0x2f71; // the reachable sibling we capture real attract states at
const OSC = 0x2fe3; // the oscillator-body tail (still untranslated)
const PUB = 0x3029; // the publish tail (still untranslated)
const PHASE = 0x80e3; // the animation phase counter loc_2fc0 ticks/reloads
const FLIP_TILE = 0x80dc; // the two-state flip tile cell, written on the reload frame
const STUB_MARK = 0x87f0; // dead scratch byte the tail stubs mark, to make routing visible
const OSC_MARK = 0xe3; // stub value that says "the oscillator body ran"
const PUB_MARK = 0x29; // stub value that says "the publish tail ran"
const CAPTURE_FRAMES = 900; // the sibling first runs ~frame 695, so run well past it
const CAPTURE_LIMIT = 96; // how many real sibling states to collect
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// Stubs standing in for the two untranslated continuations. Installed IDENTICALLY on
// both sides, so they can only move both in lockstep. Each gives its continuation a
// distinct, observable memory effect + exit pc, so the routing decision is checkable.
function oscStub(mm) {
  mm.mem.write8(STUB_MARK, OSC_MARK);
  mm.pc = OSC;
  return undefined;
}
function pubStub(mm) {
  mm.mem.write8(STUB_MARK, PUB_MARK);
  mm.pc = PUB;
  return undefined;
}
const STUBS = [
  [OSC, oscStub],
  [PUB, pubStub],
];

/**
 * Collect up to CAPTURE_LIMIT real machine states at the sibling loc_2f71's entry,
 * each carrying the tail stubs in its registry so loc_2fc0 can be run on clones. The
 * sibling hook clones the pristine entry, then runs the real sibling so attract goes
 * on. The natural entries span every phase value (1..8) and both flip tiles.
 */
function captureSiblingStates() {
  const states = [];
  const overrides = new Map([
    ...STUBS,
    [SIB, (mm) => {
      if (states.length < CAPTURE_LIMIT) states.push(mm.clone());
      return loc_2f71(mm);
    }],
  ]);
  const host = makeMachine(overrides);
  host.runFrames(CAPTURE_FRAMES);
  return states;
}

const STATES = ROM_PRESENT ? captureSiblingStates() : [];

/**
 * Run the oracle and a candidate on two independent clones of one entry state and
 * diff MEMORY + exit pc (the honest live-out; the leftover register file is dead and
 * deliberately not compared). Returns the diff plus which arm the oracle took.
 */
function runPair(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();

  oracle(a);
  candidate(b);

  const oraclePhase = a.mem.read8(PHASE);
  const oracleMark = a.mem.read8(STUB_MARK);
  let arm;
  if (a.mem.read8(PHASE) === 8 && oracleMark === OSC_MARK) arm = "reload"; // countdown expired
  else if (oracleMark === PUB_MARK) arm = "off-beat";
  else arm = "on-beat";

  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    pc: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    arm,
    oraclePhase,
  };
}

// -- 1. EQUAL: every naturally-occurring captured state -----------------------

test("EQUAL (captured): idiomatic == oracle on every real sibling state", () => {
  assert.ok(STATES.length > 0, "captured at least one real attract state at the sibling loc_2f71");
  const arms = new Set();
  for (const entry of STATES) {
    const r = runPair(entry, idiomatic);
    assert.equal(
      r.ram,
      null,
      r.ram &&
        `entry phase=${r.oraclePhase}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`,
    );
    assert.equal(r.pc, null, r.pc && `entry phase=${r.oraclePhase}: exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
    arms.add(r.arm);
  }
  console.log(`  EQUAL/captured: ${STATES.length} real sibling states identical (memory + pc); arms hit: ${[...arms].sort().join(", ")}`);
});

// -- 2. EQUAL: exhaustive over the phase counter x the flip tiles --------------

test("EQUAL (exhaustive): idiomatic == oracle over all 256 phase values x flip tiles", () => {
  const base = STATES[0];
  assert.ok(base, "have a base state to poke");
  const tiles = [0, 55, 56, 57, 58, 255]; // both flip codes + off-toggle values
  const arms = new Set();
  for (let e3 = 0; e3 < 256; e3++) {
    // Which arm this entry drives, computed straight from the ticked phase.
    const p = (e3 - 1 + 256) % 256;
    arms.add(p === 0 ? "reload" : p % 4 !== 0 ? "off-beat" : "on-beat");
    for (const dc of tiles) {
      const entry = base.clone();
      entry.mem.write8(PHASE, e3);
      entry.mem.write8(FLIP_TILE, dc);
      const r = runPair(entry, idiomatic);
      assert.equal(
        r.ram,
        null,
        r.ram &&
          `e3=${hx(e3)} dc=${hx(dc)}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`,
      );
      assert.equal(r.pc, null, r.pc && `e3=${hx(e3)} dc=${hx(dc)}: exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
    }
  }
  assert.ok(arms.has("reload") && arms.has("off-beat") && arms.has("on-beat"), `all three arms must be exercised, got: ${[...arms].join(", ")}`);
  console.log(`  EQUAL/exhaustive: 256 x ${tiles.length} phase/tile inputs identical to the oracle; arms: ${[...arms].sort().join(", ")}`);
});

// -- 3. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: reloads the phase counter to the WRONG value on the expired frame. */
function brokenReload(m) {
  const { mem } = m;
  const phase = (mem.read8(PHASE) - 1 + 256) % 256;
  mem.write8(PHASE, phase);
  if (phase !== 0) {
    if (phase % 4 !== 0) return m.call(PUB);
    return m.call(OSC);
  }
  mem.write8(PHASE, 7); // BUG: reloads to 7 instead of 8
  const tile = mem.read8(FLIP_TILE);
  m.regs.a = tile === 56 ? 57 : 56;
  return m.call(0x2fd9);
}

/** Broken twin B: mis-routes the on-beat frame to the publish tail. */
function brokenRoute(m) {
  const { mem } = m;
  const phase = (mem.read8(PHASE) - 1 + 256) % 256;
  mem.write8(PHASE, phase);
  if (phase !== 0) {
    if (phase % 4 !== 0) return m.call(PUB);
    return m.call(PUB); // BUG: on-beat frame should run the oscillator body (OSC)
  }
  mem.write8(PHASE, 8);
  const tile = mem.read8(FLIP_TILE);
  m.regs.a = tile === 56 ? 57 : 56;
  return m.call(0x2fd9);
}

/** Broken twin C: never flips the tile on the expired frame. */
function brokenFlip(m) {
  const { mem } = m;
  const phase = (mem.read8(PHASE) - 1 + 256) % 256;
  mem.write8(PHASE, phase);
  if (phase !== 0) {
    if (phase % 4 !== 0) return m.call(PUB);
    return m.call(OSC);
  }
  mem.write8(PHASE, 8);
  m.regs.a = mem.read8(FLIP_TILE); // BUG: commits the current tile, no flip
  return m.call(0x2fd9);
}

test("TEETH: a wrong reload value is CAUGHT at the phase counter", () => {
  const entry = STATES[0].clone();
  entry.mem.write8(PHASE, 1); // -> phase 0, the expired/reload frame
  const r = runPair(entry, brokenReload);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong reload value — it is worthless");
  assert.equal(r.ram.addr, PHASE, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the phase counter ${hx(PHASE)})`);
  console.log(`  TEETH: wrong reload caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a mis-routed on-beat frame is CAUGHT at the tail mark", () => {
  const entry = STATES[0].clone();
  entry.mem.write8(PHASE, 5); // -> phase 4, the on-beat frame (routes to OSC)
  const r = runPair(entry, brokenRoute);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a mis-route — it is worthless");
  assert.equal(r.ram.addr, STUB_MARK, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the tail mark ${hx(STUB_MARK)})`);
  assert.notEqual(r.pc, null, "and the exit pc must diverge (the two tails leave different pcs)");
  console.log(`  TEETH: mis-route caught at ${hx(r.ram.addr)} + pc (oracle=${hx(r.pc.a)} broken=${hx(r.pc.b)})`);
});

test("TEETH: a dropped tile flip is CAUGHT at the flip-tile cell", () => {
  const entry = STATES[0].clone();
  entry.mem.write8(PHASE, 1); // -> phase 0, the reload frame
  entry.mem.write8(FLIP_TILE, 56); // current tile -> oracle flips to 57, twin keeps 56
  const r = runPair(entry, brokenFlip);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a dropped flip — it is worthless");
  assert.equal(r.ram.addr, FLIP_TILE, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the flip-tile cell ${hx(FLIP_TILE)})`);
  console.log(`  TEETH: dropped flip caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

// -- 4. EQUAL + TEETH through the shared unitEquivalence harness ---------------
// loc_2fc0 is unreached in attract, so a makeMachine wrapper forces a real dispatch:
// run the real sibling, then invoke the target so the harness's snapshot hook fires on
// a genuine attract-derived state. The tail stubs are layered in the same wrapper. The
// harness also diffs registers, which are a DEAD live-out here, so we assert only the
// memory + pc it reports (res.ram / res.pc) — the honest contract for this routine.

function makeForced(overrides) {
  const merged = new Map(overrides ? [...overrides] : []);
  for (const [addr, fn] of STUBS) merged.set(addr, fn);
  merged.set(SIB, (mm) => {
    const r = loc_2f71(mm); // real sibling, natural attract behaviour
    mm.call(TARGET); // then force-enter the target so the snapshot hook captures it
    return r;
  });
  return makeMachine(merged);
}

test("EQUAL (harness): a forced real 0x2fc0 dispatch is memory-EQUAL through unitEquivalence", () => {
  const res = unitEquivalence(makeForced, TARGET, oracle, idiomatic, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.ram, null, `harness RAM diverged: ${JSON.stringify(res.ram)}`);
  assert.equal(res.pc, null, `harness exit pc diverged: ${JSON.stringify(res.pc)}`);
  console.log("  EQUAL/harness: unitEquivalence captured a real 0x2fc0 entry -> memory + pc EQUAL");
});

/**
 * Broken twin for the harness: the correct routine, then one wrong store to the phase
 * counter. It diverges on EVERY arm (the phase counter is always written), so it is
 * caught whichever arm the single forced capture happens to land on.
 */
function brokenHarness(m) {
  const r = idiomatic(m);
  m.mem.write8(PHASE, m.mem.read8(PHASE) ^ 0xff); // BUG: corrupts the ticked phase counter
  return r;
}

test("TEETH (harness): a corrupted phase counter is CAUGHT by unitEquivalence", () => {
  const res = unitEquivalence(makeForced, TARGET, oracle, brokenHarness, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, false, "unitEquivalence FAILED to catch the corrupted twin — it is worthless");
  assert.notEqual(res.ram, null, "the diff must include a RAM difference");
  assert.equal(res.ram.addr, PHASE, `harness caught ${hx(res.ram?.addr ?? 0)} (expected the phase counter ${hx(PHASE)})`);
  console.log(`  TEETH/harness: corrupted phase counter caught at ${hx(res.ram.addr)} (oracle=${res.ram.a} broken=${res.ram.b})`);
});
