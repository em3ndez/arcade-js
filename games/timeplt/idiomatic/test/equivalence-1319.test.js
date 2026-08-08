// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillCellRun — memory-equivalent to the frozen oracle at ROM 0x1319.
 *
 * GATE: crafted-entry, because the strict gate CANNOT run here. The shipped coin -> start tape
 *   never reaches 0x1319 within ENTRY_FRAMES — nor in 20000 frames, nor undriven, nor under a
 *   tape that re-coins every thirty seconds. Its callers are dark as well (0x142A, 0x14C5,
 *   0x49FA, 0x4A0F, 0x4A42), so this is an UNREACHED routine and no frame budget fixes that.
 *   unitEquivalence throws "never entered", and the first arm ASSERTS the throw rather than
 *   quietly raising maxFrames past what the harness exports.
 *
 *   The entry is therefore built rather than captured: a REAL machine, cloned at the end of the
 *   tape's session with play active, with only the two live-in registers set to what the callers
 *   pass. Video RAM, colour RAM, work RAM and the stack are the state the game itself produced.
 *
 * What it exercises, holes stated:
 *   1. REAL ARGUMENTS — the four (start, byte) pairs the callers pass: the blanking character
 *      into the two character-plane runs, and the two colour-plane runs painted from the base
 *      colour cell the callers add their offsets to.
 *   2. DEGENERATE, measured and asserted: on this backdrop the two character-plane runs ALREADY
 *      hold the blanking byte, so arm 1 is passed by a routine that does nothing at all. That is
 *      vacuity; it is measured here rather than assumed away, and arm 3 is what covers it.
 *   3. EXHAUSTIVE — every byte 0..255 at each of the four starts, 1024 cases.
 *   4. LIVE-OUT — the thirteen cells AND the cell-step register the callers read back without
 *      reloading. RAM equality is BLIND to that register: the twin that drops it is identical on
 *      all 1024 cases. The callers are what make it live, so the callers are where it is caught.
 *   5. CALLER-LEVEL — the blanking caller run whole with this routine wired under it, against the
 *      same caller over the frozen original. Mixed arms churn the dead stack scratch below the
 *      entry stack pointer, which is excluded, bounded at eight bytes, and asserted to be the
 *      ONLY divergence; every twin is caught OUTSIDE that window at real character-plane cells.
 *
 * HOLE: one backdrop. The routine reads only its two live-in registers and the cells it writes,
 * so the sweep covers its whole input space at the four starts the callers use; other starts are
 * not exercised, because no caller passes one.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-1319.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { fillCellRun } from "../fillCellRun.js";
import { loc_1319 as oracle } from "../../translated/loc_1319.js";
import { firstStateDiff, unitEquivalence } from "../../../../core/equivalence.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x1319;
const RUN_CELLS = 13;
const CELL_STEP = -32;

// The four run starts the callers pass: two in the character plane, two in the colour plane.
const STARTS = [0xa7b1, 0xa5d1, 0xa3b1, 0xa1d1];
const BLANK_CHAR = 0xf1;
const BASE_COLOUR = 0xad0c;
const COLOUR_OFFSETS = [0xa0, 0x20];

// Arm 5 runs caller 0x142A whole: its branch selector, the six cells it writes by hand off the
// step register this routine leaves it, and the dead stack scratch the mixed arms churn.
const CALLER = 0x142a;
const CALLER_BRANCH = 0xa9f2;
const CALLER_CELLS = [0xa610, 0xa5f0, 0xa611, 0xa5f1, 0xa612, 0xa5f2];
const DEAD_SCRATCH = 8;

const skip = romsPresent() ? false : "ROM images are gitignored and absent";
const hex4 = (v) => "0x" + u16(v).toString(16).padStart(4, "0");
const show = (d) => (d ? `${hex4(d.addr ?? 0)}: frozen=${d.a} candidate=${d.b}` : "identical");

// ── the session, and the entry built off it ─────────────────────────────────────────────────

let session = null;
function sessionRun() {
  if (session) return session;
  let host = null;
  let threw = null;
  try {
    unitEquivalence((overrides) => (host = makeMachine(overrides)), TARGET, oracle, fillCellRun, {
      maxFrames: ENTRY_FRAMES,
    });
  } catch (e) {
    threw = e;
  }
  session = { host, threw };
  return session;
}

let pristineEntry = null;
function pristine() {
  if (!pristineEntry) pristineEntry = sessionRun().host.clone();
  return pristineEntry;
}

function craft(start, fill) {
  const c = pristine().clone();
  c.regs.hl = start;
  c.regs.a = fill;
  return c;
}

/** The frozen original against a candidate, both from the same crafted entry. */
function diffOf(candidate, start, fill) {
  const a = craft(start, fill);
  const b = craft(start, fill);
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

function cellsFrom(start, step) {
  const out = [];
  let p = start;
  for (let i = 0; i < RUN_CELLS; i++) {
    out.push(pristine().mem8[p]);
    p = u16(p + step);
  }
  return out;
}

/** The (start, byte) pairs the callers pass, the colour ones off the live base-colour cell. */
function callArguments() {
  const base = pristine().mem8[BASE_COLOUR];
  return [
    [STARTS[0], BLANK_CHAR],
    [STARTS[1], BLANK_CHAR],
    [STARTS[2], u8(COLOUR_OFFSETS[0] + base)],
    [STARTS[3], u8(COLOUR_OFFSETS[1] + base)],
  ];
}

// ── twins ───────────────────────────────────────────────────────────────────────────────────
// Each differs from the real arm in exactly one term, and each must be caught by the SAME
// comparison the real arm passes — or, for the one RAM cannot see, by the caller that reads it.

function filler({ cells = RUN_CELLS, step = CELL_STEP, delta = 0, keepStep = true }) {
  return (m) => {
    const { regs, mem8 } = m;
    let cursor = regs.hl;
    for (let i = 0; i < cells; i++) {
      mem8[cursor] = u8(regs.a + delta);
      cursor = u16(cursor + step);
    }
    if (keepStep) regs.de = u16(CELL_STEP);
  };
}

const brokenNoOp = () => {};
const brokenShortRun = filler({ cells: RUN_CELLS - 1 });
const brokenForwardStride = filler({ step: -CELL_STEP });
const brokenWrongByte = filler({ delta: 1 });
const brokenDropsStep = filler({ keepStep: false });

// ── arm 1: the strict gate cannot run ───────────────────────────────────────────────────────

test("NEVER ENTERED: the tape does not reach the routine, and the session says so", { skip }, () => {
  const { host, threw } = sessionRun();
  assert.notEqual(threw, null, "the routine WAS reached — retire the crafted entry, gate strictly");
  assert.match(threw.message, /never entered/, `unexpected failure: ${threw.message}`);
  assert.equal(host.stoppedBy, null, `the session did not complete: ${host.stoppedBy}`);
  assert.equal(host.frames.length, ENTRY_FRAMES, "the session must run the whole frame budget");
  console.log(`  NEVER ENTERED: ${ENTRY_FRAMES} frames ran clean and the routine never dispatched`);
});

// ── arms 2-4: the crafted entry ─────────────────────────────────────────────────────────────

test("REAL ARGUMENTS: identical RAM at each of the four calls the callers make", { skip }, () => {
  for (const [start, fill] of callArguments()) {
    const d = diffOf(fillCellRun, start, fill);
    assert.equal(d, null, `${hex4(start)} filled with ${fill} — ${show(d)}`);
  }
  console.log(`  REAL ARGUMENTS: ${callArguments().map(([s, f]) => `${hex4(s)}<-${f}`).join(" ")}`);
});

test("DEGENERATE: two of those four calls write the byte already there", { skip }, () => {
  const degenerate = callArguments().filter(([start, fill]) =>
    cellsFrom(start, CELL_STEP).every((v) => v === fill),
  );
  assert.deepEqual(
    degenerate.map(([start]) => hex4(start)),
    ["0xa7b1", "0xa5d1"],
    "the backdrop moved: which calls are invisible has changed, so re-derive the arms",
  );
  for (const [start, fill] of degenerate) {
    assert.equal(diffOf(brokenNoOp, start, fill), null, "a no-op must PASS here — that is the point");
  }
  console.log(`  DEGENERATE: ${degenerate.length} of 4 real calls are invisible; the sweep covers them`);
});

test("EXHAUSTIVE: every byte at every start, 1024 cases identical", { skip }, () => {
  let swept = 0;
  for (const start of STARTS) {
    for (let fill = 0; fill < 256; fill++) {
      const d = diffOf(fillCellRun, start, fill);
      assert.equal(d, null, `${hex4(start)} filled with ${fill} — ${show(d)}`);
      swept++;
    }
  }
  assert.equal(swept, STARTS.length * 256, "must have swept every byte at every start");
  console.log(`  EXHAUSTIVE: ${swept} cases identical`);
});

test("LIVE-OUT: the step register survives, and only dead registers move", { skip }, () => {
  const a = craft(STARTS[0], BLANK_CHAR);
  const b = craft(STARTS[0], BLANK_CHAR);
  oracle(a);
  fillCellRun(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  const unexpected = moved.filter((k) => !["f", "b", "h", "l", "sp"].includes(k));
  assert.deepEqual(
    unexpected,
    [],
    "a register diverged outside the excluded set: only the flag byte, the loop counter, the " +
      "cursor pair and the stack pointer may differ — every caller reloads all four before " +
      "reading them",
  );
  assert.equal(a.regs.de, b.regs.de, "the cell-step register is a LIVE-OUT, not an exclusion");
  assert.equal(a.regs.a, b.regs.a, "the fill byte is left standing for the caller's own writes");
  assert.notEqual(a.pc, b.pc, "the frozen return moves pc; the rewrite returns to JS");
  console.log(`  LIVE-OUT: step register ${hex4(b.regs.de)}; moved ${moved.join(", ")} and pc`);
});

test("BLIND: RAM equality cannot see the step register at all", { skip }, () => {
  let identical = 0;
  for (const start of STARTS) {
    for (let fill = 0; fill < 256; fill++) if (diffOf(brokenDropsStep, start, fill) === null) identical++;
  }
  assert.equal(identical, STARTS.length * 256, "RAM caught the dropped register — re-derive this arm");

  const a = craft(STARTS[0], BLANK_CHAR);
  const b = craft(STARTS[0], BLANK_CHAR);
  oracle(a);
  brokenDropsStep(b);
  assert.notEqual(a.regs.de, b.regs.de, "the live-out check must catch what RAM cannot");
  console.log(`  BLIND: the dropped-register twin is RAM-identical on all ${identical} cases`);
});

// ── teeth on the crafted entry ──────────────────────────────────────────────────────────────

const TWINS = [
  [
    "no-op",
    brokenNoOp,
    (start, fill) => cellsFrom(start, CELL_STEP).some((v) => v !== fill),
    [255, 255, 256, 256],
  ],
  [
    "short-run",
    brokenShortRun,
    (start, fill) => cellsFrom(start, CELL_STEP)[RUN_CELLS - 1] !== fill,
    [255, 255, 255, 255],
  ],
  [
    "forward-stride",
    brokenForwardStride,
    (start, fill) =>
      cellsFrom(start, CELL_STEP).slice(1).some((v) => v !== fill) ||
      cellsFrom(start, -CELL_STEP).slice(1).some((v) => v !== fill),
    [256, 255, 256, 256],
  ],
  ["wrong-byte", brokenWrongByte, () => true, [256, 256, 256, 256]],
];

for (const [label, twin, predicted, pinned] of TWINS) {
  test(`TEETH: the ${label} twin is caught on exactly the cases it should be`, { skip }, () => {
    const caught = [];
    const expected = [];
    for (const start of STARTS) {
      let c = 0;
      let e = 0;
      for (let fill = 0; fill < 256; fill++) {
        if (diffOf(twin, start, fill)) c++;
        if (predicted(start, fill)) e++;
      }
      caught.push(c);
      expected.push(e);
    }
    assert.deepEqual(caught, expected, "caught on a DIFFERENT set than the theory predicts");
    assert.deepEqual(caught, pinned, "the backdrop moved — re-measure before trusting this arm");
    console.log(`  TEETH/${label}: caught ${caught.join("/")} of 256 per start`);
  });
}

// ── arm 5: the caller ───────────────────────────────────────────────────────────────────────

/** The blanking caller, run whole over `fn`, on dirtied cells so its writes are visible. */
function callerRun(fn) {
  const c = pristine().clone();
  c.routines = new Map(c.routines);
  c.routines.set(TARGET, fn);
  c.mem8[CALLER_BRANCH] = 0;
  c.regs.de = 0;
  for (const start of [STARTS[0], STARTS[1], ...CALLER_CELLS]) {
    let p = start;
    for (let i = 0; i < RUN_CELLS; i++) {
      c.mem8[p] = u8(0x40 + i);
      p = u16(p + CELL_STEP);
    }
  }
  c.call(CALLER);
  return c;
}

function differingAddrs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) out.push(a.stateOffsetToAddr(i));
  return out;
}

test("CALLER-LEVEL: the caller composes, and its twins are caught at real cells", { skip }, () => {
  const entrySp = pristine().regs.sp;
  const dead = (addr) => addr >= entrySp - DEAD_SCRATCH && addr < entrySp;
  const frozen = callerRun(oracle);

  const mixed = differingAddrs(frozen, callerRun(fillCellRun));
  assert.ok(
    mixed.every(dead),
    `the caller diverged outside the dead stack scratch: ${mixed.map(hex4).join(",")}`,
  );
  assert.equal(mixed.length, 3, "the excluded churn must stay exactly the three scratch bytes");

  const outside = (fn) => differingAddrs(frozen, callerRun(fn)).filter((a) => !dead(a)).map(hex4);
  assert.deepEqual(
    outside(brokenDropsStep),
    ["0xa5f0", "0xa5f1", "0xa5f2"],
    "dropping the step register must corrupt the three cells the caller steps to itself",
  );
  assert.deepEqual(outside(brokenShortRun), ["0xa451", "0xa631"], "the last cell of each run");
  assert.equal(outside(brokenNoOp).length, 29, "the no-op must lose both runs and the stepped cells");
  console.log(`  CALLER-LEVEL: mixed arms differ only at ${mixed.map(hex4).join(",")}, all dead`);
});
