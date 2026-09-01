// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for translated loc_021e (ROM 0x021e-0x0247): the shared draw body reached from
// loc_0214 (DE=0x2242) and loc_021b (DE=0x2142). Stores the enable flag A at 0x2081, then runs a
// 4-pass loop (loc_0229): saves PSW/BC, reloads the flag; NZ -> loc_0242 (call loc_147c), Z ->
// call loc_1a69; then (loc_0235) restores, decrements the counter A, rets when 0, else HL += 0x02e0
// and loops. PSW push/pop preserves the counter across the flag-test. Two arms tested by the entry A.
// The mock's `call` POPS the pushed return addr (callee ret) so PSW/BC frames stay balanced.
// TEETH: mis-charge `sta 0x2081` and the 623-T golden catches it.
// Run: node --test games/invaders/translated/test/loc_021e.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_021e } from "../loc_021e.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x021e, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // model the callee's ret popping the pushed return addr -> PSW/BC frames stay balanced
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

const PC_TAIL_TAKEN = [ // one loc_0229 pass, jnz taken (flag != 0), rz not taken
  0x022a, 0x022b, 0x022e, 0x022f, 0x0242, 0x147c, 0x0235,
  0x0236, 0x0237, 0x0238, 0x0239, 0x023a, 0x023d, 0x023e, 0x023f, 0x0229,
];
const PC_LAST_TAKEN = [ // final pass, rz taken -> ret
  0x022a, 0x022b, 0x022e, 0x022f, 0x0242, 0x147c, 0x0235,
  0x0236, 0x0237, 0x0238, CALLER_RET,
];
const PC_TAIL_NT = [ // one loc_0229 pass, jnz not taken (flag == 0), rz not taken
  0x022a, 0x022b, 0x022e, 0x022f, 0x0232, 0x1a69,
  0x0236, 0x0237, 0x0238, 0x0239, 0x023a, 0x023d, 0x023e, 0x023f, 0x0229,
];
const PC_LAST_NT = [ // final pass, rz taken -> ret
  0x022a, 0x022b, 0x022e, 0x022f, 0x0232, 0x1a69,
  0x0236, 0x0237, 0x0238, CALLER_RET,
];
const SETUP = [0x0221, 0x0224, 0x0227, 0x0229];

test("loc_021e flag!=0 arm (A=1, DE=0x2242): calls loc_147c 4x, HL += 3*0x02e0, rets; 623 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x01;    // enable flag nonzero -> jnz 0x0242 taken each pass
  m.regs.de = 0x2242; // loc_0214 path

  loc_021e(m);

  assert.equal(m.mem.read8(0x2081), 0x01, "enable flag stored at 0x2081");
  assert.equal(m.tstates, 623, "T: setup(40)+3*157+112");
  assert.deepEqual(m.calls, [0x147c, 0x147c, 0x147c, 0x147c], "loc_147c four times (flag set)");
  assert.equal(m.regs.hl, 0x30a6, "HL = 0x2806 + 3*0x02e0 (no dad on the last pass)");
  assert.equal(m.regs.de, 0x2242, "DE restored by pop d each pass");
  assert.equal(m.regs.bc, 0x1602, "BC restored by pop b each pass");
  assert.equal(m.regs.a, 0x00, "counter A decremented to 0");
  assert.equal(m.regs.sp, 0x2400, "stack fully unwound to baseline");
  assert.equal(m.pc, CALLER_RET, "rz returns to the seated caller");
  assert.deepEqual(
    m.pcSeq,
    [...SETUP, ...PC_TAIL_TAKEN, ...PC_TAIL_TAKEN, ...PC_TAIL_TAKEN, ...PC_LAST_TAKEN],
    "step boundaries (flag-set arm)",
  );
});

test("loc_021e flag==0 arm (A=0, DE=0x2142): calls loc_1a69 4x, HL += 3*0x02e0, rets; 583 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x00;    // enable flag zero -> jnz not taken -> call loc_1a69
  m.regs.de = 0x2142; // loc_021b path

  loc_021e(m);

  assert.equal(m.mem.read8(0x2081), 0x00, "enable flag (0) stored at 0x2081");
  assert.equal(m.tstates, 583, "T: setup(40)+3*147+102");
  assert.deepEqual(m.calls, [0x1a69, 0x1a69, 0x1a69, 0x1a69], "loc_1a69 four times (flag clear)");
  assert.equal(m.regs.hl, 0x30a6, "HL = 0x2806 + 3*0x02e0");
  assert.equal(m.regs.de, 0x2142, "DE restored by pop d each pass");
  assert.equal(m.regs.bc, 0x1602, "BC restored by pop b each pass");
  assert.equal(m.regs.a, 0x00, "counter A decremented to 0");
  assert.equal(m.regs.sp, 0x2400, "stack fully unwound to baseline");
  assert.equal(m.pc, CALLER_RET, "rz returns to the seated caller");
  assert.deepEqual(
    m.pcSeq,
    [...SETUP, ...PC_TAIL_NT, ...PC_TAIL_NT, ...PC_TAIL_NT, ...PC_LAST_NT],
    "step boundaries (flag-clear arm)",
  );
});

test("loc_021e MUTATION: `sta 0x2081` mis-charged 7T (not 13T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.a = 0x01;
  m.regs.de = 0x2242;
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0221 ? 7 : c);
  loc_021e(m);
  assert.equal(m.tstates, 617, "mutation loses 6 T (13 -> 7)");
  assert.notEqual(m.tstates, 623, "golden T-state total catches the mutant");
});
