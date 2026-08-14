// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20cc — memory-equivalent to the frozen oracle at ROM 0x20CC.
 * GATE: crafted-entry. Attract never dispatches this in-play scroll-copy engine (probe: 0 dispatches
 * over ENTRY_FRAMES), so a post-boot attract machine is cloned and its live-in registers poked —
 * DE (source pointer, aimed at a real ROM data table), B (row count), C (column count) — plus the
 * column-stride cell (0x81B1), to drive a normal grid, a multi-column and a multi-row shape, and the
 * count-0 => 256 edge on both the inner (row) and outer (column) loops. The oracle balances a
 * push/pop, leaving dead scratch in [SP-8, SP); the diff masks that window and compares the rest of
 * RAM. Live-out is memory-only. Teeth: four broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_20cc } from "../loc_20cc.js";
import { loc_20cc as oracle } from "../../translated/loc_20cc.js";

const STRIDE_CELL = 0x81b1;
const SRC_A = 0x1423; // real ROM scroll-lane data tables the caller feeds this engine
const SRC_B = 0x142b;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot machine with the engine's live-in registers and column stride poked (a valid entry:
// the caller supplies exactly these).
function entryWith(rows, cols, stride, src) {
  const e = seedMachine().clone();
  e.regs.de = src;
  e.regs.b = rows;
  e.regs.c = cols;
  e.mem8[STRIDE_CELL] = stride;
  return e;
}

// null == RAM-equivalent outside the dead stack-scratch window. Memory-only live-out, so registers
// and SP are not compared; the [SP-8, SP) bytes the oracle's balanced push leaves are masked.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const lo = (sp - 8) & 0xffff;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= lo && addr < sp) continue; // dead stack scratch
    return `0x${addr.toString(16)}: ${da[i]} vs ${db[i]}`;
  }
  return null;
}

// [rows, cols, stride, src, label]
const CASES = [
  [3, 2, 2, SRC_A, "normal grid"],
  [1, 4, 2, SRC_A, "multi-column"],
  [5, 1, 3, SRC_B, "multi-row"],
  [0, 1, 2, SRC_A, "row count 0 -> 256 inner runs"],
  [1, 0, 2, SRC_A, "column count 0 -> 256 outer runs"],
];

// broken twins.
function brokenNoOp() {}
function brokenWrongPitch(m) { // 31-byte row pitch instead of 32
  const { regs, mem8, mem16 } = m;
  const src = regs.de, rows = regs.b === 0 ? 256 : regs.b, cols = regs.c === 0 ? 256 : regs.c;
  mem16[0x8001] = regs.de; mem8[0x8003] = regs.b;
  let dst = mem16[0x13ef];
  for (let col = 0; col < cols; col++) {
    let d = dst, s = src;
    for (let r = 0; r < rows; r++) {
      mem8[d] = mem8[s]; mem8[(d + 1) & 0xffff] = mem8[(s + 1) & 0xffff];
      d = (d + 31) & 0xffff; s = (s + 2) & 0xffff;
    }
    dst = (d + mem8[STRIDE_CELL]) & 0xffff;
  }
}
function brokenNoScratch(m) { // never writes the (0x8001)/(0x8003) scratch cells
  const { regs, mem8, mem16 } = m;
  const src = regs.de, rows = regs.b === 0 ? 256 : regs.b, cols = regs.c === 0 ? 256 : regs.c;
  let dst = mem16[0x13ef];
  for (let col = 0; col < cols; col++) {
    let d = dst, s = src;
    for (let r = 0; r < rows; r++) {
      mem8[d] = mem8[s]; mem8[(d + 1) & 0xffff] = mem8[(s + 1) & 0xffff];
      d = (d + 32) & 0xffff; s = (s + 2) & 0xffff;
    }
    dst = (d + mem8[STRIDE_CELL]) & 0xffff;
  }
}
function brokenNoRowCountZero(m) { // treats a row count of 0 as 0 iterations, not 256
  const { regs, mem8, mem16 } = m;
  const src = regs.de, rows = regs.b, cols = regs.c === 0 ? 256 : regs.c;
  mem16[0x8001] = regs.de; mem8[0x8003] = regs.b;
  let dst = mem16[0x13ef];
  for (let col = 0; col < cols; col++) {
    let d = dst, s = src;
    for (let r = 0; r < rows; r++) {
      mem8[d] = mem8[s]; mem8[(d + 1) & 0xffff] = mem8[(s + 1) & 0xffff];
      d = (d + 32) & 0xffff; s = (s + 2) & 0xffff;
    }
    dst = (d + mem8[STRIDE_CELL]) & 0xffff;
  }
}

test("EQUAL (crafted): loc_20cc == oracle on every grid/edge path", { skip }, () => {
  const entries = CASES.map(([rr, cc, st, src]) => entryWith(rr, cc, st, src));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (let i = 0; i < entries.length; i++) {
    assert.equal(ramDiff(loc_20cc, entries[i]), null, `crafted entry diverged: ${CASES[i][4]}`);
  }
  // non-vacuous: the no-op twin must diverge (the oracle really writes VRAM + scratch).
  assert.ok(ramDiff(brokenNoOp, entryWith(3, 2, 2, SRC_A)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted paths, loc_20cc == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const grid = entryWith(3, 2, 2, SRC_A);
  const rows0 = entryWith(0, 1, 2, SRC_A);
  assert.ok(ramDiff(brokenNoOp, grid), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongPitch, grid), "the wrong-pitch twin escaped");
  assert.ok(ramDiff(brokenNoScratch, grid), "the no-scratch twin escaped");
  assert.ok(ramDiff(brokenNoRowCountZero, rows0), "the no-256-edge twin escaped");
  console.log("  TEETH: no-op, wrong-pitch, no-scratch, no-256-edge all caught");
});
