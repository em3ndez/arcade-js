// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for unpackScoreDigits (ROM 0x4d0c) — the score-readout digit
 * unpacker: it splits the packed value staged at 0x8037/0x8038 into four nibble
 * digit cells at the buffer pointer, with leading-zero blanking on the top digit,
 * then two trailing zero cells, leaving the pointer on the last cell written.
 *
 * The routine WRITES MEMORY and takes/returns a pointer, so it is gated on
 * memory-equivalence (RAM − stack, pc, SP, and the advanced pointer), not on a
 * returned scalar. Attract never draws the score readout (loc_4cca / loc_4d0c are
 * not dispatched in a plain boot run), so entries are CRAFTED: a real captured
 * machine with the buffer pointer + staged value poked. The only data-dependent
 * branch is "is the top digit zero", a pure function of the two staged bytes, so
 * the whole 65,536-value domain is swept EXHAUSTIVELY on the cell output.
 *
 *   1. EQUAL (exhaustive) — for all 65,536 packed values (both branch arms),
 *      unpackScoreDigits writes the same six/five cells and leaves the same
 *      advanced pointer as the oracle.
 *   2. EQUAL (contract) — on a curated value set, run oracle vs idiomatic on fresh
 *      clones and confirm identical RAM (minus stack) + pc + SP + pointer. This is
 *      what proves nothing OUTSIDE the digit cells is touched.
 *   3. TEETH (exhaustive) — a twin that never blanks the leading zero MUST be
 *      caught (it diverges on every value whose top digit is zero).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4d0c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4d0c as oracle } from "../../translated/loc_4d0c.js";
import { unpackScoreDigits } from "../unpackScoreDigits.js";
import { makeMachineFactory } from "../../machine.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const VAL_LO = 0x8037; // staged score value, low byte
const VAL_HI = 0x8038; // staged score value, high byte
const HL = 0x8286; // a real score-readout digit-cell base (loc_4cca's first record)
const SAFE_SP = 0x83f0; // a work-RAM stack the oracle's ret can pop harmlessly
const CELLS = 7; // watch six output cells + one guard cell past them
const hx = (v) => "0x" + (v & 0xffff).toString(16);

const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// A real captured machine — booted a few frames, then frozen — to seed crafted
// entries with realistic RAM. clone() neutralises its frame machinery.
const seed = ROM_PRESENT ? (() => { const h = makeMachine(); h.runFrames(60); return h.clone(); })() : null;

/**
 * Build an entry: a fresh clone of the real machine with the buffer pointer, the
 * staged value, and a safe stack poked, and the target cells pre-filled to a
 * sentinel so a blanked (unwritten) cell is deterministic and identical on both
 * sides.
 */
function craft(hi, lo, sentinel = 0xaa) {
  const e = seed.clone();
  e.regs.hl = HL;
  e.regs.sp = SAFE_SP;
  e.mem.write8(VAL_HI, hi);
  e.mem.write8(VAL_LO, lo);
  for (let k = 0; k < CELLS; k++) e.mem.write8((HL + k) & 0xffff, sentinel);
  return e;
}

function cellsOf(m) {
  const a = [];
  for (let k = 0; k < CELLS; k++) a.push(m.mem.read8((HL + k) & 0xffff));
  return a;
}

// -- 1. EQUAL (exhaustive over all 65,536 staged values) ----------------------

/**
 * Sweep every packed value against the oracle, comparing the written cells and the
 * advanced pointer. Two persistent machines are reused (the routine only writes the
 * cells it is handed and reads only the staged bytes), re-seeded each iteration.
 */
function exhaustiveSweep(candidate) {
  const mo = seed.clone(), mi = seed.clone();
  let count = 0;
  for (let hi = 0; hi < 256; hi++) {
    for (let lo = 0; lo < 256; lo++) {
      for (const mm of [mo, mi]) {
        mm.regs.hl = HL;
        mm.regs.sp = SAFE_SP; // the oracle rets each pass; keep its pop inside work RAM
        mm.mem.write8(VAL_HI, hi);
        mm.mem.write8(VAL_LO, lo);
        for (let k = 0; k < CELLS; k++) mm.mem.write8((HL + k) & 0xffff, 0xaa);
      }
      oracle(mo);
      candidate(mi);
      count++;
      const co = cellsOf(mo), ci = cellsOf(mi);
      for (let k = 0; k < CELLS; k++) {
        if (co[k] !== ci[k]) return { mismatch: { hi, lo, k, want: co[k], got: ci[k] }, count };
      }
      if ((mo.regs.hl & 0xffff) !== (mi.regs.hl & 0xffff)) {
        return { mismatch: { hi, lo, k: "ptr", want: mo.regs.hl & 0xffff, got: mi.regs.hl & 0xffff }, count };
      }
    }
  }
  return { mismatch: null, count };
}

test("EQUAL (exhaustive): unpackScoreDigits == oracle over all 65,536 packed values", () => {
  const { mismatch, count } = exhaustiveSweep(unpackScoreDigits);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch hi=${hx(mismatch.hi)} lo=${hx(mismatch.lo)} cell=${mismatch.k}: ` +
        `oracle=${hx(mismatch.want)} idiomatic=${hx(mismatch.got)}`,
  );
  assert.equal(count, 65536, "must have swept the full 65,536-value domain");
  console.log(`  EQUAL/exhaustive: ${count} packed values identical to the oracle (cells + pointer)`);
});

// -- 2. EQUAL (whole-RAM + pc + SP contract) ----------------------------------

/** First RAM byte that differs, or null. No stack region to exclude — the routine pushes nothing. */
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Full memory-equivalence contract on one entry: run the oracle on one clone (it
 * rets internally) and the idiomatic on another (then one ret to line up pc + SP,
 * since the idiomatic uses the JS call stack), and diff RAM + pc + SP + pointer.
 */
function contractDiffs(entry) {
  const o = entry.clone(); oracle(o);
  const c = entry.clone(); unpackScoreDigits(c); c.ret();
  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${hx(ram.a)} idiomatic=${hx(ram.b)}`);
  if ((o.regs.hl & 0xffff) !== (c.regs.hl & 0xffff)) diffs.push(`HL oracle=${hx(o.regs.hl)} idiomatic=${hx(c.regs.hl)}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} idiomatic=${hx(c.pc)}`);
  if ((o.regs.sp & 0xffff) !== (c.regs.sp & 0xffff)) diffs.push(`SP oracle=${hx(o.regs.sp)} idiomatic=${hx(c.regs.sp)}`);
  return diffs;
}

test("EQUAL (contract): identical RAM + pc + SP + pointer, so nothing outside the cells is touched", () => {
  const cases = [
    [0x00, 0x00], // all zero: top digit blanked, five zero cells
    [0x01, 0x23], // leading-zero blank arm (12300 style)
    [0x98, 0x76], // no blanking, full six cells
    [0x0f, 0xff], // top digit blanked, nibbles at max
    [0x10, 0x00], // top digit exactly nonzero at the boundary
    [0xff, 0xff], // no blanking, all-max
    [0x07, 0x00], // single leading digit then zeros
  ];
  for (const [hi, lo] of cases) {
    const diffs = contractDiffs(craft(hi, lo));
    assert.equal(diffs.length, 0, `hi=${hx(hi)} lo=${hx(lo)}: ${diffs.join("; ")}`);
  }
  console.log(`  EQUAL/contract: ${cases.length} entries identical on RAM + pc + SP + pointer`);
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/** Broken twin: always emits the top digit (never blanks a leading zero). Diverges
 *  on every value whose top digit is zero — pointer off by one and cells shifted. */
function brokenUnpack(m) {
  const { regs, mem } = m;
  const hi = mem.read8(VAL_HI);
  const lo = mem.read8(VAL_LO);
  const cells = [hi >> 4, hi & 0x0f, lo >> 4, lo & 0x0f, 0, 0];
  let ptr = regs.hl;
  for (let i = 0; i < cells.length; i++) { // BUG: no leading-zero blanking
    mem.write8(ptr, cells[i]);
    if (i < cells.length - 1) ptr = (ptr + 1) & 0xffff;
  }
  regs.hl = ptr;
}

test("TEETH (exhaustive): the no-leading-blank twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = exhaustiveSweep(brokenUnpack);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a twin that skips leading-zero blanking — it is worthless");
  console.log(
    `  TEETH/exhaustive: caught after ${count} values at hi=${hx(mismatch.hi)} lo=${hx(mismatch.lo)} ` +
      `cell=${mismatch.k} (oracle=${hx(mismatch.want)} broken=${hx(mismatch.got)})`,
  );
});
