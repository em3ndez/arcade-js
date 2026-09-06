// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0583 — crafted-entry equivalence vs the frozen VRAM-clear phase step at ROM 0x0583.
 * Memory-only live-outs: the 32-cell VRAM blank at the running cursor (0x400b), the advanced cursor
 * stored back, the phase counter (0x4009), and — only on the last phase — the sequence-state bump
 * (0x400a) plus the object-shadow reseed (0x4021 stride 2). No register/io live-out. Two paths:
 *   - PHASES LEFT: counter still nonzero after the tick -> no fall-through.
 *   - LAST PHASE: counter hits zero -> advance the state and reseed.
 * Teeth: a no-op twin, a double-decrement, a wrong advanced cursor, an unfilled cell, a dropped state
 * bump, and a perturbed reseed.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_0583 as cand } from "../loc_0583.js";
import { loc_0583 as oracle } from "../../translated/loc_0583.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const VRAM_PTR = 0x400b;
const PHASE = 0x4009;
const SEQ_STATE = 0x400a;
const RESEED_HEAD = 0x4021; // first cell the object-shadow reseed writes
const CURSOR = 0x5000;      // VRAM fill destination
const CURSOR_END = 0x501f;  // last of the 32 filled cells
const BLANK = 16;

// Counter still counting after the tick.
const phasesLeft = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.mem16[VRAM_PTR] = CURSOR;
  mem[PHASE] = 5;
  mem[SEQ_STATE] = 5;
  mem[CURSOR] = 0xff;
  mem[CURSOR_END] = 0xff;
});
// Counter hits zero -> fall through to the advance + reseed.
const lastPhase = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.mem16[VRAM_PTR] = CURSOR;
  mem[PHASE] = 1;
  mem[SEQ_STATE] = 5;
  mem[RESEED_HEAD] = 0xff;
  mem[CURSOR] = 0xff;
});

function runOracle(entry) { const a = entry.clone(); a.routines = STUBS; oracle(a); return a; }

test("EQUAL (crafted): loc_0583 == oracle with phases left", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, phasesLeft()), null, "loc_0583 diverged with phases left");
  const a = runOracle(phasesLeft());
  assert.equal(a.mem8[CURSOR], BLANK, "positive control: oracle blanked the cursor head");
  assert.equal(a.mem8[CURSOR_END], BLANK, "positive control: oracle blanked the cursor tail");
  assert.equal(a.mem16[VRAM_PTR], CURSOR + 32, "positive control: oracle advanced the cursor 32 cells");
  assert.equal(a.mem8[PHASE], 4, "positive control: oracle ticked the phase counter 5->4");
  assert.equal(a.mem8[SEQ_STATE], 5, "positive control: phases-left leaves the sequence state untouched");
  console.log("  EQUAL: loc_0583 == oracle, filled + advanced, phase 5->4, no advance");
});

test("EQUAL (crafted): loc_0583 == oracle on the last phase", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, lastPhase()), null, "loc_0583 diverged on the last phase");
  const a = runOracle(lastPhase());
  assert.equal(a.mem8[PHASE], 0, "positive control: oracle drove the phase counter to 0");
  assert.equal(a.mem8[SEQ_STATE], 6, "positive control: oracle advanced the sequence state 5->6");
  assert.equal(a.mem16[VRAM_PTR], CURSOR + 32, "positive control: oracle advanced the cursor 32 cells");
  console.log("  EQUAL: loc_0583 == oracle, last phase advanced state 5->6 and reseeded");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const decTwice = (m) => { cand(m); m.mem8[PHASE] = (m.mem8[PHASE] - 1) & 0xff; };
  const wrongCursor = (m) => { cand(m); m.mem16[VRAM_PTR] = m.mem16[VRAM_PTR] + 1; };
  const unfilled = (m) => { cand(m); m.mem8[CURSOR] = 0xff; };
  const noBump = (m) => { cand(m); m.mem8[SEQ_STATE] = (m.mem8[SEQ_STATE] - 1) & 0xff; };
  const noReseed = (m) => { cand(m); m.mem8[RESEED_HEAD] = m.mem8[RESEED_HEAD] ^ 0xff; };
  assert.ok(ramDiff(oracle, noOp, phasesLeft()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, decTwice, phasesLeft()), "double-decrement twin escaped");
  assert.ok(ramDiff(oracle, wrongCursor, phasesLeft()), "wrong-cursor twin escaped");
  assert.ok(ramDiff(oracle, unfilled, phasesLeft()), "unfilled-cell twin escaped");
  assert.ok(ramDiff(oracle, noBump, lastPhase()), "dropped-state-bump twin escaped");
  assert.ok(ramDiff(oracle, noReseed, lastPhase()), "perturbed-reseed twin escaped");
  console.log("  TEETH: no-op, double-dec, wrong-cursor, unfilled, no-bump, no-reseed all caught");
});
