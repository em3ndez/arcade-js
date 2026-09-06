// SPDX-License-Identifier: GPL-3.0-only
/**
 * drawObjectFigureGridColumn — memory-equivalent to the frozen oracle at ROM 0x2067 (object-slot scan head).
 * Three crafted paths off the shared attract seed:
 *   - FALL  : 0x425f low nibble != 0, 0x4238 bit0 clear -> seed the 6-row column loop (stride 0x10) and fall into
 *             routeObjectGridCellDraw; the loop draws a tile figure per slot, so work/VRAM changes are observable.
 *   - TAIL  : 0x425f low nibble == 0 -> repaint the player-status column (0x4006 seeded nonzero so 0x40ab +
 *             the status column are written -> observable).
 *   - RET   : 0x425f low nibble != 0, 0x4238 bit0 set -> return with NO memory write.
 * Fidelity is memory-only (ramDiff masks the return-stack window). No register live-out: the caller
 * loc_200a reloads all its state after the call, and the BC/C/HL seeding is consumed inside the routeObjectGridCellDraw
 * loop (handed over as explicit params) — so there is no register-comparison arm.
 * Teeth: no-op, swapped tails, a dropped bit0 gate, a wrong grid base, a wrong nibble mask.
 * NON-VACUOUS positive control: the no-op twin diverges on FALL and TAIL (each writes RAM), and the
 * dropped-bit0 twin diverges on RET (proving that path is observable and the gate is load-bearing).
 * The candidate and twins delegate to the idiomatic routeObjectGridCellDraw as routeObjectGridCellDraw(m, bc, hl) -- bc = (count<<8)|stride,
 * hl = the slot pointer -- the push-free co-batch ABI the loop epilogue forwards.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { drawObjectFigureGridColumn as cand } from "../drawObjectFigureGridColumn.js";
import { loc_2067 as oracle } from "../../translated/loc_2067.js";
import { routeObjectGridCellDraw } from "../routeObjectGridCellDraw.js";
import { repaintPlayerStatusColumnFromModeGate } from "../repaintPlayerStatusColumnFromModeGate.js";

const COUNTER = 0x425f;   // frame counter; low nibble = grid-column phase
const FLAGS = 0x4238;     // flags byte; bit0 gates the scan
const GRID = 0x4120;      // object grid base
const MODE_GATE = 0x4006; // repaint mode-gate byte read by loc_209c
const STRIDE = 0x10;
const COUNT = 6;

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// Zero the grid span every variant's loop reads so slot activity is deterministic, then poke the head cells.
function seedGrid(mem8) {
  for (let a = GRID; a < GRID + 0x90; a++) mem8[a] = 0x00;
}
function entryFall() {
  return craft((mem8, m) => { m.push16(0x9999); seedGrid(mem8); mem8[COUNTER] = 0x35; mem8[FLAGS] = 0x02; });
}
function entryTail() {
  return craft((mem8, m) => { m.push16(0x9999); mem8[COUNTER] = 0x30; mem8[MODE_GATE] = 0x07; });
}
function entryRet() {
  return craft((mem8, m) => { m.push16(0x9999); seedGrid(mem8); mem8[COUNTER] = 0x35; mem8[FLAGS] = 0x03; });
}

// Broken twins: each mirrors the candidate with a single defect that must make the RAM diff non-null.
function brokenNoOp() {}
function brokenWrongTail(m) { // nibble 0 falls into the loop instead of repainting
  const { mem8 } = m;
  const nibble = mem8[COUNTER] & 0x0f;
  if (nibble === 0) return routeObjectGridCellDraw(m, (COUNT << 8) | STRIDE, GRID);
  const ptr = GRID + nibble;
  if (mem8[FLAGS] & 0x01) return;
  return routeObjectGridCellDraw(m, (COUNT << 8) | STRIDE, ptr);
}
function brokenIgnoreBit0(m) { // drops the flags bit0 gate -> always scans
  const { mem8 } = m;
  const nibble = mem8[COUNTER] & 0x0f;
  if (nibble === 0) return repaintPlayerStatusColumnFromModeGate(m);
  return routeObjectGridCellDraw(m, (COUNT << 8) | STRIDE, GRID + nibble);
}
function brokenWrongBase(m) { // wrong grid base -> loop reads/draws at wrong coords
  const { mem8 } = m;
  const nibble = mem8[COUNTER] & 0x0f;
  if (nibble === 0) return repaintPlayerStatusColumnFromModeGate(m);
  const ptr = GRID + 0x10 + nibble;
  if (mem8[FLAGS] & 0x01) return;
  return routeObjectGridCellDraw(m, (COUNT << 8) | STRIDE, ptr);
}
function brokenWrongMask(m) { // wrong nibble mask -> wrong index/path
  const { mem8 } = m;
  const nibble = mem8[COUNTER] & 0xf0;
  if (nibble === 0) return repaintPlayerStatusColumnFromModeGate(m);
  const ptr = GRID + nibble;
  if (mem8[FLAGS] & 0x01) return;
  return routeObjectGridCellDraw(m, (COUNT << 8) | STRIDE, ptr);
}

test("EQUAL: drawObjectFigureGridColumn == oracle across the three paths", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entryFall()), null, "FALL: seed + fall into routeObjectGridCellDraw diverged");
  assert.equal(ramDiff(oracle, cand, entryTail()), null, "TAIL: repaint path diverged");
  assert.equal(ramDiff(oracle, cand, entryRet()), null, "RET: bit0-set return path diverged");
  console.log("  EQUAL: drawObjectFigureGridColumn == oracle (RAM) on fall/tail/ret");
});

test("TEETH: broken twins are caught (with non-vacuous positive controls)", { skip }, () => {
  // Positive controls: the crafted entries genuinely write RAM, so a retire-to-0xff can't hide.
  assert.ok(ramDiff(oracle, brokenNoOp, entryFall()), "vacuous: FALL wrote no RAM");
  assert.ok(ramDiff(oracle, brokenNoOp, entryTail()), "vacuous: TAIL wrote no RAM");
  assert.ok(ramDiff(oracle, brokenIgnoreBit0, entryRet()), "vacuous: RET path unobservable / bit0 gate not load-bearing");

  assert.ok(ramDiff(oracle, brokenWrongTail, entryTail()), "the swapped-tail twin escaped");
  assert.ok(ramDiff(oracle, brokenIgnoreBit0, entryRet()), "the dropped-bit0 twin escaped");
  assert.ok(ramDiff(oracle, brokenWrongBase, entryFall()), "the wrong-grid-base twin escaped");
  assert.ok(ramDiff(oracle, brokenWrongMask, entryFall()), "the wrong-nibble-mask twin escaped");
  console.log("  TEETH: no-op, swapped tail, dropped bit0, wrong base, wrong mask all caught");
});
