// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_2a6a (Frogger IX sprite-object arm, ROM 0x2A6A-0x2AF2) and its folded second
// entry loc_2ae6 (0x2AE6-0x2AF2, the shared tail loc_2af3 also calls). Callees stubbed: the blit helper
// 0x0aee (3 sites, returns a byte in A) and rst 0x18 -> 0x0018. Drives the place-relative-to-frog-X
// branch (0x8276 walk + djnz loop -> block_2abe), the park-off-screen branch (block_2aaa), and the
// (0x8371) one-shot in the tail.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_2a6a, loc_2ae6 } from "../loc_2a6a.js";

const IX = 0x8500;

// SP-balancer stubs. 0x0aee pops its return (rst-less CALL) and hands back a queued byte in A; 0x0018
// pops the rst return. Both assert they entered with the pushed frame on top.
function mk(blitReturns = []) {
  const returns = [...blitReturns];
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.ix = IX;
  m.calls = [];
  m.routines.set(0x0aee, (mm) => {
    const ret = mm.mem.read16(mm.regs.sp);
    assert.ok(ret >= 0x2a00 && ret <= 0x2b00, "0x0aee return is inside loc_2a6a");
    mm.regs.sp = (mm.regs.sp + 2) & 0xffff;
    mm.regs.a = returns.length ? returns.shift() : 0x00;
  });
  m.routines.set(0x0018, (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; });
  m.routines.set(0x2ae6, loc_2ae6); // the folded tail resolves through the seam on fall-through
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const w = (m, a) => m.mem.workRam[a - 0x8000];
const setIx = (m, d, v) => { m.mem.workRam[IX + d - 0x8000] = v; };
const setAbs = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };

// Bring the arm to the blit sites: armed (0x83B7>=3), spawn timer just expired, object idle.
function arm(m) {
  setAbs(m, 0x83b7, 0x03);
  setIx(m, 0x0a, 0x01); // dec -> 0
  setIx(m, 0x06, 0x00); // idle
}

test("loc_2a6a: not armed (0x83B7<3) -> ret c", () => {
  const m = mk();
  setAbs(m, 0x83b7, 0x02);
  loc_2a6a(m);
  assert.deepEqual(m.calls, [], "no blit before the arm gate");
  assert.equal(m.cycles, 13 + 7 + 11, "ld a,(nn)13 + cp 7 + ret c taken 11");
});

test("loc_2a6a: spawn timer live -> ret nz", () => {
  const m = mk();
  setAbs(m, 0x83b7, 0x03);
  setIx(m, 0x0a, 0x05); // dec -> 4 != 0
  loc_2a6a(m);
  assert.deepEqual(m.calls, [], "no blit while the timer counts");
  assert.equal(w(m, IX + 0x0a), 0x04, "timer decremented");
});

test("loc_2a6a: places the object relative to frog X (block_2abe), then fires the tail", () => {
  // 1st blit 0x50 clears the cp-b range gate; 2nd blit 0x01 (and 3 != 0) enters the 0x8276 walk.
  const m = mk([0x50, 0x01]);
  arm(m);
  setAbs(m, 0x8276, 0x04); // >>2 -> 0x01, +0x24 -> d=0x25
  setAbs(m, 0x8278, 0x02); // b = loop count 2
  setAbs(m, 0x8014, 0x80); // frog X; 0x80 - 0x10 = 0x70
  setAbs(m, 0x8371, 0x00); // tail one-shot not yet fired
  loc_2a6a(m);
  // loop: 0x70 -0x40 -0x25 = 0x0b (b:2->1); 0x0b -0x40 -> carry -> block_2abe with A=0x0b restored.
  assert.equal(w(m, IX + 0x02), 0x80, "(ix+0x02) = frog X");
  assert.equal(w(m, IX + 0x01), 0x75, "(ix+0x01) = frogX - b(0x0b)");
  assert.equal(w(m, IX + 0x00), 0xb5, "(ix+0x00) = that + c(0x40)");
  assert.equal(w(m, IX + 0x04), 0x4e, "sprite code 0x4e");
  assert.equal(w(m, IX + 0x05), 0x80, "flip bit");
  assert.equal(w(m, IX + 0x03), 0x00, "x-fraction cleared");
  assert.equal(w(m, IX + 0x06), 0x01, "object now active");
  assert.equal(w(m, IX + 0x08), 0x0b, "frame timer seeded");
  assert.equal(w(m, IX + 0x09), 0x08, "move timer seeded");
  assert.equal(w(m, 0x8371), 0x01, "tail raised the one-shot");
  assert.deepEqual(m.calls, [0x0aee, 0x0aee, 0x2ae6, 0x0018], "2 blits + fall-through to the tail + rst 0x18");
});

test("loc_2a6a: (A&3)==0 parks the object off-screen (block_2aaa)", () => {
  // 1st blit 0x50 passes the range gate; 2nd blit 0x00 -> and 3 == 0 -> block_2aaa; 3rd blit 0x00 ->
  // rrca -> no carry -> park path.
  const m = mk([0x50, 0x00, 0x00]);
  arm(m);
  setAbs(m, 0x8371, 0x00);
  loc_2a6a(m);
  assert.equal(w(m, IX + 0x04), 0x7e, "park sprite code 0x7e");
  assert.equal(w(m, IX + 0x05), 0x00, "flip cleared");
  assert.equal(w(m, IX + 0x03), 0xf0, "parked x = 0xf0");
  assert.equal(w(m, IX + 0x06), 0x01, "active");
  assert.deepEqual(m.calls, [0x0aee, 0x0aee, 0x0aee, 0x2ae6, 0x0018], "3 blits + fall-through to the tail + rst");
});

test("loc_2ae6: one-shot not fired -> latch (0x8371) and queue sound 0x90", () => {
  const m = mk();
  setAbs(m, 0x8371, 0x00);
  loc_2ae6(m);
  assert.equal(w(m, 0x8371), 0x01, "one-shot latched");
  assert.deepEqual(m.calls, [0x0018], "rst 0x18 queued the sound");
});

test("loc_2ae6: already fired -> ret nz, no write, no sound, 28 T", () => {
  const m = mk();
  setAbs(m, 0x8371, 0x05);
  loc_2ae6(m);
  assert.equal(w(m, 0x8371), 0x05, "unchanged");
  assert.deepEqual(m.calls, [], "no sound");
  assert.equal(m.cycles, 28, "ld a,(nn)13 + or a 4 + ret nz taken 11");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_2a6a.js
//   find: regs.sub(0x10);
//   repl: regs.sub(0x11);
//   expect: FAIL  (the frog-X placement base shifts by 1, so (ix+0x00..0x02) diverge — caught by the
//                  "places the object relative to frog X" test)
//   verified-anchor: count == 1  (the sole sub 0x10 in loc_2a6a.js)
