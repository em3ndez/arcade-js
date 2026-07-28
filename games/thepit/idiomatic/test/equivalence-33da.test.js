// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for probeRowBackTilePair (ROM 0x33da) — the two-stage 0x34fe/0x35fe ROM-table
 * probe of the tilemap cell one row back from the write cursor (0x8089), keyed on the
 * row index at 0x808d, stashing the one-row-back cursor at 0x8134 and reporting a match
 * through the zero flag.
 *
 * The routine WRITES one 16-bit RAM word (0x8134) and its consumed result is the ZERO
 * FLAG (the tile-probe dispatcher stepEnemyMover branches `if (regs.fZ)` immediately after every
 * one of its six calls, and reads no other register), so the contract is
 * RAM + pc + SP + the zero flag. The idiomatic routine models the return as a plain JS
 * return, so each contract check does one m.ret() on the candidate clone AFTER the call to
 * line pc + SP up with the oracle (which rets internally).
 *
 * Attract reaches it from the gameplay demo (first dispatch ~frame 1600), and there the row
 * index is always a multiple of 32 and only the first-table-miss and second-table-search
 * paths occur; the index-0 short-circuit is CRAFTED, and the table-membership decision is a
 * pure function of the two tile keys, so it is swept EXHAUSTIVELY.
 *
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the harness
 *      wiring (construct-with-override -> host run -> capture -> clone -> diff) reaches 0x33da.
 *   1. EQUAL (real dispatches) — for every captured attract dispatch, run oracle vs probeRowBackTilePair
 *      on fresh clones and confirm identical RAM + pc + SP + zero flag. Proves nothing outside
 *      0x8134 is touched and the flag matches on the real input distribution.
 *   2. EQUAL (crafted + exhaustive) — a crafted index-0 hit (the short-circuit path), plus
 *      exhaustive sweeps of the first key (all 256), the second key on a path that reaches the
 *      second table (all 256), and the row index (all 256) — every case identical to the oracle.
 *   3. TEETH — a twin that skips the second table (reports the first match unconditionally) is
 *      CAUGHT on a crafted second-table-miss entry and across the key2 sweep; a twin that stashes
 *      the wrong cursor is CAUGHT on RAM.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-33da.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_33da as oracle } from "../../translated/loc_33da.js";
import { probeRowBackTilePair } from "../probeRowBackTilePair.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";
import { F_Z } from "../../../../core/cpu/z80.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x33da;
const SUBTILE_PHASE = 0x808d; // the object sub-tile phase (also the table row selector)
const PROBE_CELL = 0x8089; // the probe-cell tilemap pointer
const SAVED_CELL = 0x8134; // where the one-row-back cell is stashed
const TABLE_A = 0x34fe;
const TABLE_B = 0x35fe;
const MAXF = 2200; // the tile probe first dispatches around frame 1600 in attract
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/** First differing RAM byte between two machines (or null). */
function firstRamDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * Compare a candidate against the oracle over the full contract for one entry:
 * RAM + pc + SP + the zero flag (the declared live-out). The oracle rets internally;
 * the candidate's return is modelled with one m.ret() so pc + SP line up.
 */
function contractDiffs(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);
  c.ret();

  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? ram.offset)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  if ((o.regs.f & F_Z) !== (c.regs.f & F_Z))
    diffs.push(`zero-flag oracle=${(o.regs.f & F_Z) !== 0} cand=${(c.regs.f & F_Z) !== 0}`);
  return diffs;
}

/**
 * Hook 0x33da in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return caps;
}

/** Which ROM-table search path a captured/crafted entry takes (for reporting). */
function classify(m) {
  const index = m.mem.read8(SUBTILE_PHASE);
  const rowBack = (m.mem.read16(PROBE_CELL) - 32) & 0xffff;
  const key1 = m.mem.read8(rowBack);
  const base = TABLE_A + ((index + 32) & 0xff);
  let hit = false;
  for (let i = 0; i < 32; i++) if (m.mem.read8(base + i) === key1) { hit = true; break; }
  if (!hit) return "A-miss";
  return index === 0 ? "B-index0-hit" : "C-second-search";
}

/** Build a crafted entry from a real seed: set the row index and the two cell keys. */
function craft(seed, index, key1, key2) {
  const e = seed.clone();
  e.mem.write8(SUBTILE_PHASE, index);
  const rowBack = (e.mem.read16(PROBE_CELL) - 32) & 0xffff;
  e.mem.write8(rowBack, key1);
  e.mem.write8((rowBack + 1) & 0xffff, key2);
  return e;
}

/** A tile value present in table A's row for `index` (or -1), and one absent (or -1). */
function tableAProbe(index) {
  const base = TABLE_A + ((index + 32) & 0xff);
  let present = -1, absent = -1;
  for (let v = 0; v < 256; v++) {
    let inRow = false;
    for (let i = 0; i < 32; i++) if (ROM[base + i] === v) { inRow = true; break; }
    if (inRow && present < 0) present = v;
    if (!inRow && absent < 0) absent = v;
  }
  return { present, absent };
}

// -- twins for the teeth ------------------------------------------------------

/** Skips the second table: reports the FIRST match unconditionally. Wrong whenever the
 *  second search would have missed on a path that reaches it. */
function twinSkipTableB(m) {
  const { regs, mem } = m;
  const rowBack = (mem.read16(PROBE_CELL) - 32) & 0xffff;
  mem.write16(SAVED_CELL, rowBack);
  const index = mem.read8(SUBTILE_PHASE);
  const base = TABLE_A + ((index + 32) & 0xff);
  let matched = false;
  for (let i = 0; i < 32; i++) if (mem.read8(base + i) === mem.read8(rowBack)) { matched = true; break; }
  regs.f = matched ? regs.f | F_Z : regs.f & ~F_Z; // BUG: never consults table B
  return matched;
}

/** Stashes the wrong cursor (does not step one row back). Correct flag, wrong RAM@0x8134. */
function twinWrongStash(m) {
  probeRowBackTilePair(m); // correct zero flag + correct stash
  m.mem.write16(SAVED_CELL, m.mem.read16(PROBE_CELL)); // BUG: overwrite the stash with the un-stepped cursor
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: MAXF });
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x33da, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatches, full contract) --------------------------------

test("EQUAL (real dispatches): probeRowBackTilePair == oracle on every captured 0x33da entry", () => {
  const caps = captureDispatches(64, MAXF);
  assert.ok(caps.length >= 1, "expected at least one real 0x33da dispatch during attract");

  const paths = {};
  for (const cap of caps) {
    const diffs = contractDiffs(cap, probeRowBackTilePair); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
    const p = classify(cap);
    paths[p] = (paths[p] ?? 0) + 1;
  }
  console.log(
    `  EQUAL/real: ${caps.length} captured dispatches identical over RAM+pc+SP+zero-flag ` +
      `(paths ${JSON.stringify(paths)})`,
  );
});

// -- 2. EQUAL (crafted short-circuit + exhaustive key/index sweeps) ------------

test("EQUAL (crafted + exhaustive): index-0 hit and full key1/key2/index sweeps == oracle", () => {
  const seed = captureDispatches(1, MAXF)[0];
  assert.ok(seed, "need a real capture to seed crafted entries");

  // The index-0 short-circuit: a first-table HIT with index 0 must report a match (zero set)
  // without any second search — a path attract never reaches naturally.
  const p0 = tableAProbe(0);
  assert.ok(p0.present >= 0 && p0.absent >= 0, "table A's index-0 row must have both a present and absent value");
  assert.equal(classify(craft(seed, 0, p0.present, 0)), "B-index0-hit", "crafted index-0 hit must take the short-circuit path");
  assert.equal(contractDiffs(craft(seed, 0, p0.present, 0), probeRowBackTilePair).length, 0, "index-0 hit diverged");
  assert.equal(contractDiffs(craft(seed, 0, p0.absent, 0), probeRowBackTilePair).length, 0, "index-0 miss diverged");

  // Exhaustive first-key sweep at a real index (32): every possible neighbouring tile.
  let bad = 0;
  for (let k1 = 0; k1 < 256; k1++) {
    if (contractDiffs(craft(seed, 32, k1, 0), probeRowBackTilePair).length) bad++;
  }
  assert.equal(bad, 0, `first-key sweep diverged on ${bad}/256 values`);

  // Exhaustive second-key sweep, on a first-key chosen to reach the second table (path C).
  const p32 = tableAProbe(32);
  assert.ok(p32.present >= 0, "need a table-A hit value to force the second search");
  let bad2 = 0;
  for (let k2 = 0; k2 < 256; k2++) {
    if (contractDiffs(craft(seed, 32, p32.present, k2), probeRowBackTilePair).length) bad2++;
  }
  assert.equal(bad2, 0, `second-key sweep diverged on ${bad2}/256 values`);

  // Exhaustive row-index sweep (all 256), fixed arbitrary keys.
  let bad3 = 0;
  for (let idx = 0; idx < 256; idx++) {
    if (contractDiffs(craft(seed, idx, 0x33, 0x77), probeRowBackTilePair).length) bad3++;
  }
  assert.equal(bad3, 0, `index sweep diverged on ${bad3}/256 values`);

  console.log("  EQUAL/crafted: index-0 short-circuit + 3x256 exhaustive sweeps all identical to the oracle");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: a table-B-skipping twin and a wrong-stash twin are CAUGHT", () => {
  const seed = captureDispatches(1, MAXF)[0];
  assert.ok(seed, "need a real capture to seed the teeth check");

  // A crafted path-C entry whose SECOND search misses: oracle reports no-match (zero clear),
  // the skip-table-B twin reports the first match (zero set) -> the flag contract must catch it.
  const p32 = tableAProbe(32);
  const missKey2 = (() => {
    const base = TABLE_B + ((32 - 32) & 0xff);
    for (let v = 0; v < 256; v++) {
      let inRow = false;
      for (let i = 0; i < 32; i++) if (ROM[base + i] === v) { inRow = true; break; }
      if (!inRow) return v;
    }
    return -1;
  })();
  assert.ok(missKey2 >= 0, "table B's row must have an absent value for the second-miss craft");
  const entryC = craft(seed, 32, p32.present, missKey2);
  assert.equal(classify(entryC), "C-second-search", "teeth craft must reach the second search");
  const skipDiffs = contractDiffs(entryC, twinSkipTableB);
  assert.ok(skipDiffs.length > 0, "the skip-table-B twin ESCAPED on a second-miss entry — the flag teeth are worthless");

  // And it must be caught somewhere across the exhaustive key2 sweep too.
  let caughtInSweep = 0;
  for (let k2 = 0; k2 < 256; k2++) {
    if (contractDiffs(craft(seed, 32, p32.present, k2), twinSkipTableB).length) caughtInSweep++;
  }
  assert.ok(caughtInSweep > 0, "the skip-table-B twin escaped the entire key2 sweep");

  // The wrong-stash twin must be caught on RAM@0x8134 (the routine's only memory write).
  const stashDiffs = contractDiffs(seed, twinWrongStash);
  assert.ok(
    stashDiffs.some((d) => d.startsWith("RAM@")),
    `the wrong-stash twin ESCAPED the RAM contract (diffs: ${stashDiffs.join("; ") || "none"})`,
  );

  console.log(
    `  TEETH: skip-table-B twin caught on the second-miss entry (${skipDiffs.join("; ")}) ` +
      `and on ${caughtInSweep}/256 key2 values; wrong-stash twin caught on RAM`,
  );
});
