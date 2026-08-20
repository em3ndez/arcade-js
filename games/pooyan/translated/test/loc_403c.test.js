// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_403c (ROM 0x403c, Pooyan) -- the animation-sequence stepper for
 * the actor at IY. (iy+0x0e) is a frame-hold counter (dec + return while non-zero); on expiry it
 * walks the stream at (iy+0x0c:0x0d): a 0xff opcode reloads that pointer and re-reads, any other byte
 * is a 3-byte frame record copied into (iy+0x10/0x0f/0x0e) with the pointer advanced past it.
 *
 * Pure leaf -- no calls -- so the mock's `call` is unused; it still POPS for template fidelity.
 * Paths: DELAY (hold>0 -> dec, ret at 0x4045), FRAME (hold==0, first byte != 0xff -> record + ret at
 * 0x4065), RELOAD+FRAME (first byte 0xff -> reload pointer, jr 0x4046, then a frame record). Each
 * asserts the full pcSeq (visiting every step boundary), the T-state total, final PC/regs, and the
 * (iy+...) writes. STACK TOOTH: every path rets, so final pc === the seated CALLER_RET and sp is back
 * to baseline. T-STATE MUTATION TOOTH: mis-charge `dec (iy+0x0e)` as 11 T (plain dec (hl)) not 23 T.
 *
 * Run: node --test games/pooyan/translated/test/loc_403c.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_403c } from "../loc_403c.js";

const CALLER_RET = 0xabcd;
const IY = 0x8c30; // an actor record base

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x403c, pcSeq: [],
    step(nextAddr, cycles) { this.pc = nextAddr; this.tstates += cycles; this.pcSeq.push(nextAddr); },
    push16(v) {
      regs.sp = (regs.sp - 2) & 0xffff;
      mem.write8(regs.sp, v & 0xff);
      mem.write8((regs.sp + 1) & 0xffff, (v >> 8) & 0xff);
    },
    pop16() {
      const lo = mem.read8(regs.sp);
      const hi = mem.read8((regs.sp + 1) & 0xffff);
      regs.sp = (regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    ret(cycles = 10) { this.step(this.pop16(), cycles); },
    // Popping mock (loc_403c makes no calls; kept for template fidelity / a would-be missing-push16 bug).
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
  m.regs.iy = IY;
}

test("loc_403c Path DELAY: (iy+0x0e) non-zero -> dec, ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8((IY + 0x0e) & 0xffff, 0x05);

  loc_403c(m);

  assert.equal(m.tstates, 63, "DELAY T-state total");
  assert.deepEqual(m.pcSeq, [0x403f, 0x4040, 0x4042, 0x4045, CALLER_RET], "DELAY step boundaries");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.mem.read8((IY + 0x0e) & 0xffff), 0x04, "hold counter decremented");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_403c Path FRAME: hold==0, next record is a 3-byte frame -> copy + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8((IY + 0x0e) & 0xffff, 0x00);       // hold expired
  m.mem.write8((IY + 0x0c) & 0xffff, 0x00);       // stream pointer 0x9000
  m.mem.write8((IY + 0x0d) & 0xffff, 0x90);
  m.mem.write8(0x9000, 0x20);                     // frame: sprite 0x20
  m.mem.write8(0x9001, 0x11);                     // attr
  m.mem.write8(0x9002, 0x08);                     // new hold

  loc_403c(m);

  assert.equal(m.tstates, 231, "FRAME T-state total");
  assert.deepEqual(m.pcSeq, [
    0x403f, 0x4040, 0x4046, 0x4049, 0x404c, 0x404d, 0x404f,
    0x4051, 0x4054, 0x4055, 0x4056, 0x4059, 0x405a, 0x405b, 0x405e, 0x405f, 0x4062, 0x4065,
    CALLER_RET,
  ], "FRAME step boundaries");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  assert.equal(m.mem.read8((IY + 0x10) & 0xffff), 0x20, "byte0 -> (iy+0x10)");
  assert.equal(m.mem.read8((IY + 0x0f) & 0xffff), 0x11, "byte1 -> (iy+0x0f)");
  assert.equal(m.mem.read8((IY + 0x0e) & 0xffff), 0x08, "byte2 -> (iy+0x0e) new hold");
  assert.equal(m.mem.read8((IY + 0x0c) & 0xffff), 0x03, "pointer advanced +3 (lo)");
  assert.equal(m.mem.read8((IY + 0x0d) & 0xffff), 0x90, "pointer advanced +3 (hi)");
  assert.deepEqual(m.calls, [], "no calls");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_403c Path RELOAD+FRAME: 0xff reloads the pointer, then a frame record", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8((IY + 0x0e) & 0xffff, 0x00);       // hold expired
  m.mem.write8((IY + 0x0c) & 0xffff, 0x00);       // stream pointer 0x9000
  m.mem.write8((IY + 0x0d) & 0xffff, 0x90);
  m.mem.write8(0x9000, 0xff);                     // reload opcode
  m.mem.write8(0x9001, 0x10);                     // new pointer lo
  m.mem.write8(0x9002, 0x91);                     // new pointer hi -> 0x9110
  m.mem.write8(0x9110, 0x22);                     // frame at reloaded pointer
  m.mem.write8(0x9111, 0x33);
  m.mem.write8(0x9112, 0x44);

  loc_403c(m);

  assert.equal(m.tstates, 371, "RELOAD+FRAME T-state total");
  assert.deepEqual(m.pcSeq, [
    0x403f, 0x4040, 0x4046, 0x4049, 0x404c, 0x404d, 0x404f,
    0x4066, 0x4067, 0x4068, 0x406b, 0x406c, 0x406d, 0x4070, 0x4046, // reload + jr back
    0x4049, 0x404c, 0x404d, 0x404f,
    0x4051, 0x4054, 0x4055, 0x4056, 0x4059, 0x405a, 0x405b, 0x405e, 0x405f, 0x4062, 0x4065,
    CALLER_RET,
  ], "RELOAD+FRAME step boundaries");
  assert.equal(m.pc, CALLER_RET, "ret to seated caller");
  // frame from the reloaded pointer 0x9110
  assert.equal(m.mem.read8((IY + 0x10) & 0xffff), 0x22, "byte0 -> (iy+0x10)");
  assert.equal(m.mem.read8((IY + 0x0f) & 0xffff), 0x33, "byte1 -> (iy+0x0f)");
  assert.equal(m.mem.read8((IY + 0x0e) & 0xffff), 0x44, "byte2 -> (iy+0x0e) new hold");
  assert.equal(m.mem.read8((IY + 0x0c) & 0xffff), 0x13, "advanced reloaded pointer (lo)");
  assert.equal(m.mem.read8((IY + 0x0d) & 0xffff), 0x91, "advanced reloaded pointer (hi)");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_403c MUTATION: `dec (iy+0x0e)` mis-charged 11T (not 23T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x4045 ? 11 : cycles);
  seatCaller(m);
  m.mem.write8((IY + 0x0e) & 0xffff, 0x05);

  loc_403c(m);

  assert.equal(m.tstates, 51, "mutation loses 12 T (23 -> 11)");
  assert.throws(
    () => assert.equal(m.tstates, 63, "DELAY T-state total"),
    /63/,
    "the 63-T golden must fail on the mutant",
  );
});
