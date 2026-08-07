// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0d6b — memory-equivalent to the frozen oracle at ROM 0x0D6B.
 *
 * GATE: strict unit-capture with the printer RUNNING, plus a severed arm that inspects the three
 *   arguments this entry exists to fix, plus a corpus, plus teeth. What it exercises, holes
 *   stated:
 *
 *   1. EQUAL at the real dispatch with the printer running — RAM byte-identical across the whole
 *      state dump, AND every register identical, the stack pointer included, because the printer
 *      returns on both sides. Nothing is excluded at all in this arm.
 *   2. SEVERED — the printer replaced by a recorder on BOTH arms, so the three arguments this
 *      entry chooses are compared directly. This is the arm that would catch a rewrite whose
 *      argument happened to make no visible difference on the one captured screen.
 *   3. THE ARGUMENTS ARE PINNED AS VALUES, not merely compared: the recorded triple is asserted
 *      against the constants the module names, so a rewrite and a twin cannot drift together.
 *   4. CORPUS — every dispatch of the driven tape and of the undriven demo. ★ THIS ENTRY FIRES
 *      ONCE PER SESSION and the corpus arm asserts that count, so a change is a finding.
 *   5. TEETH — a twin for each way this entry could be wrong: doing nothing, each of the three
 *      arguments taken from the wrong place, the field walked from the wrong end, and the
 *      transfer skipped. Each is listed with the exact arms that catch it.
 *
 * HOLE: one dispatch per session, at one point in the sequence, so nothing here exercises the
 * printer against a different screen state.
 * HOLE: nothing here establishes what the tally being printed IS. This entry chooses a source
 * and a destination; what lives at that source is the printer's business and its caller's.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-0d6b.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0d6b } from "../loc_0d6b.js";
import { loc_0d6b as oracle } from "../../translated/loc_0d6b.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TARGET = 0x0d6b;
const PRINTER = 0x0d73;
const CORPUS_FRAMES = 2500;

/** The triple this entry exists to choose, asserted as values rather than merely compared. */
const TALLY_TOP_BYTE = 0xa98d;
const FIRST_DIGIT_CELL = 0xa641;
const DIGIT_COLOUR = 0x10;

const TAPES = [
  ["driven", {}],
  ["attract", { tape: [] }],
];
const DISPATCHES = { driven: 1, attract: 1 };

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");

let entry = null;

function gate(candidate) {
  return unitEquivalence(
    makeMachine,
    TARGET,
    oracle,
    (m) => {
      if (entry === null) entry = m.clone();
      return candidate(m);
    },
    { maxFrames: ENTRY_FRAMES },
  );
}

function entryState() {
  if (entry === null) gate(loc_0d6b);
  return entry;
}

/** A clone whose printer is a recorder, installed identically on both arms. */
function severed(machine, log) {
  const c = machine.clone();
  c.routines = new Map(c.routines);
  c.routines.set(PRINTER, (mm) => {
    log.push({ source: mm.regs.hl, destination: mm.regs.de, colour: mm.regs.c });
  });
  return c;
}

/** The full contract: RAM and every register with the printer running, then the arguments. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return ram;
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  if (moved.length) return { addr: null, reg: moved[0], a: a.regs[moved[0]], b: b.regs[moved[0]] };
  const logA = [];
  const logB = [];
  const sa = severed(machine, logA);
  const sb = severed(machine, logB);
  oracle(sa);
  candidate(sb);
  if (logA.length !== logB.length) {
    return { addr: null, reg: "handovers", a: logA.length, b: logB.length };
  }
  for (const [i, x] of logA.entries()) {
    for (const k of ["source", "destination", "colour"]) {
      if (x[k] !== logB[i][k]) return { addr: null, reg: k, a: x[k], b: logB[i][k] };
    }
  }
  return null;
}

function replaySession(opts, candidate) {
  let dispatches = 0;
  let caught = 0;
  const m = makeMachine(
    new Map([[TARGET, (mm) => {
      dispatches++;
      if (unitDiff(candidate, mm)) caught++;
      return oracle(mm);
    }]]),
    opts,
  );
  const frames = m.runFrames(CORPUS_FRAMES);
  assert.equal(m.stoppedBy, null, `session stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CORPUS_FRAMES, "session ran short");
  return { dispatches, caught };
}

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: prints one of the OTHER two siblings' tallies. */
function brokenWrongSource(m) {
  m.regs.de = FIRST_DIGIT_CELL;
  m.regs.hl = 0xad35;
  m.regs.c = DIGIT_COLOUR;
  return m.call(PRINTER);
}

/** BUG: prints into one of the other siblings' screen positions. */
function brokenWrongDestination(m) {
  m.regs.de = 0xa781;
  m.regs.hl = TALLY_TOP_BYTE;
  m.regs.c = DIGIT_COLOUR;
  return m.call(PRINTER);
}

/** BUG: picks a different colour for the digits. */
function brokenWrongColour(m) {
  m.regs.de = FIRST_DIGIT_CELL;
  m.regs.hl = TALLY_TOP_BYTE;
  m.regs.c = DIGIT_COLOUR + 1;
  return m.call(PRINTER);
}

/** BUG: walks the tally upward from its lowest byte instead of down from its highest. */
function brokenLowestByteFirst(m) {
  m.regs.de = FIRST_DIGIT_CELL;
  m.regs.hl = TALLY_TOP_BYTE - 2;
  m.regs.c = DIGIT_COLOUR;
  return m.call(PRINTER);
}

/** BUG: fixes the arguments and never transfers, so nothing is printed. */
function brokenSkipsThePrinter(m) {
  m.regs.de = FIRST_DIGIT_CELL;
  m.regs.hl = TALLY_TOP_BYTE;
  m.regs.c = DIGIT_COLOUR;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["wrong-source", brokenWrongSource],
  ["wrong-destination", brokenWrongDestination],
  ["wrong-colour", brokenWrongColour],
  ["lowest-byte-first", brokenLowestByteFirst],
  ["skips-the-printer", brokenSkipsThePrinter],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: RAM and EVERY register, the stack pointer included", { skip }, () => {
  const r = gate(loc_0d6b);
  assert.notEqual(entry, null, "vacuous: the tape never reached the routine");
  assert.equal(r.ram, null, `RAM diverged — ${show(r.ram)}`);
  assert.equal(r.regs, null, `a register diverged — ${JSON.stringify(r.regs)}`);
  const a = entryState().clone();
  const b = entryState().clone();
  oracle(a);
  loc_0d6b(b);
  assert.deepEqual(
    REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    [],
    "NOTHING is excluded for this entry: the printer it falls into returns on both sides, so " +
      "even the stack pointer must agree",
  );
  assert.equal(a.pc, b.pc, "the printer's own return sets pc on both sides");
  console.log("  EQUAL: RAM and every register identical, sp and pc included");
});

test("SEVERED: the three arguments are the ones this entry names, and only those", { skip }, () => {
  const logA = [];
  const logB = [];
  const a = severed(entryState(), logA);
  const b = severed(entryState(), logB);
  oracle(a);
  loc_0d6b(b);
  assert.equal(logA.length, 1, "vacuous: the oracle did not reach the printer");
  assert.deepEqual(logB, logA, "the arguments handed to the printer differ");
  assert.deepEqual(
    logA[0],
    { source: TALLY_TOP_BYTE, destination: FIRST_DIGIT_CELL, colour: DIGIT_COLOUR },
    "the argument triple moved, so the constants this module names are no longer the ROM's",
  );
  assert.equal(
    firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    null,
    "with the printer severed neither arm may write anything at all",
  );
  console.log(
    `  SEVERED: source=${hex4(TALLY_TOP_BYTE)} destination=${hex4(FIRST_DIGIT_CELL)} ` +
      `colour=${DIGIT_COLOUR}`,
  );
});

test("CORPUS: the one dispatch of each session replays identically", { skip }, () => {
  let total = 0;
  for (const [label, opts] of TAPES) {
    const r = replaySession(opts, loc_0d6b);
    assert.equal(r.dispatches, DISPATCHES[label], `the ${label} dispatch count moved`);
    assert.ok(r.dispatches > 0, `vacuous: the ${label} tape never reached the routine`);
    assert.equal(r.caught, 0, `the rewrite diverged on ${r.caught} ${label} dispatches`);
    total += r.dispatches;
  }
  console.log(`  CORPUS: ${total} dispatches over two sessions, identical on each`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT at the real dispatch`, { skip }, () => {
    const d = unitDiff(twin, entryState());
    assert.notEqual(d, null, `the gate PASSED the ${label} twin — it has no teeth`);
    console.log(`  TEETH/${label}: caught — ${JSON.stringify(d)}`);
  });
}
