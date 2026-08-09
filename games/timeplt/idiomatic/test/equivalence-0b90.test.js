// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterCommandRingDrain — memory-equivalent to the frozen oracle at ROM 0x0B90.
 *
 * A three-byte `jp 0x0b93`: a tail transfer into the foreground command-ring loop, which is the
 * drain — a coroutine that never returns. This entry's whole job is to reach it and hand back
 * whatever it yields. It reaches it through the routine map (m.call), not a direct import: a direct
 * import of a poll routine hangs, and the map is what lets this gate SEVER it. Both arms run against
 * a clone whose 0x0b93 is a RECORDER that notes the state handed over and returns one shared
 * sentinel, so both return after one transfer through their own code. This entry writes no memory
 * and touches no register, so RAM comes back byte-identical, the hand-off state matches, and the
 * real live-out — the drain's continuation — is handed straight back, asserted as the sentinel by
 * identity. Neither tape dispatches this address, so entries are CRAFTED from a real machine
 * captured at the drain's one boot dispatch; the zero is evidence only because the same taps
 * counted the drain in the same runs.
 *
 * GATE: crafted-entry, drain severed. Holes:
 *   1. UNREACHED — this address at zero under both tapes, drain as a live positive control.
 *   2. THE ENTRY — a real machine captured at the drain's boot dispatch.
 *   3. REACHES THE DRAIN — both arms reach it once and hand it identical state.
 *   4. EQUAL — RAM, the hand-off state and the returned sentinel, on every crafted entry.
 *   5. NOT VACUOUS — a memory-writing twin FAILS the RAM diff.
 *   6. TEETH — four twins, each with its exact crafted catch count.
 * HOLE: the drain is stubbed; cycles and pc are not compared, since this hands back a coroutine.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0b90.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { enterCommandRingDrain } from "../enterCommandRingDrain.js";
import { loc_0b90 as oracle } from "../../translated/loc_0b90.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { COMMAND_READ_CURSOR } from "../names.js";

const TARGET = 0x0b90;
const DRAIN = 0x0b93;

/** What the severed drain hands back; both arms must return this exact object. */
const SENTINEL = { drain: true };

/** The registers passed through to the drain, snapshotted at the hand-off. */
const HANDOVER = ["a", "bc", "de", "hl", "ix", "iy"];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

// ── the entry ───────────────────────────────────────────────────────────────────────────

let entry = null;
/** A coherent real machine captured at the drain's one boot dispatch; the base for every craft. */
function entryState() {
  if (entry !== null) return entry;
  const real = makeMachine().routines.get(DRAIN);
  const m = makeMachine(
    new Map([[DRAIN, (mm, ...a) => {
      if (entry === null) entry = mm.clone();
      return real(mm, ...a);
    }]]),
  );
  m.runFrames(ENTRY_FRAMES);
  assert.notEqual(entry, null, "vacuous: the drain was never dispatched, so there is no state to craft from");
  return entry;
}

/** A clone whose drain is a recorder returning the shared sentinel, installed the same on both arms. */
function severed(machine, log) {
  const c = machine.clone();
  c.routines = new Map(c.routines);
  c.routines.set(DRAIN, (mm) => {
    log.push(Object.fromEntries(HANDOVER.map((k) => [k, mm.regs[k]])));
    return SENTINEL;
  });
  return c;
}

/** Register seeds layered onto the base entry: registers this transfer must pass through untouched. */
const SEEDS = [
  { a: 0x00, bc: 0x0000, de: 0x0000, hl: 0x0000 },
  { a: 0xff, bc: 0x1234, de: 0x5678, hl: 0x9abc },
  { a: 0x42, bc: 0xffff, de: 0x00ff, hl: 0xff00 },
  { a: 0x01, bc: 0x0100, de: 0x8000, hl: 0x0001 },
  { a: 0x7f, bc: 0xabcd, de: 0x0f0f, hl: 0xf0f0 },
  { a: 0x80, bc: 0x0001, de: 0xfffe, hl: 0x1000 },
];

function craft(seed) {
  const m = entryState().clone();
  for (const [k, v] of Object.entries(seed)) m.regs[k] = v;
  return m;
}

/** Both arms once on the same crafted state: RAM, the state handed over, and the returned value. */
function unitDiff(candidate, machine) {
  const logA = [];
  const logB = [];
  const a = severed(machine, logA);
  const b = severed(machine, logB);
  const retA = oracle(a);
  let retB;
  try {
    retB = candidate(b);
  } catch (e) {
    return { addr: null, a: "returned", b: String(e).slice(0, 50) };
  }

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  if (logA.length !== logB.length) {
    return { addr: null, a: `${logA.length} transfer(s)`, b: `${logB.length} transfer(s)` };
  }
  for (const [i, l] of logA.entries()) {
    for (const k of HANDOVER) {
      if (l[k] !== logB[i][k]) return { addr: null, a: `handover ${k}=${l[k]}`, b: `${logB[i][k]}` };
    }
  }
  if (retA !== retB) return { addr: null, a: `return ${String(retA)}`, b: `return ${String(retB)}` };
  return null;
}

function sweepCaught(candidate) {
  return SEEDS.filter((s) => unitDiff(candidate, craft(s)) !== null).length;
}

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** BUG: does nothing — never reaches the drain and hands nothing back. */
function brokenNoTransfer() {}

/** BUG: reaches the drain but swallows its continuation instead of handing it back. */
function brokenDropsReturn(m) {
  m.call(DRAIN);
}

/** BUG: mucks with a register on the way through, so the drain is handed the wrong state. */
function brokenScribblesRegister(m) {
  m.regs.a = (m.regs.a + 1) & 0xff;
  return m.call(DRAIN);
}

/** BUG: writes a work-RAM cell before transferring, so the transfer is no longer transparent. */
function brokenWritesMemory(m) {
  m.mem8[COMMAND_READ_CURSOR] = m.mem8[COMMAND_READ_CURSOR] ^ 0xff;
  return m.call(DRAIN);
}

const ALL = SEEDS.length;
const TWINS = [
  ["no-transfer", brokenNoTransfer, ALL],
  ["drops-return", brokenDropsReturn, ALL],
  ["scribbles-register", brokenScribblesRegister, ALL],
  ["writes-memory", brokenWritesMemory, ALL],
];

test("UNREACHED: neither tape dispatches this address, with the drain as a live control", { skip }, () => {
  for (const [label, opts] of [["coin-start", {}], ["undriven", { tape: [] }]]) {
    const seen = { [TARGET]: 0, [DRAIN]: 0 };
    const realTarget = makeMachine().routines.get(TARGET);
    const realDrain = makeMachine().routines.get(DRAIN);
    const m = makeMachine(new Map([
      [TARGET, (mm, ...a) => (seen[TARGET]++, realTarget(mm, ...a))],
      [DRAIN, (mm, ...a) => (seen[DRAIN]++, realDrain(mm, ...a))],
    ]), opts);
    m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} run stopped early: ${m.stoppedBy}`);
    assert.ok(seen[DRAIN] > 0,
      `the ${label} run counted nothing at the drain either, so the instrument is broken and the ` +
        "zero beside it means nothing");
    assert.equal(seen[TARGET], 0,
      `${label} DOES dispatch this address now, so a captured entry is better evidence than a craft`);
    console.log(`  UNREACHED: ${label} — ${hex4(TARGET)} entered ${seen[TARGET]} times, the ` +
      `control ${hex4(DRAIN)} ${seen[DRAIN]}`);
  }
});

test("THE ENTRY: a real machine is captured at the drain's boot dispatch", { skip }, () => {
  assert.notEqual(entryState(), null, "the drain was never dispatched in the capture run");
  console.log("  THE ENTRY: captured one coherent machine at the drain dispatch");
});

test("REACHES THE DRAIN: both arms reach it once and hand it identical state", { skip }, () => {
  const logA = [];
  const logB = [];
  const a = severed(entryState(), logA);
  const b = severed(entryState(), logB);
  const retA = oracle(a);
  const retB = enterCommandRingDrain(b);
  assert.equal(logA.length, 1, "the oracle did not reach the drain exactly once");
  assert.equal(logB.length, 1, "the rewrite did not reach the drain exactly once");
  assert.deepEqual(logB, logA, "the state handed to the drain differs");
  assert.equal(retA, SENTINEL, "the oracle did not hand back the drain's continuation");
  assert.equal(retB, SENTINEL, "the rewrite did not hand back the drain's continuation");
  console.log("  REACHES THE DRAIN: one transfer each, identical hand-off, sentinel returned");
});

test("EQUAL: RAM, the hand-off state and the returned sentinel, on every crafted entry", { skip }, () => {
  for (const seed of SEEDS) {
    const d = unitDiff(enterCommandRingDrain, craft(seed));
    assert.equal(d, null, `seed ${JSON.stringify(seed)}: ${show(d)}`);
  }
  console.log(`  EQUAL: ${SEEDS.length} crafted register sets identical`);
});

test("NOT VACUOUS: a memory-writing twin FAILS the RAM diff", { skip }, () => {
  const d = unitDiff(brokenWritesMemory, craft(SEEDS[0]));
  assert.notEqual(d, null, "the RAM diff passed a candidate that scribbles a cell");
  assert.notEqual(d.addr, null, "the memory-writing twin must be caught on a cell, not a register");
  console.log(`  NOT VACUOUS: the memory-writing twin is caught — ${show(d)}`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count of crafted entries`, { skip }, () => {
    const caught = sweepCaught(twin);
    console.log(`  TEETH/${label}: caught on ${caught} of ${SEEDS.length} crafted entries`);
    assert.equal(caught, expected, `the ${label} twin's crafted catch count moved`);
    assert.ok(caught > 0, `the crafted space missed the ${label} twin everywhere`);
  });
}
