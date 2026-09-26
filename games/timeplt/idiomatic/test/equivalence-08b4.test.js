// SPDX-License-Identifier: GPL-3.0-only
/**
 * erasePenRouteThenOpenInitialsEntry — memory-equivalent to the frozen oracle at ROM 0x08B4.
 * GATE: the arm is reached only when a score files into the high-score table, which the shipped
 *   tape may never do, so any real dispatch the tape makes is captured AND entries are sourced at
 *   0x0201 (the pen-run sub-call the arm opens with, heavily dispatched). Three branches:
 *     - retnz   — a pooled entry, the pen run reseats to a non-zero row and the arm exits;
 *     - full    — the run index seated on the prior that reseats to a zero row (the value the 0x1734
 *                 gate measured), with sentinels on every cell the full path writes;
 *     - derail  — a full entry on a ROM copy with one byte of the 256-byte checked block bumped, so
 *                 the fold misses and the oracle jumps into the frame service from outside an interrupt.
 *   The derail is an anti-tamper arm: the checked block is program ROM and folds to 0x30 on a genuine
 *   image, so the arm is dead there. The module RAISES NotImplemented on it rather than transcribing the
 *   derail; the derail scenarios are therefore held to the fault (DERAIL test), not byte-replayed, while
 *   retnz/full stay memory-equivalent. DERAIL also computes the genuine fold from the ROM image (positive
 *   control that the fault is dead on a clean ROM), shows the oracle's branch really turns on the fold, and
 *   catches a no-derail twin that proceeds on a tamper.
 *   RAM is compared with the dead stack scratch below the seated SP masked out, plus pc and SP.
 *   Registers are not compared: the oracle's live-out is memory only — its caller's continuation
 *   (0x0F54) loads A and re-derives F before reading any register, and reads no other register.
 *   The seam tooth (R36) runs the rewrite through withOmittedRet on the retnz/full branches.
 *   Run: node --test games/timeplt/idiomatic/test/equivalence-08b4.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { erasePenRouteThenOpenInitialsEntry as candidate } from "../erasePenRouteThenOpenInitialsEntry.js";
import { loc_08b4 as oracle } from "../../translated/loc_08b4.js";
import { loc_0201 as oracle0201 } from "../../translated/loc_0201.js";
import { drawInterpolatedPenRun } from "../drawInterpolatedPenRun.js";
import { postCommand } from "../postCommand.js";
import { paintFiveLabelledNumericReadouts } from "../paintFiveLabelledNumericReadouts.js";
import { fetchTableByte } from "../fetchTableByte.js";
import { advanceSequenceSubStep } from "../advanceSequenceSubStep.js";
import { NotImplemented } from "../../../../boards/timeplt/io.js";
import {
  COMMAND_RING,
  COMMAND_WRITE_CURSOR,
  HIGH_SCORE_INITIALS_CELL_BASE,
  PEN_ROUTE_LEG,
  PEN_ROW_CELL,
  SCRATCH_PTR_B,
  SEQUENCE_SUBSTEP,
} from "../names.js";

const TARGET = 0x08b4;
const ENTRY_SITE = 0x0201;
const CHECKED_BLOCK = 0x4880;
const CHECKED_BYTES = 256;
const GENUINE_FOLD = 0x30;
const GLYPH_TABLE = 0x12c7;
const SAVED_COLOUR = 0xa990;
const CLEARED_RUN = 0xa995;
const RUN_END = CLEARED_RUN + 5;
const RING_CELLS = 64;

// Seating the pen route leg here makes the pen run reseat to a zero row integer (measured by the
// 0x1734 gate over the same pool), so the oracle takes the full path rather than the early ret.
const ZERO_ROW_PRIOR = 0x69;
const SENTINEL = 0xee;
const COLOUR_SENTINEL = 0x0d;
const SAVED_SENTINEL = 0x5a;

// Every game-data write lands at or below here; the stack seats above it.
const DATA_TOP = 0xadff;
const POOL_CAP = 60;
const DISPATCH_CAP = 8;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

// ── the masked comparison ─────────────────────────────────────────────────────────────────

function run(fn, m) {
  try {
    fn(m);
    return null;
  } catch (e) {
    return String(e && e.message);
  }
}

/**
 * Oracle vs a candidate on independent clones. The oracle pushes return addresses into stack scratch
 * the rewrite leaves differently (and, on the derail, register values the rewrite never seats), so the
 * diff excludes [lowestSp, seat) — lowestSp measured over BOTH sides' pushes. A throw on one side only
 * is a divergence; the same throw on both is compared as an outcome.
 */
function compare(cand, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  for (const side of [a, b]) {
    const push = side.push16.bind(side);
    side.push16 = (v) => {
      push(v);
      if (side.regs.sp < low) low = side.regs.sp;
    };
  }
  const threwA = run(oracle, a);
  const threwB = run(cand, b);
  if (threwA !== threwB) {
    return { escaped: { addr: -1, oracle: threwA, candidate: threwB }, low, seat, spDiff: 0, pcDiff: 0 };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  let escaped = null;
  for (let i = 0; i < da.length && escaped === null; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    escaped = { addr, oracle: da[i], candidate: db[i] };
  }
  return { escaped, low, seat, spDiff: a.regs.sp - b.regs.sp, pcDiff: a.pc - b.pc, threw: threwA };
}

// The rewrite omits its ROM ret on every branch (the dispatch seam completes it), so it is compared
// PLACED through the seam; called directly it must leave SP where it found it.
const placed = withOmittedRet(candidate, TARGET);
function spNeutral(machine) {
  const c = machine.clone();
  const before = c.regs.sp;
  run(candidate, c);
  return c.regs.sp === before;
}

const diverged = (r) => r.escaped !== null || r.spDiff !== 0 || r.pcDiff !== 0;

/** Cells the oracle moves from a state, ignoring the stack scratch — a branch's footprint. */
function footprint(machine) {
  const a = machine.clone();
  const before = a.dumpState().slice();
  run(oracle, a);
  const now = a.dumpState();
  const cells = new Set();
  for (let i = 0; i < now.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (now[i] !== before[i] && addr <= DATA_TOP) cells.add(addr);
  }
  return cells;
}

// ── the entry pools ───────────────────────────────────────────────────────────────────────

let pools = null;
function entryPools() {
  if (pools === null) {
    const sites = [];
    const dispatches = [];
    let sealed = false;
    const m = makeMachine(new Map([
      [ENTRY_SITE, (mm) => {
        if (!sealed && sites.length < POOL_CAP) sites.push(mm.clone());
        return oracle0201(mm);
      }],
      [TARGET, (mm) => {
        if (!sealed && dispatches.length < DISPATCH_CAP) dispatches.push(mm.clone());
        return oracle(mm);
      }],
    ]));
    m.runFrames(ENTRY_FRAMES);
    sealed = true;
    pools = { sites, dispatches };
  }
  return pools;
}

/** A pooled entry forced onto the full path, with every cell that path writes pre-seated to a sentinel. */
function craftFull(entry) {
  const m = entry.clone();
  const { mem8, mem16 } = m;
  mem8[PEN_ROUTE_LEG] = ZERO_ROW_PRIOR;
  for (let i = 0; i <= 5; i++) mem8[CLEARED_RUN + i] = SENTINEL;
  mem8[SAVED_COLOUR] = SAVED_SENTINEL;
  // the arm stamps where the scratch pointer names: seat it on a real initials cell
  mem16[SCRATCH_PTR_B] = HIGH_SCORE_INITIALS_CELL_BASE;
  mem8[HIGH_SCORE_INITIALS_CELL_BASE] = SENTINEL;
  mem8[HIGH_SCORE_INITIALS_CELL_BASE & ~0x400] = COLOUR_SENTINEL;
  // a free ring, so every posted caption lands rather than being dropped
  for (let i = 0; i < RING_CELLS; i++) mem8[COMMAND_RING + i] = 0xff;
  return m;
}

/** A full entry on a private ROM copy with one checked byte bumped — the fold misses. */
function craftDerail(entry, i) {
  const m = craftFull(entry);
  const patched = Uint8Array.from(m.mem.rom);
  patched[CHECKED_BLOCK + i] = (patched[CHECKED_BLOCK + i] + 1) & 0xff;
  m.rom = patched;
  m.mem.rom = patched;
  return m;
}

function scenarios() {
  const { sites } = entryPools();
  return [
    ["retnz-0", sites[0]],
    ["retnz-1", sites[1]],
    ["full-0", craftFull(sites[0])],
    ["full-2", craftFull(sites[2])],
    ["derail-0", craftDerail(sites[0], 0)],
    ["derail-2", craftDerail(sites[2], 0x7f)],
  ];
}

/** Which branch a machine drives, read off the frozen side. The derail is identified POSITIVELY — the
 * oracle transfers to the frame service at FRAME_SERVICE — not as the residue of the other two. */
const FRAME_SERVICE = 0x00d9;
function branchOf(machine) {
  const a = machine.clone();
  const before = a.mem8[SEQUENCE_SUBSTEP];
  let derailed = false;
  const call = a.call.bind(a);
  a.call = (target, ...rest) => {
    if (target === FRAME_SERVICE) derailed = true;
    return call(target, ...rest);
  };
  const threw = run(oracle, a);
  if (derailed) return "derail";
  const stepped = ((a.mem8[SEQUENCE_SUBSTEP] - before) & 0xff) === 1;
  if (stepped && a.mem8[RUN_END] === 3) return "full";
  if (a.mem8[PEN_ROW_CELL] !== 0 && threw === null) return "retnz";
  return "unclassified";
}

// ── the twins ─────────────────────────────────────────────────────────────────────────────

/** The rewrite with one deliberate defect each; every default matches erasePenRouteThenOpenInitialsEntry. */
function build({
  gate = "nz", fold = 0x30, derail = true, captions = [0x13, 0x00, 0x14, 0x15, 0x0c], readouts = true,
  runLen = 5, terminator = 3, glyphIndex = 4, cellOffset = 0, plane = 0x400, saveColour = true, step = true,
}) {
  return (m) => {
    const { mem8, mem16 } = m;
    drawInterpolatedPenRun(m);
    if (gate === "nz" ? mem8[PEN_ROW_CELL] !== 0 : mem8[PEN_ROW_CELL] === 0) return;
    let f = 0;
    for (let i = 0; i < 256; i++) f ^= mem8[CHECKED_BLOCK + i];
    if (f !== fold && derail) throw new NotImplemented("twin tamper derail");
    for (const arg of captions) postCommand(m, 1, arg);
    if (readouts) paintFiveLabelledNumericReadouts(m);
    for (let i = 0; i < runLen; i++) mem8[CLEARED_RUN + i] = 0;
    mem8[CLEARED_RUN + 5] = terminator;
    const cell = (mem16[SCRATCH_PTR_B] + cellOffset) & 0xffff;
    mem8[cell] = fetchTableByte(m, GLYPH_TABLE, mem8[CLEARED_RUN + glyphIndex]);
    if (saveColour) mem8[SAVED_COLOUR] = mem8[cell & ~plane];
    return step ? advanceSequenceSubStep(m) : undefined;
  };
}

// [label, twin, branches it must be caught on]
const TWINS = [
  ["no-op", () => {}, ["retnz", "full"]],
  ["inverted-gate", build({ gate: "z" }), ["retnz", "full"]],
  ["wrong-fold", build({ fold: 0x31 }), ["full"]],
  ["drop-caption", build({ captions: [0x13, 0x00, 0x14, 0x15] }), ["full"]],
  ["skip-readouts", build({ readouts: false }), ["full"]],
  ["short-run", build({ runLen: 4 }), ["full"]],
  ["wrong-terminator", build({ terminator: 2 }), ["full"]],
  ["wrong-cell", build({ cellOffset: 1 }), ["full"]],
  ["wrong-plane", build({ plane: 0 }), ["full"]],
  ["skip-colour-save", build({ saveColour: false }), ["full"]],
  ["skip-step", build({ step: false }), ["full"]],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACH: the entry-site tap fires, and any real dispatch of the arm is reported", { skip }, () => {
  const { sites, dispatches } = entryPools();
  assert.ok(sites.length > 2, "vacuous: the tape never reached the entry site");
  console.log(`  REACH: ${hex4(TARGET)} dispatched ${dispatches.length} time(s) (capped ${DISPATCH_CAP}); entry site pooled ${sites.length}`);
});

test("EQUAL over the real dispatches (if any) and the entry-site pool", { skip }, () => {
  const { sites, dispatches } = entryPools();
  for (const e of [...dispatches, ...sites]) {
    const r = compare(placed, e);
    assert.equal(r.escaped, null, r.escaped && `escaped the mask at ${hex4(r.escaped.addr)}`);
    assert.equal(r.spDiff, 0, "SP diverged");
    assert.ok(spNeutral(e), "called directly the rewrite moved SP -- it popped a return slot");
    assert.equal(r.pcDiff, 0, "pc diverged");
    assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached into game data`);
  }
  console.log(`  EQUAL: ${dispatches.length} real + ${sites.length} pooled entries identical`);
});

test("PATHS: every branch equivalent, and each branch is the branch it claims", { skip }, () => {
  const seen = new Set();
  for (const [label, m] of scenarios()) {
    const branch = branchOf(m);
    assert.equal(branch, label.split("-")[0], `${label} drives the ${branch} branch`);
    seen.add(branch);
    // The derail is the tamper fault: held to the raise in DERAIL, not byte-replayed here.
    if (branch === "derail") continue;
    const r = compare(placed, m);
    assert.equal(r.escaped, null, `${label} escaped at ${r.escaped && hex4(r.escaped.addr)}`);
    assert.equal(r.spDiff, 0, `${label}: SP diverged`);
    assert.ok(spNeutral(m), `${label}: called directly the rewrite moved SP`);
    assert.equal(r.pcDiff, 0, `${label}: pc diverged`);
  }
  assert.deepEqual([...seen].sort(), ["derail", "full", "retnz"], "the scenarios miss a branch");
  // ★ Vacuity: the full branch must touch the run, its terminator, the stamped cell, the saved colour and
  // the sequence cell and the ring cursor; the early-ret branch none of the RAM cells among them.
  const [, retnz] = scenarios()[0];
  const [, full] = scenarios()[2];
  const pf = footprint(full);
  const pr = footprint(retnz);
  for (const cell of [CLEARED_RUN, RUN_END, HIGH_SCORE_INITIALS_CELL_BASE, SAVED_COLOUR, SEQUENCE_SUBSTEP, COMMAND_WRITE_CURSOR]) {
    assert.ok(pf.has(cell), `the full branch never wrote ${hex4(cell)}`);
  }
  for (const cell of [CLEARED_RUN, RUN_END, SAVED_COLOUR, SEQUENCE_SUBSTEP, COMMAND_WRITE_CURSOR]) {
    assert.ok(!pr.has(cell), `the early-ret branch wrote ${hex4(cell)}`);
  }
  console.log(`  PATHS: retnz/full scenarios equivalent; derail scenarios identified (held to the fault)`);
});

test("DERAIL: the fold is genuine on the ROM, a tamper raises, the guard is conditional, a no-derail twin is caught", { skip }, () => {
  const { sites } = entryPools();
  // Positive control 1: the checked block is program ROM and folds to the genuine byte on this image, so
  // the fault is dead on a clean ROM (computed, not assumed).
  const rom = sites[0].mem.rom;
  let fold = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) fold ^= rom[CHECKED_BLOCK + i];
  assert.equal(fold, GENUINE_FOLD, `the genuine ROM folds to 0x${fold.toString(16)}, not 0x30`);
  // Positive control 2: the full entries are genuine and do not fault.
  for (const [label, m] of scenarios()) {
    if (!label.startsWith("full")) continue;
    assert.doesNotThrow(() => candidate(m.clone()), `${label}: a genuine image faulted`);
  }
  // The guard is genuinely conditional: the SAME entry takes the full branch on the genuine ROM and the
  // derail branch on a one-byte tamper, read off the frozen oracle.
  const [, full] = scenarios()[2];
  assert.equal(branchOf(full), "full", "the genuine entry does not take the full branch");
  for (const [label, m] of scenarios()) {
    if (!label.startsWith("derail")) continue;
    let f = 0;
    for (let i = 0; i < CHECKED_BYTES; i++) f ^= m.mem.rom[CHECKED_BLOCK + i];
    assert.notEqual(f, GENUINE_FOLD, `${label}: vacuous, the crafted ROM still folds genuine`);
    assert.equal(branchOf(m), "derail", `${label}: the oracle did not derail on the tamper`);
    assert.throws(() => candidate(m.clone()), NotImplemented, `${label}: the tamper did not raise`);
  }
  // TEETH: a twin that proceeds on a tamper does not raise — it would be caught here.
  const noDerail = build({ derail: false });
  for (const [label, m] of scenarios()) {
    if (!label.startsWith("derail")) continue;
    assert.doesNotThrow(() => noDerail(m.clone()), `${label}: the no-derail twin raised, so the teeth are blind`);
  }
  console.log("  DERAIL: genuine fold 0x30 computed from ROM; full does not fault; tamper raises; no-derail twin caught");
});

test("SEAM (R36): the rewrite is placeable by withOmittedRet on the retnz and full branches", { skip }, () => {
  for (const [label, m] of scenarios()) {
    if (label.startsWith("derail")) continue;
    const r = seamPlaceable(withOmittedRet, candidate, TARGET, m.clone());
    assert.equal(r.placeable, true, `${label}: ${r.error}`);
  }
  // Null mutant: a rewrite that leaves SP one word adrift must be refused by the same check.
  const adrift = (m) => { candidate(m); m.pop16(); };
  const [, full] = scenarios()[2];
  assert.equal(seamPlaceable(withOmittedRet, adrift, TARGET, full.clone()).placeable, false,
    "the seam placed an adrift rewrite, so its green is blind");
  console.log("  SEAM: placeable on every non-derail scenario; adrift mutant refused");
});

for (const [label, twin, branches] of TWINS) {
  test(`TEETH: the ${label} twin is caught on every ${branches.join("/")} scenario`, { skip }, () => {
    let caught = 0;
    let owed = 0;
    for (const [name, m] of scenarios()) {
      if (!branches.includes(name.split("-")[0])) continue;
      owed++;
      if (diverged(compare(withOmittedRet(twin, TARGET), m))) caught++;
    }
    assert.ok(owed > 0, `no scenario exercises the ${label} twin`);
    assert.equal(caught, owed, `the ${label} twin slipped through ${owed - caught} of ${owed}`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${owed}`);
  });
}
