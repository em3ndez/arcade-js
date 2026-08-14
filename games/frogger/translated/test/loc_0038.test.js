// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter + mutation test for loc_0038 (rst 0x38 screen-clear, 0x0038-0x004E): fills VRAM
// 0xA800-0xABFF with tile 0x10 (D=0x20 rows, per-row C=0x15 djnz delay); 2,271,097 T. The delay
// writes nothing, so a mistimed djnz is VRAM-invisible and only the cycle total catches it.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0038 } from "../loc_0038.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  return m;
}

function collect(m) {
  let all10 = true;
  for (let i = 0; i < 0x400; i++) if (m.mem.videoRam[i] !== 0x10) all10 = false;
  return { cycles: m.cycles, all10, hl: m.regs.hl, d: m.regs.d, e: m.regs.e };
}

function checkSpec(res) {
  assert.equal(res.all10, true, "every VRAM byte cleared to tile 0x10");
  assert.equal(res.cycles, 2271097, "T-state total (rows + per-row busy delay)");
  assert.equal(res.hl, 0xac00, "HL ends one past the tilemap (0xAC00)");
  assert.equal(res.d, 0, "row counter D exhausted");
  assert.equal(res.e, 0x10, "fill tile E preserved (0x10)");
}

test("loc_0038: clears the 0x400-byte tilemap to 0x10; 2,271,097 T", () => {
  const m = mk();
  loc_0038(m);
  checkSpec(collect(m));
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0038.js
//   find: m.step(0x0046, 13); // djnz 0x0046 (taken)
//   repl: m.step(0x0046, 12); // djnz 0x0046 (taken)
//   expect: FAIL  (undercharges the inner-delay djnz by 1 T -- the delay writes no
//                  memory, so VRAM stays identical and only the cycle total catches it)
//   verified-anchor: count == 1  (the inner busy-delay djnz taken arm)
test("loc_0038: the cycle assertion catches a mistimed (state-invisible) delay djnz", () => {
  const m = mk();
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0046 && t === 13 ? 12 : t);
  loc_0038(m);
  const res = collect(m);
  assert.equal(res.all10, true, "VRAM is UNCHANGED by the timing mutation (state-invisible)");
  assert.throws(() => checkSpec(res), /T-state total/);
});
