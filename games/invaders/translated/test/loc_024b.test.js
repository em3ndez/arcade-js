// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_024b (ROM 0x024b-0x028b): the 16-byte-record table walker. Covers the
// four data-dependent arms -- 0xfe skip + 0xff terminator (ret), the 0x0277/0x027d B-edit arm, the
// 0x0288 dcr-m arm, and the 0x026e pchl dispatch (m.call the record's [+3]/[+4] target, then the
// 0x026f advance-and-loop continuation). CALLER_RET is seated so the terminating `rz` pops a known
// address; the dispatch cases use a smart mock whose `call` models the handler's pop-h + ret.
//
// Run: node --test games/invaders/translated/test/loc_024b.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/8080.js";
import { loc_024b } from "../loc_024b.js";

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
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); return undefined; }, // record-only dispatch
  };
}

function seatCaller(m) { m.regs.sp = 0x2400; m.push16(CALLER_RET); }

test("loc_024b: 0xfe record skips, next record 0xff -> ret; 91 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x2010;
  m.mem.write8(0x2010, 0xfe); // skip this record (+0x10)
  m.mem.write8(0x2020, 0xff); // terminator

  loc_024b(m);

  assert.equal(m.tstates, 91, "skip iteration (66) + terminator iteration (25)");
  assert.equal(m.regs.a, 0xff, "A holds the terminator byte");
  assert.equal(m.regs.hl, 0x2020, "HL advanced one 0x10 stride");
  assert.equal(m.pc, CALLER_RET, "rz returns to the caller");
  assert.equal(m.regs.sp, 0x2400, "stack unwound by the rz");
  assert.deepEqual(m.calls, [], "no delegations on the skip/terminate path");
  assert.deepEqual(m.pcSeq, [
    0x024c, 0x024e, 0x024f, 0x0251, 0x0281, 0x0284, 0x0285, 0x024b,
    0x024c, 0x024e, CALLER_RET,
  ], "step boundaries");
});

test("loc_024b MUTATION: `jz 0x0281` taken mis-charged 7T (not 10T) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x2010;
  m.mem.write8(0x2010, 0xfe);
  m.mem.write8(0x2020, 0xff);
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x0281 ? 7 : c);
  loc_024b(m);
  assert.equal(m.tstates, 88, "mutation loses 3 T (10 -> 7)");
  assert.notEqual(m.tstates, 91, "golden T-state total catches the mutant");
});

test("loc_024b B-edit arm: (B:A) field nonzero -> 0x0277/0x027d net-decrements B; 171 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x2010;
  m.mem.write8(0x2010, 0x05); // A field (not 0xff/0xfe)
  m.mem.write8(0x2011, 0x03); // B field -> (B|A) nonzero -> jnz 0x0277
  m.mem.write8(0x2020, 0xff); // next record terminates

  loc_024b(m);

  assert.equal(m.tstates, 171, "B-edit iteration (146) + terminator (25)");
  assert.equal(m.mem.read8(0x2011), 0x02, "B field written back one less (dcr/inr/dcr net -1)");
  assert.equal(m.mem.read8(0x2010), 0x05, "A field re-stored unchanged");
  assert.equal(m.regs.b, 0x02, "B ends at the written value");
  assert.equal(m.regs.c, 0x05, "C held the A field");
  assert.equal(m.regs.a, 0xff, "A holds the terminator of the next record");
  assert.equal(m.regs.hl, 0x2020, "HL advanced one stride");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x2400, "stack unwound");
  assert.deepEqual(m.calls, []);
});

test("loc_024b dcr-m arm: field zero, gate byte nonzero -> 0x0288 decrements gate; 183 T", () => {
  const m = makeMachine();
  seatCaller(m);
  m.regs.hl = 0x2010;
  m.mem.write8(0x2010, 0x00); // A field zero
  m.mem.write8(0x2011, 0x00); // B field zero -> (B|A)==0 -> jnz 0x0277 falls through
  m.mem.write8(0x2012, 0x08); // gate byte nonzero -> jnz 0x0288
  m.mem.write8(0x2020, 0xff);

  loc_024b(m);

  assert.equal(m.tstates, 183, "dcr-m iteration (158) + terminator (25)");
  assert.equal(m.mem.read8(0x2012), 0x07, "gate byte decremented in place");
  assert.equal(m.regs.a, 0xff, "A holds the next terminator");
  assert.equal(m.regs.hl, 0x2020, "HL advanced one stride");
  assert.equal(m.pc, CALLER_RET);
  assert.equal(m.regs.sp, 0x2400, "stack unwound");
  assert.deepEqual(m.calls, []);
});

test("loc_024b pchl dispatch: field zero + gate zero -> m.call the record's [+3]/[+4] target, then loop", () => {
  const m = makeMachine();
  // Smart mock: a dispatched handler pops the record pointer (its `pop h`, the push-d frame) and rets
  // (popping the 0x026f continuation), so the guest stack matches the real machine and the inline
  // continuation's own `pop h` recovers the outer record pointer.
  m.call = (addr) => { m.calls.push(addr); if (addr === 0x1234) { m.pop16(); m.pop16(); } };
  seatCaller(m);
  m.regs.hl = 0x2010;
  m.mem.write8(0x2010, 0x00); // A field zero
  m.mem.write8(0x2011, 0x00); // B field zero -> (B|A)==0
  m.mem.write8(0x2012, 0x00); // gate byte zero -> reach the 0x026e pchl
  m.mem.write8(0x2013, 0x34); // dispatch target low
  m.mem.write8(0x2014, 0x12); // dispatch target high -> 0x1234
  m.mem.write8(0x2020, 0xff); // next record terminates the walk

  loc_024b(m);

  assert.deepEqual(m.calls, [0x1234], "dispatches to the 16-bit target read from record[+3]/[+4]");
  assert.equal(m.regs.hl, 0x2020, "continuation advanced HL by 0x10 (record+4 + 0x0c) to the next record");
  assert.equal(m.pc, CALLER_RET, "rz on the 0xff record returns to the caller");
  assert.equal(m.regs.sp, 0x2400, "stack balanced: dispatch dance + handler pops + continuation pop net zero");
});

test("loc_024b pchl target MUTATION: reading the wrong record byte dispatches the wrong address", () => {
  const m = makeMachine();
  m.call = (addr) => { m.calls.push(addr); m.pop16(); m.pop16(); };
  seatCaller(m);
  m.regs.hl = 0x2010;
  m.mem.write8(0x2010, 0x00); m.mem.write8(0x2011, 0x00); m.mem.write8(0x2012, 0x00);
  m.mem.write8(0x2013, 0x34); m.mem.write8(0x2014, 0x12);
  m.mem.write8(0x2020, 0xff);
  // corrupt the high byte the routine must read (record+4): a wrong offset would not see this
  m.mem.write8(0x2014, 0x99);
  loc_024b(m);
  assert.deepEqual(m.calls, [0x9934], "target high byte comes from record[+4]");
  assert.notDeepEqual(m.calls, [0x1234], "a wrong read would not track record[+4]");
});
