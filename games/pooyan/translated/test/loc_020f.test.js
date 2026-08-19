// SPDX-License-Identifier: GPL-3.0-only
/**
 * Test for loc_020f (ROM 0x020F-0x0241, Pooyan) -- the attract-mode state driver,
 * an infinite loop reached by `jp` from 0x01d2 / 0x0738. It reads the state byte
 * at 0x88<(0x88a1)>, and either runs the per-frame worker 0x0254 (bit 7 set) or
 * dispatches through the handler table at 0x0242 via a computed `jp (hl)` (bit 7
 * clear), pushing 0x020f so the handler's ret loops back.
 *
 * Because the routine never returns, the mock's `call` throws a sentinel so the
 * loop stops the instant it dispatches; the accumulated state is then asserted.
 *
 * Two paths, both with golden T-states computed independently from the timings:
 *   A. state 0x02 (bit 7 clear) -> dispatcher: slots freed, pointer wrapped to
 *      0xC0, table index 4 -> handler 0x03e9, 0x020f pushed (214 T).
 *   B. state 0x80 (bit 7 set) -> `call 0x0254` (59 T).
 *
 * TEETH: mis-charge `add a,a` (4 T) as 8 T on path A; the golden catches it.
 *
 * Run: node --test games/pooyan/translated/test/loc_020f.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_020f } from "../loc_020f.js";

class StopLoop extends Error {
  constructor(addr) { super("dispatch"); this.addr = addr; }
}

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
    write16: (a, v) => {
      ram[a & 0xffff] = v & 0xff;
      ram[(a + 1) & 0xffff] = (v >> 8) & 0xff;
    },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x020f, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) { regs.sp = (regs.sp - 2) & 0xffff; mem.write8(regs.sp, v & 0xff); mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff); },
    pop16() { const lo = mem.read8(regs.sp); const hi = mem.read8((regs.sp + 1) & 0xffff); regs.sp = (regs.sp + 2) & 0xffff; return lo | (hi << 8); },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // The loop never rets; stop it the moment it hands off to a handler/worker.
    call(addr) { this.calls.push(addr); throw new StopLoop(addr); },
  };
}

const HANDLER_TABLE = [
  0x9b, 0x03, 0xc2, 0x03, 0xe9, 0x03, 0x96, 0x04, 0x52,
  0x05, 0x6b, 0x05, 0xb2, 0x05, 0xee, 0x05, 0x44, 0x06,
];

function seedTable(m) {
  HANDLER_TABLE.forEach((b, i) => m.mem.write8(0x0242 + i, b));
}

const EXPECTED_PC_SEQ_A = [
  0x0211, 0x0214, 0x0215, 0x0216, 0x0217,
  0x021e, 0x0220, 0x0221, 0x0223, 0x0225, 0x0226, 0x0227, 0x0229, 0x022a, 0x022b, 0x022d,
  0x022f, 0x0231, 0x0234, 0x0235, 0x0238, 0x0239, 0x023a, 0x023b, 0x023c, 0x023f, 0x0240, 0x0241,
  0x03e9,
];

function runPathA(m) {
  m.regs.sp = 0x8780;
  m.mem.write8(0x88a1, 0x50); // pointer -> HL = 0x8850
  m.mem.write8(0x8850, 0x02); // state byte, bit 7 clear -> dispatcher
  m.mem.write8(0x8851, 0xab); // neighbour slot, read into E before it is freed
  seedTable(m);
  try { loc_020f(m); } catch (e) { if (e instanceof StopLoop) return e; throw e; }
  throw new Error("loop did not stop");
}

test("loc_020f Path A: state 0x02 -> dispatch handler 0x03e9", () => {
  const m = makeMachine();
  const stop = runPathA(m);
  assert.equal(stop.addr, 0x03e9, "table index 4 -> 0x03e9");
  assert.equal(m.regs.hl, 0x03e9, "HL holds the handler at the jp (hl)");
  assert.equal(m.tstates, 214, "Path A T-state total");
  assert.equal(m.mem.read8(0x88a1), 0xc0, "slot pointer wrapped to 0xC0");
  assert.equal(m.mem.read8(0x8850), 0xff, "slot 0 freed");
  assert.equal(m.mem.read8(0x8851), 0xff, "slot 1 freed");
  assert.equal(m.mem.read16(m.regs.sp), 0x020f, "0x020f pushed as handler return");
  assert.deepEqual(m.calls, [0x03e9]);
  assert.deepEqual(m.pcSeq, EXPECTED_PC_SEQ_A, "step boundaries match the disassembly");
});

test("loc_020f Path B: state 0x80 (bit 7 set) -> call 0x0254", () => {
  const m = makeMachine();
  m.regs.sp = 0x8780;
  m.mem.write8(0x88a1, 0x50);
  m.mem.write8(0x8850, 0x80); // bit 7 set -> worker path
  let stop;
  try { loc_020f(m); } catch (e) { if (e instanceof StopLoop) stop = e; else throw e; }
  assert.equal(stop.addr, 0x0254, "runs the per-frame worker");
  assert.equal(m.tstates, 59, "Path B T-state total");
  assert.equal(m.mem.read16(m.regs.sp), 0x021c, "0x021c pushed as worker return");
  assert.deepEqual(m.calls, [0x0254]);
  assert.deepEqual(m.pcSeq, [0x0211, 0x0214, 0x0215, 0x0216, 0x0217, 0x0219, 0x0254]);
});

test("loc_020f MUTATION: `add a,a` mischarged 8 T (not 4) is caught", () => {
  const m = makeMachine();
  const real = m.step.bind(m);
  let armed = true;
  m.step = (n, c) => { if (armed && n === 0x0217) { armed = false; return real(n, 8); } return real(n, c); };
  runPathA(m);
  assert.equal(m.tstates, 218, "mutant gained exactly 4 T");
  assert.throws(() => assert.equal(m.tstates, 214, "Path A T-state total"), /Path A T-state total/);
});
