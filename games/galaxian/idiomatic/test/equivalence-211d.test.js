// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_211d — crafted-entry equivalence vs the frozen 2-bit fold at ROM 0x211d.
 * The sole live-out is register B; the routine writes no RAM (A and the flags are saved and restored).
 * So EQUAL is asserted on register B (RAM checked equal too, stack window masked). Two paths:
 *   - in range (B < 0x70): B = (swap-nibbles(status byte 0x425f) + B + C) & 3 (status 0x12: swap=0x21).
 *   - out of range (B >= 0x70): B saturates to 0x80.
 * The seed lays one return word (the routine balances its own push/pop af). Teeth: no-op, no-swap,
 * wrong-mask, and clamp-ignoring twins each leave a wrong B; a RAM-scribble twin proves ramDiff has teeth.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { computeTileVariantFromTimer as cand } from "../computeTileVariantFromTimer.js";
import { loc_211d as oracle } from "../../translated/loc_211d.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const STATUS = 0x425f;
const SCRATCH_RAM = 0x4100; // a plain work-RAM cell for the ramDiff-teeth twin

// In range: B=3, C=1, status 0x12 -> swap 0x21 (33) -> 33 + 3 + 1 = 37 -> B = 37 & 3 = 1.
const inRange = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.b = 3;
  mm.regs.c = 1;
  mem[STATUS] = 0x12;
});

// Out of range: B=0x70 -> saturate to 0x80.
const outOfRange = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.b = 0x70;
  mm.regs.c = 0;
  mem[STATUS] = 0x12;
});

// The live-out is register B; also require RAM (stack masked) untouched between oracle and twin.
function bDiff(twin, e) {
  const ram = ramDiff(oracle, twin, e);
  if (ram) return `RAM ${ram}`;
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.b !== b.regs.b) return `B: ${a.regs.b} vs ${b.regs.b}`;
  return null;
}

test("EQUAL (crafted): loc_211d == oracle on register B, in range", { skip }, () => {
  assert.equal(bDiff(cand, inRange()), null, "the in-range fold diverged");
  const a = inRange().clone(); a.routines = STUBS; oracle(a);
  assert.equal(a.regs.b, 1, "positive control: oracle folded B 3 -> 1");
  assert.equal(a.regs.a, inRange().regs.a, "positive control: A preserved");
  console.log("  EQUAL: in range, B 3->1, A preserved");
});

test("EQUAL (crafted): loc_211d == oracle on register B, out of range", { skip }, () => {
  assert.equal(bDiff(cand, outOfRange()), null, "the saturation diverged");
  const a = outOfRange().clone(); a.routines = STUBS; oracle(a);
  assert.equal(a.regs.b, 0x80, "positive control: oracle saturated B to 0x80");
  console.log("  EQUAL: out of range, B 0x70->0x80");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noSwap = (m) => { const b = m.regs.b, c = m.regs.c; m.regs.b = (m.mem8[STATUS] + b + c) & 0x03; };
  const wrongMask = (m) => { const s = m.mem8[STATUS], b = m.regs.b, c = m.regs.c; m.regs.b = (((s >> 4) | (s << 4)) + b + c) & 0x07; };
  const ignoreClamp = (m) => { const s = m.mem8[STATUS], b = m.regs.b, c = m.regs.c; m.regs.b = (((s >> 4) | (s << 4)) + b + c) & 0x03; };
  const scribble = (m) => { cand(m); m.mem8[SCRATCH_RAM] = m.mem8[SCRATCH_RAM] ^ 0xff; };
  assert.ok(bDiff(noOp, inRange()), "no-op twin escaped");
  assert.ok(bDiff(noSwap, inRange()), "no-swap twin escaped");
  assert.ok(bDiff(wrongMask, inRange()), "wrong-mask twin escaped");
  assert.ok(bDiff(ignoreClamp, outOfRange()), "clamp-ignoring twin escaped");
  assert.ok(ramDiff(oracle, scribble, inRange()), "scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: no-op, no-swap, wrong-mask, clamp-ignoring (B) + scribble (RAM) all caught");
});
