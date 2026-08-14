// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1058 (Frogger frog-animation arms 1-5, ROM 0x1058-0x10DD). Each arm loads its
// sprite triple (0x827x) into A/B/C, HL from a (0x13xx) ROM pointer, DE/IX/IY immediates, stores A at
// (0x81B1) and DE at (0x8001), then tail-jumps into the shared render loop 0x0FF1 (stubbed). Arm
// loc_1058 first calls the pre-helper 0x0F8C (stubbed, SP-balanced); loc_10db is a bare jp to 0x1029.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1058, loc_107b, loc_109b, loc_10bb, loc_10db } from "../loc_1058.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; }; // a stubbed CALL/rst returns
const noop = () => {}; // a stubbed tail-jump target

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0f8c, bal], [0x0ff1, noop], [0x1029, noop]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

// Each arm: fn, src (sprite triple base), ptr (ROM word address), de/idx immediates.
const ARMS = {
  loc_1058: { fn: loc_1058, src: 0x8273, ptr: 0x13ef, de: 0x1423, idx: 0x8109, calls: [0x0f8c, 0x0ff1] },
  loc_107b: { fn: loc_107b, src: 0x8276, ptr: 0x13f1, de: 0x143b, idx: 0x8112, calls: [0x0ff1] },
  loc_109b: { fn: loc_109b, src: 0x8279, ptr: 0x13f3, de: 0x1453, idx: 0x811b, calls: [0x0ff1] },
  loc_10bb: { fn: loc_10bb, src: 0x827c, ptr: 0x13f5, de: 0x145f, idx: 0x8124, calls: [0x0ff1] },
};

const SC = 0x5a, B = 0x77, C = 0x33, PTR = 0x1c2a; // distinct probe values

function seed(m, arm) {
  m.mem.workRam[arm.src - 0x8000] = SC;
  m.mem.workRam[arm.src + 1 - 0x8000] = B;
  m.mem.workRam[arm.src + 2 - 0x8000] = C;
  m.mem.rom[arm.ptr] = PTR & 0xff;
  m.mem.rom[arm.ptr + 1] = (PTR >> 8) & 0xff;
}

function check(m, arm) {
  assert.equal(r(m, 0x81b1), SC, "(0x81b1) = sprite code");
  assert.equal(r(m, 0x8001), arm.de & 0xff, "(0x8001) lo = DE lo");
  assert.equal(r(m, 0x8002), (arm.de >> 8) & 0xff, "(0x8002) hi = DE hi");
  assert.equal(m.regs.a, SC, "A = sprite code");
  assert.equal(m.regs.b, B, "B = (src+1)");
  assert.equal(m.regs.c, C, "C = (src+2)");
  assert.equal(m.regs.hl, PTR, "HL = pattern pointer read from ROM");
  assert.equal(m.regs.de, arm.de, "DE immediate");
  assert.equal(m.regs.ix, arm.idx, "IX cursor");
  assert.equal(m.regs.iy, arm.idx, "IY cursor");
}

for (const [name, arm] of Object.entries(ARMS)) {
  test(`loc_1058: arm ${name} sets up the sprite/cursor state and jp's to 0x0ff1`, () => {
    const m = mk();
    seed(m, arm);
    arm.fn(m);
    check(m, arm);
    assert.deepEqual(m.calls, arm.calls, "expected call sequence");
  });
}

test("loc_1058: arm loc_10db is a bare jp to the sibling arm 0x1029 (10 T)", () => {
  const m = mk();
  loc_10db(m);
  assert.deepEqual(m.calls, [0x1029], "delegates to 0x1029");
  assert.equal(m.cycles, 10, "jp = 10 T");
});

test("loc_1058: arm loc_107b charges exactly 140 T (no leading call)", () => {
  const m = mk();
  seed(m, ARMS.loc_107b);
  loc_107b(m);
  // 10+7+6+7+6+7+16+10+14+14+13+20+10 (ld ix/iy are dd/fd-prefixed = base 10 + 4)
  assert.equal(m.cycles, 140, "arm body T-states");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1058.js
//   find: regs.ix = 0x8109;   (arm loc_1058, the dd-prefixed ld ix)
//   repl: regs.ix = 0x810a;
//   expect: FAIL  (the IX plot cursor passed to 0x0ff1 is off by one)
//   verified-anchor: count == 1  (the sole `regs.ix = 0x8109;` in loc_1058.js)
// IX is live-out and untouched after the load (0x0ff1 stubbed), so the mutant's whole observable is
// regs.ix == 0x810a; setting it here reproduces exactly that end-state.
test("loc_1058: the contract catches a wrong IX cursor (dd-prefixed ld ix)", () => {
  const m = mk();
  seed(m, ARMS.loc_1058);
  loc_1058(m);
  m.regs.ix = 0x810a;
  assert.throws(() => check(m, ARMS.loc_1058));
});
