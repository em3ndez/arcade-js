// SPDX-License-Identifier: GPL-3.0-only
/**
 * swapOutActivePlayerPages — memory-equivalent to the frozen oracle at ROM 0x0726.
 * GATE: crafted-entry. Attract never dispatches this player-page swap-out, so coherent post-boot
 * states are captured at the per-frame score redraw (0x0b1f) and replayed through both sides; the
 * routine reads all its inputs from memory (no register live-in), so any such state is a valid entry.
 * A seeded twin fills the four source banks with a marker and arms the init latch so the copies and
 * the latch are exercised; a second twin pre-sets the latch to cover the early-return arm. Live-out
 * is memory-only, so RAM is compared and registers/SP are not. Teeth: three broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { swapOutActivePlayerPages } from "../swapOutActivePlayerPages.js";
import { loc_0726 as oracle } from "../../translated/loc_0726.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const NEIGHBOUR = 0x0b1f; // per-frame score redraw; a source of coherent post-boot states
const CAP = 200;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function captureNeighbours() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(NEIGHBOUR);
  const m = makeMachine(new Map([[NEIGHBOUR, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  assert.ok(entries.length > 0, "vacuous: the neighbour was never dispatched, no state to replay");
  captured = entries;
  return captured;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// full-path entry: distinctive source banks (so the copies are observable) with the latch armed.
function craftSwap(machine) {
  const c = machine.clone();
  for (let i = 0; i < 183; i++) c.mem8[0x80ff + i] = (i * 2 + 1) & 0xff;
  for (let i = 0; i < 183; i++) c.mem8[0x8600 + i] = (i * 3 + 7) & 0xff;
  for (let i = 0; i < 43; i++) c.mem8[0x800c + i] = (i + 61) & 0xff;
  for (let i = 0; i < 43; i++) c.mem8[0x85c0 + i] = (i + 131) & 0xff;
  c.mem8[0x8295] = 0;
  return c;
}
function craftInited(machine) { const c = craftSwap(machine); c.mem8[0x8295] = 1; return c; }
function oracled(machine) { const a = machine.clone(); oracle(a); return a.dumpState(); }

function brokenNoOp() {}
function brokenShortPage(m) {
  const { mem8 } = m;
  for (let i = 0; i < 182; i++) mem8[0x8500 + i] = mem8[0x80ff + i];   // BUG: 182 not 183
  for (let i = 0; i < 43; i++) mem8[0x86c0 + i] = mem8[0x800c + i];
  for (let i = 0; i < 183; i++) mem8[0x80ff + i] = mem8[0x8600 + i];
  for (let i = 0; i < 43; i++) mem8[0x800c + i] = mem8[0x85c0 + i];
  mem8[0x803f] = 1;
  if (mem8[0x8295] !== 0) return;
  mem8[0x825b] = 0; mem8[0x8295] = 1;
}
function brokenSkipLatch(m) {
  const { mem8 } = m;
  for (let i = 0; i < 183; i++) mem8[0x8500 + i] = mem8[0x80ff + i];
  for (let i = 0; i < 43; i++) mem8[0x86c0 + i] = mem8[0x800c + i];
  for (let i = 0; i < 183; i++) mem8[0x80ff + i] = mem8[0x8600 + i];
  for (let i = 0; i < 43; i++) mem8[0x800c + i] = mem8[0x85c0 + i];
  mem8[0x803f] = 1;
  // BUG: never clear 0x825b / latch 0x8295
}

test("REAL: oracle == rewrite on every captured neighbour state", { skip }, () => {
  const entries = captureNeighbours();
  for (const e of entries) assert.equal(ramDiff(swapOutActivePlayerPages, e), null, "a captured machine diverged");
  console.log(`  REAL: ${entries.length} neighbour states, oracle == rewrite`);
});

test("CRAFTED: oracle == rewrite on the swap and early-return arms", { skip }, () => {
  const base = captureNeighbours()[0];
  const swap = craftSwap(base), inited = craftInited(base);
  assert.equal(ramDiff(swapOutActivePlayerPages, swap), null, "diverged on the full swap arm");
  assert.equal(ramDiff(swapOutActivePlayerPages, inited), null, "diverged on the already-inited (early-return) arm");
  assert.notDeepEqual(oracled(swap), swap.dumpState(), "swap entry vacuous: oracle changed nothing");
  console.log("  CRAFTED: full-swap and early-return arms, oracle == rewrite");
});

test("TEETH: broken twins are caught on the full-swap entry", { skip }, () => {
  const swap = craftSwap(captureNeighbours()[0]);
  assert.ok(ramDiff(brokenNoOp, swap), "the no-op twin escaped");
  assert.ok(ramDiff(brokenShortPage, swap), "the short-page twin escaped");
  assert.ok(ramDiff(brokenSkipLatch, swap), "the skip-latch twin escaped");
  console.log("  TEETH: no-op, short-page, skip-latch all caught");
});
