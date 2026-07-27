// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for fillVideoRam (ROM 0x4c27) — paint the whole tilemap: read a
 * fixed fill code from ROM (0x4b0f) and write it into every cell of video RAM
 * (0x9000..0x93FF, 1024 cells).
 *
 * The routine reads one ROM constant and writes a fixed 1024-cell run into video RAM,
 * so it is gated on MEMORY-equivalence, not on a returned register. Its declared
 * live-out is memory-only: the return lands back inside blankScreen, whose very next call
 * (loc_4c37) reloads every value register (count, fill byte, cursor) before reading it,
 * so the registers the oracle leaves behind are dead and not reproduced.
 *
 * Four checks:
 *
 *   0. IDENTITY — run the unit gate with both arms = the oracle; EQUAL proves the
 *      harness wiring (construct-with-override -> host run -> capture -> clone -> diff)
 *      works on The Pit and that 0x4c27 is actually reached during attract (it is
 *      dispatched at display setup, cold boot -> blankScreen -> here).
 *   1. EQUAL (real dispatches, full contract) — hook 0x4c27 in a real attract run and,
 *      for each capture, run the oracle on one clone and fillVideoRam on another and
 *      confirm identical RAM + pc + SP. Because the whole state dump is compared, this
 *      also proves the fill touches nothing outside the tilemap span.
 *   2. EQUAL (full-region coverage) — pre-seed the whole tilemap with a sentinel byte
 *      distinct from the fill code, then confirm oracle and fillVideoRam both overwrite
 *      every cell to the fill code and agree byte-for-byte (no missed or stale cell).
 *   3. TEETH — a deliberately-broken twin that stops one page early (skips 0x9300..
 *      0x93FF) MUST be caught, both on the real entry and on a sentinel-seeded entry.
 *
 * The idiomatic routine models the return as a plain JS return (no stack modelling), so
 * the full-contract check performs one m.ret() on the candidate clone AFTER the call to
 * line pc + SP up with the oracle (which rets internally).
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4c27.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4c27 as oracle } from "../../translated/loc_4c27.js";
import { fillVideoRam } from "../fillVideoRam.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4c27;
const VRAM_LO = 0x9000; // tilemap base
const VRAM_HI = 0x93ff; // last tilemap cell
const FILL_ROM = 0x4b0f; // ROM constant holding the fill code
const SENTINEL = 0xab; // a byte distinct from the fill code, for coverage/teeth seeding
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/**
 * Hook 0x4c27 in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper snapshots the entry state, then runs the oracle so the host game proceeds
 * undisturbed. Attract reaches it at display setup and at each round setup.
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

/** Pre-seed the whole tilemap span with one byte (both arms start identical). */
function seedTilemap(m, value) {
  for (let cell = VRAM_LO; cell <= VRAM_HI; cell++) m.mem.write8(cell, value);
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

/** Broken twin: fills only the first three pages, skipping the last (0x9300..0x93FF). */
function brokenFillVideoRam(m) {
  const { mem } = m;
  const fill = mem.read8(FILL_ROM);
  for (let cell = VRAM_LO; cell <= 0x92ff; cell++) mem.write8(cell, fill); // BUG: stops one page early
}

// -- 0. IDENTITY --------------------------------------------------------------

test("IDENTITY: the unit gate runs on The Pit and reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle);
  assert.equal(
    res.equal,
    true,
    `gate reported a diff for identical arms: ram=${JSON.stringify(res.ram)} regs=${JSON.stringify(res.regs)}`,
  );
  console.log("  IDENTITY: captured 0x4c27 (display setup), cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL (real dispatches, full contract) --------------------------------

test("EQUAL (real dispatches): fillVideoRam == oracle on every captured 0x4c27 entry", () => {
  const caps = captureDispatches(64, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x4c27 dispatch during attract");
  for (const cap of caps) {
    const diffs = contractDiffs(cap, fillVideoRam); // fresh clones inside — cap untouched
    assert.equal(diffs.length, 0, diffs.join("; "));
  }
  const s = caps[0];
  console.log(
    `  EQUAL/real: ${caps.length} captured dispatches identical over RAM+pc+SP ` +
      `(fill code=${hx(s.mem.read8(FILL_ROM))})`,
  );
});

// -- 2. EQUAL (full-region coverage) ------------------------------------------

test("EQUAL (full-region coverage): every tilemap cell is overwritten, identical to the oracle", () => {
  const seed = captureDispatches(1, 400)[0];
  assert.ok(seed, "expected at least one real 0x4c27 dispatch during attract");

  const fill = seed.mem.read8(FILL_ROM);
  assert.notEqual(fill, SENTINEL, "sentinel must differ from the fill code for this check to bite");

  const o = seed.clone();
  seedTilemap(o, SENTINEL);
  oracle(o);

  const c = seed.clone();
  seedTilemap(c, SENTINEL);
  fillVideoRam(c);

  const d = firstRamDiff(o, c);
  assert.equal(
    d,
    null,
    d && `coverage differs at 0x${(d.addr ?? d.offset).toString(16)} oracle=${d.a} cand=${d.b}`,
  );
  // And prove no sentinel survived on the candidate — every cell really was painted.
  let stale = -1;
  for (let cell = VRAM_LO; cell <= VRAM_HI && stale < 0; cell++) {
    if (c.mem.read8(cell) !== fill) stale = cell;
  }
  assert.equal(stale, -1, stale >= 0 && `cell ${hx(stale)} left un-painted (still ${hx(c.mem.read8(stale))})`);
  console.log(`  EQUAL/coverage: all 1024 cells painted to ${hx(fill)}, byte-for-byte with the oracle`);
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: the short-fill twin (skips the last page) is CAUGHT", () => {
  const seed = captureDispatches(1, 400)[0];
  assert.ok(seed, "need a real capture to seed the teeth check");

  // On the real entry the skipped page differs from the fill code, so the contract fails.
  const realDiffs = contractDiffs(seed, brokenFillVideoRam);
  assert.ok(realDiffs.length > 0, "the twin escaped the full-contract check on the real entry");

  // And on a sentinel-seeded entry the miss is caught independent of the entry's content.
  const o = seed.clone();
  seedTilemap(o, SENTINEL);
  oracle(o);
  const c = seed.clone();
  seedTilemap(c, SENTINEL);
  brokenFillVideoRam(c);
  const d = firstRamDiff(o, c);
  assert.notEqual(d, null, "the sentinel-seeded diff FAILED to catch the skipped last page — it is worthless");
  assert.ok(d.addr >= 0x9300, `expected the miss in the last page, got 0x${(d.addr ?? 0).toString(16)}`);

  console.log(
    `  TEETH: short-fill twin caught on the real entry (${realDiffs[0]}) ` +
      `and on the sentinel entry at 0x${d.addr.toString(16)} (oracle=${d.a} broken=${d.b})`,
  );
});
