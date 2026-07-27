// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for copyTileColumn (ROM 0x3dea) — the video-RAM arm of the
 * shared column plotter: it copies a run of tile/character codes from a source table
 * straight down a video-RAM column and writes the advanced cursor back to 0x8060.
 *
 * Its declared live-out is MEMORY-ONLY: the copied video-RAM cells plus the advanced
 * video cursor at 0x8060. The source pointer is a genuine register live-in, promoted to
 * an honest JS parameter (`copyTileColumn(m, sourcePtr)`) and passed the captured entry's
 * pointer; the routine leaves it (and every work register/flag) dead — each caller reloads
 * the source pointer before its next call — so the gate compares RAM ONLY, excluding pc,
 * SP and the value registers the oracle leaves behind (the honest-signature contract).
 * The oracle rets internally and the idiomatic routine models its return as a plain JS
 * return; neither writes the stack, and RAM-only comparison sidesteps the pc/SP mismatch.
 *
 * Four checks:
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the harness
 *      wiring (construct-with-override -> host run -> capture -> clone -> diff) works.
 *   1. EQUAL (real dispatches) — hook 0x3dea in a real attract run (the title/panel/record
 *      plotters feed it varied source pointers, run lengths and cursors) and, for each
 *      capture, run the oracle on one clone and copyTileColumn on another and confirm they
 *      leave identical RAM. A positive check confirms the column really was painted and the
 *      cursor advanced (no vacuous pass).
 *   2. EQUAL (run-length sweep 1..64) — on a real captured entry, force PLOT_RUN_LENGTH to
 *      each of 1..64 identically on both sides and confirm every loop length copies the same
 *      cells and writes back the same cursor.
 *   3. TEETH — two deliberately-broken twins MUST be caught by the RAM diff: a wrong-row-
 *      stride twin (31 instead of 32) and a twin that drops the cursor write-back (caught at
 *      0x8060). A gate that cannot fail proves nothing.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3dea.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3dea as oracle } from "../../translated/loc_3dea.js";
import { copyTileColumn as idiomatic } from "../copyTileColumn.js";
import { PLOT_RUN_LENGTH } from "../ram.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3dea;
const CURSOR = 0x8060; // video-RAM write cursor (top-of-column, then advanced + saved)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/** Little-endian 16-bit read composed from bytes (matches the house style). */
function read16(m, a) {
  return m.mem.read8(a) | (m.mem.read8((a + 1) & 0xffff) << 8);
}

/**
 * Hook 0x3dea in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed. Attract's title/panel/record draws dispatch it from several plotters
 * (showSetupScreen, drawMenLeftPanel, drawSharedPanel, loc_3bec, loc_3d49, drawGameOverText, loc_4df8, ...) with a
 * varied source pointer, run length and cursor.
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

/** First differing RAM byte between two machines (or null) — the RAM-only contract. */
function firstRamDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * Run the oracle on one clone and a candidate on another, from the same entry, and
 * return the first RAM difference (or null == EQUAL). The candidate is the idiomatic
 * signature `fn(m, sourcePtr)` fed the entry's captured source pointer. RAM-only: pc,
 * SP and value registers are the declared-dead live-out and excluded.
 */
function ramDiff(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c, c.regs.ix);
  return firstRamDiff(o, c);
}

// -- teeth twins (correct signature, one deliberate defect each) --------------

/** Wrong row stride: cells 31 apart instead of 32 — paints the wrong cells / wrong cursor. */
function twinWrongStride(m, sourcePtr) {
  const { mem8, mem16 } = m;
  const count = mem8[PLOT_RUN_LENGTH];
  const rows = count === 0 ? 256 : count;
  let cell = mem16[CURSOR];
  let src = sourcePtr;
  for (let i = 0; i < rows; i++) {
    mem8[cell] = mem8[src];
    cell += 31; // BUG: rows are 32 cells apart, not 31
    src -= 1;
  }
  mem16[CURSOR] = cell;
}

/** Correct copy, but the advanced cursor is never written back (a follow-up run repaints). */
function twinNoWriteback(m, sourcePtr) {
  const { mem8, mem16 } = m;
  const count = mem8[PLOT_RUN_LENGTH];
  const rows = count === 0 ? 256 : count;
  let cell = mem16[CURSOR];
  let src = sourcePtr;
  for (let i = 0; i < rows; i++) {
    mem8[cell] = mem8[src];
    cell += 32;
    src -= 1;
  }
  // BUG: the advanced cursor is dropped, so 0x8060 keeps its stale top-of-column value.
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x3dea, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatches, RAM-only contract) ----------------------------

test("EQUAL (real dispatches): copyTileColumn == oracle on every captured 0x3dea entry", () => {
  const caps = captureDispatches(64, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x3dea dispatch during attract");

  for (const cap of caps) {
    const ram = ramDiff(cap, idiomatic); // fresh clones inside — cap untouched
    assert.equal(ram, null, ram && `RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  }

  // Positive, non-vacuous check on the first capture: the column really was painted and
  // the cursor advanced by run-length rows of 32 cells.
  const s = caps[0];
  const count = s.mem.read8(PLOT_RUN_LENGTH);
  const rows = count === 0 ? 256 : count;
  const cursor = read16(s, CURSOR);
  const sourceTop = s.mem.read8(s.regs.ix & 0xffff);
  const c = s.clone();
  idiomatic(c, c.regs.ix);
  assert.equal(c.mem.read8(cursor), sourceTop, "top cell not painted with the source's first byte");
  assert.equal(read16(c, CURSOR), (cursor + rows * 32) & 0xffff, "cursor did not advance by rows*32");
  console.log(
    `  EQUAL/real: ${caps.length} captured dispatches identical over RAM ` +
      `(sample len=${count} cursor=${hx(cursor)} src=${hx(s.regs.ix)})`,
  );
});

// -- 2. EQUAL (run-length sweep 1..64) ----------------------------------------

test("EQUAL (run-length sweep 1..64): every loop length copies + advances identically", () => {
  const seed = captureDispatches(1, 1500)[0];
  assert.ok(seed, "need a captured 0x3dea entry to craft the sweep from");

  for (let len = 1; len <= 64; len++) {
    const entry = seed.clone();
    entry.mem.write8(PLOT_RUN_LENGTH, len);
    const ram = ramDiff(entry, idiomatic);
    assert.equal(ram, null, ram && `len=${len}: RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  }
  console.log("  EQUAL/sweep: run lengths 1..64 all copy the same cells + write back the same cursor");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH (wrong stride): a 31-cell-stride twin is CAUGHT by the RAM diff", () => {
  const caps = captureDispatches(1, 1500);
  assert.ok(caps.length >= 1, "need a real capture to seed the teeth check");

  const ram = ramDiff(caps[0], twinWrongStride);
  assert.notEqual(ram, null, "the gate FAILED to catch the wrong-stride twin — it proves nothing");
  console.log(`  TEETH/stride: wrong-stride twin caught at ${hx(ram.addr ?? 0)} (oracle=${ram.a} broken=${ram.b})`);
});

test("TEETH (no write-back): a twin that drops the cursor save is CAUGHT at 0x8060", () => {
  const caps = captureDispatches(1, 1500);
  assert.ok(caps.length >= 1, "need a real capture to seed the teeth check");

  const ram = ramDiff(caps[0], twinNoWriteback);
  assert.notEqual(ram, null, "the gate FAILED to catch the missing-write-back twin — it proves nothing");
  assert.equal(
    ram.addr,
    CURSOR,
    `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(CURSOR)})`,
  );
  console.log(`  TEETH/writeback: dropped cursor save caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
