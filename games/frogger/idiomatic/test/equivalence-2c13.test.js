// SPDX-License-Identifier: GPL-3.0-only
/**
 * spawnSpriteObject — memory-equivalent to the frozen oracle at ROM 0x2C13.
 * GATE: crafted-entry, masked. Attract never dispatches this in-play spawn arm (probe: 0 dispatches
 * over ENTRY_FRAMES), so a post-boot attract machine is cloned, pointed at the object record / sprite
 * slot its caller uses (IX=0x8480/0x8490, IY=0x8058), and driven across every path: below the level-
 * count gate, an already-active slot, and — with the five candidate seed cells poked high so the
 * placement loop runs to completion — the full spawn-and-arm path. This is a non-leaf: the four spawn-
 * PRNG draws (0x0AEE) run on both fresh clones, so their ring effect is part of the compared live-out.
 * Live-out is memory-only; the four draws and their return-continuations leave the dead [SP-8, SP)
 * stack scratch differing, so that window is masked and the rest of RAM is compared. Teeth: no-op,
 * wrong-tile, and a skip-a-draw twin that leaves the PRNG ring un-advanced.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { spawnSpriteObject } from "../spawnSpriteObject.js";
import { loc_2c13 as oracle } from "../../translated/loc_2c13.js";

const RECORDS = [0x8480, 0x8490]; // object record bases its caller loads into IX
const SLOT = 0x8058;
const COUNT_CELL = 0x83b7;
const VARIANT_TABLE = 0x2ce6; // odd bytes give the low byte of each candidate seed cell in page 0x80
const SPAN_RANDOM = 0x0aee;
const COUNTS = [0, 2, 3, 4, 8, 0x0f, 0x1f, 0x40, 0xff];
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

// The five page-0x80 cells the variant table can point the placement seed at.
function seedCells() {
  const s = seedMachine();
  const cells = [];
  for (let v = 0; v < 5; v++) cells.push((0x8000 + s.mem8[(VARIANT_TABLE + 2 * v + 1) & 0xffff]) & 0xffff);
  return cells;
}

// A post-boot machine aimed at a record/slot with a level count, the slot idle. When `forceArm`,
// the candidate seed cells are poked high so the placement loop resolves rather than underflowing —
// the only way the crafted (attract-unreachable) full-arm path is exercised. A valid entry: the arm
// reads IX and RAM only.
function craft(record, count, { forceArm = false } = {}) {
  const e = seedMachine().clone();
  e.regs.ix = record;
  e.regs.iy = SLOT;
  e.mem8[record + 6] = 0; // idle: attempt a spawn
  e.mem8[COUNT_CELL] = count;
  if (forceArm) for (const c of seedCells()) e.mem8[c] = 0xc0;
  return e;
}

// null == equivalent on the memory-only live-out, masking the dead [SP-8, SP) stack scratch the
// draws' return-continuations leave behind. Compares RAM only (not registers or SP).
function maskedDiff(cand, machine) {
  const lo = (machine.regs.sp - 8) & 0xffff;
  const hi = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const A = a.dumpState(), B = b.dumpState();
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    if (A[i] === B[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= lo && addr < hi) continue; // dead stack scratch
    return `0x${(addr ?? 0).toString(16)}: ${A[i]} vs ${B[i]}`;
  }
  return null;
}

function armedByOracle(machine) {
  const a = machine.clone(); oracle(a);
  return a.mem8[(a.regs.ix + 6) & 0xffff] === 1;
}

// broken twins.
function brokenNoOp() {}
function brokenWrongTile(m) {
  spawnSpriteObject(m);
  const { regs, mem8 } = m;
  mem8[(regs.ix + 4) & 0xffff] = (mem8[(regs.ix + 4) & 0xffff] + 1) & 0xff; // BUG: wrong tile/attribute
}
// omits the third spawn draw, leaving the PRNG ring one step behind the oracle.
function brokenSkipDraw(m) {
  const { regs, mem8, mem16 } = m;
  const record = regs.ix;
  const count = mem8[COUNT_CELL];
  if (count < 3) return;
  if (mem8[(record + 6) & 0xffff] !== 0) return;
  m.push16(0x2c22); m.call(SPAN_RANDOM);
  if (((8 * count + 128) & 0xff) < regs.a) return;
  m.push16(0x2c30); m.call(SPAN_RANDOM);
  const variant = regs.a & 0x07;
  if (variant >= 5) return;
  mem8[(record + 4) & 0xffff] = variant * 16 + 48;
  // BUG: the third draw (advancing the ring) is omitted here
  const spanA = mem8[(VARIANT_TABLE + 2 * variant) & 0xffff];
  const workLow = mem8[(VARIANT_TABLE + 2 * variant + 1) & 0xffff];
  mem8[(record + 11) & 0xffff] = workLow;
  const seedPos = mem8[(0x8000 + workLow) & 0xffff];
  const ptr = mem16[(0x2cdc + 2 * variant) & 0xffff];
  const cell = mem8[ptr];
  const spanB = ((((cell >> 2) | (cell << 6)) & 0xff) - 16) & 0xff;
  const spanCount = mem8[(ptr & 0xff00) | ((ptr + 2) & 0xff)] || 256;
  let pos = seedPos, armAcc = null;
  for (let i = 0; i < spanCount; i++) {
    if (pos < spanA) return;
    pos = pos - spanA;
    if (pos < spanB) { armAcc = (pos - spanB) & 0xff; break; }
    pos = pos - spanB;
    if (i === spanCount - 1) { armAcc = pos; break; }
  }
  const remainder = (armAcc + spanB) & 0xff;
  mem8[(record + 2) & 0xffff] = seedPos;
  mem8[(record + 1) & 0xffff] = (seedPos - remainder) & 0xff;
  mem8[record & 0xffff] = (seedPos - remainder + spanB) & 0xff;
  m.push16(0x2c8a); m.call(SPAN_RANDOM);
  if (regs.a & 1) { mem8[(record + 5) & 0xffff] = 0; mem8[(record + 3) & 0xffff] = 0; }
  else { mem8[(record + 5) & 0xffff] = 0x80; mem8[(record + 3) & 0xffff] = 0xf0; }
  mem8[(record + 6) & 0xffff] = 1;
  mem8[(record + 9) & 0xffff] = 8;
}

test("EQUAL (crafted): spawnSpriteObject == oracle on the gate and full-arm paths", { skip }, () => {
  let n = 0, armed = 0;
  for (const record of RECORDS) {
    for (const count of COUNTS) {
      for (const forceArm of [false, true]) {
        const e = craft(record, count, { forceArm });
        assert.equal(maskedDiff(spawnSpriteObject, e), null, `diverged (record=0x${record.toString(16)}, count=${count}, forceArm=${forceArm})`);
        if (armedByOracle(e)) armed++;
        n++;
      }
    }
  }
  assert.ok(armed > 0, "vacuous: no crafted entry reached the full spawn-and-arm path");
  console.log(`  EQUAL: ${n} crafted paths, ${armed} fully armed, spawnSpriteObject == oracle (masked stack scratch)`);
});

test("TEETH: broken twins are caught on a fully-armed entry", { skip }, () => {
  let armEntry = null;
  for (const count of COUNTS) {
    const e = craft(RECORDS[0], count, { forceArm: true });
    if (armedByOracle(e)) { armEntry = e; break; }
  }
  assert.ok(armEntry, "no fully-armed crafted entry to test teeth against");
  assert.ok(maskedDiff(brokenNoOp, armEntry), "the no-op twin escaped");
  assert.ok(maskedDiff(brokenWrongTile, armEntry), "the wrong-tile twin escaped");
  assert.ok(maskedDiff(brokenSkipDraw, armEntry), "the skip-a-draw twin escaped");
  console.log("  TEETH: no-op, wrong-tile, skip-a-draw all caught");
});
