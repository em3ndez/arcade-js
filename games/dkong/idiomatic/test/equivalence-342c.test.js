// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_342c (ROM 0x342C) — start or resume one object's scripted
 * position walk, advance its X one step, then hand to the shared table-walk tail loc_3445.
 *
 * loc_342c's own memory-observable behaviour (before the tail) is small and factors cleanly:
 *
 *   • It reloads a 16-bit saved pointer from the object record (+0x1a low, +0x1b high) and
 *     splits on whether it is ZERO:
 *       FRESH  (saved == 0) — aim the walk at the ROM path table (0x3A8C) and stamp OBJ_X to
 *                             the seed (38), overwriting whatever was there.
 *       RESUME (saved != 0) — keep the saved pointer.
 *   • Either way it then advances OBJ_X by one (8-bit).
 *   • It marshals the resolved pointer into the tail's register slot and calls loc_3445, which
 *     is ALREADY idiomatic and proven memory-equivalent (equivalence-3445.test.js) — so this
 *     gate is a COMPOSITION check: loc_342c's head logic, wired to the real idiomatic tail,
 *     must reproduce the frozen oracle (which falls through into the translated loc_3445).
 *
 * NO STACK-SCRATCH EXCLUSION. The oracle's only stack op is loc_3445's terminal pop (a READ;
 * it never pushes — loc_342c models the fall-through as a call with no return address), so no
 * side of the compare writes the stack. The contract is memory-only over the WHOLE dump, like
 * loc_3445's own test.
 *
 * The factored sweeps together cover loc_342c's whole memory-observable input space:
 *
 *   FRESH   — saved == 0 over every OBJ_X input (0..255). The pointer is forced to the ROM
 *             table start, so the tail reads the real first entry (ROM[0x3A8C] = 0xE8, an
 *             ordinary entry): OBJ_X must become 0x27 (seed 38 + 1) REGARDLESS of the input,
 *             OBJ_Y := 0xE8, and the saved pointer advances to 0x3A8D. Pins the seed-overwrite
 *             and the fresh-start pointer target.
 *   RESUME/entry  — saved != 0 into controllable work RAM (0x6800), an ordinary table byte:
 *             (a) over every non-terminator byte (pins OBJ_Y := byte); (b) over every pointer
 *             low byte 0x6800..0x68FF (pins the 16-bit reload + the +1 step incl. the low-byte
 *             carry 0x68FF->0x6900); (c) over every OBJ_X input (pins the advance incl. the
 *             0xFF->0x00 wrap; no seed on a resume).
 *   RESUME/terminator — saved != 0, the table byte is the end-of-table marker (0xAA): the tail
 *             finalizes. Sweep OBJ_X and OBJ_Y independently — the finalize latches the
 *             ALREADY-ADVANCED X into +0x0e (so this also pins advance-before-finalize) and
 *             OBJ_Y into +0x0f, clears the four state bytes, and rewinds the pointer to zero.
 *
 * TEETH — four broken twins (each keeps the real idiomatic tail; only the head is broken), each
 *   of which the sweeps MUST catch:
 *     (a) inverted fresh/resume test — treats a zero pointer as resume and non-zero as fresh.
 *     (b) dropped X advance — never increments OBJ_X.
 *     (c) no seed — the fresh start does not stamp OBJ_X.
 *     (d) wrong table start — the fresh start aims at 0x3A8D instead of 0x3A8C.
 *
 * CAPTURED — hook 0x342C in a real boot/attract run (it is dispatched there), clone at each
 *   dispatch, and confirm loc_342c == oracle on every real state the game actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-342c.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_342c as oracle } from "../../translated/loc_342c.js";
import { loc_342c } from "../loc_342c.js";
import { loc_3445 } from "../loc_3445.js";
import { OBJ_X, OBJ_Y, OBJ_STATE, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x342c;
const TABLE_TERMINATOR = 0xaa;
const TABLE_START = 0x3a8c; // ROM[0x3A8C] = 0xE8 (an ordinary entry), ROM[0x3A8D] = 0xE5
const X_SEED = 38; // 0x26 — the fresh-start X

// The object record the caller points at (IX). 0x6400 is OBJ_ARRAY_64's first record —
// exactly the base observed in real captures — so every touched cell (+0x03..+0x1c) lands
// inside one 0x20-byte record in work RAM (0x6000-0x6BFF), never in video RAM or I/O.
const IX_BASE = 0x6400;
const CELL = (off) => (IX_BASE + off) & 0xffff;

// Where a RESUME walk pointer points — controllable work RAM, disjoint from the record and
// the stack. The pointer-low sweep walks it across 0x6800..0x68FF so the 16-bit +1 in the
// tail crosses a low-byte 0xFF -> high-byte carry.
const WORK_PTR = 0x6800;

// The oracle's tail pops the stack (a read); point SP at work RAM so the pop reads valid
// bytes (never I/O). Neither side WRITES the stack, so this never affects the compared memory.
const SAFE_SP = 0x6bf8;

// A distinctive value pre-loaded into every cell the routine WRITES, so a twin that SKIPS a
// write (rather than writing a wrong value) still diverges from the oracle.
const SENTINEL = 0x87;

// Every object-record cell either path/arm writes — sentinel-filled before each run.
const OUTPUT_OFFSETS = [OBJ_X, OBJ_Y, 0x0e, 0x0f, 0x13, 0x18, OBJ_STATE, 0x1c, OBJ_WALK_PTR_LO, OBJ_WALK_PTR_HI];

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const hb = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the object record in IX, the saved 16-bit walk
 * pointer written into the record (+0x1a/+0x1b), the OBJ_X/OBJ_Y inputs set, every output cell
 * sentinel-filled, and — for a RESUME (non-zero pointer into work RAM) — the byte the tail will
 * read placed at that pointer. Frame machinery is neutralised so the oracle's step machinery
 * cannot fire an NMI or push a frame while running in isolation.
 */
function makeEntry(base, { saved, objX = 0, objY = 0, tableByte = 0 }) {
  const e = base.clone();
  e.regs.ix = IX_BASE;
  for (const off of OUTPUT_OFFSETS) e.mem.write8(CELL(off), SENTINEL);
  e.mem.write8(CELL(OBJ_WALK_PTR_LO), saved & 0xff);
  e.mem.write8(CELL(OBJ_WALK_PTR_HI), (saved >> 8) & 0xff);
  e.mem.write8(CELL(OBJ_X), objX); // +0x03 input (overwritten on a fresh start)
  e.mem.write8(CELL(OBJ_Y), objY); // +0x05 input (terminator latch source; ordinary arm overwrites)
  if (saved !== 0) e.mem.write8(saved, tableByte); // the byte the resume pointer reads
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). Fresh entry per side because the
 * routine WRITES memory — a reused machine would carry the previous run forward.
 */
function runPair(base, opts, candidate) {
  const a = makeEntry(base, opts); // oracle
  const b = makeEntry(base, opts); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * The factored sweeps, run in sequence. Returns the first mismatch (or null) and the total
 * combos compared. By the factorisation in the file header these together cover loc_342c's
 * whole memory-observable input space.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // FRESH — saved pointer zero (first pass) over every OBJ_X input. The tail reads the real
  // ROM table start, so OBJ_X must land on 0x27 regardless of the input (seed overwrites it).
  for (let objX = 0; objX < 256; objX++) {
    const { ram } = runPair(base, { saved: 0, objX, objY: 0x00 }, candidate);
    count++;
    if (ram) return { mismatch: { where: `FRESH objX=${hb(objX)}`, ram }, count };
  }

  // RESUME/entry (a) — ordinary table byte over every non-terminator value, pointer fixed.
  for (let byte = 0; byte < 256; byte++) {
    if (byte === TABLE_TERMINATOR) continue;
    const { ram } = runPair(base, { saved: WORK_PTR, objX: 0x11, objY: 0x22, tableByte: byte }, candidate);
    count++;
    if (ram) return { mismatch: { where: `RESUME/entry byte=${hb(byte)}`, ram }, count };
  }

  // RESUME/entry (b) — pointer low byte over 0x6800..0x68FF, an ordinary byte fixed. Covers the
  // 16-bit reload and the tail's +1 step including 0x68FF -> 0x6900 (low-byte carry).
  for (let lo = 0; lo < 256; lo++) {
    const saved = (WORK_PTR + lo) & 0xffff;
    const { ram } = runPair(base, { saved, objX: 0x33, objY: 0x44, tableByte: 0x00 }, candidate);
    count++;
    if (ram) return { mismatch: { where: `RESUME/entry ptr=${hx(saved)}`, ram }, count };
  }

  // RESUME/entry (c) — OBJ_X input over all 256 values, pointer + byte fixed. Pins the advance
  // including the 0xFF -> 0x00 wrap (no seed on a resume).
  for (let objX = 0; objX < 256; objX++) {
    const { ram } = runPair(base, { saved: WORK_PTR, objX, objY: 0x44, tableByte: 0x00 }, candidate);
    count++;
    if (ram) return { mismatch: { where: `RESUME/entry objX=${hb(objX)}`, ram }, count };
  }

  // RESUME/terminator — the tail finalizes. Sweep OBJ_X (pins +0x0e := advanced X, i.e.
  // advance-before-finalize) and OBJ_Y (pins +0x0f := OBJ_Y) independently.
  for (let objX = 0; objX < 256; objX++) {
    const { ram } = runPair(base, { saved: WORK_PTR, objX, objY: 0xc3, tableByte: TABLE_TERMINATOR }, candidate);
    count++;
    if (ram) return { mismatch: { where: `TERMINATOR objX=${hb(objX)}`, ram }, count };
  }
  for (let objY = 0; objY < 256; objY++) {
    const { ram } = runPair(base, { saved: WORK_PTR, objX: 0x3c, objY, tableByte: TABLE_TERMINATOR }, candidate);
    count++;
    if (ram) return { mismatch: { where: `TERMINATOR objY=${hb(objY)}`, ram }, count };
  }

  return { mismatch: null, count };
}

const describe = (mm) => mm && `${mm.where}: RAM diverges at ${hx(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;
const SWEEP_COUNT = 256 + 255 + 256 + 256 + 256 + 256; // FRESH + entry(a,b,c) + terminator(x,y)

// -- 1. EQUAL (factored-exhaustive) -------------------------------------------

test("EQUAL (exhaustive): loc_342c == oracle across all factored sweeps", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_342c);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, SWEEP_COUNT, "must have compared the full factored input space");
  console.log(`  EQUAL/exhaustive: ${count} combos across fresh/resume + both tail arms — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------
// Each twin keeps the real idiomatic tail (loc_3445) and breaks ONLY loc_342c's head logic.

/** BUG (a): inverts the fresh/resume split — zero is treated as resume, non-zero as fresh. */
function brokenInvertedFreshTest(m) {
  const { regs, mem } = m;
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;
  const saved = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);
  let ptr;
  if (saved === 0) ptr = saved; // BUG: inverted
  else { ptr = TABLE_START; mem.write8(field(OBJ_X), X_SEED); }
  mem.write8(field(OBJ_X), mem.read8(field(OBJ_X)) + 1);
  regs.hl = ptr;
  loc_3445(m);
}

/** BUG (b): never advances OBJ_X. */
function brokenDroppedAdvance(m) {
  const { regs, mem } = m;
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;
  const saved = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);
  let ptr;
  if (saved !== 0) ptr = saved;
  else { ptr = TABLE_START; mem.write8(field(OBJ_X), X_SEED); }
  // BUG: no advance
  regs.hl = ptr;
  loc_3445(m);
}

/** BUG (c): the fresh start does not stamp the X seed. */
function brokenNoSeed(m) {
  const { regs, mem } = m;
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;
  const saved = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);
  let ptr;
  if (saved !== 0) ptr = saved;
  else ptr = TABLE_START; // BUG: no seed write
  mem.write8(field(OBJ_X), mem.read8(field(OBJ_X)) + 1);
  regs.hl = ptr;
  loc_3445(m);
}

/** BUG (d): the fresh start aims at 0x3A8D instead of the table start 0x3A8C. */
function brokenWrongTableStart(m) {
  const { regs, mem } = m;
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;
  const saved = mem.read8(field(OBJ_WALK_PTR_LO)) | (mem.read8(field(OBJ_WALK_PTR_HI)) << 8);
  let ptr;
  if (saved !== 0) ptr = saved;
  else { ptr = TABLE_START + 1; mem.write8(field(OBJ_X), X_SEED); } // BUG: wrong start
  mem.write8(field(OBJ_X), mem.read8(field(OBJ_X)) + 1);
  regs.hl = ptr;
  loc_3445(m);
}

test("TEETH: the inverted fresh/resume twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInvertedFreshTest);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted fresh/resume split — worthless");
  console.log(`  TEETH/inverted-split: caught — ${describe(mismatch)}`);
});

test("TEETH: the dropped-X-advance twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedAdvance);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped X advance — worthless");
  console.log(`  TEETH/advance: caught — ${describe(mismatch)}`);
});

test("TEETH: the no-seed twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNoSeed);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a missing fresh-start seed — worthless");
  console.log(`  TEETH/no-seed: caught — ${describe(mismatch)}`);
});

test("TEETH: the wrong-table-start twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongTableStart);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong fresh-start table pointer — worthless");
  console.log(`  TEETH/table-start: caught — ${describe(mismatch)}`);
});

// -- 3. CAPTURED realism ------------------------------------------------------

/**
 * Hook 0x342C in a real boot/attract run and clone the machine at up to K real dispatches.
 * The object-walk subtree runs in attract, so this fires there (fresh and resume both occur).
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("CAPTURED: loc_342c == oracle on every real 0x342C dispatch", () => {
  const caps = captureDispatches(64, 2000);
  assert.ok(caps.length >= 1, "expected at least one real 0x342C dispatch during boot/attract");

  let fresh = 0, resume = 0;
  for (const cap of caps) {
    const a = cap.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
    const b = cap.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const savedPtr = a.mem.read8((a.regs.ix + OBJ_WALK_PTR_LO) & 0xffff) |
      (a.mem.read8((a.regs.ix + OBJ_WALK_PTR_HI) & 0xffff) << 8);
    if (savedPtr === 0) fresh++; else resume++;
    oracle(a);
    loc_342c(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
  }
  console.log(`  CAPTURED: ${caps.length} real 0x342C dispatches — RAM == oracle (${fresh} fresh, ${resume} resume)`);
});
