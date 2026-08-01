// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_1ea0 (ROM 0x1EA0) — effect-sequence step 0: spawn the hit
 * effect sprite from the collided object's record, then arm the effect countdown + sound.
 *
 * loc_1ea0 is a LEAF whose whole memory effect is a function of the collision-search
 * result cells (COLLIDED_OBJECT_BASE/STRIDE/INDEX), the object record's +0x15 field, and
 * two fields of a source sprite record picked by the base's page. It writes the hit
 * object's active flag, EFFECT_SELECT, four EFFECT_SPRITE bytes, the source record's +0,
 * and the five sequence/sound cells. It returns nothing a caller consumes and touches no
 * stack, so the contract is memory-only (RAM over the whole dump) — no STACK_SCRATCH
 * exclusion is needed (the routine dissolves no push16/ret bracket).
 *
 *   1. REACHABILITY — 0x1EA0 is dispatched during attract (via the effect-sequence router).
 *
 *   2. EQUAL (captured) — hook 0x1EA0 in a real boot/attract run, clone at each dispatch,
 *      and confirm loc_1ea0 == oracle on the whole RAM dump. Attract reaches the 0x6700
 *      (page > 0x65) and 0x6400 (page < 0x65) arms with index 0 and index 2-5.
 *
 *   3. EQUAL (crafted) — a real attract base + surgical pokes to drive all three classifier
 *      arms (page == 0x65 -> 0x69B8, < 0x65 -> 0x69D0, > 0x65 -> 0x6980), both EFFECT_SELECT
 *      variants (the object's +0x15 field zero and nonzero), and index 0 (no walk) vs > 0
 *      (records walked to the hit index), identically on both sides.
 *
 *   4. TEETH — three broken twins, each MUST be caught:
 *      (a) inverted variant test (writes 4 where the oracle writes 2, and vice versa).
 *      (b) dropped classifier arm (treats the == 0x65 page like the < 0x65 page, so it copies
 *          from the wrong source record).
 *      (c) wrong sequence reload (EFFECT_SEQ_INNER loaded 5 instead of 6).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1ea0.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_1ea0 as oracle } from "../../translated/entry_1ea0.js";
import { loc_1ea0 } from "../loc_1ea0.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  COLLIDED_OBJECT_BASE,
  COLLIDED_OBJECT_STRIDE,
  COLLIDED_OBJECT_INDEX,
  EFFECT_SELECT,
  EFFECT_SEQ_INNER,
} from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1ea0;
// The oracle's terminal `ret` pops one return address; point SP at mapped stack scratch so
// that pop reads valid bytes (an attract-base clone leaves SP at the unmapped RAM top). The
// pop only READS, so it never changes the compared RAM — only the candidate, which models no
// stack, is unaffected either way.
const SAFE_SP = 0x6bf8;
const hx = (v) => "0x" + ((v ?? 0) & 0xffff).toString(16);

/**
 * Run the oracle and the candidate on two FRESH, byte-identical clones of `entry` and diff
 * the memory-equivalence contract (RAM over the whole dump). A fresh clone per side because
 * the routine WRITES memory. Frame machinery is neutralised so a stray NMI can't masquerade
 * as a side effect. Returns the first RAM difference or null.
 */
function ramDiff(entry, candidate) {
  const a = entry.clone();
  const b = entry.clone();
  a.nextNmi = Infinity; a.nextBoundary = Infinity;
  b.nextNmi = Infinity; b.nextBoundary = Infinity;
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// A real, self-consistent machine: boot + a stretch of attract so work RAM holds realistic
// values. The crafted classifier arms below are reached by poking the search-result cells.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

// Stamp a crafted 0x1EA0 dispatch onto a clone of the base: the collision-search result
// (page-aligned base whose high byte is the classifier, stride, hit index), the object
// record's +0x15 variant field, and two distinctive source-record fields so the effect
// sprite copy is observable. Addresses are derived exactly as the routine walks them.
function craft(base, { baseHi, stride, index, marker, src0 = 0xab, src3 = 0xcd }) {
  const m = base.clone();
  m.nextNmi = Infinity; m.nextBoundary = Infinity;
  m.regs.sp = SAFE_SP; // so the oracle's terminal `ret` pops mapped bytes
  m.mem.write8(COLLIDED_OBJECT_BASE, 0x00);        // page-aligned low byte
  m.mem.write8(COLLIDED_OBJECT_BASE + 1, baseHi);  // classifier: the array's page
  m.mem.write8(COLLIDED_OBJECT_STRIDE, stride);
  m.mem.write8(COLLIDED_OBJECT_INDEX, index);

  const objRecord = ((baseHi << 8) + stride * index) & 0xffff;
  m.mem.write8((objRecord + 0x15) & 0xffff, marker); // 0 -> variant 2, nonzero -> variant 4

  const sourceBase = baseHi === 0x65 ? 0x69b8 : baseHi < 0x65 ? 0x69d0 : 0x6980;
  const sourceRecord = (sourceBase + 4 * index) & 0xffff;
  m.mem.write8(sourceRecord, src0);
  m.mem.write8((sourceRecord + 3) & 0xffff, src3);
  return m;
}

// -- 1. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x1EA0 is dispatched during attract", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(4000);
  assert.ok(count > 0, "0x1EA0 should be dispatched — the effect-sequence router reaches it");
  console.log(`  REACHABILITY: ${count} natural 0x1EA0 dispatches in 4000 frames`);
});

// -- 2. EQUAL (captured) ------------------------------------------------------

test("EQUAL (captured): loc_1ea0 == oracle on every real dispatch", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 64) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(4000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1EA0 dispatch during attract");

  const pages = new Set();
  for (const entry of caps) {
    const diff = ramDiff(entry, loc_1ea0);
    assert.equal(diff, null, diff && `captured dispatch diverges at ${hx(diff.addr)} oracle=${diff.a} cand=${diff.b}`);
    pages.add(entry.mem.read8(COLLIDED_OBJECT_BASE + 1));
  }
  console.log(`  EQUAL/captured: ${caps.length} real dispatches identical to the oracle (base pages ${[...pages].map(hx).join(", ")})`);
});

// -- 3. EQUAL (crafted, all classifier + variant arms) ------------------------

test("EQUAL (crafted): the three classifier arms and both variants match the oracle", () => {
  const base = attractBase();

  const cases = [
    // page == 0x65 -> source 0x69B8 (never reached in attract); both variants; index 0 and > 0
    { name: "page==0x65 idx0 variant2", opts: { baseHi: 0x65, stride: 0x20, index: 0, marker: 0 } },
    { name: "page==0x65 idx3 variant4", opts: { baseHi: 0x65, stride: 0x20, index: 3, marker: 5 } },
    // page < 0x65 -> source 0x69D0
    { name: "page<0x65 idx2 variant2", opts: { baseHi: 0x64, stride: 0x20, index: 2, marker: 0 } },
    { name: "page<0x65 idx0 variant4", opts: { baseHi: 0x64, stride: 0x20, index: 0, marker: 7 } },
    // page > 0x65 -> source ACTOR_SPRITES (0x6980)
    { name: "page>0x65 idx4 variant4", opts: { baseHi: 0x67, stride: 0x20, index: 4, marker: 9 } },
    { name: "page>0x65 idx0 variant2", opts: { baseHi: 0x67, stride: 0x20, index: 0, marker: 0 } },
  ];

  for (const { name, opts } of cases) {
    const entry = craft(base, opts);
    const diff = ramDiff(entry, loc_1ea0);
    assert.equal(diff, null, diff && `${name}: RAM diverges at ${hx(diff.addr)} oracle=${diff.a} cand=${diff.b}`);

    // Confirm the crafted variant actually landed the way we intended (non-vacuity).
    const after = entry.clone();
    after.nextNmi = Infinity; after.nextBoundary = Infinity;
    oracle(after);
    assert.equal(after.mem.read8(EFFECT_SELECT), opts.marker === 0 ? 2 : 4, `${name}: EFFECT_SELECT variant mismatch`);
  }
  console.log(`  EQUAL/crafted: ${cases.length} arms (three classifier pages x both variants, index 0 and > 0) identical`);
});

// -- 4. TEETH -----------------------------------------------------------------

/** Broken twin (a): inverts the variant test — 4 where the oracle picks 2, and vice versa. */
function brokenVariant(m) {
  const { mem } = m;
  const arrayPage = mem.read8(COLLIDED_OBJECT_BASE + 1);
  let sourceBase;
  if (arrayPage === 0x65) sourceBase = 0x69b8;
  else if (arrayPage < 0x65) sourceBase = 0x69d0;
  else sourceBase = 0x6980;
  const index = mem.read8(COLLIDED_OBJECT_INDEX);
  const stride = mem.read8(COLLIDED_OBJECT_STRIDE);
  const objRecord = (mem.read16(COLLIDED_OBJECT_BASE) + stride * index) & 0xffff;
  const sourceRecord = (sourceBase + 4 * index) & 0xffff;
  mem.write8(objRecord & 0xffff, 0x00);
  mem.write8(EFFECT_SELECT, mem.read8((objRecord + 0x15) & 0xffff) === 0 ? 4 : 2); // BUG: inverted
  const field0 = mem.read8(sourceRecord);
  mem.write8(sourceRecord, 0x00);
  mem.write8(0x6a2c, field0);
  mem.write8(0x6a2d, 0x60);
  mem.write8(0x6a2e, 0x0c);
  mem.write8(0x6a2f, mem.read8((sourceRecord + 3) & 0xffff));
  mem.write8(0x6345, mem.read8(0x6345) + 1);
  mem.write8(0x6346, 6);
  mem.write8(0x6347, 5);
  mem.write8(0x608a, 6);
  mem.write8(0x608b, 3);
}

/** Broken twin (b): drops the == 0x65 arm, folding it into the < 0x65 arm (wrong source). */
function brokenClassifier(m) {
  const { mem } = m;
  const arrayPage = mem.read8(COLLIDED_OBJECT_BASE + 1);
  const sourceBase = arrayPage <= 0x65 ? 0x69d0 : 0x6980; // BUG: == 0x65 no longer selects 0x69B8
  const index = mem.read8(COLLIDED_OBJECT_INDEX);
  const stride = mem.read8(COLLIDED_OBJECT_STRIDE);
  const objRecord = (mem.read16(COLLIDED_OBJECT_BASE) + stride * index) & 0xffff;
  const sourceRecord = (sourceBase + 4 * index) & 0xffff;
  mem.write8(objRecord & 0xffff, 0x00);
  mem.write8(EFFECT_SELECT, mem.read8((objRecord + 0x15) & 0xffff) === 0 ? 2 : 4);
  const field0 = mem.read8(sourceRecord);
  mem.write8(sourceRecord, 0x00);
  mem.write8(0x6a2c, field0);
  mem.write8(0x6a2d, 0x60);
  mem.write8(0x6a2e, 0x0c);
  mem.write8(0x6a2f, mem.read8((sourceRecord + 3) & 0xffff));
  mem.write8(0x6345, mem.read8(0x6345) + 1);
  mem.write8(0x6346, 6);
  mem.write8(0x6347, 5);
  mem.write8(0x608a, 6);
  mem.write8(0x608b, 3);
}

/** Broken twin (c): reloads EFFECT_SEQ_INNER with 5 instead of 6. */
function brokenSeqReload(m) {
  loc_1ea0(m);
  m.mem.write8(EFFECT_SEQ_INNER, 5); // BUG: should be 6
}

test("TEETH: the inverted-variant, dropped-classifier, and wrong-reload twins are CAUGHT", () => {
  const base = attractBase();

  // (a) inverted variant — a marker-zero case, where the oracle writes 2 and the twin 4.
  const va = craft(base, { baseHi: 0x67, stride: 0x20, index: 2, marker: 0 });
  const vaDiff = ramDiff(va, brokenVariant);
  assert.ok(vaDiff, "the inverted-variant twin escaped — the gate is worthless");
  assert.equal(vaDiff.addr, EFFECT_SELECT, `expected the variant diff at ${hx(EFFECT_SELECT)}, got ${hx(vaDiff.addr)}`);

  // (b) dropped classifier arm — only the == 0x65 page distinguishes the two source records,
  // and the source fields differ so the copied EFFECT_SPRITE bytes diverge.
  const cl = craft(base, { baseHi: 0x65, stride: 0x20, index: 0, marker: 0, src0: 0x11, src3: 0x22 });
  cl.mem.write8(0x69d0, 0x99);      // the < 0x65 source the buggy twin copies from instead
  cl.mem.write8(0x69d0 + 3, 0x88);
  const clDiff = ramDiff(cl, brokenClassifier);
  assert.ok(clDiff, "the dropped-classifier twin escaped — the gate is worthless");

  // (c) wrong sequence reload — caught on any dispatch at EFFECT_SEQ_INNER.
  const sq = craft(base, { baseHi: 0x67, stride: 0x20, index: 0, marker: 0 });
  const sqDiff = ramDiff(sq, brokenSeqReload);
  assert.ok(sqDiff, "the wrong-reload twin escaped — the gate is worthless");
  assert.equal(sqDiff.addr, EFFECT_SEQ_INNER, `expected the reload diff at ${hx(EFFECT_SEQ_INNER)}, got ${hx(sqDiff.addr)}`);

  console.log(`  TEETH: inverted-variant caught @${hx(vaDiff.addr)}; dropped-classifier caught @${hx(clDiff.addr)}; wrong-reload caught @${hx(sqDiff.addr)}`);
});
