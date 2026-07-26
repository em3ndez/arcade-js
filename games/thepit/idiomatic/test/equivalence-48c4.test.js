// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for loc_48c4 (ROM 0x48c4, The Pit) — the nine-cell
 * colour-RAM column recolour that cycles its colour one step per call.
 *
 * The routine writes RAM and is NOT a leaf: it seats the fill length / colour /
 * target cell, then drives three still-oracle cell helpers (offset calc 0x3dae,
 * address derive 0x3dc9, column fill 0x3e01) through the real Z80 stack — the fill
 * is a tail hand-off whose own return unwinds to loc_48c4's caller. Because those
 * callees are exercised through the same stack the oracle uses (and The Pit's stack
 * lives inside diffed work RAM), the idiomatic rewrite reproduces the oracle's whole
 * observable state: RAM, the register file, pc AND the stack all come out identical.
 * So this gate is STRICT — it compares everything unitEquivalence compares (whole
 * state + full register file + pc), not just a memory-only live-out.
 *
 * The routine is dispatched from the dig / wall-collision core (loc_03e8) during the
 * ordinary boot/attract run, so entries are CAPTURED from that run, never constructed.
 *
 *   1. IDENTITY  — the gate with both arms = the oracle MUST report EQUAL (wiring).
 *   2. EQUAL     — the idiomatic routine vs the oracle from the first real captured
 *                  dispatch: identical RAM, registers, and pc.
 *   3. NON-VACUOUS — on that real entry the oracle actually does the work (fill length
 *                  9, target column 6 / row 10, colour advanced with bit 3 held clear,
 *                  the colour painted down the column) and its stack traffic really
 *                  lands in diffed work RAM — so EQUAL is meaningful, not trivial.
 *   4. TEETH     — a twin that drops the colour advance MUST be caught, naming
 *                  BOARD_MODE (0x8057).
 *   5. REALISM   — replay every real dispatch over a longer run: whole state + regs +
 *                  pc identical to the oracle on each.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-48c4.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_48c4 as oracle } from "../../translated/loc_48c4.js";
import { loc_48c4 as idiomatic } from "../loc_48c4.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { BOARD_MODE, TILE_COL, TILE_ROW } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x48c4;
// loc_48c4 is dispatched from the dig core only once the attract DEMO is playing —
// first entry lands near frame 695 (well past the title), so every capture/gate run
// needs a budget that reaches the demo.
const REACH_FRAMES = 820;
const FILL_LENGTH = 0x8055; // nine-cell count the column fill reads (unnamed in ram.js)
const COLOR_RAM_BASE = 0x8800; // colour-RAM base the address-derive helper adds
const CELL_OFFSET = 32 * 10 + 6; // row 10, column 6 -> tilemap offset (32-wide stride)
const COLOR_CELL = COLOR_RAM_BASE + CELL_OFFSET; // top of the painted column, in colour RAM
const COLUMN_STRIDE = 32; // one row down the colour-RAM column
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/** Hook 0x48c4 over a boot/attract run and clone the machine at up to K real dispatches. */
function captureEntries(K, maxFrames) {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snap);
  host.runFrames(maxFrames);
  assert.equal(host.stoppedBy, null, "attract capture run must reach the vblank spin cleanly");
  return caps;
}

/** First difference between two run-out machines across whole state, registers, then pc. */
function fullDiff(a, b) {
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  if (ram) return { kind: "ram", ...ram };
  const regs = firstRegDiff(a.regs, b.regs);
  if (regs) return { kind: "regs", ...regs };
  if (a.pc !== b.pc) return { kind: "pc", a: a.pc, b: b.pc };
  return null;
}

// -- 1. IDENTITY --------------------------------------------------------------

test("IDENTITY: the gate reports EQUAL when both arms are the oracle", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, oracle, { maxFrames: REACH_FRAMES });
  assert.equal(res.equal, true, `gate reported a diff for identical arms: ${JSON.stringify(res)}`);
  console.log("  IDENTITY: captured 0x48c4, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 2. EQUAL -----------------------------------------------------------------

test("EQUAL: idiomatic loc_48c4 == oracle from the first real dispatch (state + regs + pc)", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, idiomatic, { maxFrames: REACH_FRAMES });
  assert.equal(res.ram, null, res.ram && `RAM diff at ${hx(res.ram.addr ?? 0)} (oracle=${res.ram.a} idiomatic=${res.ram.b})`);
  assert.equal(res.regs, null, res.regs && `register diff at ${res.regs?.reg} (oracle=${res.regs?.a} idiomatic=${res.regs?.b})`);
  assert.equal(res.pc, null, res.pc && `pc diff (oracle=${hx(res.pc?.a ?? 0)} idiomatic=${hx(res.pc?.b ?? 0)})`);
  assert.equal(res.equal, true, "idiomatic must be byte-identical to the oracle");
  console.log("  EQUAL: whole state, register file and pc identical to the oracle");
});

// -- 3. NON-VACUOUS -----------------------------------------------------------

test("NON-VACUOUS: the oracle really recolours the column, and its stack traffic is in diffed RAM", () => {
  const [entry] = captureEntries(1, REACH_FRAMES);
  assert.ok(entry, "attract must dispatch 0x48c4 at least once");

  const sp = entry.regs.sp;
  assert.ok(sp >= 0x8000 && sp < 0x8800, `entry SP must sit in diffed work RAM (SP=${hx(sp)})`);
  const colorBefore = entry.mem.read8(BOARD_MODE);

  const a = entry.clone();
  oracle(a);

  // The seated inputs and the advanced colour.
  assert.equal(a.mem.read8(FILL_LENGTH), 9, "oracle must seat the nine-cell fill length");
  assert.equal(a.mem.read8(TILE_COL), 6, "oracle must aim at column 6");
  assert.equal(a.mem.read8(TILE_ROW), 10, "oracle must aim at row 10");
  const colorAfter = (colorBefore + 1) & 0xf7;
  assert.equal(a.mem.read8(BOARD_MODE), colorAfter, "oracle must advance the colour with bit 3 held clear");
  assert.equal((a.mem.read8(BOARD_MODE) & 0x08), 0, "the advanced colour never sets bit 3");

  // The column was actually painted: the top cell and the ninth cell both hold the colour.
  assert.equal(a.mem.read8(COLOR_CELL), colorAfter, "oracle must paint the colour at the top of the column");
  assert.equal(a.mem.read8(COLOR_CELL + 8 * COLUMN_STRIDE), colorAfter, "oracle must paint all nine cells down the column");

  // The oracle's two helper calls leave their last return address on the stack, in
  // diffed work RAM — proof the stack is genuinely part of what EQUAL compared.
  assert.equal(a.mem.read16(sp - 2), 0x48e2, "the helper-call stack traffic must land in diffed work RAM");
  console.log(`  NON-VACUOUS: colour ${colorBefore} -> ${colorAfter}, nine cells painted, stack traffic in RAM`);
});

// -- 4. TEETH -----------------------------------------------------------------

/** Broken twin: everything faithful EXCEPT it never advances the colour, so it paints
 *  (and stores back) the un-bumped colour. The only divergence is the colour byte and
 *  the cells it paints — the gate must catch it, first at BOARD_MODE. */
function brokenNoAdvance(m) {
  const { mem } = m;
  mem.write8(FILL_LENGTH, 9);
  const color = mem.read8(BOARD_MODE);
  mem.write8(BOARD_MODE, color); // BUG: colour not advanced
  mem.write8(TILE_COL, 6);
  mem.write8(TILE_ROW, 10);
  m.push16(0x48df); m.call(0x3dae);
  m.push16(0x48e2); m.call(0x3dc9);
  return m.call(0x3e01);
}

test("TEETH: a twin that drops the colour advance is CAUGHT, naming BOARD_MODE", () => {
  const res = unitEquivalence(makeMachine, TARGET, oracle, brokenNoAdvance, { maxFrames: REACH_FRAMES });
  assert.equal(res.equal, false, "the gate FAILED to catch a dropped colour advance — it is worthless");
  assert.notEqual(res.ram, null, "the caught diff must be a RAM difference");
  assert.equal(res.ram.addr, BOARD_MODE, `expected the caught diff at BOARD_MODE (0x8057), got ${hx(res.ram.addr ?? 0)}`);
  console.log(`  TEETH: dropped colour advance caught at ${hx(res.ram.addr)} (oracle=${res.ram.a} broken=${res.ram.b})`);
});

// -- 5. REALISM ---------------------------------------------------------------

test("REALISM: replay every real 0x48c4 dispatch — whole state + regs + pc identical", () => {
  const caps = captureEntries(16, 1300);
  assert.ok(caps.length >= 1, "expected at least one real 0x48c4 dispatch in the run");
  for (const entry of caps) {
    const a = entry.clone(), b = entry.clone();
    oracle(a);
    idiomatic(b);
    const d = fullDiff(a, b);
    assert.equal(d, null, d && `dispatch diff (${d.kind}) ${JSON.stringify(d)}`);
  }
  console.log(`  REALISM: ${caps.length} real 0x48c4 dispatch(es) — identical to the oracle`);
});
