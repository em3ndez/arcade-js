// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_4816 (ROM 0x4816) — the round-setup strip painter:
 * it places a tile-cell cursor at column 1 / row 11, resolves the cell's addresses,
 * fills a 10-cell vertical tilemap strip from the ROM table at 0x494f (top cell a fixed
 * cap, the nine below walked back through the table), then tail-calls the colour-column
 * fill that paints the same 10 cells with colour 0.
 *
 * CRAFTED-ENTRY, because attract never dispatches loc_4816 (it is round setup — the
 * caller loc_02e1/loc_02ca only runs once a game starts). So instead of hooking the
 * target itself, we capture REAL machine states at a routine loc_4816 shares and that
 * attract DOES dispatch — loc_3dae, the shared row/col -> offset calc (first entered
 * ~frame 81) — clone at its entry, and run oracle-vs-idiomatic loc_4816 on those real,
 * in-distribution states. loc_4816 supplies all of its own inputs (it overwrites the
 * cursor/count/fill scratch it reads and sets its own source pointer), so any real
 * captured state is a valid entry; the capture just provides a realistic RAM image and
 * a valid stack for the tail return to pop.
 *
 * The Pit's stack is diffed work RAM and SP is a compared register, so this routine
 * reproduces the oracle's exact push/call/return-pop discipline; the gate therefore
 * compares the FULL state — whole RAM dump + the whole register file + pc — which all
 * match because the idiomatic routine makes the identical calls. (Its declared live-out
 * is memory-only; comparing registers too only adds teeth.)
 *
 * Jobs:
 *   1. EQUAL   — on each captured real entry, oracle and idiomatic leave identical
 *                RAM + registers + pc.
 *   2. PAINTED — pre-dirty the 20 target cells, run the oracle, and confirm exactly the
 *                10 tilemap cells and 10 colour cells (plus the scratch) were written —
 *                proof the entries actually exercise the paint, and the footprint.
 *   3. TEETH   — a twin that fills 9 cells instead of 10 MUST be caught, both on the
 *                whole-state contract and specifically at the 10th (unpainted) cell.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4816.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4816 as oracle } from "../../translated/loc_4816.js";
import { loc_4816 as idiomatic } from "../loc_4816.js";
import { loc_3dae as proxyOracle } from "../../translated/loc_3dae.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const PROXY = 0x3dae; // a shared callee attract dispatches; its entry states are real
const STRIP_HEIGHT = 0x8055; // strip cell count (scratch)

// The routine paints column 1 / row 11: offset = 32*11 + 1 = 0x161; colour base
// 0x161 + 0x8800 = 0x8961, tilemap base + 0x9000 = 0x9161. Both runs are 10 cells,
// stride 0x20 (one row down).
const TILE_CELLS = Array.from({ length: 10 }, (_, k) => 0x9161 + k * 0x20);
const COLOUR_CELLS = Array.from({ length: 10 }, (_, k) => 0x8961 + k * 0x20);
const DIRTY = 0x99; // sentinel for the pre-dirty proof

const hx = (v) => "0x" + (v & 0xffff).toString(16);

const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Capture up to K real machine states at PROXY's dispatch during a boot/attract run.
 * The wrapper clones on entry, then delegates to the oracle so the host proceeds
 * undisturbed — the capture/clone/replay pattern, off to the side of the live run.
 */
function captureEntries(K, maxFrames) {
  const caps = [];
  const snap = new Map([[PROXY, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return proxyOracle(mm);
  }]]);
  makeMachine(snap).runFrames(maxFrames);
  return caps;
}

const ENTRIES = ROM_PRESENT ? captureEntries(6, 240) : [];

/** Full contract diff: whole RAM dump, then the register file, then pc. null if equal. */
function contractDiff(o, c) {
  const ram = firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
  if (ram) return `RAM at ${hx(ram.addr ?? ram.offset)}: oracle=${ram.a} cand=${ram.b}`;
  const reg = firstRegDiff(o.regs, c.regs);
  if (reg) return `REG ${reg.reg}: oracle=${hx(reg.a)} cand=${hx(reg.b)}`;
  if (o.pc !== c.pc) return `pc: oracle=${hx(o.pc)} cand=${hx(c.pc)}`;
  return null;
}

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: real captured entries — idiomatic loc_4816 == oracle in full RAM + registers + pc", () => {
  assert.ok(ENTRIES.length >= 1, "expected at least one real proxy dispatch in the run window");
  for (const entry of ENTRIES) {
    const o = entry.clone();
    const c = entry.clone();
    oracle(o);
    idiomatic(c);
    const diff = contractDiff(o, c);
    assert.equal(diff, null, diff);
  }
  console.log(`  EQUAL: ${ENTRIES.length} real entries identical (full RAM + registers + pc)`);
});

// -- 2. PAINTED (write-set) ---------------------------------------------------

test("PAINTED: the oracle writes exactly the 10 tilemap + 10 colour cells (and the scratch)", () => {
  const entry = ENTRIES[0];
  const before = entry.clone();
  const after = entry.clone();
  // Pre-dirty the target cells so a landed paint is unmistakable (not a leftover).
  for (const a of [...TILE_CELLS, ...COLOUR_CELLS]) {
    before.mem.write8(a, DIRTY);
    after.mem.write8(a, DIRTY);
  }
  const b0 = before.dumpState();
  oracle(after);
  const a1 = after.dumpState();

  // Every target cell must have been overwritten (no DIRTY sentinel survives).
  for (const a of TILE_CELLS) {
    assert.notEqual(after.mem.read8(a), DIRTY, `tilemap cell ${hx(a)} was not painted`);
  }
  for (const a of COLOUR_CELLS) {
    assert.equal(after.mem.read8(a), 0x00, `colour cell ${hx(a)} must be colour 0`);
  }

  // The full write-set stays inside {paint scratch 0x8055-0x8061} + the 20 target
  // cells + the stack window (the pushed/popped return-address word — the routine's
  // real stack traffic, which is exactly why the gate compares the whole diffed stack).
  const targets = new Set([...TILE_CELLS, ...COLOUR_CELLS]);
  const stackTop = entry.regs.sp;
  for (let off = 0; off < b0.length; off++) {
    if (b0[off] === a1[off]) continue;
    const addr = after.stateOffsetToAddr(off);
    const isScratch = addr >= 0x8055 && addr <= 0x8061;
    const isStack = addr >= stackTop - 8 && addr < 0x8400;
    assert.ok(
      isScratch || isStack || targets.has(addr),
      `oracle wrote outside the paint footprint at ${hx(addr)} (${b0[off]}->${a1[off]})`,
    );
  }
  console.log("  PAINTED: 10 tilemap + 10 colour cells written; footprint = paint scratch + those cells + the return-address stack word");
});

// -- 3. TEETH -----------------------------------------------------------------

/** Broken twin: a faithful copy of the idiomatic body with the strip height wrong
 *  (9 instead of 10) — a plausible off-by-one that fills one cell too few. */
function brokenLoc4816(m) {
  const { regs, mem } = m;
  mem.write8(0x8058, 1);
  mem.write8(0x8059, 11);
  m.push16(0x4823);
  m.call(0x3dae);
  m.push16(0x4826);
  m.call(0x3dc9);
  mem.write8(0x8057, 0);
  mem.write8(STRIP_HEIGHT, 9); // BUG: the strip is 10 cells tall
  regs.ix = 0x494f;
  m.push16(0x4837);
  m.call(0x3ddb);
  return m.call(0x3e01);
}

test("TEETH: a twin that fills 9 cells instead of 10 is CAUGHT (the gate can fail)", () => {
  const entry = ENTRIES[0];

  // Whole-state contract catches it on a plain entry.
  const o = entry.clone();
  const c = entry.clone();
  oracle(o);
  brokenLoc4816(c);
  const diff = contractDiff(o, c);
  assert.notEqual(diff, null, "the gate FAILED to catch a short strip fill — it is worthless");

  // And it reaches the painted output: with the target cells pre-dirtied, the oracle
  // paints the 10th tilemap cell while the short twin leaves it dirty.
  const tenth = TILE_CELLS[9];
  const od = entry.clone();
  const cd = entry.clone();
  for (const a of [...TILE_CELLS, ...COLOUR_CELLS]) {
    od.mem.write8(a, DIRTY);
    cd.mem.write8(a, DIRTY);
  }
  oracle(od);
  brokenLoc4816(cd);
  assert.notEqual(od.mem.read8(tenth), DIRTY, "oracle should have painted the 10th cell");
  assert.equal(cd.mem.read8(tenth), DIRTY, "short twin should have left the 10th cell unpainted");
  assert.notEqual(
    od.mem.read8(tenth),
    cd.mem.read8(tenth),
    "teeth NOT caught at the 10th painted cell",
  );
  console.log(`  TEETH: short fill caught (${diff}) and at the 10th cell ${hx(tenth)} (oracle=${od.mem.read8(tenth)} twin=${cd.mem.read8(tenth)})`);
});
