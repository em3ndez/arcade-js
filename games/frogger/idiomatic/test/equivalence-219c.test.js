// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitScrollBand — memory-equivalent to the frozen oracle at ROM 0x219C.
 * GATE: crafted-entry. Attract never dispatches this scroll-band blitter (probe: 0 dispatches over
 * ENTRY_FRAMES, and its only caller 0x2005 is likewise never reached), so a post-boot attract machine
 * is cloned and its descriptor (0x827C column / unit / row), scroll-phase mode (0x8111) and wrap-latch
 * (0x8108) are poked to drive every mode arm plus the zero-count (256-step) loop edges. The video-RAM
 * band is pre-cleared so the blit is observable. LIVE-OUT is memory-only: the routine reads no live
 * register and the caller reloads A, so registers are not compared. The oracle's folded call/return
 * and DE push leave dead scratch in [SP-8, SP) that the register-free rewrite never writes, excluded
 * from the RAM diff. Teeth: four broken twins (no-op, wrong source row, skipped latch, wrong tail).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { blitScrollBand } from "../blitScrollBand.js";
import { loc_219c as oracle } from "../../translated/loc_219c.js";

const DESCRIPTOR = 0x827c; // column, unit count, row count
const MODE = 0x8111;
const LATCH = 0x8108;
const TAIL = 0x8119;
const VRAM_LO = 0xa800, VRAM_HI = 0xac00;
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

// A post-boot machine with a poked descriptor/mode/latch and a cleared video band, so the blit is
// observable (a valid entry: this leaf reads its inputs from RAM and forces IX to the descriptor).
function craft(column, units, rows, mode, latch) {
  const e = seedMachine().clone();
  e.mem8[DESCRIPTOR] = column;
  e.mem8[(DESCRIPTOR + 1) & 0xffff] = units;
  e.mem8[(DESCRIPTOR + 2) & 0xffff] = rows;
  e.mem8[MODE] = mode;
  e.mem8[LATCH] = latch;
  for (let p = VRAM_LO; p < VRAM_HI; p++) e.mem8[p] = 0;
  return e;
}

// null == memory-equivalent, excluding the dead [SP-8, SP) stack scratch the oracle's push/pop leaves.
function ramDiff(cand, machine) {
  const sp0 = machine.regs.sp, lo = (sp0 - 8) & 0xffff, hi = sp0;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let i = 0; i < da.length; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= lo && addr < hi) continue; // dead stack scratch
    return `RAM 0x${addr.toString(16)}: ${da[i]} vs ${db[i]}`;
  }
  return null;
}

// [name, column, units, rows, mode, latch]
const CASES = [
  ["mode 0 -> row A", 4, 1, 2, 0, 0],
  ["mode 112 -> row A", 4, 1, 2, 112, 0],
  ["mode 48 -> row B, clears set latch", 6, 2, 3, 48, 1],
  ["mode 96 -> row B, latch already 0", 6, 2, 3, 96, 0],
  ["mode 80 -> row C, sets latch", 3, 1, 2, 80, 0],
  ["off-table mode -> no blit, tail only", 4, 1, 2, 99, 1],
  ["rows=1 -> 256-step band walk", 1, 0, 1, 0, 0],
  ["units=0 -> 256-iteration unit loop", 2, 0, 3, 80, 0],
  ["rows=0 -> 255-step band walk", 1, 1, 0, 0, 0],
];

// broken twins.
function brokenNoOp() {}
function brokenWrongTail(m) { blitScrollBand(m); m.mem8[TAIL] = (m.mem8[TAIL] + 1) & 0xff; } // wrong 0x8119
function brokenSkipLatch(m) { // blits but never touches the wrap-latch
  const { mem8 } = m;
  const column = mem8[DESCRIPTOR], units = mem8[(DESCRIPTOR + 1) & 0xffff], rows = mem8[(DESCRIPTOR + 2) & 0xffff];
  const stride = (column + ((32 * units) & 0xff)) & 0xffff;
  const steps = ((rows - 1) & 0xff) || 256;
  let dst = (0xa80e + stride * steps) & 0xffff;
  const mode = mem8[MODE];
  let src = -1;
  if (mode === 0 || mode === 112) src = 0x2231;
  else if (mode === 48 || mode === 96) src = 0x2235;
  else if (mode === 80) src = 0x2239;
  if (src >= 0) for (let row = 0; row < 6; row++) {
    const s = (src + (row % 2) * 2) & 0xffff;
    mem8[dst] = mem8[s]; mem8[(dst + 1) & 0xffff] = mem8[(s + 1) & 0xffff]; dst = (dst + 32) & 0xffff;
  }
  mem8[TAIL] = (rows - 1) & 0xff;
}
function brokenWrongRow(m) { // mode-B reads row A instead of row B
  const { mem8 } = m;
  const column = mem8[DESCRIPTOR], units = mem8[(DESCRIPTOR + 1) & 0xffff], rows = mem8[(DESCRIPTOR + 2) & 0xffff];
  const stride = (column + ((32 * units) & 0xff)) & 0xffff;
  const steps = ((rows - 1) & 0xff) || 256;
  let dst = (0xa80e + stride * steps) & 0xffff;
  const mode = mem8[MODE];
  let src = -1;
  if (mode === 0 || mode === 112) src = 0x2231;
  else if (mode === 48 || mode === 96) src = 0x2231; // BUG
  else if (mode === 80) src = 0x2239;
  if (src >= 0) {
    for (let row = 0; row < 6; row++) {
      const s = (src + (row % 2) * 2) & 0xffff;
      mem8[dst] = mem8[s]; mem8[(dst + 1) & 0xffff] = mem8[(s + 1) & 0xffff]; dst = (dst + 32) & 0xffff;
    }
    if (mode === 48 || mode === 96) { if (mem8[LATCH] !== 0) mem8[LATCH] = 0; }
    else if (mode === 80) mem8[LATCH] = 1;
  }
  mem8[TAIL] = (rows - 1) & 0xff;
}

test("EQUAL (crafted): blitScrollBand == oracle on every mode arm and count edge", { skip }, () => {
  assert.ok(CASES.length > 0, "vacuous: no crafted entries");
  for (const [name, ...args] of CASES) {
    assert.equal(ramDiff(blitScrollBand, craft(...args)), null, `diverged: ${name}`);
  }
  assert.ok(ramDiff(brokenNoOp, craft(4, 1, 2, 0, 0)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${CASES.length} crafted arms/edges, blitScrollBand == oracle (RAM minus stack scratch)`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const eLatch = craft(3, 1, 2, 80, 0); // mode C: blits + raises the latch
  const eRowB = craft(6, 2, 3, 48, 1); // mode B: blits row B + clears the latch
  assert.ok(ramDiff(brokenNoOp, eLatch), "the no-op twin escaped");
  assert.ok(ramDiff(brokenSkipLatch, eLatch), "the skip-latch twin escaped");
  assert.ok(ramDiff(brokenWrongRow, eRowB), "the wrong-source-row twin escaped");
  assert.ok(ramDiff(brokenWrongTail, craft(4, 1, 2, 0, 0)), "the wrong-tail twin escaped");
  console.log("  TEETH: no-op, skip-latch, wrong-row, wrong-tail all caught");
});
