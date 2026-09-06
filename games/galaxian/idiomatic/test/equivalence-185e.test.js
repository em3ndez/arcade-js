// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_185e — memory-equivalent to the frozen oracle at ROM 0x185e.
 * Reads the high byte H (register). H==0 -> idle. Otherwise it stores H-1 to 0x41c8 and stages the
 * pitch/flag pair: 0x41c1 <- (selector - 1) mod 256 and 0x41c0 <- 1, where the selector is 129 when
 * bit2 of H-1 is set, else 0. All live-outs are work RAM, so ramDiff covers them. Three paths:
 *   IDLE (H==0): the sentinels are left untouched.
 *   BIT2 CLEAR (H=3 -> H-1=2): pitch 0xff, flag 1, high byte 2.
 *   BIT2 SET   (H=6 -> H-1=5): pitch 128, flag 1, high byte 5.
 * Teeth: no-op + wrong-value + flag-not-raised twins on a write path, and a writes-anyway twin on IDLE.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { pulseSoundToneFromCountdown as cand } from "../pulseSoundToneFromCountdown.js";
import { loc_185e as oracle } from "../../translated/loc_185e.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const HIGH_BYTE = 0x41c8;
const PITCH = 0x41c1;
const FLAG = 0x41c0;
const S_HIGH = 0xaa, S_PITCH = 0xbb, S_FLAG = 0xcc; // sentinels so writes (and non-writes) are observable

const seedH = (h) => craft((mem, m) => {
  mem[HIGH_BYTE] = S_HIGH; mem[PITCH] = S_PITCH; mem[FLAG] = S_FLAG;
  m.regs.h = h;
  m.push16(0x9999);
});

const idle = () => seedH(0);
const bit2clear = () => seedH(3);  // H-1 = 2 -> bit2 clear
const bit2set = () => seedH(6);    // H-1 = 5 -> bit2 set

test("EQUAL (crafted): loc_185e == oracle idles when H is zero", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, idle()), null, "idle path diverged");
  const e = idle(); oracle(e);
  assert.equal(e.mem8[HIGH_BYTE], S_HIGH, "positive control: high byte untouched");
  assert.equal(e.mem8[FLAG], S_FLAG, "positive control: flag untouched");
  console.log("  EQUAL: idle (H==0)");
});

test("EQUAL (crafted): loc_185e == oracle, bit2 clear -> pitch 0xff", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, bit2clear()), null, "bit2-clear path diverged");
  const e = bit2clear(); oracle(e);
  assert.equal(e.mem8[HIGH_BYTE], 2, "positive control: high byte = H-1");
  assert.equal(e.mem8[PITCH], 0xff, "positive control: pitch = 0-1 mod 256");
  assert.equal(e.mem8[FLAG], 1, "positive control: flag raised");
  console.log("  EQUAL: bit2 clear (pitch 0xff)");
});

test("EQUAL (crafted): loc_185e == oracle, bit2 set -> pitch 128", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, bit2set()), null, "bit2-set path diverged");
  const e = bit2set(); oracle(e);
  assert.equal(e.mem8[HIGH_BYTE], 5, "positive control: high byte = H-1");
  assert.equal(e.mem8[PITCH], 128, "positive control: pitch = 129-1");
  assert.equal(e.mem8[FLAG], 1, "positive control: flag raised");
  console.log("  EQUAL: bit2 set (pitch 128)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongPitch = (m) => { m.mem8[HIGH_BYTE] = 5; m.mem8[PITCH] = 0x7f; m.mem8[FLAG] = 1; }; // 0x7f not 128
  const noFlag = (m) => { m.mem8[HIGH_BYTE] = 5; m.mem8[PITCH] = 128; };                        // flag left sentinel
  const writesAnyway = (m) => { m.mem8[FLAG] = 1; };                                            // must idle when H==0
  assert.ok(ramDiff(oracle, noOp, bit2set()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongPitch, bit2set()), "the wrong-pitch twin escaped");
  assert.ok(ramDiff(oracle, noFlag, bit2set()), "the flag-not-raised twin escaped");
  assert.ok(ramDiff(oracle, writesAnyway, idle()), "the writes-on-idle twin escaped");
  console.log("  TEETH: no-op, wrong-pitch, flag-not-raised, writes-on-idle all caught");
});
