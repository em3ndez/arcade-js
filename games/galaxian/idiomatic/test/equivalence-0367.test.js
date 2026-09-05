// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0367 — crafted-entry equivalence vs the frozen periodic tile-column redraw at ROM 0x0367.
 * Every live-out is VRAM (in the state dump), so ramDiff==null is the whole check. Callers overwrite HL
 * immediately or tail-jump, so no register is a live-out — a memory-only check is correct here. Three
 * paths: DRAW (count>=2, frame low6 == the draw phase), BLANK (count>=2, low6 == 0), EARLY (count<2 or an
 * inert phase -> no writes). Teeth: no-op and a VRAM scribble on the draw/blank paths, and a rogue writer
 * that ignores the count guard on the early path.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_0367 as cand } from "../loc_0367.js";
import { loc_0367 as oracle } from "../../translated/loc_0367.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const COUNT = 0x4241;    // running column count that gates the redraw
const FRAME = 0x425f;    // frame counter: low 6 bits select the phase, top 2 select the source row
const VRAM = 0x5193;     // first destination cell
const BLANK_TILE = 16;
const TABLE_FIRST_BYTE = 1; // first byte of the selected source row (row 0)

const DIRTY_TILE = 0x77; // a non-blank sentinel: the attract seed already holds BLANK_TILE at VRAM,
                          // so a blank write would be idempotent (invisible to a no-op twin) unless
                          // the destination is pre-dirtied first.

const drawEntry  = () => craft((mem, mm) => { mm.push16(0x9999); mem[COUNT] = 3; mem[FRAME] = 0x20; });
const blankEntry = () => craft((mem, mm) => { mm.push16(0x9999); mem[COUNT] = 3; mem[FRAME] = 0x00; mem[VRAM] = DIRTY_TILE; });
const earlyEntry = () => craft((mem, mm) => { mm.push16(0x9999); mem[COUNT] = 1; mem[FRAME] = 0x20; });

test("EQUAL (crafted): loc_0367 draws the frame-selected columns like the oracle", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, drawEntry()), null, "loc_0367 diverged on the draw path");
  const a = drawEntry(); oracle(a);
  assert.equal(a.mem8[VRAM], TABLE_FIRST_BYTE, "positive control: oracle stamped the source row into VRAM");
  console.log("  EQUAL: loc_0367 == oracle on the draw path (VRAM)");
});

test("EQUAL (crafted): loc_0367 blanks the columns like the oracle on the zero phase", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, blankEntry()), null, "loc_0367 diverged on the blank path");
  const a = blankEntry(); oracle(a);
  assert.equal(a.mem8[VRAM], BLANK_TILE, "positive control: oracle blanked the first VRAM cell");
  console.log("  EQUAL: loc_0367 == oracle on the blank path (VRAM)");
});

test("EQUAL (crafted): loc_0367 draws nothing when the count is below two", { skip }, () => {
  const before = earlyEntry().mem8[VRAM];
  assert.equal(ramDiff(oracle, cand, earlyEntry()), null, "loc_0367 diverged on the early-return path");
  const a = earlyEntry(); oracle(a);
  assert.equal(a.mem8[VRAM], before, "positive control: oracle left VRAM untouched");
  console.log("  EQUAL: loc_0367 == oracle on the early-return path (no VRAM write)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribble = (m) => { cand(m); m.mem8[VRAM] = m.mem8[VRAM] ^ 0xff; };
  const rogueWrite = (m) => { m.mem8[VRAM] = m.mem8[VRAM] ^ 0xff; }; // ignores the count<2 guard
  assert.ok(ramDiff(oracle, noOp, drawEntry()), "no-op twin escaped (draw)");
  assert.ok(ramDiff(oracle, noOp, blankEntry()), "no-op twin escaped (blank)");
  assert.ok(ramDiff(oracle, scribble, drawEntry()), "scribble twin escaped (ramDiff teeth)");
  assert.ok(ramDiff(oracle, rogueWrite, earlyEntry()), "rogue-write twin escaped (early guard)");
  console.log("  TEETH: no-op (draw+blank), scribble, early-guard rogue write all caught");
});
