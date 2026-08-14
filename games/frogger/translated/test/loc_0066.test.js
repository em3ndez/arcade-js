// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_0066 (Frogger vblank NMI handler, ROM 0x0066-0x0291). Driven with cleared
// work RAM (the boot state): it acks the NMI, scans coins (0x2CF0), blits sprites to OBJRAM with
// the rrca x4 nibble-swap, runs the attract-mode dispatch (0x83D6=0 -> call z,0x0E7A; call 0x2341),
// restores registers, re-enables the NMI, and `retn`s to the interrupted PC. Callees are stubbed as
// balanced pop-returns; a fake interrupted PC (0xBEEF) is pre-pushed for the epilogue `retn`.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0066 } from "../loc_0066.js";

function mk() {
  const routines = new Map();
  for (const a of [0x2cf0, 0x0e7a, 0x2341]) routines.set(a, (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; });
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...rest) => { m.calls.push(a); return oc(a, ...rest); };
  m.regs.af = 0x1234; m.regs.ix = 0x1111; m.regs.iy = 0x2222;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  for (let i = 0; i < 0x40; i++) m.mem.workRam[0x0007 + i] = (i * 7 + 0x1f) & 0xff;
  return m;
}

function collect(m) {
  return {
    cycles: m.cycles, calls: m.calls, sp: m.regs.sp, pc: m.pc, irq: m.io.irqEnable,
    objStraight: m.mem.objRam[0x07], objSwapped: m.mem.objRam[0x08],
  };
}

function checkSpec(res) {
  assert.deepEqual(res.calls, [0x2cf0, 0x0e7a, 0x2341],
    "coin scan, then attract-mode dispatch (0x83D6=0 -> 0x0E7A) and 0x2341");
  assert.equal(res.cycles, 4216, "T-state total of loc_0066's own instructions on the boot path");
  assert.equal(res.sp, 0x8800, "every push balanced; the NMI stack frame unwound");
  assert.equal(res.pc, 0xbeef, "retn returned to the interrupted PC");
  assert.equal(res.irq, 1, "the NMI was re-enabled (0xB808 D0=1) before retn");
  assert.equal(res.objStraight, 0x1f, "first byte copied straight (0x8007=0x1F -> 0xB007)");
  assert.equal(res.objSwapped, 0x62, "second byte nibble-swapped (0x8008=0x26 -> ror4 -> 0x62)");
}

test("loc_0066: NMI blits sprites (nibble-swap), dispatches attract, re-enables NMI; 4,216 T", () => {
  const m = mk();
  loc_0066(m);
  checkSpec(collect(m));
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0066.js
//   find: m.step(0x0071, 13); // ld a,(0x8800) -- pet the watchdog
//   repl: m.step(0x0071, 12); // (undercharge the prologue watchdog read by 1 T)
//   expect: FAIL  (writes nothing -- watchdog read is state-invisible -- only the cycle total catches it)
//   verified-anchor: count == 1  (the prologue ld a,(0x8800); the epilogue's is at 0x0248)
test("loc_0066: the cycle assertion catches a mistimed (state-invisible) watchdog read", () => {
  const m = mk();
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0071 && t === 13 ? 12 : t);
  loc_0066(m);
  const res = collect(m);
  assert.equal(res.objSwapped, 0x62, "sprite blit UNCHANGED by the timing mutation");
  assert.throws(() => checkSpec(res), /T-state total/);
});
