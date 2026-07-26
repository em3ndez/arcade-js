// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for fillColourColumn (ROM 0x3e01) — paint a vertical run of
 * colour-RAM cells: from the staged cursor (0x805e) it writes the staged colour byte
 * (0x8057) into `count` (0x8055) cells stepping 32 (one screen row) each time.
 *
 * The routine reads three scratch bytes and writes a variable-length run into colour
 * RAM, so it is gated on MEMORY-equivalence, not on a returned register. Its declared
 * live-out is memory-only: the painters that reach it tail-jump in, so its return lands
 * in their own caller, which re-stages its scratch and reads painted memory back, never
 * a leftover register — so the value registers the oracle leaves behind are dead and not
 * reproduced.
 *
 * Four checks:
 *
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the
 *      harness wiring (construct-with-override -> host run -> capture -> clone -> diff)
 *      works on The Pit and that 0x3e01 is reached (it is tail-jumped into, so this also
 *      proves the override resolves through m.call, not just a dispatch table).
 *   1. EQUAL (real dispatches, full contract) — hook 0x3e01 in a real attract run (the
 *      colour painters feed it different cursor/count/colour) and, for each capture, run
 *      the oracle on one clone and fillColourColumn on another and confirm identical
 *      RAM + pc + SP. This proves the memory-only signature is honest on real state.
 *   2. EQUAL (row-count sweep) — on a real captured entry, poke every row count 1..64 and
 *      confirm the whole colour-RAM paint matches the oracle for every loop length.
 *   3. EQUAL (zero-count wrap) — a row count of 0 means a full 256-cell run. Placed at a
 *      low cursor so all 256 stride-32 writes stay inside mapped RAM (0x8000..0x9fff is
 *      one contiguous mapped span), confirm the wrapped run matches the oracle.
 *   4. TEETH — a deliberately-broken twin (row stride 16 instead of 32) MUST be caught,
 *      both by the row-count sweep and on a crafted entry.
 *
 * The idiomatic routine models the return as a plain JS return (no stack modelling), so
 * the full-contract check performs one m.ret() on the candidate clone AFTER the call to
 * line pc + SP up with the oracle (which rets internally).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-3e01.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3e01 as oracle } from "../../translated/loc_3e01.js";
import { fillColourColumn } from "../fillColourColumn.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x3e01;
const CURSOR = 0x805e; // 16-bit colour-RAM write cursor (column top cell)
const COUNT = 0x8055; // rows to paint
const FILL = 0x8057; // the colour byte stamped into each cell
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x3e01 in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed. Attract's colour draws reach it from several painters with varied
 * cursor/count/colour.
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

/** First differing RAM byte between two machines (or null). */
function firstRamDiff(a, b) {
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * Compare a candidate against the oracle over the memory-equivalence contract for one
 * entry: RAM + pc + SP (value registers are the declared-dead live-out and excluded).
 * The oracle rets internally; the candidate's return is modelled with one m.ret().
 */
function contractDiffs(entry, fn) {
  const o = entry.clone();
  oracle(o);
  const c = entry.clone();
  fn(c);
  c.ret();

  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@0x${(ram.addr ?? ram.offset).toString(16)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  return diffs;
}

/**
 * Row-count sweep: for each count in [lo, hi], poke it onto fresh clones of a real
 * captured entry, run oracle vs candidate, and diff the WHOLE colour-RAM paint. Returns
 * the first count whose paint differs (with the differing address) or null. Fresh clones
 * per count so an earlier, longer run's painted cells never leak into a later compare.
 */
function countSweep(candidate, seed, lo, hi) {
  let count = 0;
  for (let n = lo; n <= hi; n++) {
    const o = seed.clone();
    o.mem.write8(COUNT, n);
    oracle(o);

    const c = seed.clone();
    c.mem.write8(COUNT, n);
    candidate(c);

    count++;
    const d = firstRamDiff(o, c);
    if (d) return { mismatch: { n, addr: d.addr, want: d.a, got: d.b }, count };
  }
  return { mismatch: null, count };
}

/** Broken twin: step one row = 16 cells instead of 32 — paints the wrong cells. */
function brokenFillColourColumn(m) {
  const { mem } = m;
  const cursor = mem.read16(CURSOR);
  const count = mem.read8(COUNT);
  const colour = mem.read8(FILL);
  const rows = count === 0 ? 256 : count;
  let cell = cursor;
  for (let i = 0; i < rows; i++) {
    mem.write8(cell, colour);
    cell += 16; // BUG: a row is 32 cells apart, not 16
  }
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x3e01 (reached by tail-jump / m.call), cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatches, full contract) --------------------------------

test("EQUAL (real dispatches): fillColourColumn == oracle on every captured 0x3e01 entry", () => {
  const caps = captureDispatches(64, 1200);
  assert.ok(caps.length >= 1, "expected at least one real 0x3e01 dispatch during attract");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, fillColourColumn); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  const s = caps[0];
  console.log(
    `  EQUAL/real: ${caps.length} captured dispatches identical over RAM+pc+SP ` +
      `(sample cursor=${hx(s.mem.read16(CURSOR))} count=${s.mem.read8(COUNT)} colour=${hx(s.mem.read8(FILL))})`,
  );
});

// -- 2. EQUAL (row-count sweep) -----------------------------------------------

test("EQUAL (row-count sweep): fillColourColumn == oracle for every row count 1..64", () => {
  const seed = captureDispatches(1, 400)[0];
  assert.ok(seed, "expected at least one real 0x3e01 dispatch during attract");

  const { mismatch, count } = countSweep(fillColourColumn, seed, 1, 64);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `paint differs at count=${mismatch.n}: 0x${(mismatch.addr ?? 0).toString(16)} oracle=${mismatch.want} cand=${mismatch.got}`,
  );
  assert.equal(count, 64, "must have compared all 64 row counts");
  console.log(`  EQUAL/sweep: ${count} row counts paint an identical colour column to the oracle`);
});

// -- 3. EQUAL (zero-count wrap) -----------------------------------------------

test("EQUAL (zero-count wrap): row count 0 paints a full 256-cell run identical to the oracle", () => {
  const seed = captureDispatches(1, 400)[0];
  assert.ok(seed, "expected at least one real 0x3e01 dispatch during attract");

  // 256 cells * 32 stride spans 0x1FE0 bytes; a cursor of 0x8000 keeps every write
  // inside the contiguous mapped span 0x8000..0x9fe0, so both sides paint without
  // touching unmapped memory.
  const o = seed.clone();
  o.mem.write16(CURSOR, 0x8000);
  o.mem.write8(COUNT, 0);
  oracle(o);

  const c = seed.clone();
  c.mem.write16(CURSOR, 0x8000);
  c.mem.write8(COUNT, 0);
  fillColourColumn(c);

  const d = firstRamDiff(o, c);
  assert.equal(
    d,
    null,
    d && `256-cell wrap differs at 0x${(d.addr ?? d.offset).toString(16)} oracle=${d.a} cand=${d.b}`,
  );
  console.log("  EQUAL/wrap: count 0 -> 256 stride-32 cells match the oracle byte-for-byte");
});

// -- 4. TEETH -----------------------------------------------------------------

test("TEETH: the wrong-row-stride twin is CAUGHT", () => {
  const seed = captureDispatches(1, 400)[0];
  assert.ok(seed, "need a real capture to seed the teeth check");

  // The row-count sweep must catch the twin (any count >= 2 paints a diverging cell).
  const { mismatch, count } = countSweep(brokenFillColourColumn, seed, 1, 64);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong row stride — it is worthless");

  // And on a crafted count>=2 entry, the full contract must fail too.
  const crafted = seed.clone();
  crafted.mem.write8(COUNT, 6);
  const craftedDiffs = contractDiffs(crafted, brokenFillColourColumn);
  assert.ok(craftedDiffs.length > 0, "the twin escaped the full-contract check on a crafted count=6 entry");

  console.log(
    `  TEETH: wrong-stride twin caught at count=${mismatch.n} ` +
      `(0x${(mismatch.addr ?? 0).toString(16)} oracle=${mismatch.want} broken=${mismatch.got}) after ${count} sweep counts ` +
      `and on the crafted entry (${craftedDiffs[0]})`,
  );
});
