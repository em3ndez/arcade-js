// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_0000 (Frogger reset vector, ROM 0x0000-0x0010):
//   0000  3a 00 40  ld a,(0x4000)   ; unmapped -> 0xFF (unmap_value_high)
//   0003  fe 55     cp 0x55         ; 0xFF != 0x55, Z never set
//   0005  ca 01 40  jp z,0x4001     ; DEAD arm (aimed outside the ROM image)
//   0008  3a 00 88  ld a,(0x8800)   ; watchdog reset_r (pets the dog)
//   000b  31 00 88  ld sp,0x8800
//   000e  c3 a3 02  jp 0x02a3       ; tail-jump into cold-boot init
// Contract: 6 instr, 63 T, one watchdog read, SP=0x8800, TAIL-jump into 0x02a3 (via m.call, result
// propagates). The dead self-check arm THROWS if 0x4000 ever reads 0x55 (positive control below).

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0000 } from "../loc_0000.js";

function mk(stubs = {}) {
  const routines = new Map();
  for (const [a, k] of Object.entries(stubs)) {
    routines.set(Number(a), k === "tail" ? () => "TAIL" : (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; });
  }
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

function checkSpec(res) {
  assert.equal(res.cycles, 63, "T-state total (13+7+10+13+10+10)");
  assert.deepEqual(res.calls, [0x02a3], "tail-jumps into cold-boot init 0x02a3");
  assert.equal(res.ret, "TAIL", "the tail-jump's callee result propagates out");
  assert.equal(res.sp, 0x8800, "ld sp,0x8800");
  assert.equal(res.wd, 1, "one watchdog read (ld a,(0x8800))");
}

function run(fn, stubs = { 0x02a3: "tail" }) {
  const m = mk(stubs);
  const ret = fn(m);
  return { cycles: m.cycles, calls: m.calls, ret, sp: m.regs.sp, wd: m.mem.watchdogReads };
}

test("loc_0000: reset vector, dead self-check, watchdog kick, tail-jump 0x02a3; 63 T", () => {
  checkSpec(run(loc_0000));
});

test("loc_0000: the dead arm THROWS if 0x4000 ever reads 0x55 (positive control)", () => {
  const m = mk({ 0x02a3: "tail" });
  const orig = m.mem.read8.bind(m.mem);
  m.mem.read8 = (a) => (a === 0x4000 ? 0x55 : orig(a)); // force the guard true
  assert.throws(() => loc_0000(m), /0x4000 read as 0x55/);
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0000.js
//   find: m.step(0x02a3, 10);\n  return m.call(0x02a3);
//   repl: m.step(0x02b3, 10);\n  return m.call(0x02b3);
//   expect: FAIL  (jumps to 0x02b3 -- caught by calls == [0x02a3])
//   verified-anchor: count == 1  (the sole "return m.call(0x02a3)" in loc_0000.js)
test("loc_0000: the contract catches a wrong tail-jump target", () => {
  const mutant = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(0x4000);
    m.step(0x0003, 13);
    regs.cp(0x55);
    m.step(0x0005, 7);
    if (regs.fZ) throw new Error("dead arm");
    m.step(0x0008, 10);
    regs.a = mem.read8(0x8800);
    m.step(0x000b, 13);
    regs.sp = 0x8800;
    m.step(0x000e, 10);
    m.step(0x02b3, 10); // MUTANT: wrong target
    return m.call(0x02b3);
  };
  assert.throws(() => checkSpec(run(mutant, { 0x02b3: "tail" })));
});
