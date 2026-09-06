// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_029d — memory-equivalent to the frozen oracle at ROM 0x029d. A sequence-state handler whose whole
 * contract is RAM/VRAM: clear the strided table, blank a VRAM row + step the cursor, tick the dwell, and
 * on expiry advance the sequence step, clear two work blocks, re-arm the timers, reseed the object shadow,
 * and append a command word to the queue (all in the state dump). No register/io live-out — the tail
 * enqueue's HL restore is an internal artifact, not a designed output. Two paths:
 *   - RUNNING: dwell > 1 -> tick and return (no expiry work).
 *   - EXPIRY: dwell == 1 -> full advance incl. the queue append.
 * EQUAL asserts ramDiff==null on both. Teeth: no-op, a decrement-by-two dwell mutant, a scribble (ramDiff
 * teeth), and an expiry mutant that undoes the sequence-step advance.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_029d as cand } from "../loc_029d.js";
import { loc_029d as oracle } from "../../translated/loc_029d.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const VRAM_PTR = 0x400b; // 16-bit fill cursor
const DWELL = 0x4009;
const SEQ = 0x400a;
const QHEAD = 0x40a0;
const QSLOT0 = 0x40c0; // slot addressed at head 0xc0
const CURSOR = 0x5000; // a VRAM address to blank a row into
const SCRATCH = 0x4200; // a plain work-RAM cell for the ramDiff-teeth twin

// Dwell still running: tick it and return before any expiry work.
const running = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.mem16[VRAM_PTR] = CURSOR;
  mem[DWELL] = 5;
});
// Dwell about to expire: the full advance including the queue append fires. Queue slots armed free.
const expiry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.mem16[VRAM_PTR] = CURSOR;
  mem[DWELL] = 1;
  mem[QHEAD] = 0xc0;
  for (let i = 0xc0; i <= 0xff; i++) mem[0x4000 + i] = 0xff; // free slots (bit 7 set)
});

test("EQUAL (crafted): loc_029d == oracle while the dwell is still running", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, running()), null, "loc_029d diverged on the running path");
  const a = running(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DWELL], 4, "positive control: oracle did not tick the dwell 5->4");
  console.log("  EQUAL: loc_029d == oracle (RAM/VRAM), dwell 5->4, no expiry work");
});

test("EQUAL (crafted): loc_029d == oracle on dwell expiry (advance + queue append)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expiry()), null, "loc_029d diverged on the expiry path");
  const a = expiry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DWELL], 4, "positive control: dwell tier not re-armed to 4");
  assert.equal(a.mem8[0x4008], 64, "positive control: sub-timer tier not re-armed to 64");
  assert.equal(a.mem8[QSLOT0], 0x06, "positive control: command word hi (6) not queued");
  assert.equal(a.mem8[QSLOT0 + 1], 0x00, "positive control: command word lo (0) not queued");
  assert.equal(a.mem8[QHEAD], 0xc2, "positive control: write-head not advanced past the append");
  console.log("  EQUAL: loc_029d == oracle (RAM/VRAM/OBJ), sequence advanced + command 6 queued");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const decTwice = (m) => { m.mem8[DWELL] = (m.mem8[DWELL] - 2) & 0xff; };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH] = m.mem8[SCRATCH] ^ 0xff; };
  const noAdvance = (m) => { cand(m); m.mem8[SEQ] = (m.mem8[SEQ] - 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, running()), "the no-op twin escaped (running)");
  assert.ok(ramDiff(oracle, decTwice, running()), "the decrement-by-two twin escaped (running)");
  assert.ok(ramDiff(oracle, scribble, running()), "the scribble twin escaped (ramDiff teeth)");
  assert.ok(ramDiff(oracle, noAdvance, expiry()), "the no-advance twin escaped (expiry)");
  console.log("  TEETH: no-op, decrement-by-two, scribble, no-advance all caught");
});
