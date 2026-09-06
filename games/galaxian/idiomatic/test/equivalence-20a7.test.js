// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20a7 — crafted-entry memory-equivalence vs the frozen gated repaint.
 * The routine paints the player-status column into VRAM only when a saved status byte is nonzero; a zero
 * byte skips it. It writes only work RAM/VRAM, so ramDiff is the whole live-out (return-stack window
 * masked). Two paths: gate-open (paint) and gate-closed (no work). The open seed pre-dirties the three
 * painted cells with a sentinel so the paint is demonstrably non-vacuous. Positive controls: the open path
 * stamps the three cells; the closed path leaves memory alone. Teeth: no-op (open) and a gate-ignoring paint
 * (closed).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_20a7 as cand } from "../loc_20a7.js";
import { loc_20a7 as oracle } from "../../translated/loc_20a7.js";
import { repaintPlayerStatusColumn } from "../repaintPlayerStatusColumn.js";

const STATUS_GATE = 0x40ab, CURRENT_PLAYER = 0x400d;
const TILE_MID = 0x25, TILE_BOTTOM = 0x20, SENT = 0xaa;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// The three cells the active player's status column paints (top, then two rows up).
function columnCells(mem) {
  const base = mem[CURRENT_PLAYER] === 0 ? 0x5340 : 0x50e0;
  return { base, cells: [base, base - 32, base - 64] };
}

// Gate open: status byte nonzero, B bit 4 clear -> paint; pre-dirty the painted cells; lay the ret.
const open = () => craft((mem, mm) => {
  mem[STATUS_GATE] = 1;
  mm.regs.b = 0;
  for (const c of columnCells(mem).cells) mem[c] = SENT;
  mm.push16(0x9999);
});
// Gate closed: status byte zero -> the routine bails; pre-dirty the cells so a gate-ignoring paint shows.
const closed = () => craft((mem, mm) => {
  mem[STATUS_GATE] = 0;
  mm.regs.b = 0;
  for (const c of columnCells(mem).cells) mem[c] = SENT;
  mm.push16(0x9999);
});

test("EQUAL (crafted): loc_20a7 == oracle paints when the gate is open", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, open()), null, "the gated repaint diverged (open)");
  // non-vacuous: the open path stamps the three status-column cells over the sentinel.
  const a = open(); oracle(a);
  const { base, cells } = columnCells(a.mem8);
  assert.equal(a.mem8[cells[0]], (a.mem8[CURRENT_PLAYER] + 1) & 0xff, "top cell not stamped");
  assert.equal(a.mem8[cells[1]], TILE_MID, "middle cell not stamped");
  assert.equal(a.mem8[cells[2]], TILE_BOTTOM, "bottom cell not stamped");
  assert.ok(base === 0x5340 || base === 0x50e0, "unexpected status column base");
  console.log("  EQUAL: loc_20a7 == oracle, gate open -> paint");
});

test("EQUAL (crafted): loc_20a7 == oracle bails when the gate is closed", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, closed()), null, "the gated repaint diverged (closed)");
  // non-vacuous: the closed path is a genuine no-op on memory.
  const noOp = () => {};
  assert.equal(ramDiff(oracle, noOp, closed()), null, "positive control: closed gate still wrote memory");
  console.log("  EQUAL: loc_20a7 == oracle, gate closed -> no work");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const ignoreGate = (m) => repaintPlayerStatusColumn(m);
  assert.ok(ramDiff(oracle, noOp, open()), "no-op twin escaped (open path)");
  assert.ok(ramDiff(oracle, ignoreGate, closed()), "gate-ignoring twin escaped (closed path)");
  console.log("  TEETH: no-op (open) + gate-ignoring paint (closed) caught");
});
