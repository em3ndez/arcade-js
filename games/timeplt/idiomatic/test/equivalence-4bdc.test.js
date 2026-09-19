// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintFiveLabelledNumericReadouts — memory-equivalent to the frozen oracle at ROM 0x4bdc.
 * GATE: the one attract dispatch plus crafted record contents; a MASKED diff excluding the stack
 * scratch the frozen side leaves below its seat, the two-byte SP drift asserted, F and SP the
 * register ceiling. The routine paints five readouts through paintLabelledNumericReadoutColumn; the crafts vary the source
 * records it reads. Run: node --test games/timeplt/idiomatic/test/equivalence-4bdc.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, romsPresent } from "./_harness.js";
import { paintFiveLabelledNumericReadouts } from "../paintFiveLabelledNumericReadouts.js";
import { loc_4bdc as oracle } from "../../translated/loc_4bdc.js";
import { paintLabelledNumericReadoutColumn } from "../paintLabelledNumericReadoutColumn.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x4bdc;
const CAPTURE_FRAMES = 1700;
const DATA_TOP = 0xa7ff;
const SP_DRIFT = 2;
const RECORDS = 0xab08;
const RECORDS_END = 0xab30;
// The frogger standard: RAM (masked over the frozen side's stack scratch) plus only the genuine named
// register live-outs. paintFive is memory-only (see the LIVE-OUT test below and its docstring), and the
// column painter it calls leaves nothing but scratch, so there are no register live-outs to pin.
const GENUINE_LIVE_OUTS = [];
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const READOUTS = [
  [0xab08, 0xa711, 0x14], [0xab10, 0xa713, 0x16], [0xab18, 0xa715, 0x12],
  [0xab20, 0xa717, 0x15], [0xab28, 0xa719, 0x13],
];
const PATTERNS = [(i) => 0, () => 0xff, (i) => (i * 7 + 3) & 0xff, (i) => (i & 1 ? 0x09 : 0x02)];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) =>
  d ? `${d.addr == null ? "registers" : hex4(d.addr)}: frozen=${d.a} rewrite=${d.b}` : "identical";

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  const m = makeMachine(new Map([[TARGET, (mm) => { entries.push(mm.clone()); return oracle(mm); }]]), { tape: [] });
  const frames = m.runFrames(CAPTURE_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.equal(frames.length, CAPTURE_FRAMES, "the capture run ran short");
  captured = entries;
  return captured;
}

/** The captured machine with its five source records overwritten by one byte pattern. */
function craft(pattern) {
  const m = capture()[0].clone();
  for (let a = RECORDS, i = 0; a < RECORDS_END; a++, i++) m.mem8[a] = pattern(i) & 0xff;
  return m;
}

/** Oracle vs candidate on clones: memory outside the frozen side's own push window, then the
 * registers outside the ceiling. The window floor is watched off the oracle's pushes. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  candidate(b);
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i] };
  }
  for (const k of GENUINE_LIVE_OUTS) {
    if (a.regs[k] !== b.regs[k]) return { addr: null, a: `${k}=${a.regs[k]}`, b: `${k}=${b.regs[k]}` };
  }
  return null;
}

function maskProbe(machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { push(v); if (a.regs.sp < low) low = a.regs.sp; };
  oracle(a);
  paintFiveLabelledNumericReadouts(b);
  return { low, seat, spDiff: (a.regs.sp - b.regs.sp) & 0xffff };
}

function footprint(machine) {
  const before = machine.dumpState().slice();
  const after = machine.clone();
  oracle(after);
  const now = after.dumpState();
  let n = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) n++;
  return n;
}

function paint(m, rows) {
  for (const [source, cursor, pen] of rows) {
    m.regs.hl = source;
    m.regs.de = cursor;
    m.regs.c = pen;
    paintLabelledNumericReadoutColumn(m);
  }
}

// ── broken twins ────────────────────────────────────────────────────────────────────────
function brokenNoOp() {}
function brokenSkipLast(m) { paint(m, READOUTS.slice(0, 4)); }
function brokenWrongPen(m) { paint(m, READOUTS.map(([s, c, p], i) => [s, c, i === 0 ? p ^ 1 : p])); }
function brokenWrongCursor(m) { paint(m, READOUTS.map(([s, c, p], i) => [s, i === 0 ? c + 2 : c, p])); }
function regScribble(m) { paintFiveLabelledNumericReadouts(m); m.regs.b = (m.regs.b + 1) & 0xff; }
function memScribble(m) { paintFiveLabelledNumericReadouts(m); m.mem8[0xa711] = (m.mem8[0xa711] + 1) & 0xff; }

const TWINS = [
  ["no-op", brokenNoOp],
  ["skip-last", brokenSkipLast],
  ["wrong-pen", brokenWrongPen],
  ["wrong-cursor", brokenWrongCursor],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────
test("REAL DISPATCH: the one attract dispatch, identical outside the scratch window", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: nothing dispatched this address, so there is no real state to compare");
  for (const e of entries) assert.equal(unitDiff(paintFiveLabelledNumericReadouts, e), null, "a real dispatch diverged");
  const footprints = entries.map(footprint);
  assert.ok(footprints.some((n) => n > 0), "the oracle wrote nothing, so a do-nothing rewrite would pass");
  console.log(`  REAL DISPATCH: ${entries.length} identical, footprints ${footprints.join(", ")} bytes`);
});

test("CRAFTED: varied record contents, identical outside the scratch window", { skip }, () => {
  for (const p of PATTERNS) assert.equal(unitDiff(paintFiveLabelledNumericReadouts, craft(p)), null, "a crafted entry diverged");
  const s0 = (() => { const m = craft(PATTERNS[0]); oracle(m); return m.dumpState(); })();
  const s1 = (() => { const m = craft(PATTERNS[1]); oracle(m); return m.dumpState(); })();
  // Two record sets that paint the SAME RAM would make these crafts decoration.
  assert.notEqual(firstStateDiff(s0, s1), null, "different records paint identical RAM");
  console.log(`  CRAFTED: ${PATTERNS.length} patterns identical`);
});

test("SP AND SCRATCH: the drift is two bytes and the mask floor sits above the painted data", { skip }, () => {
  const r = maskProbe(capture()[0]);
  assert.equal(r.spDiff, SP_DRIFT, `the frozen side no longer re-seats two bytes higher (${r.spDiff})`);
  assert.ok(r.low > DATA_TOP, `the stack window ${hex4(r.low)} reached down into painted data`);
  console.log(`  SP AND SCRATCH: spDiff ${r.spDiff}; window floor ${hex4(r.low)} under seat ${hex4(r.seat)}`);
});

test("LIVE-OUT: memory-only, the routine returns nothing", { skip }, () => {
  assert.equal(paintFiveLabelledNumericReadouts(capture()[0].clone()), undefined, "the routine returned a value its callers do not read");
  console.log("  LIVE-OUT: returns undefined");
});

test("SCRATCH NOT PINNED: a register-only twin passes; a RAM scribble is caught", { skip }, () => {
  // paintFive has no genuine register live-outs, so a twin that only scribbles a register is
  // DELIBERATELY not flagged — and the same measurement must still catch a scribbled RAM cell.
  const e = capture()[0];
  assert.equal(unitDiff(regScribble, e), null,
    "a scratch-register scribble was flagged, but paintFive has no genuine register live-outs to pin");
  const d = unitDiff(memScribble, e);
  assert.notEqual(d, null, "the RAM measurement missed a scribbled cell, so it has no teeth");
  assert.notEqual(d.addr, null, "the RAM scribble must be caught on a cell, not a register");
  console.log(`  SCRATCH NOT PINNED: register twin ignored; RAM twin caught — ${show(d)}`);
});

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT`, { skip }, () => {
    const onReal = capture().filter((e) => unitDiff(twin, e) !== null).length;
    const onCraft = PATTERNS.filter((p) => unitDiff(twin, craft(p)) !== null).length;
    assert.equal(onReal, capture().length, `the ${label} twin escaped a real dispatch`);
    assert.equal(onCraft, PATTERNS.length, `the ${label} twin escaped a crafted entry`);
    console.log(`  TEETH/${label}: caught on ${onReal}/${capture().length} real, ${onCraft}/${PATTERNS.length} crafted`);
  });
}
