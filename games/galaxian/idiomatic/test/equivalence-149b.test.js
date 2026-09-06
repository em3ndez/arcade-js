// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_149b — memory-equivalent to the frozen oracle at ROM 0x149b. Activate a secondary object slot: all
 * its effects are RAM (consume the trigger flag, mark the slot alive, clear its state byte, inherit field 6,
 * stash the trigger index) plus a command-word append to the queue — every cell is in the state dump, so
 * ramDiff is the live-out check (the tail enqueue's HL restore is an internal artifact). Two paths:
 *   - ACTIVATE: neither live flag set -> full activation + queue append.
 *   - BAIL: a live flag already set -> nothing written.
 * EQUAL asserts ramDiff==null on both. Teeth: no-op + scribble on the activate path, and a guard-ignoring
 * twin that consumes the trigger on the bail path.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_149b as cand } from "../loc_149b.js";
import { loc_149b as oracle } from "../../translated/loc_149b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const SLOT = 0x4040;   // IY: secondary object slot
const SRC = 0x4090;    // IX: source record
const TRIG = 0x4038;   // HL: trigger flag cell (low byte 0x38 is the trigger index)
const INDEX = 0x38;
const INHERIT_VAL = 0x2a;
const QHEAD = 0x40a0;
const Q = 0x40c0;

// Slot idle (both live flags clear), a trigger flag set, source field armed, queue free.
const activate = () => craft((mem, mm) => {
  mm.regs.iy = SLOT; mm.regs.ix = SRC; mm.regs.hl = TRIG;
  mem[SLOT + 0] = 0; mem[SLOT + 1] = 0;
  mem[TRIG] = 1;
  mem[SRC + 6] = INHERIT_VAL;
  mem[QHEAD] = 0xc0;
  for (let i = 0xc0; i <= 0xff; i++) mem[0x4000 + i] = 0xff;
  mm.push16(0x9999);
});
// Slot already live (flag 0 set): the routine must bail before touching anything.
const bail = () => craft((mem, mm) => {
  mm.regs.iy = SLOT; mm.regs.ix = SRC; mm.regs.hl = TRIG;
  mem[SLOT + 0] = 1; mem[SLOT + 1] = 0;
  mem[TRIG] = 1;
  mm.push16(0x9999);
});

test("EQUAL (crafted): loc_149b == oracle activates the slot and queues the command", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, activate()), null, "loc_149b diverged on the activate path");
  const a = activate(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TRIG], 0, "positive control: trigger flag not consumed");
  assert.equal(a.mem8[SLOT + 0], 1, "positive control: slot not marked alive");
  assert.equal(a.mem8[SLOT + 2], 0, "positive control: state byte not cleared");
  assert.equal(a.mem8[SLOT + 6], INHERIT_VAL, "positive control: field 6 not inherited");
  assert.equal(a.mem8[SLOT + 7], INDEX, "positive control: trigger index not stashed");
  assert.equal(a.mem8[Q + 0], 0x01, "positive control: command word hi (1) not queued");
  assert.equal(a.mem8[Q + 1], INDEX, "positive control: command word lo (index) not queued");
  assert.equal(a.mem8[QHEAD], 0xc2, "positive control: write-head not advanced past the append");
  console.log("  EQUAL: loc_149b == oracle, slot activated + activation command queued");
});

test("EQUAL (crafted): loc_149b == oracle bails when the slot is already live", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, bail()), null, "loc_149b diverged on the bail path");
  const a = bail(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TRIG], 1, "positive control: bail must leave the trigger flag intact");
  console.log("  EQUAL: loc_149b == oracle, live slot -> nothing written");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribble = (m) => { cand(m); m.mem8[SLOT + 3] = m.mem8[SLOT + 3] ^ 0xff; };
  const ignoreGuard = (m) => { m.mem8[TRIG] = 0; }; // consumes the trigger despite the live guard
  assert.ok(ramDiff(oracle, noOp, activate()), "the no-op twin escaped (activate)");
  assert.ok(ramDiff(oracle, scribble, activate()), "the scribble twin escaped (ramDiff teeth)");
  assert.ok(ramDiff(oracle, ignoreGuard, bail()), "the guard-ignoring twin escaped (bail)");
  console.log("  TEETH: no-op, scribble, guard-ignoring all caught");
});
