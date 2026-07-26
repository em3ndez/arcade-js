// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_2f88 (ROM 0x2f88, The Pit) — reveal the next
 * column of the scrolling terrain backdrop on its frame gate, then hand off to the
 * background phase clock loc_2fc0.
 *
 * THREE WRINKLES this routine forces, all handled with a crafted entry:
 *
 *   1. loc_2f88 is NEVER dispatched in attract. Its whole subsystem DOES run there
 *      (the backdrop monolith loc_2f71 dispatches every frame), but that monolith
 *      INLINES the same reveal body instead of calling 0x2f88, so 0x2f88 is never
 *      entered on its own. A real machine state is therefore captured at loc_2f71's
 *      entry and loc_2f88 is invoked on clones of it — the crafted-entry escape
 *      hatch for an unreached entry. The monolith's preamble (an enable-flag check
 *      and one gated call) never touches the reveal gate, cursor or pattern pointer
 *      before the point 0x2f88 would run, so its entry state IS a valid 0x2f88 entry.
 *
 *   2. loc_2f88 tail-delegates to loc_2fc0, whose own two continuations are still
 *      untranslated (0x2fe3 the oscillator body, 0x3029 the publish tail): reaching
 *      them would throw. Both the oracle and the idiomatic routine descend into the
 *      same continuations, so each is replaced by ONE stub installed on both sides at
 *      once. Each stub writes a DISTINCT mark byte and sets a distinct exit pc, so
 *      the route the frame took is visible to the diff — a mis-route is caught — but
 *      because the stub is the same function on both sides it can never manufacture
 *      or hide a difference between them.
 *
 *   3. loc_2f88 is a tail-jumping routine whose caller consumes no register, so its
 *      honest live-out is MEMORY-ONLY. The oracle threads intermediate flag/register
 *      values through every step; the idiomatic rewrite drops those dead values, so
 *      the two agree on memory + exit pc but NOT on the leftover register file. The
 *      gate therefore compares memory (+ exit pc), never the full register file —
 *      the memory-equivalence contract for a dead-register live-out.
 *
 * EQUAL is proven two ways: over every naturally-occurring state captured at the
 * monolith, AND an EXHAUSTIVE sweep of the reveal gate (all 256 entry values) crossed
 * with representative cursor and phase values, which reaches all three arms
 * (nothing-to-reveal, table-exhausted, stamp-a-column) plus every downstream phase
 * route. The teeth twins (wrong gate reload, corrupted stamped tile, dropped hand-off)
 * are caught. A final pass drives EQUAL + TEETH through the shared unitEquivalence
 * harness on a forced real dispatch.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-2f88.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2f88 as oracle } from "../../translated/loc_2f88.js";
import { loc_2f88 as idiomatic } from "../loc_2f88.js";
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

const TARGET = 0x2f88; // loc_2f88
const SIB = 0x2f71; // the reachable monolith we capture real attract states at
const OSC = 0x2fe3; // the oscillator-body tail reached via loc_2fc0 (still untranslated)
const PUB = 0x3029; // the publish tail reached via loc_2fc0 (still untranslated)

const GATE = 0x80e5; // the per-column reveal gate loc_2f88 ticks/reloads
const PERIOD = 0x80e4; // the gate's reload period
const CURSOR = 0x80e6; // the pattern-table cursor loc_2f88 steps back
const POINTER = 0x80e1; // the stashed pattern pointer (16-bit)
const PHASE = 0x80e3; // loc_2fc0's phase counter, ticked by the hand-off
const COLUMN_BOTTOM = 0x938c; // bottom video-RAM cell of the stamped column

const STUB_MARK = 0x87f0; // dead scratch byte the tail stubs mark, to make routing visible
const OSC_MARK = 0xe3; // stub value that says "the oscillator body ran"
const PUB_MARK = 0x29; // stub value that says "the publish tail ran"
const CAPTURE_FRAMES = 900; // run well past the monolith's first dispatch
const CAPTURE_LIMIT = 96; // how many real monolith states to collect
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// Stubs standing in for the two untranslated continuations loc_2fc0 reaches.
// Installed IDENTICALLY on both sides, so they can only move both in lockstep. Each
// gives its continuation a distinct, observable memory effect + exit pc, so the
// routing decision through the whole loc_2f88 -> loc_2fc0 chain is checkable.
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
 * Collect up to CAPTURE_LIMIT real machine states at the monolith loc_2f71's entry,
 * each carrying the tail stubs in its registry so loc_2f88 can be run on clones. The
 * monolith hook clones the pristine entry, then runs the real monolith so attract
 * goes on. The natural entries span whatever gate/cursor/phase the game produces.
 */
function captureMonolithStates() {
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

const STATES = ROM_PRESENT ? captureMonolithStates() : [];

/** Which of loc_2f88's three arms an entry state drives, from its gate + cursor. */
function armOf(entry) {
  const gate = (entry.mem.read8(GATE) - 1 + 256) % 256;
  if (gate !== 0) return "nothing-to-reveal";
  return entry.mem.read8(CURSOR) < 6 ? "table-exhausted" : "stamp-a-column";
}

/**
 * Run the oracle and a candidate on two independent clones of one entry state and
 * diff MEMORY + exit pc (the honest live-out; the leftover register file is dead and
 * deliberately not compared). Returns the diff plus which arm the state drove.
 */
function runPair(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();

  oracle(a);
  candidate(b);

  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    pc: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    arm: armOf(entry),
  };
}

// -- 1. EQUAL: every naturally-occurring captured state -----------------------

test("EQUAL (captured): idiomatic == oracle on every real monolith state", () => {
  assert.ok(STATES.length > 0, "captured at least one real attract state at the monolith loc_2f71");
  const arms = new Set();
  for (const entry of STATES) {
    const r = runPair(entry, idiomatic);
    assert.equal(
      r.ram,
      null,
      r.ram &&
        `arm=${r.arm}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`,
    );
    assert.equal(r.pc, null, r.pc && `arm=${r.arm}: exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
    arms.add(r.arm);
  }
  console.log(`  EQUAL/captured: ${STATES.length} real monolith states identical (memory + pc); arms hit: ${[...arms].sort().join(", ")}`);
});

// -- 2. EQUAL: exhaustive over the gate x cursor x phase ----------------------

test("EQUAL (exhaustive): idiomatic == oracle over all 256 gate values x cursor x phase", () => {
  const base = STATES[0];
  assert.ok(base, "have a base state to poke");
  const cursors = [0, 5, 6, 7, 12, 66, 255]; // below and above the one-column step of 6
  const phases = [1, 3, 5]; // reload frame, off-beat frame, on-beat frame downstream
  const arms = new Set();
  for (let g = 0; g < 256; g++) {
    for (const c of cursors) {
      for (const p of phases) {
        const entry = base.clone();
        entry.mem.write8(GATE, g);
        entry.mem.write8(CURSOR, c);
        entry.mem.write8(PHASE, p);
        const r = runPair(entry, idiomatic);
        assert.equal(
          r.ram,
          null,
          r.ram &&
            `g=${hx(g)} c=${hx(c)} p=${hx(p)}: RAM diverged at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`,
        );
        assert.equal(r.pc, null, r.pc && `g=${hx(g)} c=${hx(c)} p=${hx(p)}: exit pc diverged (oracle=${hx(r.pc?.a)} idiomatic=${hx(r.pc?.b)})`);
        arms.add(r.arm);
      }
    }
  }
  assert.ok(
    arms.has("nothing-to-reveal") && arms.has("table-exhausted") && arms.has("stamp-a-column"),
    `all three arms must be exercised, got: ${[...arms].join(", ")}`,
  );
  console.log(`  EQUAL/exhaustive: 256 x ${cursors.length} x ${phases.length} inputs identical to the oracle; arms: ${[...arms].sort().join(", ")}`);
});

// -- 3. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: reloads the reveal gate to the WRONG value on the reveal frame. */
function brokenReload(m) {
  const { mem } = m;
  const gate = (mem.read8(GATE) - 1 + 256) % 256;
  mem.write8(GATE, gate);
  if (gate !== 0) return loc_2fc0Registry(m);
  mem.write8(GATE, (mem.read8(PERIOD) + 1) & 0xff); // BUG: off-by-one gate reload
  const cursor = mem.read8(CURSOR) - 6;
  if (cursor < 0) return loc_2fc0Registry(m);
  mem.write8(CURSOR, cursor);
  const source = 0x3048 + cursor;
  mem.write16(POINTER, source);
  let cell = COLUMN_BOTTOM;
  for (let i = 0; i < 6; i++) { mem.write8(cell, mem.read8(source + i)); cell -= 32; }
  return loc_2fc0Registry(m);
}

/** Broken twin B: corrupts one stamped tile in the video-RAM column. */
function brokenStamp(m) {
  const { mem } = m;
  const gate = (mem.read8(GATE) - 1 + 256) % 256;
  mem.write8(GATE, gate);
  if (gate !== 0) return loc_2fc0Registry(m);
  mem.write8(GATE, mem.read8(PERIOD));
  const cursor = mem.read8(CURSOR) - 6;
  if (cursor < 0) return loc_2fc0Registry(m);
  mem.write8(CURSOR, cursor);
  const source = 0x3048 + cursor;
  mem.write16(POINTER, source);
  let cell = COLUMN_BOTTOM;
  for (let i = 0; i < 6; i++) { mem.write8(cell, (mem.read8(source + i) ^ 0xff) & 0xff); cell -= 32; } // BUG
  return loc_2fc0Registry(m);
}

/** Broken twin C: drops the hand-off to the phase clock entirely. */
function brokenHandoff(m) {
  const { mem } = m;
  const gate = (mem.read8(GATE) - 1 + 256) % 256;
  mem.write8(GATE, gate);
  if (gate !== 0) return undefined; // BUG: never delegates to loc_2fc0
  mem.write8(GATE, mem.read8(PERIOD));
  const cursor = mem.read8(CURSOR) - 6;
  if (cursor < 0) return undefined; // BUG
  mem.write8(CURSOR, cursor);
  const source = 0x3048 + cursor;
  mem.write16(POINTER, source);
  let cell = COLUMN_BOTTOM;
  for (let i = 0; i < 6; i++) { mem.write8(cell, mem.read8(source + i)); cell -= 32; }
  return undefined; // BUG
}

// The broken twins descend into loc_2fc0 the same way the real routine does — through
// the registry (the frozen oracle) — so their bug is the ONLY difference from oracle.
function loc_2fc0Registry(m) {
  return m.call(0x2fc0);
}

test("TEETH: a wrong gate reload is CAUGHT at the reveal gate", () => {
  const entry = STATES[0].clone();
  entry.mem.write8(GATE, 1); // -> gate hits 0, the reveal frame
  entry.mem.write8(CURSOR, 66); // >= 6 so it reaches the reload
  const r = runPair(entry, brokenReload);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong gate reload — it is worthless");
  assert.equal(r.ram.addr, GATE, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the reveal gate ${hx(GATE)})`);
  console.log(`  TEETH: wrong gate reload caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a corrupted stamped tile is CAUGHT in the video-RAM column", () => {
  const entry = STATES[0].clone();
  entry.mem.write8(GATE, 1); // reveal frame
  entry.mem.write8(CURSOR, 66); // >= 6 so a column is stamped
  const r = runPair(entry, brokenStamp);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a corrupted stamped tile — it is worthless");
  const inColumn = [0x938c, 0x936c, 0x934c, 0x932c, 0x930c, 0x92ec].includes(r.ram.addr);
  assert.ok(inColumn, `teeth caught ${hx(r.ram.addr ?? 0)} (expected a cell of the stamped column 0x92ec..0x938c)`);
  console.log(`  TEETH: corrupted tile caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

test("TEETH: a dropped hand-off is CAUGHT at the phase counter", () => {
  const entry = STATES[0].clone();
  entry.mem.write8(GATE, 5); // gate stays non-zero -> nothing-to-reveal, but must still hand off
  entry.mem.write8(PHASE, 5); // a running (non-reload) phase, so the hand-off ONLY ticks 0x80e3
  const r = runPair(entry, brokenHandoff);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a dropped hand-off — it is worthless");
  assert.equal(r.ram.addr, PHASE, `teeth caught ${hx(r.ram.addr ?? 0)} (expected the phase counter ${hx(PHASE)}, un-ticked)`);
  console.log(`  TEETH: dropped hand-off caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

// -- 4. EQUAL + TEETH through the shared unitEquivalence harness ---------------
// loc_2f88 is unreached in attract, so a makeMachine wrapper forces a real dispatch:
// run the real monolith, then invoke the target so the harness's snapshot hook fires
// on a genuine attract-derived state. The tail stubs are layered in the same wrapper.
// The harness also diffs registers, which are a DEAD live-out here, so we assert only
// the memory + pc it reports (res.ram / res.pc) — the honest contract for this routine.

function makeForced(overrides) {
  const merged = new Map(overrides ? [...overrides] : []);
  for (const [addr, fn] of STUBS) merged.set(addr, fn);
  merged.set(SIB, (mm) => {
    const r = loc_2f71(mm); // real monolith, natural attract behaviour
    mm.call(TARGET); // then force-enter the target so the snapshot hook captures it
    return r;
  });
  return makeMachine(merged);
}

test("EQUAL (harness): a forced real 0x2f88 dispatch is memory-EQUAL through unitEquivalence", () => {
  const res = unitEquivalence(makeForced, TARGET, oracle, idiomatic, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.ram, null, `harness RAM diverged: ${JSON.stringify(res.ram)}`);
  assert.equal(res.pc, null, `harness exit pc diverged: ${JSON.stringify(res.pc)}`);
  console.log("  EQUAL/harness: unitEquivalence captured a real 0x2f88 entry -> memory + pc EQUAL");
});

/**
 * Broken twin for the harness: the correct routine, then one wrong store to the
 * reveal gate. It always writes the gate, so it is caught whichever arm the single
 * forced capture happens to land on.
 */
function brokenHarness(m) {
  const r = idiomatic(m);
  m.mem.write8(GATE, m.mem.read8(GATE) ^ 0xff); // BUG: corrupts the ticked reveal gate
  return r;
}

test("TEETH (harness): a corrupted reveal gate is CAUGHT by unitEquivalence", () => {
  const res = unitEquivalence(makeForced, TARGET, oracle, brokenHarness, { maxFrames: CAPTURE_FRAMES });
  assert.equal(res.equal, false, "unitEquivalence FAILED to catch the corrupted twin — it is worthless");
  assert.notEqual(res.ram, null, "the diff must include a RAM difference");
  assert.equal(res.ram.addr, GATE, `harness caught ${hx(res.ram?.addr ?? 0)} (expected the reveal gate ${hx(GATE)})`);
  console.log(`  TEETH/harness: corrupted reveal gate caught at ${hx(res.ram.addr)} (oracle=${res.ram.a} broken=${res.ram.b})`);
});
