// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2d88 (Frogger MODE-2 intro, ROM 0x2D88-0x2DC8). Sets (0x83D8)=0xFF, calls
// loc_0766, seeds (0x829B)=0/(0x8021)=0/(0x801B)=5/(0x802B)=3, blits a title strip via rst 0x28
// (stubbed); if (0x83E4) >= 10 rets, else calls loc_0ba9 and blits three more strips. Callees stubbed
// with an SP-balancer + m.calls asserts.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2d88 } from "../loc_2d88.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const stubs = new Map([[0x0028, bal], [0x0766, bal], [0x0ba9, bal]]);
  const m = new Machine(new Uint8Array(0x4000), stubs);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

function checkSeeds(m) {
  assert.equal(r(m, 0x83d8), 0xff, "(0x83d8) = 0xff");
  assert.equal(r(m, 0x829b), 0x00, "(0x829b) = 0");
  assert.equal(r(m, 0x8021), 0x00, "(0x8021) = 0");
  assert.equal(r(m, 0x801b), 0x05, "(0x801b) = 5");
  assert.equal(r(m, 0x802b), 0x03, "(0x802b) = 3");
}

test("loc_2d88: (0x83e4) < 10 blits all four strips (rst 0x28 x4)", () => {
  const m = mk();
  m.mem.workRam[0x3e4] = 0x00; // (0x83e4) = 0 -> ret nc not taken
  loc_2d88(m);
  checkSeeds(m);
  assert.deepEqual(
    m.calls,
    [0x0766, 0x0028, 0x0ba9, 0x0028, 0x0028, 0x0028],
    "loc_0766, first strip, loc_0ba9, then three more strips",
  );
  assert.equal(m.cycles, 291, "full-path T-states");
  assert.equal(m.pc, 0xbeef, "returned to caller");
});

test("loc_2d88: (0x83e4) >= 10 rets after the first strip", () => {
  const m = mk();
  m.mem.workRam[0x3e4] = 0x0a; // (0x83e4) = 10 -> ret nc taken
  loc_2d88(m);
  checkSeeds(m);
  assert.deepEqual(m.calls, [0x0766, 0x0028], "loc_0766 + one strip, then ret");
  assert.equal(m.cycles, 176, "early-ret T-states (ret nc taken = 11)");
  assert.equal(m.pc, 0xbeef, "returned to caller");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2d88.js
//   find: mem.write8(regs.hl, 0xff);
//   repl: mem.write8(regs.hl, 0xfe);
//   expect: FAIL  (writes 0xfe to 0x83d8 instead of 0xff -- caught by checkSeeds)
//   verified-anchor: count == 1  (the sole ld (hl),0xff in loc_2d88.js)
// Simulated by intercepting exactly the 0x83d8<-0xff store, which is what the edit produces.
test("loc_2d88: the contract catches a wrong (0x83d8) seed", () => {
  const m = mk();
  m.mem.workRam[0x3e4] = 0x00;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === 0x83d8 && val === 0xff ? 0xfe : val, o);
  loc_2d88(m);
  assert.throws(() => checkSeeds(m));
});
