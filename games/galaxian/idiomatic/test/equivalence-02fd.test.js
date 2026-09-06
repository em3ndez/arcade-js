// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_02fd — memory-equivalent to the frozen oracle. Unpacks the 16-byte descriptor bitmask at 0x051b
 * into the 128-cell flag block (0x4100) and copies the 8 template bytes that follow (0x052b) into the
 * template buffer (0x4218); then clears 0x425f, sets 0x421d=1, bumps SEQUENCE_STATE (0x400a), stamps
 * 0x400b=0x96, and publishes the pointer 0x0640 into the 0x4245 slot. The advanced source pointer the
 * unpacker returns is consumed internally as the template-copy source, so a memory diff validates the
 * threading. Live-out is work RAM only; the return-stack window is masked. Teeth: no-op plus template-
 * and pointer-scribble twins; positive controls pin each write.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loadDescriptorAndAdvanceSequence as cand } from "../loadDescriptorAndAdvanceSequence.js";
import { loc_02fd as oracle } from "../../translated/loc_02fd.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const FLAG_BLOCK = 0x4100;   // 128-cell one-byte-per-bit flag block
const TEMPLATE = 0x4218;     // 8-byte template destination
const STATUS_CLR = 0x425f;   // cleared to 0
const STATUS_SET = 0x421d;   // set to 1
const SEQ_STATE = 0x400a;    // bumped by one
const COUNTER = 0x400b;      // stamped to 0x96
const CALLBACK_PTR = 0x4245; // 16-bit pointer slot
const SENTINEL = 0xaa;

// Pre-dirty every cell the routine writes so each store is demonstrable, and seed a known SEQUENCE_STATE.
const entry = () => craft((mem, m) => {
  m.push16(0x9999);
  for (let i = 0; i < 128; i++) mem[FLAG_BLOCK + i] = SENTINEL;
  for (let i = 0; i < 8; i++) mem[TEMPLATE + i] = SENTINEL;
  mem[STATUS_CLR] = SENTINEL;
  mem[STATUS_SET] = SENTINEL;
  mem[SEQ_STATE] = 2;
  mem[COUNTER] = SENTINEL;
  mem[CALLBACK_PTR] = SENTINEL;
  mem[CALLBACK_PTR + 1] = SENTINEL;
});

const noOp = () => {};
const wrongTemplate = (m) => { cand(m); m.mem8[TEMPLATE] = (m.mem8[TEMPLATE] + 1) & 0xff; };
const wrongPointer = (m) => { cand(m); m.mem16[CALLBACK_PTR] = 0; };

test("EQUAL (crafted): loc_02fd == oracle unpacks, copies, and sequences", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_02fd diverged");

  // Positive controls: the oracle rewrites each cell to its expected value.
  const a = entry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[FLAG_BLOCK], 0, "control: bit 0 of mask byte 0 (0x00) unpacked to 0");
  assert.equal(a.mem8[TEMPLATE], 0x3c, "control: template byte 0 (0x052b=0x3c) copied");
  assert.equal(a.mem8[STATUS_CLR], 0, "control: 0x425f cleared");
  assert.equal(a.mem8[STATUS_SET], 1, "control: 0x421d set");
  assert.equal(a.mem8[SEQ_STATE], 3, "control: SEQUENCE_STATE bumped 2->3");
  assert.equal(a.mem8[COUNTER], 0x96, "control: 0x400b stamped");
  assert.equal(a.mem8[CALLBACK_PTR], 0x40, "control: pointer low byte");
  assert.equal(a.mem8[CALLBACK_PTR + 1], 0x06, "control: pointer high byte");
  console.log("  EQUAL: loc_02fd == oracle (flag block + template copy + status/seq + 0x0640 pointer)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongTemplate, entry()), "the wrong-template twin escaped");
  assert.ok(ramDiff(oracle, wrongPointer, entry()), "the wrong-pointer twin escaped");
  console.log("  TEETH: no-op, wrong-template, wrong-pointer all caught (RAM)");
});
