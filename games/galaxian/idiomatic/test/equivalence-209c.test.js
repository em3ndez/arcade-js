// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_209c — crafted-entry memory-equivalence vs the frozen gated status-column repaint.
 * When the mode gate byte (0x4006) is nonzero it saves that byte into the status byte (0x40ab) and
 * repaints the active player's status column; when the gate is zero it repaints only if the saved byte
 * is already set. The routine writes work RAM / VRAM only, so ramDiff is the whole live-out (return-stack
 * masked; flags(B) forwards to the painter through its own default). Three paths:
 *   save  gate nonzero -> save the byte, then paint.
 *   paint gate zero, saved byte nonzero -> paint (the painter then clears the saved byte).
 *   bail  gate zero, saved byte zero -> nothing.
 * Positive controls prove the save and the paint happen and the bail is a genuine no-op; teeth show a
 * no-op, a save-skipping twin, and a gate-ignoring paint each diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_209c as cand } from "../loc_209c.js";
import { loc_209c as oracle } from "../../translated/loc_209c.js";
import { repaintPlayerStatusColumn } from "../repaintPlayerStatusColumn.js";

const MODE = 0x4006, STATUS = 0x40ab, CURRENT_PLAYER = 0x400d;
const TILE_MID = 0x25, TILE_BOTTOM = 0x20, SENT = 0xaa;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// The three cells the active player's status column paints (top, then two rows up).
function columnCells(mem) {
  const base = mem[CURRENT_PLAYER] === 0 ? 0x5340 : 0x50e0;
  return { base, cells: [base, base - 32, base - 64] };
}
function predirty(mem) { for (const c of columnCells(mem).cells) mem[c] = SENT; }

const save = () => craft((mem, mm) => {
  mem[MODE] = 0x07; mem[STATUS] = 0x55; mm.regs.b = 0; predirty(mem); mm.push16(0x9999);
});
const paint = () => craft((mem, mm) => {
  mem[MODE] = 0; mem[STATUS] = 0x33; mm.regs.b = 0; predirty(mem); mm.push16(0x9999);
});
const bail = () => craft((mem, mm) => {
  mem[MODE] = 0; mem[STATUS] = 0; mm.regs.b = 0; predirty(mem); mm.push16(0x9999);
});

const runOracle = (e) => { e.routines = STUBS; oracle(e); return e; };

test("EQUAL (crafted): loc_209c == oracle on save, paint, and bail", { skip }, () => {
  for (const [name, e] of [["save", save], ["paint", paint], ["bail", bail]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `path ${name} diverged in RAM`);
  }
  console.log("  EQUAL: loc_209c == oracle (RAM) on save, paint, bail");
});

test("positive controls: each path is non-vacuous", { skip }, () => {
  const a = runOracle(save());
  assert.equal(a.mem8[STATUS], 0x07, "save: mode gate not stored into the status byte");
  const ac = columnCells(a.mem8);
  assert.equal(a.mem8[ac.cells[0]], (a.mem8[CURRENT_PLAYER] + 1) & 0xff, "save: top cell not painted");
  assert.equal(a.mem8[ac.cells[1]], TILE_MID, "save: middle cell not painted");
  assert.equal(a.mem8[ac.cells[2]], TILE_BOTTOM, "save: bottom cell not painted");

  const b = runOracle(paint());
  const bc = columnCells(b.mem8);
  assert.equal(b.mem8[bc.cells[0]], (b.mem8[CURRENT_PLAYER] + 1) & 0xff, "paint: top cell not painted");
  assert.equal(b.mem8[bc.cells[1]], TILE_MID, "paint: middle cell not painted");
  assert.equal(b.mem8[STATUS], 0, "paint: painter did not clear the saved byte (gate zero)");

  const noOp = () => {};
  assert.equal(ramDiff(oracle, noOp, bail()), null, "bail path wrote memory");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const saveSkip = (m) => repaintPlayerStatusColumn(m);   // paints but forgets the save (save path)
  const ignoreGate = (m) => repaintPlayerStatusColumn(m); // paints when the routine would bail
  assert.ok(ramDiff(oracle, noOp, save()), "no-op escaped (save path)");
  assert.ok(ramDiff(oracle, saveSkip, save()), "save-skipping twin escaped (save path)");
  assert.ok(ramDiff(oracle, ignoreGate, bail()), "gate-ignoring paint escaped (bail path)");
  console.log("  TEETH: no-op, save-skip, gate-ignoring paint all caught");
});
