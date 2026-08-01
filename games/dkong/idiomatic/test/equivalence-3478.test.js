// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for sub_3478 (ROM 0x3478) — start-or-continue an object's direction-
 * selected, table-driven position walk (the forward/backward twin of sub_342c), then tail
 * into the shared walk tail loc_3445.
 *
 * sub_3478 is NEVER dispatched during boot/attract (its only caller, sub_32bd at 0x32D2,
 * is still the oracle and is not reached), so there are no real captures to replay. The
 * gate is therefore CRAFTED and, by the routine's branch factorisation, exhaustive over
 * its own decision inputs:
 *
 *   • zero test on the saved table pointer (fresh vs continuing walk),
 *   • the direction select — bit 7 of the shared context byte (MARIO_X),
 *   • the direction dispatch — direction mark == 1 (forward) vs anything else (backward),
 *   • the 8-bit X step up/down (both wrap edges),
 *   • the table byte the shared tail then reads (ordinary vs the 0xAA terminator) and the
 *     table pointer handed to it (the low-byte +1 carry inside loc_3445).
 *
 * The routine pushes nothing; its terminal return is BORROWED from loc_3445, whose return
 * only POPS the stack (a read). So no side writes STACK_SCRATCH and the contract is a plain
 * whole-dump RAM diff — no STACK_SCRATCH exclusion needed. Both sides compose with the same
 * loc_3445 (the oracle m.call's the registry's copy; the candidate direct-calls the
 * idiomatic one — proven RAM-equal), so the diff isolates sub_3478's own logic and its one
 * live register hand-off (the table pointer).
 *
 *   1. EQUAL (crafted-exhaustive) — five sweeps that together cover the decision space:
 *        SWEEP 1 — fresh walk (pointer 0) over every context byte (0..255): pins the zero
 *                  test, the bit-7 direction select, both fresh-walk seeds, and the ensuing
 *                  step + shared-tail hand-off.
 *        SWEEP 2 — continuing walk over every direction mark (0..255): pins "no reinit when
 *                  non-zero" (context byte untouched) and the mark == 1 dispatch.
 *        SWEEP 3 — continuing walk, the X step over every X value on BOTH arms (forward and
 *                  backward): pins the 8-bit up/down wrap.
 *        SWEEP 4 — continuing walk over every table byte (0..255 incl. 0xAA): pins the
 *                  pointer hand-off so loc_3445 selects the right arm and reads the right
 *                  entry (a dropped hand-off reads the wrong table byte).
 *        SWEEP 5 — continuing walk over every table-pointer low byte (0x6800..0x68FF): pins
 *                  the pointer value handed over, including the +1 carry inside loc_3445.
 *
 *   2. TEETH — four deliberately-broken twins, each of which the sweeps MUST catch:
 *        (a) wrong direction bit (tests bit 0, not bit 7)          — SWEEP 1.
 *        (b) swapped dispatch (mark == 1 steps DOWN, not up)       — SWEEP 2/3.
 *        (c) dropped pointer hand-off (leaves the stale pointer)   — SWEEP 4/5 (and 1).
 *        (d) dropped zero test (always reinitialises)              — SWEEP 2.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3478.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_3478 as oracle } from "../../translated/sub_3478.js";
import { loc_3478 as candidate } from "../loc_3478.js";
import { loc_3445 } from "../loc_3445.js";
import { OBJ_X, OBJ_STATE, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI, MARIO_X } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TERMINATOR = 0xaa;

// The object record the caller points at (IX). 0x6400 is OBJ_ARRAY_64's first record, so
// every touched field (+0x03..+0x1c) lands inside one 0x20-byte record in work RAM.
const IX_BASE = 0x6400;
const CELL = (off) => (IX_BASE + off) & 0xffff;

// A non-zero table pointer for the continuing-walk sweeps, disjoint from the record. The
// pointer sweep walks it across 0x6800..0x68FF so the 16-bit +1 crosses a low-byte 0xFF.
const PTR_BASE = 0x6800;

// A distinct value pre-loaded into the register that carries the table pointer, so a twin
// that DROPS the pointer hand-off (leaves this) diverges from the oracle, which reloads it.
const HL_SENTINEL = 0x6900;

// Point SP at work RAM so the oracle's borrowed terminal return (a pop, if the registry's
// loc_3445 is still the oracle) reads valid bytes. Nothing WRITES the stack, so this never
// affects the compared memory.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const hb = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the record pointer in IX, a distinct sentinel
 * in the pointer register, the record's saved-pointer / direction-mark / X fields set, the
 * context byte set, and (for a non-zero pointer) the chosen table byte written at mem[ptr].
 * Frame machinery is neutralised so the oracle's step machinery cannot fire an NMI or push
 * a frame while running in isolation.
 */
function makeEntry(base, { ptr, mario = 0, state = 0, objX = 0, tableByte = 0 }) {
  const e = base.clone();
  e.regs.ix = IX_BASE;
  e.regs.hl = HL_SENTINEL;
  e.regs.sp = SAFE_SP;
  e.mem.write8(CELL(OBJ_WALK_PTR_LO), ptr & 0xff);
  e.mem.write8(CELL(OBJ_WALK_PTR_HI), (ptr >> 8) & 0xff);
  e.mem.write8(CELL(OBJ_STATE), state);
  e.mem.write8(CELL(OBJ_X), objX);
  e.mem.write8(MARIO_X, mario);
  if (ptr !== 0) e.mem.write8(ptr, tableByte); // fresh walk reads ROM 0x3AAC instead
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and a candidate on two FRESH, byte-identical entries and diff the memory-
 * equivalence contract (whole-dump RAM). Fresh entry per side because the routine WRITES
 * memory — a reused machine would carry the previous run forward.
 */
function runPair(base, opts, fn) {
  const a = makeEntry(base, opts);
  const b = makeEntry(base, opts);
  oracle(a);
  fn(b);
  return { ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)) };
}

/**
 * The five factored sweeps run in sequence. Returns the first mismatch (or null) and the
 * total combos compared. By the branch factorisation in the header these together cover
 * sub_3478's whole decision space.
 */
function fullSweep(base, fn) {
  let count = 0;

  // SWEEP 1 — fresh walk (pointer 0) over every context byte. tableByte is irrelevant here
  // (the fresh arm points at ROM 0x3AAC); objX chosen so both step arms are observable.
  for (let mario = 0; mario < 256; mario++) {
    const { ram } = runPair(base, { ptr: 0, mario, state: 0x55, objX: 0x40 }, fn);
    count++;
    if (ram) return { mismatch: { where: `SWEEP 1 mario=${hb(mario)}`, ram }, count };
  }

  // SWEEP 2 — continuing walk (pointer non-zero) over every direction mark. Context byte set
  // to a value whose bit 7 differs from the "no-reinit" expectation, so a dropped zero test
  // (which would consult it) diverges.
  for (let state = 0; state < 256; state++) {
    const { ram } = runPair(base, { ptr: PTR_BASE, mario: 0x80, state, objX: 0x40, tableByte: 0x00 }, fn);
    count++;
    if (ram) return { mismatch: { where: `SWEEP 2 state=${hb(state)}`, ram }, count };
  }

  // SWEEP 3 — continuing walk, the X step over every X value on both arms.
  for (let objX = 0; objX < 256; objX++) {
    const fwd = runPair(base, { ptr: PTR_BASE, state: 0x01, objX, tableByte: 0x00 }, fn); // forward: +1
    count++;
    if (fwd.ram) return { mismatch: { where: `SWEEP 3 forward objX=${hb(objX)}`, ram: fwd.ram }, count };
    const bwd = runPair(base, { ptr: PTR_BASE, state: 0x02, objX, tableByte: 0x00 }, fn); // backward: -1
    count++;
    if (bwd.ram) return { mismatch: { where: `SWEEP 3 backward objX=${hb(objX)}`, ram: bwd.ram }, count };
  }

  // SWEEP 4 — continuing walk over every table byte (incl. the 0xAA terminator): pins the
  // pointer hand-off so the shared tail selects the right arm and reads the right entry.
  for (let tableByte = 0; tableByte < 256; tableByte++) {
    const { ram } = runPair(base, { ptr: PTR_BASE, state: 0x01, objX: 0x40, tableByte }, fn);
    count++;
    if (ram) return { mismatch: { where: `SWEEP 4 tableByte=${hb(tableByte)}`, ram }, count };
  }

  // SWEEP 5 — continuing walk over every table-pointer low byte (0x6800..0x68FF): pins the
  // pointer value handed over, including the +1 carry the shared tail applies to it.
  for (let lo = 0; lo < 256; lo++) {
    const ptr = (0x6800 + lo) & 0xffff;
    const { ram } = runPair(base, { ptr, state: 0x01, objX: 0x40, tableByte: 0x00 }, fn);
    count++;
    if (ram) return { mismatch: { where: `SWEEP 5 ptr=${hx(ptr)}`, ram }, count };
  }

  return { mismatch: null, count };
}

const describe = (mm) => mm && `${mm.where}: RAM diverges at ${hx(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;
const COMBOS = 256 + 256 + 256 * 2 + 256 + 256; // 1536

// -- 1. EQUAL (crafted-exhaustive) --------------------------------------------

test("EQUAL (exhaustive): sub_3478 == oracle across all factored sweeps", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, candidate);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, COMBOS, "must have compared the full factored decision space");
  console.log(`  EQUAL/exhaustive: ${count} combos across fresh/continuing walks — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------
//
// Each twin re-implements sub_3478 with ONE injected bug (composing with the SAME idiomatic
// loc_3445), so the sweep isolates that bug alone.

/** BUG (a): direction select tests bit 0 of the context byte, not bit 7. */
function brokenWrongDirectionBit(m) {
  const { regs, mem } = m;
  const base = regs.ix, field = (off) => (base + off) & 0xffff;
  let ptr = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);
  if (ptr === 0) {
    ptr = 0x3aac;
    if ((mem.read8(MARIO_X) & 0x01) === 0) { // BUG: bit 0
      mem.write8(field(OBJ_STATE), 0x02); mem.write8(field(OBJ_X), 0x80);
    } else {
      mem.write8(field(OBJ_STATE), 0x01); mem.write8(field(OBJ_X), 0x7e);
    }
  }
  if (mem.read8(field(OBJ_STATE)) === 0x01) mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) + 1) & 0xff);
  else mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) - 1) & 0xff);
  regs.hl = ptr; loc_3445(m);
}

/** BUG (b): the forward mark steps X DOWN instead of up (dispatch swapped). */
function brokenSwappedDispatch(m) {
  const { regs, mem } = m;
  const base = regs.ix, field = (off) => (base + off) & 0xffff;
  let ptr = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);
  if (ptr === 0) {
    ptr = 0x3aac;
    if ((mem.read8(MARIO_X) & 0x80) === 0) { mem.write8(field(OBJ_STATE), 0x02); mem.write8(field(OBJ_X), 0x80); }
    else { mem.write8(field(OBJ_STATE), 0x01); mem.write8(field(OBJ_X), 0x7e); }
  }
  if (mem.read8(field(OBJ_STATE)) === 0x01) mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) - 1) & 0xff); // BUG: down
  else mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) + 1) & 0xff);
  regs.hl = ptr; loc_3445(m);
}

/** BUG (c): never sets the pointer register, so the shared tail reads the stale pointer. */
function brokenDroppedHandoff(m) {
  const { regs, mem } = m;
  const base = regs.ix, field = (off) => (base + off) & 0xffff;
  let ptr = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);
  if (ptr === 0) {
    ptr = 0x3aac;
    if ((mem.read8(MARIO_X) & 0x80) === 0) { mem.write8(field(OBJ_STATE), 0x02); mem.write8(field(OBJ_X), 0x80); }
    else { mem.write8(field(OBJ_STATE), 0x01); mem.write8(field(OBJ_X), 0x7e); }
  }
  if (mem.read8(field(OBJ_STATE)) === 0x01) mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) + 1) & 0xff);
  else mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) - 1) & 0xff);
  loc_3445(m); // BUG: regs.hl left at the stale sentinel
}

/** BUG (d): drops the zero test, reinitialising even a continuing walk. */
function brokenDroppedZeroTest(m) {
  const { regs, mem } = m;
  const base = regs.ix, field = (off) => (base + off) & 0xffff;
  let ptr = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);
  ptr = 0x3aac; // BUG: no zero test — always reinitialise
  if ((mem.read8(MARIO_X) & 0x80) === 0) { mem.write8(field(OBJ_STATE), 0x02); mem.write8(field(OBJ_X), 0x80); }
  else { mem.write8(field(OBJ_STATE), 0x01); mem.write8(field(OBJ_X), 0x7e); }
  if (mem.read8(field(OBJ_STATE)) === 0x01) mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) + 1) & 0xff);
  else mem.write8(field(OBJ_X), (mem.read8(field(OBJ_X)) - 1) & 0xff);
  regs.hl = ptr; loc_3445(m);
}

test("TEETH: the wrong-direction-bit twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongDirectionBit);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong direction bit — worthless");
  console.log(`  TEETH/direction-bit: caught — ${describe(mismatch)}`);
});

test("TEETH: the swapped-dispatch twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSwappedDispatch);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a swapped direction dispatch — worthless");
  console.log(`  TEETH/dispatch: caught — ${describe(mismatch)}`);
});

test("TEETH: the dropped-pointer-handoff twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedHandoff);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped table-pointer hand-off — worthless");
  console.log(`  TEETH/handoff: caught — ${describe(mismatch)}`);
});

test("TEETH: the dropped-zero-test twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedZeroTest);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped zero test — worthless");
  console.log(`  TEETH/zero-test: caught — ${describe(mismatch)}`);
});
