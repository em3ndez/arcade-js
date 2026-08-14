// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_26a6 (Frogger fly/insect collision animation, ROM 0x26A6-0x272E; IX/IY unit).
// While no eat is in progress (0x8134==0) it re-arms the tongue via the folded init (block_270d), runs the
// mover (call 0x272f), and box-tests the fly (0x8044/0x8040) against the frog row window (0x8047); on a hit
// it latches (0x8134)=1 + fires rst 0x18. block_26f0 copies the live fly X/Y (IX=0x8044) to the sprite
// (IY=0x8040). Callees stubbed: 0x0018 (rst), 0x272f (mover), 0x27b3 (eat-retract jp-delegate tail).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_26a6 } from "../loc_26a6.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const stubs = new Map([
    [0x0018, bal],
    [0x272f, bal],
    [0x27b3, (mm) => mm.ret()],
  ]);
  const m = new Machine(new Uint8Array(0x4000), stubs);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...rest) => { m.calls.push(a); return oc(a, ...rest); };
  return m;
}
const r = (m, a) => m.mem.read8(a);

test("loc_26a6: eat in progress (0x8134!=0) -> block_26f0 copies live fly X/Y to the sprite; 186 T", () => {
  const m = mk();
  m.mem.workRam[0x8134 - 0x8000] = 0x01;
  m.mem.workRam[0x8044 - 0x8000] = 0xaa;
  m.mem.workRam[0x8045 - 0x8000] = 0xbb;
  m.mem.workRam[0x8047 - 0x8000] = 0x30;
  loc_26a6(m);
  assert.equal(r(m, 0x8040), 0xaa, "sprite X = live X");
  assert.equal(r(m, 0x8041), 0xbb, "sprite code = live code");
  assert.equal(r(m, 0x8043), 0x32, "sprite Y = live Y + 2");
  assert.deepEqual(m.calls, [], "no callee reached");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
  assert.equal(m.cycles, 186, "dispatch 27 + IX/IY copy 159");
});

test("loc_26a6: idle fly -> folded init arms the tongue, then delegates to the eat-retract tail", () => {
  const m = mk();
  m.mem.workRam[0x8134 - 0x8000] = 0x00; // no eat in progress
  m.mem.workRam[0x811c - 0x8000] = 0x00; // (ix+1) clear -> call z,0x270d taken
  m.mem.workRam[0x8135 - 0x8000] = 0x00; // tongue not armed -> init proceeds
  m.mem.workRam[0x813d - 0x8000] = 0x00; // init's inc makes it 1 -> bit 0 set -> delegate
  loc_26a6(m);
  assert.equal(r(m, 0x813d), 0x01, "tongue phase inc'd");
  assert.equal(r(m, 0x8041), 0x1e, "arm frame lo");
  assert.equal(r(m, 0x8042), 0x04, "arm frame mid");
  assert.equal(r(m, 0x8043), 0x60, "arm frame hi");
  assert.equal(r(m, 0x8135), 0x01, "tongue armed flag");
  assert.equal(r(m, 0x833d), 0x01, "direction seed");
  assert.equal(r(m, 0x833e), 0x3c, "tongue timer seed");
  assert.deepEqual(m.calls, [0x27b3], "delegated to the eat-retract tail");
  assert.equal(m.pc, 0xbeef, "tail rets to loc_26a6's caller");
});

test("loc_26a6: fly inside the row+X window -> mover + latch eat + rst 0x18, then sprite copy", () => {
  const m = mk();
  m.mem.workRam[0x8134 - 0x8000] = 0x00; // no eat yet
  m.mem.workRam[0x811c - 0x8000] = 0x01; // (ix+1) set -> skip the init
  m.mem.workRam[0x813d - 0x8000] = 0x00; // bit 0 clear -> no delegate
  m.mem.workRam[0x8135 - 0x8000] = 0x01; // armed -> jr nz,block_26c7
  m.mem.workRam[0x8047 - 0x8000] = 0x60; // frog Y inside [0x5a,0x68)
  m.mem.workRam[0x8040 - 0x8000] = 0x40; // frog X
  m.mem.workRam[0x8044 - 0x8000] = 0x41; // fly X inside +-4
  m.mem.workRam[0x8045 - 0x8000] = 0x55; // live code
  loc_26a6(m);
  assert.equal(r(m, 0x8134), 0x01, "eat latched");
  assert.equal(r(m, 0x8040), 0x41, "sprite X = fly X");
  assert.equal(r(m, 0x8041), 0x55, "sprite code");
  assert.equal(r(m, 0x8043), 0x62, "sprite Y = 0x60 + 2");
  assert.equal(r(m, 0x8135), 0x01, "init skipped (unchanged)");
  assert.deepEqual(m.calls, [0x272f, 0x0018], "mover then rst 0x18");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_26a6.js
//   find: regs.add(0x02);   repl: regs.add(0x03);
//   expect: FAIL  (sprite Y becomes live Y + 3 -- caught by the first test)
//   verified-anchor: count == 1  (the sole `add a,0x02` in loc_26a6.js)
// Simulated by intercepting the 0x32 store to (0x8043) and forcing 0x33.
test("loc_26a6: the contract catches a wrong sprite-Y offset", () => {
  const m = mk();
  m.mem.workRam[0x8134 - 0x8000] = 0x01;
  m.mem.workRam[0x8047 - 0x8000] = 0x30;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, a === 0x8043 && v === 0x32 ? 0x33 : v, o);
  loc_26a6(m);
  assert.throws(() => assert.equal(r(m, 0x8043), 0x32));
});
