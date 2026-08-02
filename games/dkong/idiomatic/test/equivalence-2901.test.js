// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2901 (ROM 0x2901) — configure and run one bounding-box
 * collision sweep over the OBJ_ARRAY_64 record array.
 *
 * The routine recovers the per-axis tolerances the dispatcher pushed on the stack, stamps
 * the sweep's object count into OBJ_SEARCH_COUNT, points the shared collision search
 * loc_2913 at the object array (base OBJ_ARRAY_64, 0x20-byte stride, 7 records), runs one
 * scan, and always completes as a normal return. Its whole observable effect is that one
 * memory store plus the search result loc_2913 leaves in the registers (the result byte and
 * the count-minus-index residue the found-handler reads back).
 *
 * The oracle models the Z80 stack: it pops the pushed tolerances, brackets the search with a
 * call/return, and — because the search takes a caller-skip return on a hit — both outcomes
 * land back at the dispatch site with the same pc + SP. loc_2901 models no call/return
 * bracket (a direct call to loc_2913), so the harness lines the two up: after loc_2901 it
 * performs the single terminal return the ROM nets on either path, so pc + SP match and the
 * bytes the oracle's dissolved bracket leaves behind sit in the dead STACK_SCRATCH region,
 * which the memory compare excludes.
 *
 * 0x2901 is NEVER dispatched during attract (its dispatch-table arm is reached only through
 * the untranslated 0x3E88 dispatcher), so there are no real captured dispatches — the gate
 * is crafted entries covering every arm, each run identically on both sides:
 *
 *   1. EQUAL (crafted) — a hit at the first record, a hit at a later record (the
 *      count-minus-index recovery), an exhausted scan, and two cases with different
 *      stack-passed tolerances that flip the hit decision (proving the tolerance
 *      marshalling is live). Every case: RAM (minus STACK_SCRATCH), pc, SP and the live
 *      register file identical to the oracle.
 *
 *   2. TEETH — two broken twins the same suite MUST catch: one that stores the wrong object
 *      count (caught in RAM at OBJ_SEARCH_COUNT) and one that scans the wrong record count
 *      (caught in the count-minus-index register residue).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2901.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2901 as oracle } from "../../translated/loc_2901.js";
import { loc_2913 } from "../loc_2913.js";
import { loc_2901 } from "../loc_2901.js";
import { Machine } from "../../machine.js";
import { STACK_SCRATCH, OBJ_SEARCH_COUNT, OBJ_ARRAY_64 } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2901;
const SP_TOP = 0x6c00;         // stack top — inside STACK_SCRATCH, so every push is excluded
const RETURN_SITE = 0x2870;    // where the dispatcher's caller resumes (the routine's normal return)
const RECORD_STRIDE = 0x20;    // OBJ_ARRAY_64 record stride, as the routine hard-codes it
const IY_BASE = 0x6200;        // reference-point pointer, as the real callers set it (IY+3 = axis-2 ref)

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inStack = (a) => a != null && a >= STACK_SCRATCH.lo && a < STACK_SCRATCH.hi;

// First RAM byte that differs between two machines, skipping the dead STACK_SCRATCH region
// (the memory-equivalence contract is RAM − STACK_SCRATCH). { addr, a, b } | null.
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (inStack(addr)) continue;
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

// The registers the search leaves live (result byte in A, count-minus-index residue in B),
// plus the tolerances in H/L, the untouched reference/stride/base registers, and the flags.
const REG_NAMES = ["a", "b", "c", "h", "l", "f", "de", "ix", "iy"];
function regDiffs(o, c) {
  const out = [];
  for (const n of REG_NAMES) if (o.regs[n] !== c.regs[n]) out.push(`reg ${n} oracle=${hx(o.regs[n])} cand=${hx(c.regs[n])}`);
  return out;
}

/** Run the ORACLE on a fresh clone; it performs its own pop/call/return churn. */
function runOracle(entry) {
  const c = entry.clone();
  oracle(c);
  return c;
}

/**
 * Run the candidate on a fresh clone, then model the single terminal return the ROM nets on
 * either outcome (both the hit and the exhausted path unwind to the dispatch site), so pc + SP
 * line up with the oracle. The candidate recovers the pushed tolerances itself (that stack read
 * is a genuine dispatcher boundary), so only the one dissolved call/return remains to model.
 */
function runCandidate(entry, fn) {
  const c = entry.clone();
  fn(c);
  c.ret();
  return c;
}

/** Full contract diff: RAM − STACK_SCRATCH, pc, SP, and the live register file. */
function contractDiffs(entry, fn) {
  const o = runOracle(entry);
  const c = runCandidate(entry, fn);
  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  diffs.push(...regDiffs(o, c));
  return diffs;
}

// A real attract machine so the surrounding RAM is realistic; clone() neutralises the frame
// machinery (nextNmi/nextBoundary = Infinity) so the oracle's steps cannot fire an NMI.
function attractBase(frames = 120) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

// An 11-byte record row from its meaningful fields (+0 active bit, +3/+5 axis coords,
// +9/+0xA extra spans). Other bytes are noise the search ignores.
function row({ active = true, f3 = 0, f5 = 0, f9 = 0, fA = 0 } = {}) {
  const r = new Array(11).fill(0);
  r[0x00] = active ? 0x01 : 0x00;
  r[0x03] = f3;
  r[0x05] = f5;
  r[0x09] = f9;
  r[0x0a] = fA;
  return r;
}

/**
 * Stamp a crafted 0x2901 dispatch onto a clone of the base: the dispatcher's stack (the return
 * site below the pushed tolerance word, which the pop recovers), the reference coordinate and
 * reference pointer the dispatcher leaves in registers, and 7 records at OBJ_ARRAY_64. `bounds`
 * is the pushed HL word — its low byte is the axis-1 tolerance, its high byte the axis-2.
 */
function craft(base, { records, bounds = 0x0407, cRef, iyRef }) {
  const m = base.clone();
  m.regs.sp = SP_TOP;
  m.push16(RETURN_SITE); // the routine's normal return target
  m.push16(bounds);      // the tolerances the dispatcher pushed; `pop hl` recovers them
  m.regs.iy = IY_BASE;
  m.regs.c = cRef & 0xff;
  m.mem.write8((IY_BASE + 3) & 0xffff, iyRef & 0xff);
  const rows = records.slice(0, 7);
  while (rows.length < 7) rows.push(row({ active: false })); // pad to the 7 records the sweep scans
  for (let i = 0; i < rows.length; i++) {
    const rbase = (OBJ_ARRAY_64 + i * RECORD_STRIDE) & 0xffff;
    const rec = rows[i];
    for (let off = 0; off < rec.length; off++) m.mem.write8((rbase + off) & 0xffff, rec[off] & 0xff);
  }
  return m;
}

// The search result the oracle leaves (result byte in A, count-minus-index residue in B).
function classify(entry) {
  const o = entry.clone();
  oracle(o);
  return { hit: o.regs.a === 1, a: o.regs.a, b: o.regs.b };
}

// -- 0. reachability ----------------------------------------------------------

test("REACHABILITY: 0x2901 is NOT dispatched during attract (crafted-entry gate is required)", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(1500);
  // The 0x2901 table arm is reached only through the untranslated 0x3E88 dispatcher, so the
  // live NMI/substate paths never fire it — this is WHY the gate below is crafted entries.
  assert.equal(count, 0, `expected 0x2901 to stay dead in attract; saw ${count} dispatches — add captured cases`);
  console.log("  REACHABILITY: 0 natural 0x2901 dispatches in 1500 frames (dead in attract) -> crafted-entry gate");
});

// -- 1. EQUAL (crafted, each arm pinned) --------------------------------------

test("EQUAL (crafted): every arm matches the oracle", () => {
  const base = attractBase();
  const C = 0x64, Y = 0x80; // realistic reference coordinates

  const cases = [
    {
      name: "hit at the first record (result byte 1, residue = count)",
      opts: { cRef: C, iyRef: Y, records: [row({ f5: C, f3: Y })] }, // rest padded inactive
      wantHit: true, wantB: 7,
    },
    {
      name: "hit at record 3 (count-minus-index recovery)",
      opts: { cRef: C, iyRef: Y, records: [
        row({ active: false }),
        row({ f5: 0x00, fA: 0x02 }),   // active but axis-1 far -> reject
        row({ active: false }),
        row({ f5: C, f3: Y }),         // the hit, index 3
        row({ f5: C, f3: Y }),         // would also hit, but the scan stops earlier
      ] },
      wantHit: true, wantB: 7 - 3,
    },
    {
      name: "exhausted scan (all inactive, result byte 0)",
      opts: { cRef: C, iyRef: Y, records: [] }, // padded to 7 inactive
      wantHit: false, wantB: 0,
    },
  ];

  for (const { name, opts, wantHit, wantB } of cases) {
    const entry = craft(base, opts);
    const k = classify(entry);
    assert.equal(k.hit, wantHit, `${name}: expected ${wantHit ? "hit" : "exhausted"}, oracle did the opposite`);
    assert.equal(k.b, wantB, `${name}: expected residue B=${wantB}, oracle left ${k.b}`);
    const diffs = contractDiffs(entry, loc_2901);
    assert.equal(diffs.length, 0, `${name}: ${diffs.join("; ")}`);
    // Non-vacuity: the object count is stamped, and the write is a genuine RAM effect.
    assert.equal(runOracle(entry).mem.read8(OBJ_SEARCH_COUNT), 7, `${name}: object count not stamped`);
  }
  console.log(`  EQUAL/crafted: ${cases.length} arms (hit@0, hit@3, exhausted) identical to the oracle`);
});

test("EQUAL (crafted): the stack-passed tolerances flip the decision and both match the oracle", () => {
  const base = attractBase();
  const C = 0x64, Y = 0x80;
  // A record 5 past the axis-1 reference: |dx|+1 = 6. It is inside a loose axis-1 tolerance
  // (7) but outside a tight one (2, with no extra span), so the pushed tolerance word decides
  // the hit. This proves the `pop hl` tolerance marshalling is live, not incidental.
  const records = [row({ f5: (C + 5) & 0xff, f3: Y })];

  const loose = craft(base, { bounds: 0x0407, cRef: C, iyRef: Y, records }); // L=7
  const tight = craft(base, { bounds: 0x0402, cRef: C, iyRef: Y, records }); // L=2

  const kLoose = classify(loose), kTight = classify(tight);
  assert.notEqual(kLoose.hit, kTight.hit, "the tolerance change did not flip the decision — case is not exercising the marshalling");

  for (const [label, entry] of [["loose tolerance", loose], ["tight tolerance", tight]]) {
    const diffs = contractDiffs(entry, loc_2901);
    assert.equal(diffs.length, 0, `${label}: ${diffs.join("; ")}`);
  }
  console.log(`  EQUAL/tolerances: loose=${kLoose.hit ? "hit" : "miss"} tight=${kTight.hit ? "hit" : "miss"} — both identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** Broken twin (a): stores the wrong object count (6 instead of 7). */
function brokenCount(m) {
  const { regs, mem } = m;
  regs.hl = m.pop16();
  mem.write8(OBJ_SEARCH_COUNT, 6); // BUG: wrong count
  regs.b = 7;
  regs.de = RECORD_STRIDE;
  regs.ix = OBJ_ARRAY_64;
  loc_2913(m);
  return true;
}

/** Broken twin (b): scans the wrong record count (6 instead of 7), corrupting the residue. */
function brokenScanCount(m) {
  const { regs, mem } = m;
  regs.hl = m.pop16();
  mem.write8(OBJ_SEARCH_COUNT, 7);
  regs.b = 6; // BUG: scans 6 records -> count-minus-index residue is off
  regs.de = RECORD_STRIDE;
  regs.ix = OBJ_ARRAY_64;
  loc_2913(m);
  return true;
}

test("TEETH: the wrong-count-store twin and the wrong-scan-count twin are CAUGHT", () => {
  const base = attractBase();
  const C = 0x64, Y = 0x80;
  const hitEntry = craft(base, { cRef: C, iyRef: Y, records: [row({ f5: C, f3: Y })] });

  // (a) wrong count store: caught at OBJ_SEARCH_COUNT (a live cell, not stack scratch).
  const countDiffs = contractDiffs(hitEntry, brokenCount);
  assert.ok(countDiffs.length > 0, "the wrong-count-store twin escaped — the gate is worthless");
  assert.ok(countDiffs.some((d) => d.startsWith(`RAM@${hx(OBJ_SEARCH_COUNT)}`)),
    `expected the count diff at ${hx(OBJ_SEARCH_COUNT)}, got ${countDiffs.join("; ")}`);

  // (b) wrong scan count: correct RAM, but the residue register B diverges on a hit.
  const scanDiffs = contractDiffs(hitEntry, brokenScanCount);
  assert.ok(scanDiffs.length > 0, "the wrong-scan-count twin escaped — the register check is worthless");
  assert.ok(scanDiffs.some((d) => d.startsWith("reg b ")),
    `expected the residue diff in register b, got ${scanDiffs.join("; ")}`);

  console.log(`  TEETH: wrong-count-store caught (${countDiffs[0]}); wrong-scan-count caught (${scanDiffs.find((d) => d.startsWith("reg b "))})`);
});
