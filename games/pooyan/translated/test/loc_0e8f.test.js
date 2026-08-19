// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_0e8f (ROM 0x0e8f, Pooyan) -- send the sound command
 * in A to the audio CPU: latch A at 0xa100, raise the audio-IRQ latch bit (0xa181),
 * 6 nops of pulse width, then dec a (-> 0) and lower the bit; ret.
 *
 * Self-contained mock machine (real Regs for exact flags, flat 64K RAM,
 * step/call/ret/push16/pop16 mirroring the DK Machine). A known caller return address
 * is seated so the final PC proves the `ret` fired.
 *
 * Pins the single straight path: A=0x42 latched at 0xa100, 0xa181 pulsed 1 then 0,
 * T = 13+7+13 + 6*4 + 4+13+10 = 84, pcSeq the 11 boundaries + the ret.
 * TEETH: mis-charge the first `ld (0xa100),a` as 7 T (a `ld a,(nn)` copy slip) -- the
 * golden T-state total must catch it.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0e8f } from "../loc_0e8f.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x0e8f, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8800; m.push16(CALLER_RET); }

const EXPECTED_PC_SEQ = [
  0x0e92, 0x0e94, 0x0e97, 0x0e98, 0x0e99, 0x0e9a, 0x0e9b, 0x0e9c, 0x0e9d, 0x0e9e, 0x0ea1,
  CALLER_RET,
];

test("loc_0e8f: latch sound command A, strobe audio-IRQ bit high/low", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x42; // sound command
  loc_0e8f(m);
  assert.equal(m.mem.read8(0xa100), 0x42, "A latched at the sound port 0xa100");
  assert.equal(m.mem.read8(0xa181), 0x00, "audio-IRQ latch bit left low (0)");
  assert.equal(m.regs.a, 0x00, "A = 0 after dec");
  assert.equal(m.tstates, 84, "T = 13+7+13 + 6*4 + 4+13+10");
  assert.equal(m.pc, CALLER_RET, "ends via `ret` (popped caller address)");
  assert.deepEqual(m.calls, [], "no calls / tail-jumps");
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ, "step boundaries match the disassembly");
});

test("loc_0e8f MUTATION: first `ld (0xa100),a` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x42;
  const realStep = m.step.bind(m);
  let first = true;
  m.step = (nextAddr, cycles) => {
    if (first && nextAddr === 0x0e92) { first = false; return realStep(nextAddr, 7); }
    return realStep(nextAddr, cycles);
  };
  loc_0e8f(m);
  assert.equal(m.tstates, 78, "mutation loses 6 T (13 -> 7)");
  assert.throws(() => assert.equal(m.tstates, 84, "T = 13+7+13 + 6*4 + 4+13+10"),
    /T = 13/, "the golden T-state total must fail on the mutant");
});
