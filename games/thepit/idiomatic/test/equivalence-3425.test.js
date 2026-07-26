// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_3425 (ROM 0x3425, The Pit) — the two-stage
 * tile-table probe used by the object move/collision driver loc_319d.
 *
 * WHAT THE ROUTINE OUTPUTS. It writes exactly one memory byte-pair — the advanced
 * tilemap pointer at 0x8134 — and hands its caller a MATCH RESULT. loc_319d is still
 * the frozen oracle and consumes that result as the Z flag (`call 0x3425` then a
 * branch-if-matched), so the declared LIVE-OUT is memory (0x8134) PLUS the Z flag —
 * NOT the full register file. Comparing the whole register file (as the shared
 * unitEquivalence does) would false-fail an honest rewrite on the oracle's dead
 * residual registers, so this gate diffs the memory dump via firstStateDiff and the
 * Z flag explicitly, and nothing else. (The oracle's `ret` pops the stack and moves
 * SP/pc; those are the modelled-return plumbing the direct-call layer drops, so they
 * are not compared — the pop reads memory but writes none, so the memory dump stays
 * clean.)
 *
 * REAL DISPATCHES + CRAFTED COVERAGE. The attract demo enters 0x3425 ~176 times, so
 * the primary evidence is real: each captured entry is cloned and oracle-vs-idiomatic
 * replayed on it. Real dispatches naturally span the first-row miss and zero-phase
 * exits but only rarely the both-rows-scanned exit, so a crafted grid pokes the
 * probe's few inputs (phase 0x808d, pointer 0x8089, and the two tiles the pointer
 * addresses) to also cover the byte-wrap seams and force the both-rows exit on demand.
 * Both arms read the SAME ROM tables, so equality is structural for any inputs — the
 * poking is for coverage and for building a discriminator the teeth can bite.
 *
 * SIX checks:
 *   1. EQUAL (real dispatches) — every captured 0x3425 entry replayed oracle vs
 *      idiomatic; memory + Z identical, and the real states show Z both ways.
 *   2. EQUAL (crafted grid) — a broad sweep of phase/pointer/tile combinations, incl.
 *      the byte-wrap edges of the phase; memory + Z identical.
 *   3. PATH COVERAGE — three constructed entries drive the three exits and confirm
 *      the oracle's Z matches the hand-derived expectation AND the idiomatic agrees.
 *   4. NON-VACUOUS — pre-set 0x8134/0x8135 to a sentinel; both arms overwrite them
 *      to the advanced pointer and agree (a no-op twin could not pass).
 *   5. TEETH A — a twin that stores the pointer WITHOUT the one-row advance is caught
 *      at 0x8134 by the memory diff.
 *   6. TEETH B — a twin with the canonical second-row logic bug (shift the phase the
 *      wrong way) is caught by the Z-flag check on a ROM-derived path-3 entry.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3425.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3425 as oracle } from "../../translated/loc_3425.js";
import { loc_3425 as idiomatic } from "../loc_3425.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const PHASE = 0x808d; // object sub-tile phase (the table-row selector)
const PTR = 0x8089; // object tilemap pointer (word)
const SAVED = 0x8134; // where the advanced pointer is stashed
const FIRST_TABLE = 0x34fe;
const SECOND_TABLE = 0x35fe;
const ROW_LEN = 32;

// A safe pointer for crafted entries: cell = base + 32 lands in writable work RAM,
// so the two probed tiles can be poked and read back.
const PTR_BASE = 0x8200; // -> advanced cell 0x8220, following tile 0x8221
const CELL = (PTR_BASE + ROW_LEN) & 0xffff;

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The Pit's routine registry is async, so build the factory once and reuse it.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// ---- ROM table helpers (read the real tables to derive path expectations) ----

const row1Base = (phase) => (FIRST_TABLE + (phase + ROW_LEN) % 256) & 0xffff;
const row2Base = (phase) => (SECOND_TABLE + (phase - ROW_LEN + 256) % 256) & 0xffff;
const wrongRow2Base = (phase) => (SECOND_TABLE + (phase + ROW_LEN) % 256) & 0xffff; // the sub->add bug's row
function rowBytes(base) {
  const a = [];
  for (let i = 0; i < ROW_LEN; i++) a.push(ROM[(base + i) & 0xffff]);
  return a;
}

/**
 * Capture real 0x3425 entries from the attract demo. A registry hook clones the
 * machine on entry (up to `cap`), then delegates to the oracle so attract proceeds
 * undisturbed — each clone is the precise in-play state the routine was really called
 * with. Runs in one chunk (attract only advances under a continuous run).
 */
function captureRealDispatches(frames, cap) {
  const entries = [];
  const overrides = new Map([[0x3425, (mm) => {
    if (entries.length < cap) entries.push(mm.clone());
    return oracle(mm);
  }]]);
  makeMachine(overrides).runFrames(frames);
  return entries;
}

/** A real attract machine, cloned at `frame` for a realistic RAM backdrop. */
function captureState(frame) {
  const m = makeMachine();
  m.runFrames(frame);
  return m.clone();
}

/** Clone `base`, then poke the probe's inputs. */
function withProbe(base, { phase, ptr = PTR_BASE, key1, key2 }) {
  const e = base.clone();
  e.mem.write8(PHASE, phase);
  e.mem.write16(PTR, ptr);
  const cell = (ptr + ROW_LEN) & 0xffff;
  if (key1 !== undefined) e.mem.write8(cell, key1);
  if (key2 !== undefined) e.mem.write8((cell + 1) & 0xffff, key2);
  return e;
}

/** Run oracle and a candidate on independent clones; diff memory + the Z flag. */
function probeDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  const oracleRet = oracle(a);
  const fnRet = fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    oracleZ: a.regs.fZ,
    fnZ: b.regs.fZ,
    zEqual: a.regs.fZ === b.regs.fZ,
    savedOracle: a.mem.read16(SAVED),
    savedFn: b.mem.read16(SAVED),
    oracleRet,
    fnRet,
  };
}

// -- 1. EQUAL over real captured 0x3425 dispatches ----------------------------

test("EQUAL (real dispatches): idiomatic == oracle over captured 0x3425 entries", () => {
  const entries = captureRealDispatches(2000, 200);
  assert.ok(entries.length >= 20, `expected many real 0x3425 dispatches, got ${entries.length}`);
  let sawZ = false, sawNotZ = false;
  for (const e of entries) {
    const r = probeDiff(e, idiomatic);
    assert.equal(r.ram, null, r.ram && `real dispatch: RAM diff at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`);
    assert.equal(r.zEqual, true, `real dispatch: Z diverged (oracle=${r.oracleZ} idiomatic=${r.fnZ})`);
    assert.equal(r.fnRet, r.oracleZ, "real dispatch: idiomatic's boolean return must equal its Z flag");
    if (r.oracleZ) sawZ = true; else sawNotZ = true;
  }
  assert.ok(sawZ && sawNotZ, "real dispatches should exercise Z both set and clear");
  console.log(`  EQUAL/real: ${entries.length} captured 0x3425 dispatches identical to the oracle (memory + Z, both Z outcomes seen)`);
});

// -- 2. EQUAL over a crafted grid on real captured states ---------------------

test("EQUAL (crafted grid): idiomatic == oracle in memory + Z across phases/tiles/wraps", () => {
  const base = captureState(300);
  // Phases across the byte-wrap seams of both row selectors; tiles chosen to hit
  // and miss the ROM rows (equality is structural either way — this is coverage).
  const phases = [0, 1, 2, 15, 31, 32, 33, 64, 0x80, 0xdf, 0xe0, 0xff];
  const tiles = [0x00, 0x01, 0x3e, 0x55, 0x80, 0xab, 0xff];
  let n = 0;
  for (const phase of phases) {
    for (const key1 of tiles) {
      for (const key2 of tiles) {
        const r = probeDiff(withProbe(base, { phase, key1, key2 }), idiomatic);
        assert.equal(
          r.ram,
          null,
          r.ram && `phase=${hx(phase)} k1=${hx(key1)} k2=${hx(key2)}: RAM diff at ${hx(r.ram.addr ?? 0)} (oracle=${r.ram.a} idiomatic=${r.ram.b})`,
        );
        assert.equal(r.zEqual, true, `phase=${hx(phase)} k1=${hx(key1)} k2=${hx(key2)}: Z diverged (oracle=${r.oracleZ} idiomatic=${r.fnZ})`);
        assert.equal(r.savedFn, CELL, `phase=${hx(phase)}: advanced pointer must land at ${hx(SAVED)} = ${hx(CELL)}`);
        assert.equal(r.fnRet, r.oracleZ, `phase=${hx(phase)}: idiomatic's boolean return must equal its Z flag`);
        n++;
      }
    }
  }
  console.log(`  EQUAL/crafted: ${n} phase/tile combinations identical to the oracle (memory + Z)`);
});

// -- 3. PATH COVERAGE: the three exits, oracle Z vs hand-derived expectation ---

test("PATH COVERAGE: first-row miss, zero-phase short-circuit, both-rows-scanned", () => {
  const base = captureState(320);

  // Exit A — first-row MISS: a tile guaranteed absent from row1 -> match is false.
  const phaseA = 0x40;
  const row1A = new Set(rowBytes(row1Base(phaseA)));
  let missTile = 0;
  while (row1A.has(missTile)) missTile++;
  assert.ok(missTile < 256, "expected a tile value absent from the first row");
  const rA = probeDiff(withProbe(base, { phase: phaseA, key1: missTile, key2: 0x00 }), idiomatic);
  assert.equal(rA.oracleZ, false, "first-row miss: oracle reports no match");
  assert.equal(rA.zEqual, true, "first-row miss: idiomatic agrees");

  // Exit B — zero phase: first row hits (key1 = row1[0]) and phase 0 short-circuits
  // to that match, skipping the second row -> match true.
  const key1B = rowBytes(row1Base(0))[0];
  const rB = probeDiff(withProbe(base, { phase: 0, key1: key1B, key2: 0x00 }), idiomatic);
  assert.equal(rB.oracleZ, true, "zero-phase: oracle reports the first-row match");
  assert.equal(rB.zEqual, true, "zero-phase: idiomatic agrees");

  // Exit C — both rows scanned: nonzero phase, first row hits, second row also hits.
  const phaseC = 1;
  const key1C = rowBytes(row1Base(phaseC))[0];
  const key2C = rowBytes(row2Base(phaseC))[0];
  const rC = probeDiff(withProbe(base, { phase: phaseC, key1: key1C, key2: key2C }), idiomatic);
  assert.equal(rC.oracleZ, true, "both-rows: oracle reports the second-row match");
  assert.equal(rC.zEqual, true, "both-rows: idiomatic agrees");

  console.log("  PATH COVERAGE: miss / zero-phase / both-rows exits all match the oracle");
});

// -- 4. NON-VACUOUS: the advanced-pointer write actually happens --------------

test("NON-VACUOUS: 0x8134/0x8135 pre-set to a sentinel are overwritten by both arms", () => {
  const base = captureState(340);
  const entry = withProbe(base, { phase: 5, key1: 0x11, key2: 0x22 });
  entry.mem.write8(SAVED, 0x99);
  entry.mem.write8(SAVED + 1, 0x99);

  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  idiomatic(b);

  assert.notEqual(b.mem.read16(SAVED), 0x9999, "idiomatic left the advanced pointer unwritten (still the sentinel)");
  assert.equal(b.mem.read16(SAVED), CELL, `idiomatic must store the advanced pointer ${hx(CELL)}`);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log(`  NON-VACUOUS: both arms overwrote the sentinel with the advanced pointer ${hx(CELL)}`);
});

// -- 5. TEETH A: a wrong pointer write is caught in memory ---------------------

/** Broken twin: stores the pointer WITHOUT the one-row advance. */
function brokenPointer(m) {
  idiomatic(m);
  m.mem.write16(SAVED, m.mem.read16(PTR)); // BUG: should be pointer + 32
}

test("TEETH A: a pointer stored without the one-row advance is CAUGHT at 0x8134", () => {
  const base = captureState(360);
  const entry = withProbe(base, { phase: 3, key1: 0x10, key2: 0x20 });
  const r = probeDiff(entry, brokenPointer);
  assert.notEqual(r.ram, null, "the gate FAILED to catch a wrong pointer store — it proves nothing");
  assert.equal(r.ram.addr, SAVED, `teeth caught the wrong address ${hx(r.ram.addr ?? 0)} (expected ${hx(SAVED)})`);
  // and the real routine is still EQUAL on the very same entry
  assert.equal(probeDiff(entry, idiomatic).ram, null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH A: wrong pointer caught at ${hx(r.ram.addr)} (oracle=${r.ram.a} broken=${r.ram.b})`);
});

// -- 6. TEETH B: the second-row phase-shift bug is caught by the Z flag --------

/** Broken twin: the canonical logic bug — the second row is selected by shifting the
 *  phase the WRONG way (add instead of subtract), so a nonzero-phase probe scans the
 *  wrong second row and its match result flips. */
function brokenSecondRow(m) {
  const { mem, regs } = m;
  const phase = mem.read8(PHASE);
  const cell = (mem.read16(PTR) + ROW_LEN) & 0xffff;
  mem.write16(SAVED, cell);
  let matched = false;
  for (let i = 0; i < ROW_LEN; i++) if (mem.read8((row1Base(phase) + i) & 0xffff) === mem.read8(cell)) { matched = true; break; }
  if (matched && phase !== 0) {
    matched = false;
    const bad = wrongRow2Base(phase); // BUG: (phase + 32) instead of (phase - 32)
    const k2 = mem.read8((cell + 1) & 0xffff);
    for (let i = 0; i < ROW_LEN; i++) if (mem.read8((bad + i) & 0xffff) === k2) { matched = true; break; }
  }
  regs.f = matched ? regs.f | 0x40 : regs.f & ~0x40;
  return matched;
}

/** Find a nonzero phase + key2 where the correct second row contains key2 but the
 *  bug's (wrong) second row does not — so the bug flips the match. Derived from ROM. */
function findPath3Discriminator() {
  for (let phase = 1; phase < 256; phase++) {
    const correct = rowBytes(row2Base(phase));
    const wrong = new Set(rowBytes(wrongRow2Base(phase)));
    for (const key2 of correct) {
      if (!wrong.has(key2)) return { phase, key1: rowBytes(row1Base(phase))[0], key2 };
    }
  }
  return null;
}

test("TEETH B: the second-row phase-shift bug is CAUGHT by the match flag", () => {
  const disc = findPath3Discriminator();
  assert.ok(disc, "expected a ROM-derived path-3 discriminator for the second-row bug");
  const base = captureState(380);
  const entry = withProbe(base, disc);

  const rBug = probeDiff(entry, brokenSecondRow);
  assert.equal(rBug.oracleZ, true, "on the discriminator the correct second row matches (oracle Z set)");
  assert.equal(rBug.fnZ, false, "the bug scans the wrong second row and misses (twin Z clear)");
  assert.equal(rBug.zEqual, false, "the gate FAILED to catch the second-row phase-shift bug — it proves nothing");

  // and the real routine is still EQUAL (memory + Z) on that same entry
  const rGood = probeDiff(entry, idiomatic);
  assert.equal(rGood.ram, null, "idiomatic memory must match the oracle on the discriminator");
  assert.equal(rGood.zEqual, true, "idiomatic Z must match the oracle on the discriminator");
  console.log(
    `  TEETH B: second-row bug caught via Z on phase=${hx(disc.phase)} ` +
      `key2=${hx(disc.key2)} (oracle Z=${rBug.oracleZ}, bug Z=${rBug.fnZ})`,
  );
});
