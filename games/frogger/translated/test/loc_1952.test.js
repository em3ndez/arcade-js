// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1952 (Frogger frog sprite render, ROM 0x1952-0x1A01). Three column-copy loops
// blit the ROM tile groups at 0x19F6/0x19FA/0x19FE into VRAM, paint the 0x47 banner, seed corner
// tiles + (0x8007/8009/800b)=1, then jp loc_1a02. Callees loc_19e2/loc_1a02 stubbed (SP-balanced).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1952 } from "../loc_1952.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mkRom() {
  const rom = new Uint8Array(0x4000);
  rom.set([0x40, 0x43, 0x43, 0x44], 0x19f6);
  rom.set([0x45, 0x47, 0x47, 0x41], 0x19fa);
  rom.set([0x46, 0x43, 0x43, 0x42], 0x19fe);
  return rom;
}

function mk() {
  const m = new Machine(mkRom(), new Map([[0x19e2, bal], [0x1a02, bal]]));
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const v = (m, a) => m.mem.videoRam[a & 0x3ff];

function check(m) {
  assert.equal(v(m, 0xa843), 0x40, "loop1 col0 first tile = 0x40");
  assert.equal(v(m, 0xa863), 0x43, "loop1 col0 row1 (HL+0x20) = 0x43");
  assert.equal(v(m, 0xa8a3), 0x44, "loop1 col0 row3 = 0x44");
  assert.equal(v(m, 0xa8a4), 0x45, "loop2 col0 first tile = 0x45");
  assert.equal(v(m, 0xa8a5), 0x46, "loop3 col0 first tile = 0x46");
  assert.equal(v(m, 0xa8c3), 0x47, "banner tile 0x47");
  assert.equal(v(m, 0xa844), 0x41, "corner tile 0x41");
  assert.equal(v(m, 0xa845), 0x42, "corner tile 0x42");
  assert.equal(v(m, 0xaba4), 0x45, "bottom corner (HL+0x35f) tile 0x45");
  assert.equal(v(m, 0xaba5), 0x46, "bottom corner tile 0x46");
  assert.equal(r(m, 0x8007), 0x01, "(0x8007) = 1");
  assert.equal(r(m, 0x8009), 0x01, "(0x8009) = 1");
  assert.equal(r(m, 0x800b), 0x01, "(0x800b) = 1");
}

test("loc_1952: renders the frog sprite tiles + banner, tails into loc_1a02", () => {
  const m = mk();
  loc_1952(m);
  check(m);
  assert.deepEqual(m.calls, [0x19e2, 0x1a02], "home-marker blit then object-anim init");
  assert.equal(m.regs.sp, 0x8800, "inner call balanced + tail popped the caller frame");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1952.js
//   find: regs.a = 0x01;
//   repl: regs.a = 0x00;   // clears (0x8007/0x8009/0x800b) instead of setting the home flags to 1
//   expect: FAIL  ((0x8007) != 1 -- caught by check)
//   verified-anchor: the sole 0x01 immediate; A is stored only to (0x8007/0x8009/0x800b)
// Simulated by rewriting those three stores to 0 (they only ever receive 1), which is what the edit
// produces -- kept address-specific so the value-1 `push bc` when B=1 is not touched.
test("loc_1952: the contract catches a wrong home-flag value", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  const home = new Set([0x8007, 0x8009, 0x800b]);
  m.mem.write8 = (a, val, o) => ow(a, home.has(a) ? 0x00 : val, o);
  loc_1952(m);
  assert.throws(() => check(m));
});
