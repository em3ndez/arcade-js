// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3445 (ROM 0x3445) — advance one object's table-driven
 * position walk, or finalize it at the end-of-table terminator.
 *
 * loc_3445 is a LEAF (calls nothing) whose entire memory-observable behaviour splits
 * into two disjoint arms selected by the byte at the saved walk pointer (HL), on the
 * object record the caller points at (IX). It writes only object-record cells and never
 * writes the stack (it only pops via its terminal return), so the contract is
 * memory-only over the WHOLE dump — no STACK_SCRATCH exclusion is needed. Both arms
 * factor cleanly, which makes the gate a proof rather than a sample:
 *
 *   ORDINARY arm (entry != 0xAA) — writes exactly two things, from DISJOINT inputs:
 *     OBJ_Y (+0x05)      = entry byte                 — depends on the entry byte only
 *     +0x1a/+0x1b        = split of (HL + 1)          — depends on HL only
 *   TERMINATOR arm (entry == 0xAA) — clears four state bytes to 0 (OBJ_STATE, +0x13,
 *     +0x18, +0x1c and the pointer +0x1a/+0x1b), and latches two INDEPENDENT copies:
 *     +0x0e = OBJ_X (+0x03),  +0x0f = OBJ_Y (+0x05).
 *
 *   1. EQUAL (factored-exhaustive) — three sweeps that together cover the whole input
 *      space by that factorisation:
 *        SWEEP A — the entry copy over every non-terminator byte (0..255 minus 0xAA),
 *                  with HL fixed; pins OBJ_Y == entry and the fixed pointer split.
 *        SWEEP B — the pointer step over every HL low byte (0x00..0xFF), pinning the
 *                  16-bit +1 split INCLUDING the carry into the high byte.
 *        SWEEP C — the terminator latch over each OBJ_X value and each OBJ_Y value
 *                  independently (the two copies are independent), pinning both latches,
 *                  the four constant clears, and the pointer rewind.
 *      (The real ROM-table pointers the walk actually uses are covered by CAPTURED; the
 *      unreachable full 0xFFFF->0x0000 wrap is correct-by-construction — u16 mirrors the
 *      oracle's 16-bit wrap — and cannot be constructed here, since 0xFFFF is unmapped.)
 *
 *   2. TEETH — four deliberately-broken twins, each of which the sweeps MUST catch:
 *        (a) wrong entry-store offset (writes the entry to +0x06, not OBJ_Y) — SWEEP A.
 *        (b) dropped pointer advance (stores HL, not HL+1) — SWEEP A/B.
 *        (c) swapped finalize copies (+0x0e<-OBJ_Y, +0x0f<-OBJ_X) — SWEEP C.
 *        (d) never-terminate (ignores 0xAA, always takes the ordinary arm) — SWEEP C.
 *
 *   3. CAPTURED realism — hook 0x3445 in a real boot/attract run (the object-walk
 *      subtree runs there), clone at each dispatch, and confirm loc_3445 == oracle on
 *      every real state the game actually produces (both arms occur: mostly ordinary,
 *      with the terminator hit as the table is exhausted).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3445.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3445 as oracle } from "../../translated/loc_3445.js";
import { loc_3445 } from "../loc_3445.js";
import { OBJ_X, OBJ_Y, OBJ_STATE } from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x3445;
const TABLE_TERMINATOR = 0xaa;

// The object record the caller points at (IX). 0x6400 is OBJ_ARRAY_64's first record —
// exactly the base observed in real captures — so every touched cell (+0x03..+0x1c) lands
// inside one 0x20-byte record in work RAM (0x6000-0x6BFF), never in video RAM or I/O.
const IX_BASE = 0x6400;
const CELL = (off) => (IX_BASE + off) & 0xffff;

// Where the swept table byte lives, disjoint from the record. The pointer sweep walks HL
// across 0x6800..0x68FF so the 16-bit +1 crosses a low-byte 0xFF -> high-byte carry.
const HLPTR = 0x6800;

// The oracle's terminal return pops the stack; point SP at work RAM so the pop reads
// valid bytes (never I/O). The oracle writes NO RAM through the stack (a leaf: only
// pops), so this choice never affects the compared memory.
const SAFE_SP = 0x6bf8;

// A distinctive value pre-loaded into every cell the routine WRITES, so a twin that
// SKIPS a write (rather than writing a wrong value) still diverges from the oracle.
const SENTINEL = 0x5a;

// Every object-record cell either arm writes — sentinel-filled before each run.
const OUTPUT_OFFSETS = [0x0e, 0x0f, 0x13, 0x18, OBJ_STATE, 0x1c, 0x1a, 0x1b, OBJ_Y];

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const hb = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the record pointer in IX, the walk pointer
 * in HL, a chosen byte at mem[HL], the record's OBJ_X/OBJ_Y inputs set, every output
 * cell sentinel-filled, and a safe stack. Frame machinery is neutralised (clone() sets
 * nextNmi/nextBoundary = Infinity; re-asserted) so the oracle's step machinery cannot
 * fire an NMI or push a frame while running in isolation.
 */
function makeEntry(base, { hl = HLPTR, byte, objX = 0, objY = 0 }) {
  const e = base.clone();
  e.regs.ix = IX_BASE;
  e.regs.hl = hl;
  for (const off of OUTPUT_OFFSETS) e.mem.write8(CELL(off), SENTINEL);
  e.mem.write8(CELL(OBJ_X), objX); // +0x03 input (terminator latch source)
  e.mem.write8(CELL(OBJ_Y), objY); // +0x05 input (terminator latch source); ordinary arm overwrites it
  e.mem.write8(hl, byte); // set the byte LAST so it wins even if hl overlaps a set cell
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). Fresh entry per side because
 * the routine WRITES memory — a reused machine would carry the previous run forward.
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
 * The three factored sweeps plus the crafted wrap/ROM pointers, run in sequence. Returns
 * the first mismatch (or null) and the total combos compared. By the factorisation in the
 * file header these together cover loc_3445's whole memory-observable input space.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // SWEEP A — ordinary entry copy over every non-terminator byte, HL fixed. OBJ_Y is
  // seeded to 0 so a wrong-offset store (which leaves OBJ_Y at 0) is caught for byte != 0.
  for (let byte = 0; byte < 256; byte++) {
    if (byte === TABLE_TERMINATOR) continue;
    const { ram } = runPair(base, { hl: HLPTR, byte, objX: 0x11, objY: 0x00 }, candidate);
    count++;
    if (ram) return { mismatch: { where: `SWEEP A byte=${hb(byte)}`, ram }, count };
  }

  // SWEEP B — pointer step over every HL low byte (0x6800..0x68FF), a non-terminator
  // byte fixed. Covers the 16-bit +1 including 0x68FF -> 0x6900 (low-byte 0xFF carry).
  for (let lo = 0; lo < 256; lo++) {
    const hl = (0x6800 + lo) & 0xffff;
    const { ram } = runPair(base, { hl, byte: 0x00, objX: 0x33, objY: 0x44 }, candidate);
    count++;
    if (ram) return { mismatch: { where: `SWEEP B hl=${hx(hl)}`, ram }, count };
  }

  // SWEEP C — terminator finalize. The two latch copies are INDEPENDENT, so sweep OBJ_X
  // and OBJ_Y each over all 256 values (the other held at a DISTINCT constant so a
  // swapped-copy twin is caught wherever the two differ).
  for (let objX = 0; objX < 256; objX++) {
    const { ram } = runPair(base, { hl: HLPTR, byte: TABLE_TERMINATOR, objX, objY: 0xc3 }, candidate);
    count++;
    if (ram) return { mismatch: { where: `SWEEP C objX=${hb(objX)}`, ram }, count };
  }
  for (let objY = 0; objY < 256; objY++) {
    const { ram } = runPair(base, { hl: HLPTR, byte: TABLE_TERMINATOR, objX: 0x3c, objY }, candidate);
    count++;
    if (ram) return { mismatch: { where: `SWEEP C objY=${hb(objY)}`, ram }, count };
  }

  return { mismatch: null, count };
}

const describe = (mm) => mm && `${mm.where}: RAM diverges at ${hx(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (factored-exhaustive) -------------------------------------------

test("EQUAL (exhaustive): loc_3445 == oracle across all factored sweeps", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_3445);
  assert.equal(mismatch, null, describe(mismatch));
  // 255 non-terminator bytes + 256 HL low bytes + 256 OBJ_X + 256 OBJ_Y
  assert.equal(count, 255 + 256 + 256 + 256, "must have compared the full factored input space");
  console.log(`  EQUAL/exhaustive: ${count} combos across both arms — RAM identical to the oracle`);
});

// -- 2. TEETH -----------------------------------------------------------------

/** BUG (a): stores the entry byte to +0x06 instead of OBJ_Y (+0x05). */
function brokenWrongEntryOffset(m) {
  const { regs, mem } = m;
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;
  const entry = mem.read8(regs.hl);
  if (entry === TABLE_TERMINATOR) return oracle(m); // finalize arm identical — only the ordinary arm is broken
  mem.write8(field(0x06), entry); // BUG: wrong offset
  const next = (regs.hl + 1) & 0xffff;
  mem.write8(field(0x1a), next);
  mem.write8(field(0x1b), next >> 8);
}

/** BUG (b): stores HL (not HL+1) as the advanced pointer. */
function brokenDroppedAdvance(m) {
  const { regs, mem } = m;
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;
  const entry = mem.read8(regs.hl);
  if (entry === TABLE_TERMINATOR) return oracle(m);
  mem.write8(field(0x05), entry);
  mem.write8(field(0x1a), regs.hl); // BUG: no +1
  mem.write8(field(0x1b), regs.hl >> 8);
}

/** BUG (c): swaps the two finalize copies — +0x0e<-OBJ_Y, +0x0f<-OBJ_X. */
function brokenSwappedFinalize(m) {
  const { regs, mem } = m;
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;
  const entry = mem.read8(regs.hl);
  if (entry !== TABLE_TERMINATOR) return oracle(m); // ordinary arm identical
  mem.write8(field(0x13), 0);
  mem.write8(field(0x18), 0);
  mem.write8(field(0x0d), 0);
  mem.write8(field(0x1c), 0);
  mem.write8(field(0x0e), mem.read8(field(0x05))); // BUG: OBJ_Y into +0x0e
  mem.write8(field(0x0f), mem.read8(field(0x03))); // BUG: OBJ_X into +0x0f
  mem.write8(field(0x1a), 0);
  mem.write8(field(0x1b), 0);
}

/** BUG (d): never terminates — always takes the ordinary arm, even on 0xAA. */
function brokenNeverTerminate(m) {
  const { regs, mem } = m;
  const base = regs.ix;
  const field = (off) => (base + off) & 0xffff;
  const entry = mem.read8(regs.hl); // BUG: no terminator test
  mem.write8(field(0x05), entry);
  const next = (regs.hl + 1) & 0xffff;
  mem.write8(field(0x1a), next);
  mem.write8(field(0x1b), next >> 8);
}

test("TEETH: the wrong-entry-offset twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongEntryOffset);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong entry-store offset — the RAM check is worthless");
  console.log(`  TEETH/entry-offset: caught — ${describe(mismatch)}`);
});

test("TEETH: the dropped-pointer-advance twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedAdvance);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped +1 pointer advance — worthless");
  console.log(`  TEETH/advance: caught — ${describe(mismatch)}`);
});

test("TEETH: the swapped-finalize-copies twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenSwappedFinalize);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch swapped finalize copies — worthless");
  console.log(`  TEETH/swapped-latch: caught — ${describe(mismatch)}`);
});

test("TEETH: the never-terminate twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNeverTerminate);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a routine that ignores the terminator — worthless");
  console.log(`  TEETH/never-terminate: caught — ${describe(mismatch)}`);
});

// -- 3. CAPTURED realism ------------------------------------------------------

/**
 * Hook 0x3445 in a real boot/attract run and clone the machine at up to K real
 * dispatches. The object-walk subtree runs in attract, so both arms occur — mostly
 * ordinary, plus the terminator as the table is exhausted.
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

test("CAPTURED: loc_3445 == oracle on every real 0x3445 dispatch", () => {
  const caps = captureDispatches(64, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x3445 dispatch during boot/attract");

  let ordinary = 0, terminator = 0;
  for (const cap of caps) {
    const a = cap.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
    const b = cap.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
    if (a.mem.read8(a.regs.hl) === TABLE_TERMINATOR) terminator++; else ordinary++;
    oracle(a);
    loc_3445(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
  }
  console.log(`  CAPTURED: ${caps.length} real 0x3445 dispatches — RAM == oracle (${ordinary} ordinary, ${terminator} terminator)`);
});
