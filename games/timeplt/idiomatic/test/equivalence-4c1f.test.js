// SPDX-License-Identifier: GPL-3.0-only
/**
 * paintLabelledNumericReadoutColumn vs the frozen oracle at ROM 0x4C1F. Nothing the coin-start tape drives dispatches this
 * readout painter, so the corpus is CRAFTED: a cross of destinations, pen colours and source
 * records, oracle against candidate on independent clones, masked over the oracle's own stack
 * scratch. Teeth attack the pictogram stride, the colour plane, the suffix and the cursor step.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-4c1f.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES } from "../../routines.js";
import { paintLabelledNumericReadoutColumn } from "../paintLabelledNumericReadoutColumn.js";
import { loc_4c1f as oracle } from "../../translated/loc_4c1f.js";
import { advanceCharCursor } from "../advanceCharCursor.js";
import { fetchTableByte } from "../fetchTableByte.js";
import { loc_0d73 } from "../loc_0d73.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";
import { u8, u16 } from "../../../../core/int.js";

const TARGET = 0x4c1f;
const CONTROL = 0x0d73; // a routine the same tape DOES reach: the instrument's positive control
const PICTOGRAM_TABLE = 0x4cb4;
const SRC = 0xac00;
const STACK_SEAT = 0xb000;
const DATA_TOP = 0xa7ff; // every painted cell lands in the tile/colour planes at or below here

// The oracle drops its return and leaves the flag byte; both are a CEILING, never demanded.
const EXCLUDED = ["f", "sp"];

const DSTS = [0xa620, 0xa680, 0xa6c0, 0xa700, 0xa740, 0xa7ff];
const COLOURS = [0x00, 0x03, 0x07, 0x0f, 0x55, 0xff];
const BYTESETS = [
  [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  [0x01, 0x12, 0x34, 0x56, 0x08, 0x09, 0x0a],
  [0x05, 0x99, 0x00, 0x01, 0x11, 0x22, 0x33],
  [0x03, 0xff, 0xff, 0xff, 0x40, 0x41, 0x42],
  [0x2a, 0x10, 0x20, 0x30, 0x50, 0x60, 0x70],
];

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");

let snap = null;
function snapshot() {
  if (!snap) {
    const base = makeMachine();
    base.runFrames(300);
    snap = base.clone();
  }
  return snap;
}

function craft(dst, colour, bytes) {
  const m = snapshot().clone();
  m.regs.sp = STACK_SEAT;
  m.regs.de = dst;
  m.regs.hl = SRC;
  m.regs.c = colour;
  for (let i = 0; i < bytes.length; i++) m.mem8[u16(SRC + i)] = bytes[i];
  return m;
}

function cross() {
  const out = [];
  for (const dst of DSTS) for (const colour of COLOURS) for (const bytes of BYTESETS) {
    out.push([dst, colour, bytes]);
  }
  return out;
}

/** Oracle vs candidate on clones, masked over the oracle's OWN deepest push. */
function unitDiff(candidate, machine) {
  const a = machine.clone();
  const b = machine.clone();
  const seat = a.regs.sp;
  let low = seat;
  const push = a.push16.bind(a);
  a.push16 = (v) => { const r = push(v); if (a.regs.sp < low) low = a.regs.sp; return r; };
  oracle(a);
  try {
    candidate(b);
  } catch (e) {
    return { addr: null, note: `raised ${String(e).slice(0, 40)}` };
  }
  const da = a.dumpState();
  const db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= low && addr < seat) continue;
    return { addr, a: da[i], b: db[i], low, seat };
  }
  for (const k of REG_FIELDS) {
    if (EXCLUDED.includes(k)) continue;
    if (a.regs[k] !== b.regs[k]) return { addr: null, reg: k, a: a.regs[k], b: b.regs[k] };
  }
  return null;
}

const show = (d) =>
  !d ? "identical" : d.reg ? `${d.reg}: ${d.a}/${d.b}` : `${hex4(d.addr ?? 0)}: ${d.a}/${d.b}`;

/** A faithful re-build of the painter with one seam a twin can spoil. Defaults reproduce it. */
function painter({ stride = 3, colour = true, suffix = true, step = advanceCharCursor } = {}) {
  return (m) => {
    const { regs, mem8 } = m;
    const src = regs.hl;
    const stamp = (tile) => {
      mem8[regs.de] = tile;
      if (colour) { regs.d &= ~0x04; regs.a = regs.c; mem8[regs.de] = regs.a; regs.d |= 0x04; }
    };
    regs.a = u8(mem8[src] * stride);
    regs.hl = PICTOGRAM_TABLE;
    stamp(fetchTableByte(m));
    regs.hl = u16(regs.hl + 1); step(m); stamp(mem8[regs.hl]);
    regs.hl = u16(regs.hl + 1); step(m); stamp(mem8[regs.hl]);
    regs.de = u16(regs.de - 0x80); regs.hl = u16(src + 3); loc_0d73(m);
    if (!suffix) return;
    regs.de = u16(regs.de - 0x60); regs.hl = u16(regs.hl + 3); stamp(mem8[regs.hl]);
    regs.hl = u16(regs.hl + 1); step(m); stamp(mem8[regs.hl]);
    regs.hl = u16(regs.hl + 1); step(m); stamp(mem8[regs.hl]);
  };
}

const stepForward = (m) => { m.regs.de = u16(m.regs.de + 32); };
const brokenNoOp = () => {};
const brokenNoColour = painter({ colour: false });
const brokenNoSuffix = painter({ suffix: false });
const brokenForwardCursor = painter({ step: stepForward });
const brokenWrongStride = painter({ stride: 2 });

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("UNREACHED: the coin-start tape never dispatches this address, with a live control", { skip }, () => {
  const seen = { [TARGET]: 0, [CONTROL]: 0 };
  const realTarget = ROUTINES.get(TARGET);
  const realControl = ROUTINES.get(CONTROL);
  const m = makeMachine(new Map([
    [TARGET, (mm) => (seen[TARGET]++, realTarget(mm))],
    [CONTROL, (mm) => (seen[CONTROL]++, realControl(mm))],
  ]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the run stopped early: ${m.stoppedBy}`);
  assert.ok(seen[CONTROL] > 0,
    "the control was never dispatched either, so the zero beside it proves nothing");
  assert.equal(seen[TARGET], 0,
    "this address IS reached now, so a captured entry beats the crafted corpus below");
  console.log(`  UNREACHED: ${hex4(TARGET)} ${seen[TARGET]} times, control ${hex4(CONTROL)} ${seen[CONTROL]}`);
});

test("EQUAL: crafted entries identical outside the measured scratch window", { skip }, () => {
  let low = STACK_SEAT;
  let seat = STACK_SEAT;
  for (const [dst, colour, bytes] of cross()) {
    const m = craft(dst, colour, bytes);
    const d = unitDiff(paintLabelledNumericReadoutColumn, m);
    assert.equal(d, null, `dst ${hex4(dst)} colour ${colour} record ${bytes[0]}: ${show(d)}`);
    if (d === null) {
      const probe = m.clone();
      seat = probe.regs.sp;
      const push = probe.push16.bind(probe);
      probe.push16 = (v) => { const r = push(v); if (probe.regs.sp < low) low = probe.regs.sp; return r; };
      oracle(probe);
    }
  }
  assert.ok(low > DATA_TOP, `the scratch window ${hex4(low)} reached into painted data`);
  console.log(`  EQUAL: ${cross().length} crafted entries identical; window [${hex4(low)},${hex4(seat)})`);
});

test("SP DRIFT: exactly two bytes, the dropped return and nothing more", { skip }, () => {
  const drifts = new Set();
  for (const [dst, colour, bytes] of cross()) {
    const m = craft(dst, colour, bytes);
    const a = m.clone();
    const b = m.clone();
    oracle(a);
    paintLabelledNumericReadoutColumn(b);
    drifts.add(a.regs.sp - b.regs.sp);
  }
  assert.deepEqual([...drifts], [2], `the stack drift moved: ${[...drifts].join(",")}`);
  console.log(`  SP DRIFT: exactly ${[...drifts]} across ${cross().length} entries`);
});

test("NOT VACUOUS: a no-op candidate is caught on a real cell", { skip }, () => {
  const d = unitDiff(brokenNoOp, craft(0xa700, 0x07, BYTESETS[1]));
  assert.notEqual(d, null, "the masked diff passed a candidate that does nothing");
  assert.notEqual(d.addr, null, "the no-op must be caught on a cell, not a register alone");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(d)}`);
});

/** Registers a candidate parts company with the oracle on, over the whole cross. */
function movedOver(candidate) {
  const moved = new Set();
  for (const [dst, colour, bytes] of cross()) {
    const a = craft(dst, colour, bytes);
    const b = a.clone();
    oracle(a);
    try { candidate(b); } catch { continue; }
    for (const k of REG_FIELDS) if (a.regs[k] !== b.regs[k]) moved.add(k);
  }
  return moved;
}

test("EXCLUDED, deliberately: nothing moves outside the ceiling, with a control that does", { skip }, () => {
  const moved = movedOver(paintLabelledNumericReadoutColumn);
  const control = movedOver((m) => { paintLabelledNumericReadoutColumn(m); m.regs.h = u8(m.regs.h + 1); });
  assert.ok(REG_FIELDS.some((k) => control.has(k) && !EXCLUDED.includes(k)),
    "the measurement reports nothing even for a twin that scribbles a register, so a clean read is worthless");
  assert.deepEqual(REG_FIELDS.filter((k) => moved.has(k) && !EXCLUDED.includes(k)), [],
    "a register diverged outside the excluded set");
  console.log(`  EXCLUDED: moved ${[...moved].join(",")}; the control also moves ` +
    `${REG_FIELDS.filter((k) => control.has(k) && !EXCLUDED.includes(k)).join(",")}`);
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

for (const [label, twin] of [
  ["no-op", brokenNoOp],
  ["no-colour", brokenNoColour],
  ["no-suffix", brokenNoSuffix],
  ["forward-cursor", brokenForwardCursor],
]) {
  test(`TEETH: the ${label} twin is caught on every crafted entry`, { skip }, () => {
    const caught = cross().filter(([d, c, b]) => unitDiff(twin, craft(d, c, b)) !== null).length;
    assert.equal(caught, cross().length, `the ${label} twin escaped ${cross().length - caught} entries`);
    console.log(`  TEETH/${label}: caught on all ${caught} of ${cross().length}`);
  });
}

test("TEETH: the wrong-stride twin is caught on exactly the non-zero records", { skip }, () => {
  // ★ index zero times either stride is zero, so it reads the same record and the twin is blind there.
  let caught = 0;
  let escaped = 0;
  for (const [dst, colour, bytes] of cross()) {
    const hit = unitDiff(brokenWrongStride, craft(dst, colour, bytes)) !== null;
    if (bytes[0] === 0) assert.ok(!hit, "the twin was caught on a zero record it cannot alter");
    else assert.ok(hit, `the twin escaped a non-zero record: dst ${hex4(dst)} record ${bytes[0]}`);
    hit ? caught++ : escaped++;
  }
  assert.ok(caught > 0 && escaped > 0, "the split the tooth documents is gone");
  console.log(`  TEETH/wrong-stride: caught ${caught}, blind on ${escaped} zero-record entries`);
});
