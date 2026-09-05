// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1819 — memory-equivalent to the frozen oracle at ROM 0x1819. A sound-driver sequence tick with
 * four paths, all with memory live-outs only (A/HL are scratch, never read back):
 *   - ARM: gate open (0x4006 bit0 set), selector 0x41df == 6, not already active (0x41cd bit0 clear)
 *     -> raise 0x41cf=1, 0x41d6=1 and publish the 16-bit pointer 0x1ebd at 0x41d3.
 *   - DELEGATE: selector != 6 -> the 0x16 dispatch arm (its own writes; ramDiff covers them).
 *   - GATE CLOSED: 0x4006 bit0 clear -> write nothing.
 *   - ALREADY ACTIVE: selector 6 but 0x41cd bit0 set -> write nothing.
 * EQUAL asserts ramDiff==null on each. Teeth (arm path): no-op, wrong-pointer, and a gate-ignoring twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_1819 as cand } from "../loc_1819.js";
import { loc_1819 as oracle } from "../../translated/loc_1819.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const GATE = 0x4006;
const SELECTOR = 0x41df;
const ACTIVE = 0x41cd;
const SUBFLAG = 0x41cf;
const COMPANION = 0x41d6;
const PTR = 0x41d3;      // 16-bit sequence-data pointer
const ARMED_PTR = 0x1ebd;

// Arm path: gate open, selector 6, not active; foreign values in the armed cells so writes are observable.
const armEntry = () => craft((mem, mm) => {
  mem[GATE] = 1; mem[SELECTOR] = 6; mem[ACTIVE] = 0;
  mem[SUBFLAG] = 0x55; mem[COMPANION] = 0x55; mem[PTR] = 0x55; mem[PTR + 1] = 0x55;
  mm.push16(0x9999);
});
const delegateEntry = () => craft((mem, mm) => { mem[GATE] = 1; mem[SELECTOR] = 0x16; mm.push16(0x9999); });
const gateClosed = () => craft((mem, mm) => { mem[GATE] = 0; mem[SELECTOR] = 6; mm.push16(0x9999); });
const activeEntry = () => craft((mem, mm) => { mem[GATE] = 1; mem[SELECTOR] = 6; mem[ACTIVE] = 1; mm.push16(0x9999); });

test("EQUAL (crafted): loc_1819 == oracle across all four paths", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, armEntry()), null, "arm path diverged");
  assert.equal(ramDiff(oracle, cand, delegateEntry()), null, "delegate path diverged");
  assert.equal(ramDiff(oracle, cand, gateClosed()), null, "gate-closed path diverged");
  assert.equal(ramDiff(oracle, cand, activeEntry()), null, "already-active path diverged");
  // Non-vacuous: the arm path really raises the flags and publishes the pointer.
  const a = armEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[SUBFLAG], 1, "positive control: sub-flag not raised");
  assert.equal(a.mem8[COMPANION], 1, "positive control: companion not raised");
  assert.equal(a.mem8[PTR] | (a.mem8[PTR + 1] << 8), ARMED_PTR, "positive control: pointer not published");
  console.log("  EQUAL: loc_1819 == oracle — arm/delegate/gate-closed/already-active");
});

test("TEETH: broken twins are caught on the arm path", { skip }, () => {
  const noOp = () => {};
  const wrongPtr = (m) => { m.mem8[SUBFLAG] = 1; m.mem8[COMPANION] = 1; m.mem8[PTR] = 0xdf; m.mem8[PTR + 1] = 0x1e; };
  const ignoreGate = (m) => { m.mem8[SUBFLAG] = 1; }; // writes even when the gate is closed
  assert.ok(ramDiff(oracle, noOp, armEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongPtr, armEntry()), "the wrong-pointer twin escaped");
  assert.ok(ramDiff(oracle, ignoreGate, gateClosed()), "the gate-ignoring twin escaped");
  console.log("  TEETH: no-op, wrong-pointer, gate-ignoring all caught");
});
