// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0dd7 — memory-equivalent to the frozen oracle at ROM 0x0DD7.
 * GATE: unit-capture at each session's real dispatch, plus a crafted sweep that pokes the input
 *   value and poisons both display planes so every drawn cell shows. The oracle nets one ret and
 *   the candidate performs none, so it runs through withOmittedRet and SP/pc are then compared for
 *   equality; the dead stack the dissolved calls reach is masked and its depth is measured. Teeth
 *   are pinned to exact catch counts over the crafted sweep.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { withOmittedRet } from "../../machine.js";
import { loc_0dd7 } from "../loc_0dd7.js";
import { loc_0dd7 as oracle } from "../../translated/loc_0dd7.js";
import { drawSlotWithOneGlyph } from "../drawSlotWithOneGlyph.js";
import { paintDoubleTile } from "../paintDoubleTile.js";
import { paintQuadTile } from "../paintQuadTile.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x0dd7;
const WINDOW = 4; // dead stack bytes the dissolved calls reach; pinned by the SCRATCH arm
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PLANE_LO = 0xa000;
const PLANE_HI = 0xa7ff;
const MARKER = 0x7f; // a byte this routine never lays down, so every write to the planes shows

const ROW_START = 0xa463;
const ROW_END = 0xa623;

const SESSIONS = [["coin-start", {}], ["undriven", { tape: [] }]];
/** Measured over ENTRY_FRAMES. A move is a finding about the tapes, not a tolerance to widen. */
const DISPATCHES = { "coin-start": 3, undriven: 1 };

/** The input values the crafted sweep pokes: every denomination alone and mixed, plus the clamp. */
const CRAFTED_A = [0, 1, 2, 3, 4, 5, 6, 9, 10, 14, 15, 19, 20, 29, 30, 37, 45, 59, 60, 75, 90, 99, 100, 150, 255];

/** The shadow register file is the scratch the oracle splits the value in; the rewrite carries the
 * counts in JS locals and never touches it. A CEILING asserted as a subset, never a demand. */
const MAY_MOVE = ["a_", "f_", "b_", "c_", "d_", "e_"];
const HELD = ["a", "f", "b", "c", "d", "e", "h", "l", "ix", "iy", "sp", "h_", "l_"];

const hex4 = (v) => "0x" + (v & 0xffff).toString(16).padStart(4, "0");
const show = (d) => (d ? `${d.key ?? hex4(d.addr ?? 0)}: oracle=${d.a} candidate=${d.b}` : "identical");
const seam = (candidate) => withOmittedRet(candidate, TARGET);
const inWindow = (addr, sp) => addr !== null && addr >= sp - WINDOW && addr < sp;

function allDiffs(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const out = [];
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) out.push({ addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] });
  }
  return out;
}

/** Oracle vs candidate on independent clones of one machine, on the memory-equivalence contract. */
function diffOf(candidate, machine) {
  const before = machine.dumpState();
  const sp = machine.regs.sp;
  const a = machine.clone();
  const b = machine.clone();
  let faultA = null;
  let faultB = null;
  try { oracle(a); } catch (e) { faultA = e.constructor.name; }
  try { seam(candidate)(b); } catch (e) { faultB = e.constructor.name; }
  if (faultA !== null || faultB !== null) {
    return { faulted: true, faultA, faultB, raw: [], masked: [], moved: [], informative: false,
      sp, spDiff: null, pcDiff: null, caught: faultA !== faultB };
  }
  const raw = allDiffs(a, b);
  const masked = raw.filter((d) => !inWindow(d.addr, sp));
  const after = a.dumpState();
  let informative = false;
  for (let i = 0; i < after.length; i++) {
    if (after[i] !== before[i] && !inWindow(a.stateOffsetToAddr(i), sp)) { informative = true; break; }
  }
  const spDiff = a.regs.sp !== b.regs.sp ? { key: "sp", a: a.regs.sp, b: b.regs.sp } : null;
  const pcDiff = a.pc !== b.pc ? { key: "pc", a: a.pc, b: b.pc } : null;
  return {
    faulted: false, faultA, faultB, raw, masked, informative, sp,
    moved: REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]),
    spDiff, pcDiff, caught: masked.length > 0 || spDiff !== null || pcDiff !== null,
  };
}

/** How far below its seat a function's own pushes take the stack pointer. */
function pushDepth(fn, machine) {
  const c = machine.clone();
  const seat = c.regs.sp;
  let deepest = seat;
  const push = c.push16.bind(c);
  c.push16 = (v) => { const r = push(v); if (c.regs.sp < deepest) deepest = c.regs.sp; return r; };
  try { fn(c); } catch { /* a faulting run still pushed whatever it pushed */ }
  return seat - deepest;
}

const entries = new Map();
function entryFor(label) {
  if (!entries.has(label)) {
    const spec = SESSIONS.find(([l]) => l === label);
    let entry = null;
    let dispatches = 0;
    const m = makeMachine(new Map([[TARGET, (mm) => {
      dispatches++;
      if (entry === null) entry = mm.clone();
      return oracle(mm);
    }]]), spec[1]);
    const frames = m.runFrames(ENTRY_FRAMES);
    assert.equal(m.stoppedBy, null, `the ${label} session stopped early: ${m.stoppedBy}`);
    assert.equal(frames.length, ENTRY_FRAMES, `the ${label} session ran short`);
    entries.set(label, { entry, dispatches });
  }
  return entries.get(label);
}

/** A real captured entry with both display planes poisoned and the input value poked. */
function craft(v) {
  const m = entryFor("coin-start").entry.clone();
  for (let a = PLANE_LO; a <= PLANE_HI; a++) m.mem8[a] = MARKER;
  m.regs.a = v;
  return m;
}
const CRAFTED = () => CRAFTED_A.map(craft);
const craftedCaught = (twin) => CRAFTED().filter((c) => diffOf(twin, c).caught).length;

// ── the twins ───────────────────────────────────────────────────────────────────────────

/** The meter built the way the module is built, with one knob per twin. Faithful defaults. */
function drawMeter({ clampTo = 99, big = 30, onesGlyph = 0x01, fill = true, order = "small" } = {}) {
  return (m) => {
    const { regs, mem16 } = m;
    let value = regs.a >= 100 ? clampTo : regs.a;
    const thirties = Math.floor(value / big); value %= big;
    const tens = Math.floor(value / 10); value %= 10;
    const fives = Math.floor(value / 5); value %= 5;
    const ones = value;
    let denoms = [
      [ones, onesGlyph, 0x13, drawSlotWithOneGlyph],
      [fives, 0x32, 0x11, paintDoubleTile],
      [tens, 0xce, 0x16, paintQuadTile],
      [thirties, 0x23, 0x11, paintQuadTile],
    ];
    if (order === "large") denoms = denoms.slice().reverse();
    regs.de = ROW_START;
    for (const [count, glyph, colour, paint] of denoms) {
      if (!count) continue;
      regs.b = glyph;
      regs.c = colour;
      for (let i = 0; i < count; i++) paint(m);
    }
    regs.b = 0xf1;
    regs.c = 0x10;
    if (fill) while (regs.de < ROW_END) drawSlotWithOneGlyph(m);
    regs.xor(regs.a);
    regs.hl = mem16[0x00a0];
    regs.de = mem16[0x00a3];
    regs.bc = mem16[0x009d];
    regs.addHl(regs.de);
    regs.addHl(regs.bc);
    regs.add(regs.l);
    regs.add(regs.h);
    regs.sub(0x69);
  };
}

/** BUG: scribbles a held register the routine has no business moving; the control for the ceiling. */
function clobbersHeldRegister(m) {
  loc_0dd7(m);
  m.regs.h = (m.regs.h + 1) & 0xff;
}

const TWINS = [
  ["no-op", () => {}, 25],
  ["no-clamp", drawMeter({ clampTo: 255 }), 3],
  ["denom-25", drawMeter({ big: 25 }), 12],
  ["ones-glyph", drawMeter({ onesGlyph: 0x02 }), 15],
  ["no-fill", drawMeter({ fill: false }), 25],
  ["large-first", drawMeter({ order: "large" }), 14],
];

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("REACH: each session's dispatch count, pinned", { skip }, () => {
  for (const [label] of SESSIONS) {
    const { dispatches } = entryFor(label);
    assert.ok(dispatches > 0, `vacuous: the ${label} session never reaches the routine`);
    assert.equal(dispatches, DISPATCHES[label], `the ${label} dispatch count moved`);
    console.log(`  REACH/${label}: ${dispatches} dispatches`);
  }
});

test("EQUAL at the real dispatch of each session", { skip }, () => {
  for (const [label] of SESSIONS) {
    const r = diffOf(loc_0dd7, entryFor(label).entry);
    assert.equal(r.faulted, false, `${label}: a side faulted (${r.faultA} vs ${r.faultB})`);
    assert.ok(r.informative, `${label}: the oracle wrote nothing outside the window, so this is vacuous`);
    assert.deepEqual(r.masked, [], `${label}: ${show(r.masked[0])}`);
    assert.equal(r.spDiff, null, `${label}: the stack pointer must come back to the same seat`);
    assert.equal(r.pcDiff, null, `${label}: the seam must land pc where the caller's slot pointed`);
    console.log(`  EQUAL/${label}: entry pointer ${hex4(r.sp)}, ${r.raw.length} raw bytes differ, all masked`);
  }
});

test("NOT VACUOUS: a candidate that does nothing FAILS the same comparison", { skip }, () => {
  const r = diffOf(() => {}, entryFor("coin-start").entry);
  assert.ok(r.caught, "the comparison passed a candidate that does nothing");
  console.log(`  NOT VACUOUS: the empty candidate is caught — ${show(r.masked[0])}`);
});

test("SCRATCH: the masked window is the oracle's own deepest push, and nothing escapes it", { skip }, () => {
  let deepestDiff = 0;
  let deepestPush = 0;
  let seen = 0;
  for (const c of CRAFTED()) {
    deepestPush = Math.max(deepestPush, pushDepth(oracle, c));
    const r = diffOf(loc_0dd7, c);
    for (const d of r.raw) {
      assert.ok(d.addr < r.sp, `${hex4(d.addr)} is at or above the seat`);
      deepestDiff = Math.max(deepestDiff, r.sp - d.addr);
      seen++;
    }
  }
  assert.ok(seen > 0, "no raw difference anywhere, so the mask is decoration and should be removed");
  assert.ok(deepestDiff <= WINDOW, `a difference ${deepestDiff} bytes down escapes the ${WINDOW}-byte window`);
  assert.equal(deepestPush, WINDOW, "the oracle's own stack footprint moved off the masked window");
  console.log(`  SCRATCH: oracle pushes ${deepestPush} below its seat, window ${WINDOW}, deepest diff ${deepestDiff}`);
});

test("CRAFTED: every poked value is identical outside the window, SP and pc equal", { skip }, () => {
  let informative = 0;
  for (const c of CRAFTED()) {
    const r = diffOf(loc_0dd7, c);
    assert.equal(r.faulted, false, `A=${c.regs.a}: ${r.faultA} vs ${r.faultB}`);
    assert.deepEqual(r.masked, [], `A=${c.regs.a}: ${show(r.masked[0])}`);
    assert.equal(r.spDiff, null, "the seam left SP adrift");
    assert.equal(r.pcDiff, null, "the seam left pc adrift");
    if (r.informative) informative++;
  }
  assert.ok(informative > 0, "no crafted value wrote anything outside the window");
  console.log(`  CRAFTED: ${CRAFTED_A.length} poked values identical, ${informative} informative`);
});

test("EXCLUDED: only the shadow file moves, and the instrument can see a held register", { skip }, () => {
  const moved = new Set();
  for (const [label] of SESSIONS) for (const k of diffOf(loc_0dd7, entryFor(label).entry).moved) moved.add(k);
  for (const c of CRAFTED()) for (const k of diffOf(loc_0dd7, c).moved) moved.add(k);
  const list = REG_FIELDS.filter((k) => moved.has(k));
  // A CEILING, never deepEqual: an equality here would DEMAND the divergence and go red on a
  // rewrite that became register-exact.
  assert.deepEqual(list.filter((k) => !MAY_MOVE.includes(k)), [], "a register outside the ceiling moved");
  for (const k of HELD) assert.ok(!moved.has(k), `a register asserted held moved (${k})`);
  const control = new Set(diffOf(clobbersHeldRegister, entryFor("coin-start").entry).moved);
  assert.ok(control.has("h"), "the instrument cannot see a held register being clobbered, so the check is blind");
  console.log(`  EXCLUDED: ${list.join(", ")} move; the control twin also moves ${[...control].join(", ")}`);
});

for (const [label, twin, expected] of TWINS) {
  test(`TEETH: the ${label} twin is caught on an exact count`, { skip }, () => {
    const caught = craftedCaught(twin);
    assert.ok(caught > 0, `the crafted sweep missed the ${label} twin everywhere`);
    assert.equal(caught, expected, `the ${label} twin's catch count moved`);
    console.log(`  TEETH/${label}: caught on ${caught} of ${CRAFTED_A.length} crafted values`);
  });
}
