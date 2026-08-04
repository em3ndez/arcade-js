// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for copyCappedTileColumn (ROM 0x3ddb) — the capped variant of
 * the shared tile-column copy: it forces the column's TOP cell to a fixed cap tile
 * (a ROM constant at 0x4b0f), copies the cells below it from a source table walked
 * backwards through memory, and writes the advanced cursor back to 0x8060.
 *
 * Its declared live-out is MEMORY-ONLY: the painted video-RAM cells plus the advanced
 * video cursor at 0x8060. The source pointer is a genuine register live-in, promoted to
 * an honest JS parameter (`copyCappedTileColumn(m, sourcePtr)`) and passed the captured
 * entry's pointer; the routine leaves it (and every work register/flag) dead — each
 * caller reloads the source pointer before its next call — so the gate compares RAM ONLY,
 * excluding pc, SP and the value registers the oracle leaves behind (the honest-signature
 * contract). The oracle rets internally and the idiomatic routine models its return as a
 * plain JS return; neither writes the stack, and RAM-only comparison sidesteps the pc/SP
 * mismatch.
 *
 * The load-bearing subtlety this routine has and copyTileColumn does not: only the top
 * cell takes the cap, and the source walk starts one byte BELOW the pointer (the
 * pointer's own first byte is never read). The cap-confusion teeth attacks exactly that.
 *
 * Five checks:
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the harness
 *      wiring (construct-with-override -> host run -> capture -> clone -> diff) works.
 *   1. EQUAL (real dispatches) — hook 0x3ddb in a real attract run (the HUD/panel plotters
 *      feed it) and, for each capture, run the oracle on one clone and copyCappedTileColumn
 *      on another and confirm they leave identical RAM. A positive check confirms the top
 *      cell got the CAP (not the source's first byte), the body copied the walked-back
 *      source, and the cursor advanced (no vacuous pass).
 *   2. EQUAL (run-length sweep 1..64) — on a real captured entry, force PLOT_RUN_LENGTH to
 *      each of 1..64 identically on both sides and confirm every loop length paints the
 *      same cells and writes back the same cursor.
 *   3. TEETH (cap confusion) — a twin that paints the source's first byte on the top cell
 *      instead of the cap (what you get if the source walk is not offset past the pointer)
 *      MUST be caught at the top cell. This is the routine's whole distinction.
 *   4. TEETH (structure) — a wrong-row-stride twin (31 instead of 32) and a twin that drops
 *      the cursor write-back (caught at 0x8060) MUST be caught. A gate that cannot fail
 *      proves nothing.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3ddb.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3ddb as oracle } from "../../translated/loc_3ddb.js";
import { copyCappedTileColumn as idiomatic } from "../copyCappedTileColumn.js";
import { PLOT_RUN_LENGTH } from "../names.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3ddb;
const CURSOR = 0x8060; // video-RAM write cursor (top-of-column, then advanced + saved)
const CAP_TILE = 0x4b0f; // ROM address of the fixed cap tile stamped on the top cell
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
 * Hook 0x3ddb in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed. Attract's HUD/panel draws dispatch it with a real source pointer, run
 * length and cursor.
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

/**
 * Cap confusion: paint the SOURCE'S FIRST BYTE on the top cell instead of the cap and
 * start the source walk at the pointer — i.e. the plain copyTileColumn behaviour, which
 * is precisely the bug of getting this routine's cap/offset wrong.
 */
function twinCapConfusion(m, sourcePtr) {
  const { mem8, mem16 } = m;
  const count = mem8[PLOT_RUN_LENGTH];
  const rows = count === 0 ? 256 : count;
  let cell = mem16[CURSOR];
  let src = sourcePtr; // BUG: no cap; the top cell reads the source's first byte
  for (let i = 0; i < rows; i++) {
    mem8[cell] = mem8[src];
    cell += 32;
    src -= 1;
  }
  mem16[CURSOR] = cell;
}

/** Wrong row stride: cells 31 apart instead of 32 — paints the wrong cells / wrong cursor. */
function twinWrongStride(m, sourcePtr) {
  const { mem8, mem16 } = m;
  const count = mem8[PLOT_RUN_LENGTH];
  const rows = count === 0 ? 256 : count;
  let cell = mem16[CURSOR];
  mem8[cell] = mem8[CAP_TILE];
  cell += 31; // BUG: rows are 32 cells apart, not 31
  let src = sourcePtr - 1;
  for (let i = 1; i < rows; i++) {
    mem8[cell] = mem8[src];
    cell += 31; // BUG
    src -= 1;
  }
  mem16[CURSOR] = cell;
}

/** Correct paint, but the advanced cursor is never written back (a follow-up run repaints). */
function twinNoWriteback(m, sourcePtr) {
  const { mem8, mem16 } = m;
  const count = mem8[PLOT_RUN_LENGTH];
  const rows = count === 0 ? 256 : count;
  let cell = mem16[CURSOR];
  mem8[cell] = mem8[CAP_TILE];
  cell += 32;
  let src = sourcePtr - 1;
  for (let i = 1; i < rows; i++) {
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
  console.log("  IDENTITY: captured 0x3ddb, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatches, RAM-only contract) ----------------------------

test("EQUAL (real dispatches): copyCappedTileColumn == oracle on every captured 0x3ddb entry", () => {
  const caps = captureDispatches(64, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x3ddb dispatch during attract");

  for (const cap of caps) {
    const ram = ramDiff(cap, idiomatic); // fresh clones inside — cap untouched
    assert.equal(ram, null, ram && `RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  }

  // Positive, non-vacuous check on the first capture: the top cell got the CAP (not the
  // source's first byte), the cell below got the walked-back source byte, and the cursor
  // advanced by run-length rows of 32 cells.
  const s = caps[0];
  const count = s.mem.read8(PLOT_RUN_LENGTH);
  const rows = count === 0 ? 256 : count;
  const cursor = read16(s, CURSOR);
  const cap = s.mem.read8(CAP_TILE);
  const sourceFirst = s.mem.read8(s.regs.ix & 0xffff);
  const bodyFirst = s.mem.read8((s.regs.ix - 1) & 0xffff);
  assert.notEqual(cap, sourceFirst, "capture too weak: cap tile equals the source's first byte");
  const c = s.clone();
  idiomatic(c, c.regs.ix);
  assert.equal(c.mem.read8(cursor), cap, "top cell not painted with the fixed cap tile");
  assert.equal(c.mem.read8((cursor + 32) & 0xffff), bodyFirst, "second cell not the walked-back source byte");
  assert.equal(read16(c, CURSOR), (cursor + rows * 32) & 0xffff, "cursor did not advance by rows*32");
  console.log(
    `  EQUAL/real: ${caps.length} captured dispatches identical over RAM ` +
      `(sample len=${count} cursor=${hx(cursor)} cap=${hx(cap)} src=${hx(s.regs.ix)})`,
  );
});

// -- 2. EQUAL (run-length sweep 1..64) ----------------------------------------

test("EQUAL (run-length sweep 1..64): every loop length paints + advances identically", () => {
  const seed = captureDispatches(1, 1500)[0];
  assert.ok(seed, "need a captured 0x3ddb entry to craft the sweep from");

  for (let len = 1; len <= 64; len++) {
    const entry = seed.clone();
    entry.mem.write8(PLOT_RUN_LENGTH, len);
    const ram = ramDiff(entry, idiomatic);
    assert.equal(ram, null, ram && `len=${len}: RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  }
  console.log("  EQUAL/sweep: run lengths 1..64 all paint the same cells + write back the same cursor");
});

// -- 3. TEETH (cap confusion — the routine's whole distinction) ---------------

test("TEETH (cap confusion): a twin that paints the source's first byte on top is CAUGHT at the top cell", () => {
  const caps = captureDispatches(1, 1500);
  assert.ok(caps.length >= 1, "need a real capture to seed the teeth check");
  const cursor = read16(caps[0], CURSOR);

  const ram = ramDiff(caps[0], twinCapConfusion);
  assert.notEqual(ram, null, "the gate FAILED to catch the cap-confusion twin — it proves nothing");
  assert.equal(
    ram.addr,
    cursor,
    `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected the top cell ${hx(cursor)})`,
  );
  console.log(`  TEETH/cap: cap-confusion twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 4. TEETH (structure) -----------------------------------------------------

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
  // The write-back is a 16-bit value; dropping it can differ at either byte of the
  // cursor word (this capture advances by exactly 256, so only the high byte changes).
  assert.ok(
    ram.addr === CURSOR || ram.addr === CURSOR + 1,
    `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected the cursor word ${hx(CURSOR)}/${hx(CURSOR + 1)})`,
  );
  console.log(`  TEETH/writeback: dropped cursor save caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});
