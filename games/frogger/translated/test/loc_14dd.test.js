// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_14dd..loc_1587 (Frogger object-dispatcher arms, ROM 0x14DD-0x1597). Each arm
// loads HL/DE/IX/IY lane pointers and jp's (tail-call, no ret pushed) to a mover; loc_1532 jp's to the
// advance tail 0x15DE. The movers 0x1598/0x163e/0x15de are [B3] — stubbed as pure delegation recorders.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import * as arms from "../loc_14dd.js";

// A jp discards no return and pushes nothing, so the mover stub must NOT touch SP; it only records the
// delegation target and the register state handed to it.
function mk() {
  const noop = () => {};
  const m = new Machine(new Uint8Array(0x4000), new Map([[0x1598, noop], [0x163e, noop], [0x15de, noop]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.deleg = null;
  const oc = m.call.bind(m);
  m.call = (a, ...rest) => {
    m.deleg = { a, hl: m.regs.hl, de: m.regs.de, ix: m.regs.ix, iy: m.regs.iy };
    return oc(a, ...rest);
  };
  return m;
}

// name -> [hl, de, ix, iy, mover]
const CASES = {
  loc_14dd: [0x819b, 0x8100, 0x800c, 0x81a6, 0x1598],
  loc_14ee: [0x819c, 0x8109, 0x8010, 0x81a7, 0x163e],
  loc_14ff: [0x819d, 0x8112, 0x8014, 0x81a8, 0x1598],
  loc_1510: [0x819e, 0x811b, 0x8018, 0x81a9, 0x1598],
  loc_1521: [0x819f, 0x8124, 0x801c, 0x81aa, 0x163e],
  loc_1543: [0x81a1, 0x8136, 0x8024, 0x81ac, 0x163e],
  loc_1554: [0x81a2, 0x813f, 0x8028, 0x81ad, 0x1598],
  loc_1565: [0x81a3, 0x8148, 0x802c, 0x81ae, 0x163e],
  loc_1576: [0x81a4, 0x8151, 0x8030, 0x81af, 0x1598],
  loc_1587: [0x81a5, 0x815a, 0x8034, 0x81b0, 0x163e],
};

const checkArm = (m, hl, de, ix, iy, mover) => {
  assert.deepEqual(m.deleg, { a: mover, hl, de, ix, iy });
};

for (const [name, [hl, de, ix, iy, mover]] of Object.entries(CASES)) {
  test(`${name}: loads its lane pointers then delegates to the mover`, () => {
    const m = mk();
    arms[name](m);
    checkArm(m, hl, de, ix, iy, mover);
    assert.equal(m.regs.sp, 0x87fe, "jp pushed nothing");
    assert.equal(m.cycles, 58, "10+10+14+14+10");
  });
}

test("loc_1532: shortcut arm jp's straight to the advance tail 0x15DE", () => {
  const m = mk();
  arms.loc_1532(m);
  assert.equal(m.deleg.a, 0x15de, "delegates to 0x15de");
  assert.equal(m.regs.sp, 0x87fe, "jp pushed nothing");
  assert.equal(m.cycles, 10, "single jp");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_14dd.js
//   find: regs.iy = 0x81a6;
//   repl: regs.iy = 0x81a7;
//   expect: FAIL  (loc_14dd hands the mover the wrong IY phase pointer — caught by checkArm)
//   verified-anchor: count == 1  (the sole `regs.iy = 0x81a6` in loc_14dd.js)
// Simulated by mapping the recorded IY 0x81a6 -> 0x81a7, which is what the edit produces.
test("loc_14dd: the contract catches a wrong IY lane pointer", () => {
  const m = mk();
  const rec = m.call;
  m.call = (a, ...rest) => {
    const v = rec(a, ...rest);
    if (m.deleg && m.deleg.iy === 0x81a6) m.deleg.iy = 0x81a7;
    return v;
  };
  arms.loc_14dd(m);
  assert.throws(() => checkArm(m, ...CASES.loc_14dd));
});
