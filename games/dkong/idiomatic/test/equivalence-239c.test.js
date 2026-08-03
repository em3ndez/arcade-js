// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for stepBallisticMotion (ROM 0x239C).
 *
 * COVERAGE — ATTRACT ONLY. A capturing override at 0x239C clones the machine at real
 * dispatches during a 1200-frame attract run; the gate replays every clone it kept (every
 * 20th dispatch, plus the first dispatch at each distinct record base, so all bases attract
 * uses are in the sample). Nothing here enters gameplay and no entry state is crafted, so any
 * record base or field value attract never produces is untested.
 *
 * CONTRACT — the work/sprite/video state dump outside STACK_SCRATCH, plus the declared
 * live-out (the new vertical position, in `h` and as the return value). pc, SP and the other
 * registers are excluded: the rewrite models the return as a JS return and keeps no register
 * trace, so only what a caller actually reads back is compared.
 *
 * Checks: EQUAL over the captured dispatches; four broken twins — a dropped fraction write, a
 * doubled gravity slice, a frame counter that never advances, and a correct-RAM twin with the
 * wrong live-out (which the RAM diff alone cannot see) — plus an assertion that the gravity
 * twin is caught on the vertical field rather than incidentally elsewhere; and finally a
 * whole-attract-run check with the rewrite wired live at 0x239C, which is the only check here
 * that can see a register or flag some caller reads back after the call returns.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-239c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { loc_239c as oracle } from "../../translated/loc_239c.js";
import { stepBallisticMotion } from "../stepBallisticMotion.js";
import { OBJ_Y, STACK_SCRATCH } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/dkong/rom/maincpu.bin" }, fn);

const ATTRACT_FRAMES = 1200;
const KEEP_EVERY = 20;

const hx = (v) => "0x" + (v & 0xffff).toString(16);

/**
 * Boot attract with a hook at 0x239C that clones the machine at real dispatches and then hands
 * the dispatch to the oracle so the host run proceeds normally. A clone inherits the hook, but
 * this routine calls nothing, so replaying on a clone never re-enters it.
 */
function captureDispatches() {
  const kept = [];
  const bases = new Map();
  let dispatches = 0;
  const m = new Machine(ROM, {
    overrides: {
      "239c": (mm) => {
        const base = mm.regs.ix;
        const firstAtBase = !bases.has(base);
        bases.set(base, (bases.get(base) ?? 0) + 1);
        if (firstAtBase || dispatches % KEEP_EVERY === 0) kept.push({ base, state: mm.clone() });
        dispatches++;
        return oracle(mm);
      },
    },
  });
  m.runFrames(ATTRACT_FRAMES);
  return { kept, bases, dispatches };
}

const CAPTURED = ROM_PRESENT ? captureDispatches() : { kept: [], bases: new Map(), dispatches: 0 };

/** First differing state byte outside STACK_SCRATCH, or null. */
function ramDiff(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Replay one captured dispatch both ways on independent clones and report the first contract
 * breach: a RAM byte, or the live-out. `candidate(m, base)` stands in for the rewrite.
 */
function contractBreach(capture, candidate) {
  const a = capture.state.clone();
  const b = capture.state.clone();
  oracle(a);
  const returned = candidate(b, capture.base);

  const ram = ramDiff(a, b);
  if (ram) return { kind: "ram", ...ram };
  if (a.regs.h !== b.regs.h) return { kind: "live-out h", addr: null, a: a.regs.h, b: b.regs.h };
  const oracleHl = a.regs.h * 256 + a.regs.l;
  if (returned !== oracleHl) return { kind: "return", addr: null, a: oracleHl, b: returned };
  return null;
}

/** Run a candidate over every capture; return the breaches it produced. */
function breachesOver(candidate) {
  return CAPTURED.kept.map((c) => ({ base: c.base, breach: contractBreach(c, candidate) }))
    .filter((r) => r.breach !== null);
}

// -- 1. EQUAL over the captured dispatches ------------------------------------

test("EQUAL: stepBallisticMotion matches the oracle on every captured attract dispatch", () => {
  assert.ok(
    CAPTURED.dispatches > 0 && CAPTURED.kept.length > 0,
    "no dispatch of 0x239C was captured — the harness never engaged, so this gate proves nothing",
  );
  const breaches = breachesOver(stepBallisticMotion);
  assert.equal(
    breaches.length,
    0,
    breaches.length
      ? `${breaches.length} breach(es), first: base ${hx(breaches[0].base)} ${breaches[0].breach.kind} ` +
        `at ${hx(breaches[0].breach.addr ?? 0)} oracle=${breaches[0].breach.a} rewrite=${breaches[0].breach.b}`
      : "",
  );
  // The header claims the replayed sample covers every record base attract dispatches on;
  // this is the line that produces that claim.
  const sampled = new Set(CAPTURED.kept.map((c) => c.base));
  assert.deepEqual(
    [...sampled].sort((p, q) => p - q),
    [...CAPTURED.bases.keys()].sort((p, q) => p - q),
    "the replayed sample misses a record base attract dispatched on",
  );
  const bases = [...CAPTURED.bases].map(([b, n]) => `${hx(b)}x${n}`).join(" ");
  console.log(
    `  EQUAL: ${CAPTURED.kept.length} of ${CAPTURED.dispatches} real dispatches in ` +
      `${ATTRACT_FRAMES} attract frames; ${sampled.size} record bases in the sample, ` +
      `all dispatches by base: ${bases}`,
  );
});

// -- 2. TEETH -----------------------------------------------------------------

/** Broken twin: keeps only the whole byte of the horizontal position, never the fraction. */
function twinDropFraction(m, base) {
  const out = stepBallisticMotion(m, base);
  m.mem8[base + 4] = 0;
  return out;
}

/** Broken twin: the gravity slice for the frame is twice what it should be. */
function twinDoubleGravity(m, base) {
  const { mem8 } = m;
  const framesSinceLaunch = mem8[base + 20];
  const out = stepBallisticMotion(m, base);
  const wrong = (out + (2 * framesSinceLaunch + 1) * 8) & 0xffff;
  mem8[base + OBJ_Y] = wrong >> 8;
  mem8[base + 6] = wrong;
  m.regs.h = wrong >> 8;
  return wrong;
}

/** Broken twin: the arc is stepped but the frame counter never advances, so it never falls. */
function twinFrozenCounter(m, base) {
  const framesSinceLaunch = m.mem8[base + 20];
  const out = stepBallisticMotion(m, base);
  m.mem8[base + 20] = framesSinceLaunch;
  return out;
}

/** Broken twin: correct RAM, wrong live-out — invisible to the RAM diff. */
function twinWrongLiveOut(m, base) {
  const out = stepBallisticMotion(m, base);
  m.regs.h = m.regs.h ^ 0xff;
  return out;
}

const TEETH = [
  { name: "dropped fraction write", twin: twinDropFraction, cell: (b) => b + 4 },
  { name: "doubled gravity slice", twin: twinDoubleGravity, cell: null },
  { name: "frozen frame counter", twin: twinFrozenCounter, cell: (b) => b + 20 },
  { name: "wrong live-out", twin: twinWrongLiveOut, cell: null },
];

for (const { name, twin, cell } of TEETH) {
  test(`TEETH: a twin with a ${name} is CAUGHT`, () => {
    const breaches = breachesOver(twin);
    assert.ok(
      breaches.length > 0,
      `the gate FAILED to catch the ${name} twin on any of ${CAPTURED.kept.length} captures — it proves nothing`,
    );
    if (cell) {
      const { base, breach } = breaches[0];
      assert.equal(
        breach.addr,
        cell(base),
        `teeth caught the wrong cell ${hx(breach.addr ?? 0)}, expected ${hx(cell(base))}`,
      );
    }
    const { base, breach } = breaches[0];
    console.log(
      `  TEETH/${name}: caught on ${breaches.length} of ${CAPTURED.kept.length} captures; first at ` +
        `base ${hx(base)} ${breach.kind} ${breach.addr === null ? "" : hx(breach.addr)} ` +
        `oracle=${breach.a} twin=${breach.b}`,
    );
  });
}

// A twin that breaks the vertical position must land on the vertical field, not somewhere else.
test("TEETH: the doubled gravity slice lands on the vertical position field", () => {
  const [{ base, breach }] = breachesOver(twinDoubleGravity);
  assert.ok(
    breach.addr === base + OBJ_Y || breach.addr === base + 6,
    `expected the vertical position field, got ${hx(breach.addr ?? 0)}`,
  );
});

// -- 3. The live-out claim, measured over a whole run -------------------------

/** What the oracle charges for one call — measured on the captures, not summed by hand. */
function oracleCycleCost() {
  const costs = new Set();
  for (const c of CAPTURED.kept) {
    const m = c.state.clone();
    const before = m.cycles;
    oracle(m);
    costs.add(m.cycles - before);
  }
  assert.equal(costs.size, 1, `the oracle's cost is not constant: ${[...costs].join(",")}`);
  return [...costs][0];
}

/**
 * The unit checks above compare one call at a time, so they cannot see a register or flag the
 * oracle leaves that some caller reads back later. This wires the rewrite LIVE at 0x239C for a
 * whole attract run and diffs the frame trace against the all-oracle baseline.
 *
 * The cycle charge is restored explicitly (the count both runs use is printed). The rewrite is
 * cycle-free, so leaving it out lets hundreds of uncharged calls move the vblank interrupt to a
 * different instruction, and the trace then diverges for reasons that have nothing to do with
 * the contract. With the charge restored the run isolates exactly the state the rewrite drops.
 */
test("LIVE-OUT: wired live for a whole attract run, the rewrite leaves the same trace as the oracle", () => {
  const cost = oracleCycleCost();
  const baseline = new Machine(ROM).runFrames(ATTRACT_FRAMES);
  const host = new Machine(ROM, {
    overrides: {
      "239c": (m) => {
        const out = stepBallisticMotion(m);
        m.cycles += cost;
        return out;
      },
    },
  });
  const live = host.runFrames(ATTRACT_FRAMES);
  assert.equal(live.length, baseline.length, "the two runs did not reach the same frame count");

  for (let f = 0; f < baseline.length; f++) {
    for (let i = 0; i < baseline[f].length; i++) {
      if (baseline[f][i] === live[f][i]) continue;
      assert.fail(
        `frame ${f}: ${hx(host.stateOffsetToAddr(i))} baseline=${baseline[f][i]} live=${live[f][i]}`,
      );
    }
  }
  console.log(
    `  LIVE-OUT: ${ATTRACT_FRAMES} attract frames byte-identical with 0x239C wired live ` +
      `(${cost} cycles/call restored) — the registers and flags the rewrite drops are read ` +
      "back by nobody attract reaches",
  );
});
