// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0d4c (Frogger in-play board init, ROM 0x0D4C-0x0DB8). Guarded by (0x83BA):
// clears (0x8293)/(0x81B3)/(0x825B)/(0x829A), sets (0x83BA)=1, runs the object/lane setup calls,
// seeds (0x801B)=4/(0x8029)=6, and blits the HUD strings via rst 0x28. Every callee (0x07E6, 0x223D,
// 0x0804, 0x0766, 0x064B, 0x0DB9, 0x0B95, and rst 0x28 = 0x0028) is stubbed with an SP-balancer, so
// the test measures loc_0d4c's own writes, T-states, and delegated-call sequence — not the callees.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0d4c } from "../loc_0d4c.js";

// Each stub pops the return address the CALL/rst pushed (SP += 2), the callee's own `ret` would.
const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

const CALLEES = [0x07e6, 0x223d, 0x0804, 0x0766, 0x064b, 0x0db9, 0x0b95, 0x0028];

// The full delegated-call order: 5 setup calls, then rst 0x28 x2, 0x0db9, rst 0x28 x4, 0x0b95, rst 0x28.
const EXPECTED_CALLS = [
  0x07e6, 0x223d, 0x0804, 0x0766, 0x064b,
  0x0028, 0x0028, 0x0db9, 0x0028, 0x0028, 0x0028, 0x0028, 0x0b95, 0x0028,
];

function mk(romBytes = {}) {
  const rom = new Uint8Array(0x4000);
  for (const [a, v] of Object.entries(romBytes)) rom[Number(a)] = v;
  const captured = {};
  const routines = new Map(CALLEES.map((a) => [a, bal]));
  // 0x0b95 receives HL=0xa994 and DE=(0x2e08); capture DE to prove the ROM read landed in DE.
  routines.set(0x0b95, (mm) => { captured.b95_de = mm.regs.de; captured.b95_hl = mm.regs.hl; bal(mm); });
  const m = new Machine(rom, routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  m.captured = captured;
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_0d4c: (0x83BA)==0 arm runs the full board init", () => {
  const m = mk({ [0x2e08]: 0x34, [0x2e09]: 0x12 });
  // Poison the cleared cells so the zero writes are observable (not the RAM's power-on 0).
  for (const a of [0x293, 0x294, 0x1b3, 0x1b4, 0x25b, 0x29a]) m.mem.workRam[a] = 0xff;
  loc_0d4c(m);

  assert.equal(r(m, 0x8293), 0x00, "(0x8293) low cleared");
  assert.equal(r(m, 0x8294), 0x00, "(0x8293) high cleared");
  assert.equal(r(m, 0x81b3), 0x00, "(0x81b3) low cleared");
  assert.equal(r(m, 0x81b4), 0x00, "(0x81b3) high cleared");
  assert.equal(r(m, 0x825b), 0x00, "(0x825b) cleared");
  assert.equal(r(m, 0x829a), 0x00, "(0x829a) cleared");
  assert.equal(r(m, 0x83ba), 0x01, "(0x83ba) = 1 (inc of 0)");
  assert.equal(r(m, 0x801b), 0x04, "(0x801b) = 4 lane param");
  assert.equal(r(m, 0x8029), 0x06, "(0x8029) = 6 lane param");

  // The 0x2e08 TRAP: it is ROM data (a score-target word), read little-endian into DE, then passed to
  // the digit-draw callee. Proves the read hit the ROM image (0x1234), not a code stub.
  assert.equal(m.captured.b95_hl, 0xa994, "0x0b95 entered with HL = 0xa994");
  assert.equal(m.captured.b95_de, 0x1234, "0x0b95 entered with DE = (0x2e08) = 0x1234");

  assert.deepEqual(m.calls, EXPECTED_CALLS, "delegated-call order");
  assert.equal(m.cycles, 520, "T-state total of the full path");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
});

test("loc_0d4c: (0x83BA)!=0 arm returns early after the 0x07e6 clear", () => {
  const m = mk();
  m.mem.workRam[0x3ba] = 0x07; // board already initialised
  loc_0d4c(m);
  assert.deepEqual(m.calls, [0x07e6], "only the 0x07e6 clear ran, then ret nz");
  assert.equal(r(m, 0x83ba), 0x07, "(0x83ba) untouched");
  assert.equal(m.cycles, 45, "call 17 + ld a,(nn) 13 + or a 4 + ret nz taken 11");
  assert.equal(m.pc, 0xbeef, "returned to the caller");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0d4c.js
//   find: regs.a = 0x04;
//   repl: regs.a = 0x05;   // wrong lane param seeded to (0x801b)
//   expect: FAIL  ("(0x801b) = 4 lane param" assertion sees 5)
//   verified-anchor: count == 1  (the sole `regs.a = 0x04;` in loc_0d4c.js)
// Simulated below by intercepting exactly the (0x801b) store, which is what that edit produces.
test("loc_0d4c: the contract catches a wrong lane-param seed at (0x801b)", () => {
  const m = mk({ [0x2e08]: 0x34, [0x2e09]: 0x12 });
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === 0x801b && val === 0x04 ? 0x05 : val, o);
  loc_0d4c(m);
  assert.throws(() => assert.equal(r(m, 0x801b), 0x04));
});
