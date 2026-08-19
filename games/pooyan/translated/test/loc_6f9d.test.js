// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_6f9d (ROM 0x6f9d-0x6fec): level-intro phase 4. Pins the ANTI-TAMPER MATCH
// path: with flat RAM the 0x44-byte 0x6ac5-vs-0x6fed compare all-matches, so it runs 0x0f44 + rst 0x38.
// The compare loop's `inc ixl / inc ixh` 16-bit step means exactly one iteration (the one where IXL
// wraps 0xff->0x00) takes the inc-ixh arm; the expected pcSeq/T is built by an independent JS model.
//
// Run: node --test games/pooyan/translated/test/loc_6f9d.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6f9d } from "../loc_6f9d.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => { ram[a & 0xffff] = v & 0xff; ram[(a + 1) & 0xffff] = (v >> 8) & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0, pcSeq: [],
    step(n, c) { this.pc = n; this.tstates += c; this.pcSeq.push(n); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(c = 10) { this.step(this.pop16(), c); },
    call(addr) { this.calls.push(addr); this.ret(); return undefined; },
  };
}
function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_6f9d match path: 0x44-byte compare all-matches -> 0x0f44 + rst 0x38; modelled T + pcSeq", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f47, 0x01); // one iteration of the 5x loop
  m.mem.write8(0x8f51, 0x00);

  loc_6f9d(m);

  const exp = [];
  let T = 0;
  const S = (n, c) => { exp.push(n); T += c; };
  // pre-loop
  S(0x6fa0, 13); S(0x6fa3, 10); S(0x6fa4, 7); S(0x6fa5, 4); S(0x6fa6, 4);
  S(0x6fa8, 7); S(0x6faa, 8);                       // 5x loop, one iteration (b=1)
  S(0x6fad, 13); S(0x6fb0, 10); S(0x6fb2, 7);
  for (let i = 0; i < 3; i++) { S(0x6fb3, 11); S(0x6fb5, 10); S(i < 2 ? 0x6fb2 : 0x6fb7, i < 2 ? 13 : 8); }
  S(0x6fba, 10); S(0x6fbb, 11); S(0x6fbd, 7); S(0x6fbf, 10);
  S(0x6fc3, 14); S(0x6fc6, 10); S(0x6fc8, 7);
  // compare loop, 0x44 iterations, all matching
  for (let i = 0; i < 0x44; i++) {
    S(0x6fcb, 19); S(0x6fcc, 7); S(0x6fce, 7); S(0x6fd0, 8); S(0x6fd2, 8); S(0x6fd3, 4);
    if (((0x6ac5 + i + 1) & 0xff) === 0) { S(0x6fd5, 7); S(0x6fd7, 8); } else { S(0x6fd7, 12); }
    S(0x6fd8, 6);
    S(i < 0x43 ? 0x6fc8 : 0x6fda, i < 0x43 ? 13 : 8);
  }
  // post-loop match arm
  S(0x0f44, 17); S(0x6fdd, 10); S(0x6fe0, 10); S(0x0038, 11); S(0x6fe1, 10); S(CALLER_RET, 10);

  assert.equal(m.pc, CALLER_RET, "returns to caller");
  assert.equal(m.mem.read8(0x8f47), 0x05, "(0x8f47) replaced with 5x");
  assert.equal(m.mem.read8(0x8f48), 0x80, "delay reprimed");
  assert.deepEqual(m.calls, [0x0f44, 0x0038], "match arm: 0x0f44 then rst-0x38 enqueue");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.equal(m.tstates, T, "T matches the independent model");
  assert.deepEqual(m.pcSeq, exp, "boundaries match the independent model");
});

test("loc_6f9d MUTATION: cp (hl) at 0x6fcb mischarged 4T (not 7T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f47, 0x01);
  const base = makeMachine(); seatCaller(base); base.mem.write8(0x8f47, 0x01); loc_6f9d(base);
  const real = m.step.bind(m);
  let done = false;
  m.step = (n, c) => { if (n === 0x6fcc && !done) { done = true; return real(n, 4); } return real(n, c); };
  loc_6f9d(m);
  assert.equal(m.tstates, base.tstates - 3, "one 7->4 change drops exactly 3 T");
});
