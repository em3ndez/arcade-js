// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for countObjectOverlaps (ROM 0x3EC3) — count objects overlapping a probe point
 * within a per-object rectangular window, bumping OVERLAP_COUNT (0x6060) once per overlap.
 *
 * 0x3EC3 is a leaf reached from the (still-oracle) board overlap-search arm 0x3E99, which
 * clears OVERLAP_COUNT then calls it twice (0x6700 ×10, then 0x6400 ×5). It DOES run during
 * the attract demo, so real captured dispatches exercise it; crafted entries then drive each
 * branch (inactive skip, both axis1-overlap sub-arms, both axis2-overlap sub-arms, both
 * negate-on-borrow distance paths, the strict-`<` window boundary, and a multi-record loop
 * with stride/djnz).
 *
 * The oracle ends with an ordinary subroutine `ret`; the idiomatic routine models no stack
 * (a plain JS return), so runCandidate performs ONE m.ret() after it to line pc + SP up with
 * the oracle (there is no dissolved push16/ret bracket, so the full RAM is compared — no
 * STACK_SCRATCH exclusion). Register live-outs are dead (the caller reads the counter from
 * RAM), so the contract is RAM + pc + SP.
 *
 * TEETH — two broken twins, each MUST be caught at OVERLAP_COUNT:
 *   (a) dropped the axis1 "+1" (off-by-one window) — flips an axis1 boundary decision.
 *   (b) dropped the axis2 negate-on-borrow — mis-measures the distance when the probe's
 *       second coordinate is below the record's.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3ec3.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3ec3 as oracle } from "../../translated/loc_3ec3.js";
import { countObjectOverlaps } from "../countObjectOverlaps.js";
import { Machine } from "../../machine.js";
import { OVERLAP_COUNT } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x3ec3;
const RET_ADDR = 0x3eaa;       // the real return site inside 0x3E99 (`call 0x3ec3`)
const OBJ_BASE = 0x6700;       // record-array base (the live caller's group 1)
const PROBE_BASE = 0x6100;     // probe point's record (its +3 is the second-axis coordinate)

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// Marshal the oracle's register live-ins into countObjectOverlaps's honest params.
const paramsFrom = (mm) => ({
  objectBase: mm.regs.ix,
  probeBase: mm.regs.iy,
  count: mm.regs.b,
  probeA: mm.regs.c,
  stride: mm.regs.de,
  threshA: mm.regs.l,
  threshB: mm.regs.h,
});

// First differing RAM byte (full RAM — nothing excluded; no bracket was dissolved).
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/** Run the ORACLE on a fresh clone (it performs its own terminal `ret`). */
function runOracle(entry) {
  const c = entry.clone();
  oracle(c);
  return c;
}

/** Run a candidate on a fresh clone, then model its terminal `ret` with one m.ret(). */
function runCandidate(entry, fn) {
  const c = entry.clone();
  fn(c, paramsFrom(c));
  c.ret();
  return c;
}

/** Full contract diff: RAM + pc + SP. */
function contractDiffs(entry, fn) {
  const o = runOracle(entry);
  const c = runCandidate(entry, fn);
  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return diffs;
}

// A real, self-consistent machine (boot + attract) so work RAM holds realistic values.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

// Lay a record's five read fields at `base`.
function putRecord(m, base, { f0 = 0, f3 = 0, f5 = 0, f9 = 0, fa = 0 }) {
  m.mem.write8(base & 0xffff, f0);
  m.mem.write8((base + 0x03) & 0xffff, f3);
  m.mem.write8((base + 0x05) & 0xffff, f5);
  m.mem.write8((base + 0x09) & 0xffff, f9);
  m.mem.write8((base + 0x0a) & 0xffff, fa);
}

// Stamp a crafted 0x3EC3 dispatch onto a clone of the base: a stack with a plausible caller
// return (so the terminal `ret` has a sane target), the register live-ins, the probe's
// second-axis coordinate, the overlap counter's start value, and the object records.
function craft(base, { ix = OBJ_BASE, iy = PROBE_BASE, de = 0x20, c, l, h, probeY, count0 = 0, records }) {
  const m = base.clone();
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR);
  m.regs.ix = ix;
  m.regs.iy = iy;
  m.regs.b = records.length & 0xff;
  m.regs.c = c;
  m.regs.de = de;
  m.regs.l = l;
  m.regs.h = h;
  m.mem.write8(OVERLAP_COUNT, count0);
  m.mem.write8((iy + 0x03) & 0xffff, probeY);
  records.forEach((r, i) => putRecord(m, (ix + i * de) & 0xffff, r));
  return m;
}

const delta = (entry) => (runOracle(entry).mem.read8(OVERLAP_COUNT) - entry.mem.read8(OVERLAP_COUNT)) & 0xff;

// -- 0. reachability ----------------------------------------------------------

test("REACHABILITY: 0x3EC3 is dispatched during the attract demo", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2500);
  assert.ok(count > 0, "0x3EC3 should be dispatched — the attract demo reaches the overlap search");
  console.log(`  REACHABILITY: ${count} natural 0x3EC3 dispatches in 2500 frames`);
});

// -- 1. EQUAL (captured) ------------------------------------------------------

test("EQUAL (captured): countObjectOverlaps == oracle on every real dispatch", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 64) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(2500);
  assert.ok(caps.length >= 1, "expected at least one real 0x3EC3 dispatch during attract");

  let sawCount = 0, sawNoCount = 0;
  for (const entry of caps) {
    const diffs = contractDiffs(entry, countObjectOverlaps);
    assert.equal(diffs.length, 0, `captured dispatch: ${diffs.join("; ")}`);
    if (delta(entry) !== 0) sawCount++; else sawNoCount++;
  }
  console.log(`  EQUAL/captured: ${caps.length} real dispatches identical to the oracle (${sawCount} counted, ${sawNoCount} no-count)`);
});

// -- 2. EQUAL (crafted, all arms) ---------------------------------------------

test("EQUAL (crafted): every branch arm matches the oracle", () => {
  const base = attractBase();

  const cases = [
    // inactive record (bit0 clear) — skipped, no count
    { name: "inactive (f0=0)", opts: { c: 0x40, l: 0x20, h: 0x20, probeY: 0x40, records: [{ f0: 0x00, f5: 0x40, f3: 0x40 }] }, exp: 0 },
    { name: "inactive (f0=0xFE, bit0 clear)", opts: { c: 0x40, l: 0x20, h: 0x20, probeY: 0x40, records: [{ f0: 0xfe, f5: 0x40, f3: 0x40 }] }, exp: 0 },
    // active, no overlap on axis1 (past threshA and past the +0x0A window)
    { name: "axis1 no-overlap", opts: { c: 0x80, l: 0x10, h: 0x20, probeY: 0x40, records: [{ f0: 0x01, f5: 0x00, fa: 0x10, f3: 0x40 }] }, exp: 0 },
    // axis1 overlap via `< threshA`, axis2 overlap via `< threshB` -> count
    { name: "axis1<thr, axis2<thr", opts: { c: 0x40, l: 0x20, h: 0x20, probeY: 0x50, records: [{ f0: 0x01, f5: 0x40, f3: 0x50 }] }, exp: 1 },
    // axis1 overlap via the +0x0A window, axis2 overlap via the +9 window -> count
    { name: "axis1 span, axis2 span", opts: { c: 0x40, l: 0x10, h: 0x00, probeY: 0x41, records: [{ f0: 0x01, f5: 0x30, fa: 0x08, f3: 0x40, f9: 0x08 }] }, exp: 1 },
    // axis1 overlaps but axis2 does not -> no count
    { name: "axis1 overlap, axis2 no-overlap", opts: { c: 0x40, l: 0x20, h: 0x10, probeY: 0x80, records: [{ f0: 0x01, f5: 0x40, f3: 0x00, f9: 0x10 }] }, exp: 0 },
    // negate-on-borrow on axis1 (probeA < field+5)
    { name: "axis1 negate path", opts: { c: 0x10, l: 0x40, h: 0x20, probeY: 0x50, records: [{ f0: 0x01, f5: 0x40, f3: 0x50 }] }, exp: 1 },
    // negate-on-borrow on axis2 (probeY < field+3)
    { name: "axis2 negate path", opts: { c: 0x40, l: 0x20, h: 0x40, probeY: 0x20, records: [{ f0: 0x01, f5: 0x40, f3: 0x50 }] }, exp: 1 },
    // strict `<`: distance+1 == threshA with a zero window -> NOT an overlap
    { name: "axis1 boundary (== threshA, window 0)", opts: { c: 0x40, l: 0x01, h: 0x20, probeY: 0x50, records: [{ f0: 0x01, f5: 0x40, fa: 0x00, f3: 0x50 }] }, exp: 0 },
    // multi-record loop with stride+djnz: count, skip, count; starts the counter non-zero
    {
      name: "3 records (count/skip/count), stride 0x20, base+5",
      opts: {
        c: 0x40, l: 0x20, h: 0x20, probeY: 0x40, de: 0x20, count0: 0x05,
        records: [
          { f0: 0x01, f5: 0x40, f3: 0x40 }, // counts
          { f0: 0x00, f5: 0x40, f3: 0x40 }, // inactive
          { f0: 0x01, f5: 0x40, f3: 0x40 }, // counts
        ],
      },
      exp: 2,
    },
  ];

  for (const { name, opts, exp } of cases) {
    const entry = craft(base, opts);
    const diffs = contractDiffs(entry, countObjectOverlaps);
    assert.equal(diffs.length, 0, `${name}: ${diffs.join("; ")}`);
    // Non-vacuity: the oracle really took the intended branch (counter delta as designed).
    assert.equal(delta(entry), exp, `${name}: oracle counter delta ${delta(entry)} != expected ${exp}`);
  }
  console.log(`  EQUAL/crafted: ${cases.length} arms (inactive, both axis1 sub-arms, both axis2 sub-arms, both negate paths, boundary, multi-record) identical`);
});

// -- 3. TEETH -----------------------------------------------------------------

/** Broken twin (a): drops the axis1 "+1" (an off-by-one in the first-axis window). */
function brokenDroppedInc(m, { objectBase, probeBase, count, probeA, stride, threshA, threshB }) {
  const { mem } = m;
  let base = objectBase & 0xffff;
  let remaining = count & 0xff;
  const probeYAddr = (probeBase + 0x03) & 0xffff;
  const a = probeA & 0xff, tA = threshA & 0xff, tB = threshB & 0xff;
  do {
    if (mem.read8(base) & 0x01) {
      const ref = mem.read8((base + 0x05) & 0xffff);
      let d = (a - ref) & 0xff;
      if (a < ref) d = (0 - d) & 0xff;
      // BUG: no `d = (d + 1) & 0xff;`
      let ov1;
      if (d < tA) ov1 = true;
      else ov1 = ((d - tA) & 0xff) < mem.read8((base + 0x0a) & 0xffff);
      if (ov1) {
        const ref2 = mem.read8((base + 0x03) & 0xffff);
        const p2 = mem.read8(probeYAddr);
        let e = (p2 - ref2) & 0xff;
        if (p2 < ref2) e = (0 - e) & 0xff;
        let ov2;
        if (e < tB) ov2 = true;
        else ov2 = ((e - tB) & 0xff) < mem.read8((base + 0x09) & 0xffff);
        if (ov2) mem.write8(OVERLAP_COUNT, (mem.read8(OVERLAP_COUNT) + 1) & 0xff);
      }
    }
    base = (base + stride) & 0xffff;
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);
}

/** Broken twin (b): drops the axis2 negate-on-borrow (mis-measures below-record distances). */
function brokenNoNegAxis2(m, { objectBase, probeBase, count, probeA, stride, threshA, threshB }) {
  const { mem } = m;
  let base = objectBase & 0xffff;
  let remaining = count & 0xff;
  const probeYAddr = (probeBase + 0x03) & 0xffff;
  const a = probeA & 0xff, tA = threshA & 0xff, tB = threshB & 0xff;
  do {
    if (mem.read8(base) & 0x01) {
      const ref = mem.read8((base + 0x05) & 0xffff);
      let d = (a - ref) & 0xff;
      if (a < ref) d = (0 - d) & 0xff;
      d = (d + 1) & 0xff;
      let ov1;
      if (d < tA) ov1 = true;
      else ov1 = ((d - tA) & 0xff) < mem.read8((base + 0x0a) & 0xffff);
      if (ov1) {
        const ref2 = mem.read8((base + 0x03) & 0xffff);
        const p2 = mem.read8(probeYAddr);
        let e = (p2 - ref2) & 0xff; // BUG: no negate on borrow
        let ov2;
        if (e < tB) ov2 = true;
        else ov2 = ((e - tB) & 0xff) < mem.read8((base + 0x09) & 0xffff);
        if (ov2) mem.write8(OVERLAP_COUNT, (mem.read8(OVERLAP_COUNT) + 1) & 0xff);
      }
    }
    base = (base + stride) & 0xffff;
    remaining = (remaining - 1) & 0xff;
  } while (remaining !== 0);
}

test("TEETH: the dropped-+1 twin and the dropped-axis2-negate twin are CAUGHT at OVERLAP_COUNT", () => {
  const base = attractBase();

  // (a) dropped +1: distance 0x10, threshA 0x11, window 0 -> correct = no overlap (delta 0);
  //     the twin (distance stays 0x10 < 0x11) overlaps axis1, then axis2 counts (delta 1).
  const incEntry = craft(base, { c: 0x40, l: 0x11, h: 0x20, probeY: 0x50, records: [{ f0: 0x01, f5: 0x30, fa: 0x00, f3: 0x50 }] });
  assert.equal(delta(incEntry), 0, "sanity: the correct routine should NOT count this boundary case");
  const incDiffs = contractDiffs(incEntry, brokenDroppedInc);
  assert.ok(incDiffs.length > 0, "the dropped-+1 twin escaped — the gate is worthless");
  assert.ok(incDiffs[0].startsWith(`RAM@${hx(OVERLAP_COUNT)}`), `expected the diff at ${hx(OVERLAP_COUNT)}, got ${incDiffs[0]}`);

  // (b) dropped axis2 negate: probeY 0x20 < field+3 0x50 -> correct distance 0x30 < threshB 0x40
  //     counts (delta 1); the twin's un-negated 0xD0 does not, so it fails to count (delta 0).
  const negEntry = craft(base, { c: 0x40, l: 0x20, h: 0x40, probeY: 0x20, records: [{ f0: 0x01, f5: 0x40, f3: 0x50, f9: 0x08 }] });
  assert.equal(delta(negEntry), 1, "sanity: the correct routine should count this negate case");
  const negDiffs = contractDiffs(negEntry, brokenNoNegAxis2);
  assert.ok(negDiffs.length > 0, "the dropped-axis2-negate twin escaped — the gate is worthless");
  assert.ok(negDiffs[0].startsWith(`RAM@${hx(OVERLAP_COUNT)}`), `expected the diff at ${hx(OVERLAP_COUNT)}, got ${negDiffs[0]}`);

  console.log(`  TEETH: dropped-+1 caught (${incDiffs[0]}); dropped-axis2-negate caught (${negDiffs[0]})`);
});
