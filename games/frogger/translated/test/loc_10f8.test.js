// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_10f8 (Frogger frog-animation arms 6-10, ROM 0x10F8-0x1197). Siblings of the
// 0x1058 set: each loads its sprite triple (0x828x) into A/B/C, HL from a (0x13xx) ROM pointer, DE/IX/IY
// immediates, stores A at (0x81B1) and DE at (0x8001), then tail-jumps into the render loop 0x0FF1
// (stubbed). No arm has a leading call.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_10f8, loc_1118, loc_1138, loc_1158, loc_1178 } from "../loc_10f8.js";

const noop = () => {}; // stubbed tail-jump target

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x0ff1, noop]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

const ARMS = {
  loc_10f8: { fn: loc_10f8, src: 0x8282, ptr: 0x13f9, de: 0x149f, idx: 0x8136 },
  loc_1118: { fn: loc_1118, src: 0x8285, ptr: 0x13fb, de: 0x14a7, idx: 0x813f },
  loc_1138: { fn: loc_1138, src: 0x8288, ptr: 0x13fd, de: 0x14ab, idx: 0x8148 },
  loc_1158: { fn: loc_1158, src: 0x828b, ptr: 0x13ff, de: 0x14af, idx: 0x8151 },
  loc_1178: { fn: loc_1178, src: 0x828e, ptr: 0x1401, de: 0x14b3, idx: 0x815a },
};

const SC = 0x5a, B = 0x77, C = 0x33, PTR = 0x1c2a;

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
  test(`loc_10f8: arm ${name} sets up the sprite/cursor state and jp's to 0x0ff1`, () => {
    const m = mk();
    seed(m, arm);
    arm.fn(m);
    check(m, arm);
    assert.deepEqual(m.calls, [0x0ff1], "delegates to the render loop");
  });
}

test("loc_10f8: arm loc_10f8 charges exactly 140 T", () => {
  const m = mk();
  seed(m, ARMS.loc_10f8);
  loc_10f8(m);
  // 10+7+6+7+6+7+16+10+14+14+13+20+10 (ld ix/iy dd/fd-prefixed = base 10 + 4)
  assert.equal(m.cycles, 140, "arm body T-states");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_10f8.js
//   find: regs.iy = 0x8136;   (arm loc_10f8, the fd-prefixed ld iy)
//   repl: regs.iy = 0x8137;
//   expect: FAIL  (the IY plot cursor passed to 0x0ff1 is off by one)
//   verified-anchor: count == 1  (the sole `regs.iy = 0x8136;` in loc_10f8.js)
// IY is live-out and untouched after the load (0x0ff1 stubbed), so the mutant's whole observable is
// regs.iy == 0x8137; setting it here reproduces exactly that end-state.
test("loc_10f8: the contract catches a wrong IY cursor (fd-prefixed ld iy)", () => {
  const m = mk();
  seed(m, ARMS.loc_10f8);
  loc_10f8(m);
  m.regs.iy = 0x8137;
  assert.throws(() => check(m, ARMS.loc_10f8));
});
