// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_219b — crafted-entry equivalence vs the frozen composite draw at ROM 0x219b.
 * Blanks a 4x4 tile block, then draws a 2x2 block (seed 0x60) over it at 0x51fc. The tile writes land
 * in VRAM (ramDiff), and the live-outs the tail passes up are registers A and HL (advanced tile /
 * pointer) — checked with a regDiff helper since ramDiff is register-blind. (DE is left as a scratch
 * artifact of the blank loop and is not a live-out anyone reads, so it is not compared.)
 * Teeth: no-op, blank-only, wrong-seed (VRAM), and a wrong-register twin (regDiff).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { blank4x4AndDraw2x2Icon as cand } from "../blank4x4AndDraw2x2Icon.js";
import { loc_219b as oracle } from "../../translated/loc_219b.js";
import { blankTileBlock4x4 } from "../blankTileBlock4x4.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const entry = () => craft((mem, mm) => { mm.push16(0x9999); });

// null == equivalent on the register live-outs A and HL.
function regDiff(twin, e) {
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.a !== b.regs.a) return `A: ${a.regs.a} vs ${b.regs.a}`;
  if (a.regs.hl !== b.regs.hl) return `HL: ${a.regs.hl} vs ${b.regs.hl}`;
  return null;
}

test("EQUAL (crafted): loc_219b == oracle on VRAM and registers", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_219b diverged in VRAM");
  assert.equal(regDiff(cand, entry()), null, "loc_219b diverged on the A/HL live-out");
  const a = entry(); oracle(a);
  assert.equal(a.mem8[0x51da], 0x40, "positive control: block not blanked");
  assert.equal(a.mem8[0x51fc], 0x60, "positive control: 2x2 top pair not drawn");
  assert.equal(a.mem8[0x51fd], 0x61, "positive control: 2x2 top pair not drawn");
  assert.equal(a.mem8[0x521c], 0x62, "positive control: 2x2 bottom pair not drawn");
  assert.equal(a.mem8[0x521d], 0x63, "positive control: 2x2 bottom pair not drawn");
  assert.equal(a.regs.a, 0x64, "positive control: tile live-out wrong");
  assert.equal(a.regs.hl, 0x523c, "positive control: pointer live-out wrong");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const blankOnly = (m) => { blankTileBlock4x4(m); };           // never draws the 2x2
  const wrongSeed = (m) => { cand(m); m.mem8[0x51fc] ^= 0xff; }; // wrong drawn tile
  const wrongReg = (m) => { cand(m); m.regs.a = 0; m.regs.hl = 0; }; // VRAM ok, registers wrong
  assert.ok(ramDiff(oracle, noOp, entry()), "no-op twin escaped (VRAM)");
  assert.ok(ramDiff(oracle, blankOnly, entry()), "blank-only twin escaped (VRAM)");
  assert.ok(ramDiff(oracle, wrongSeed, entry()), "wrong-seed twin escaped (VRAM)");
  assert.ok(regDiff(wrongReg, entry()), "wrong-register twin escaped (regDiff)");
});
