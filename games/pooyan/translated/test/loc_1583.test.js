// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1583 (ROM 0x1583, Pooyan) -- per-frame tick on the 0x8f4d counter.
 * inc + low-nibble != 0 -> ret nz. On a 16-frame boundary it queues a display command via rst 0x38
 * (DE = 0x0635, or 0x06b5 when the counter's bit4 is set), then -- gated by (0x89ef) != 0 -- refreshes
 * state (0x7912) and dispatches on (0x880a)&0x1f through the rst-0x28 word table at 0x15a8, whose handler
 * ret's to the pushed continuation 0x15d1 (a boundary; tail `return m.call(0x15d1)`, per loc_0c4e idiom).
 *
 * The mock's `call` POPS (models the callee's ret) so every push16 (rst 0x38, call 0x7912, push hl,
 * rst 0x28) must balance. Path A: ret nz. Path B: bit4 clear (jr z taken, DE=0x0635) + ret z. Path C:
 * bit4 set (jr z not taken, DE=0x06b5) + full dispatch. STACK: the dispatch path pushes the 0x15d1
 * continuation and pops it via `return m.call(0x15d1)` -- the routine's OWN pushes all balance, leaving
 * the seated CALLER_RET (0x15d1's own ret-to-caller is the boundary routine's job, not modelled here) ->
 * SP settles at 0x877e. Deleting any push16 desyncs this. TEETH: mis-charge `call 0x7912` (17T) as 10T
 * -> the 178-T Path-C golden throws.
 *
 * Run: node --test games/pooyan/translated/test/loc_1583.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1583 } from "../loc_1583.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1583, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

test("loc_1583 Path A: low nibble != 0 -> ret nz", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f4d, 0x04); // inc -> 0x05, low nibble 5 != 0 -> ret nz

  loc_1583(m);

  assert.equal(m.tstates, 50, "Path A T-state total");
  assert.deepEqual(m.pcSeq, [0x1586, 0x1587, 0x1588, 0x1589, 0x158b, CALLER_RET], "ret nz -> caller");
  assert.equal(m.pc, CALLER_RET);
  assert.deepEqual(m.calls, []);
  assert.equal(m.mem.read8(0x8f4d), 0x05, "counter incremented");
  assert.equal(m.regs.sp, 0x8780, "ret popped CALLER_RET -> baseline");
});

test("loc_1583 Path B: 16-frame boundary, bit4 clear (DE=0x0635), then ret z", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f4d, 0x1f); // inc -> 0x20; low nibble 0; bit4 of 0x20 is clear -> jr z taken
  m.mem.write8(0x89ef, 0x00); // and a -> Z -> ret z taken

  loc_1583(m);

  assert.equal(m.tstates, 113, "Path B T-state total");
  assert.deepEqual(m.pcSeq, [
    0x1586, 0x1587, 0x1588, 0x1589, 0x158b, 0x158c, 0x158e, 0x1591,
    0x1595, 0x0038, 0x1599, 0x159a, CALLER_RET,
  ], "bit4 clear -> jr z taken -> rst 0x38 -> ret z");
  assert.equal(m.pc, CALLER_RET, "ret z to the seated caller");
  assert.deepEqual(m.calls, [0x0038], "only the rst 0x38 display-queue call");
  assert.equal(m.regs.de, 0x0635, "DE = 0x0635 (bit4 clear) queued via rst 0x38");
  assert.equal(m.mem.read8(0x8f4d), 0x20, "counter incremented");
  assert.equal(m.regs.sp, 0x8780, "rst 0x38 push balanced; ret popped CALLER_RET -> baseline");
});

test("loc_1583 Path C: bit4 set (DE=0x06b5), full rst-0x28 dispatch -> tail 0x15d1", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8f4d, 0x0f); // inc -> 0x10; low nibble 0; bit4 of 0x10 is set -> jr z NOT taken
  m.mem.write8(0x89ef, 0x01); // and a -> non-zero -> ret z NOT taken
  m.mem.write8(0x880a, 0x03); // dispatch index (0x880a)&0x1f = 3

  loc_1583(m);

  assert.equal(m.tstates, 178, "Path C T-state total");
  assert.deepEqual(m.pcSeq, [
    0x1586, 0x1587, 0x1588, 0x1589, 0x158b, 0x158c, 0x158e, 0x1591, 0x1593, 0x1595,
    0x0038, 0x1599, 0x159a, 0x159b, 0x7912, 0x15a1, 0x15a2, 0x15a5, 0x15a7, 0x0028,
  ], "bit4 set -> ld e,0xb5 -> rst 0x38 -> call 0x7912 -> push 0x15d1 -> rst 0x28");
  assert.deepEqual(m.calls, [0x0038, 0x7912, 0x0028, 0x15d1], "queue, refresh, dispatch, continuation");
  assert.equal(m.regs.de, 0x06b5, "DE = 0x06b5 (bit4 set) queued via rst 0x38");
  assert.equal(m.mem.read8(0x8f4d), 0x10, "counter incremented");
  // The routine's own pushes (rst 0x38 / call 0x7912 / push hl / rst 0x28) all balance; the seated
  // CALLER_RET remains (0x15d1's ret-to-caller is the boundary routine's job, not modelled by pop-once).
  assert.equal(m.regs.sp, 0x877e, "own pushes balanced; CALLER_RET still seated at 0x877e");
});

test("loc_1583 MUTATION: `call 0x7912` mis-charged 10T (not 17T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x7912 ? 10 : cycles);
  seatCaller(m);
  m.mem.write8(0x8f4d, 0x0f);
  m.mem.write8(0x89ef, 0x01);
  m.mem.write8(0x880a, 0x03);

  loc_1583(m);

  assert.equal(m.tstates, 171, "mutation loses 7 T (17 -> 10)");
  assert.throws(() => assert.equal(m.tstates, 178, "Path C T-state total"), /178/, "the 178-T golden must fail on the mutant");
});
