// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_6b3b (ROM 0x6b3b, Pooyan) -- the deferred-object promoter. Guards
 * on (0x8806)/(0x8d5f)/(0x8907 bit0); reads the countdown at (0x8d5e): 0 -> ret, >1 -> dec + ret,
 * ==1 -> fire (arm sound/state, scan the 11 sprite blocks at 0x8ae0 stride 0x18 copying in-band ones
 * into the 0x8d80 list), enqueue 5 display commands via rst 0x38, tail into 0x02ef.
 *
 * The mock's `call` POPS the return address the call site (or rst) pushed -- so a missing push16
 * desyncs the stack and the tail jp then over/under-pops CALLER_RET. rst 0x38 -> loc_0038 and the tail
 * jp 0x02ef are translated targets; the mock models only the pop (registers reloaded before each use).
 *
 * Path MAIN drives the FIRE branch with block #1 in-band (copied) and blocks #2..#11 out-of-band
 * (skipped); full pcSeq built from PRE + BODY + 10 SKIPs + TAIL, T=1284, ending on the tail 0x02ef.
 *
 * Run: node --test games/pooyan/translated/test/loc_6b3b.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_6b3b } from "../loc_6b3b.js";

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
    regs, mem, ram, calls: [], tstates: 0, pc: 0x6b3b, pcSeq: [],
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
    call(addr) { this.calls.push(addr); this.pop16(); return undefined; },
  };
}

function seatCaller(m) {
  m.regs.sp = 0x8780;
  m.push16(CALLER_RET);
}

const PRE = [
  0x6b3e, 0x6b3f, 0x6b40, 0x6b43, 0x6b44, 0x6b45, 0x6b48, 0x6b4a, 0x6b4b, 0x6b4e, 0x6b4f, 0x6b50,
  0x6b51, 0x6b53, 0x6b57, 0x6b59, 0x6b5c, 0x6b5f, 0x6b61, 0x6b64, 0x6b67, 0x6b6b, 0x6b6f, 0x6b71,
];
const BODY = [
  0x6b74, 0x6b76, 0x6b78, 0x6b7a, 0x6b7c, 0x6b7e, 0x6b80, 0x6b81, 0x6b84, 0x6b87, 0x6b8a,
  0x6b8d, 0x6b91, 0x6b93, 0x6b95, 0x6b97, 0x6b99, 0x6b71,
];
const SKIP = (last) => [0x6b74, 0x6b76, 0x6b78, 0x6b97, 0x6b99, last];
const TAIL = [0x6b9e, 0x0038, 0x6ba2, 0x0038, 0x6ba6, 0x0038, 0x6baa, 0x0038, 0x6bae, 0x0038, 0x02ef];

function setupFire(m) {
  seatCaller(m);
  m.mem.write8(0x8806, 0x00); // guard: pass
  m.mem.write8(0x8d5f, 0x00); // guard: pass
  m.mem.write8(0x8907, 0x00); // bit0 clear: pass
  m.mem.write8(0x8d5e, 0x01); // countdown == 1 -> fire
  m.mem.write8(0x8ae4, 0x10); // block #1 (ix+4)&0x1f = 0x10 -> in [0x06,0x1a) -> copied
  m.mem.write8(0x8ae6, 0x77); // block #1 (ix+6) payload
  // blocks #2..#11 (ix+4) default 0 -> < 0x06 -> skipped
}

test("loc_6b3b Path EARLY: (0x8806)!=0 -> ret nz at 0x6b3f", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x01);

  loc_6b3b(m);

  assert.equal(m.tstates, 13 + 4 + 11, "ld a + and a + ret nz");
  assert.deepEqual(m.pcSeq, [0x6b3e, 0x6b3f, CALLER_RET]);
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6b3b Path DEC: countdown > 1 -> dec (0x8d5e) + ret", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8806, 0x00);
  m.mem.write8(0x8d5f, 0x00);
  m.mem.write8(0x8907, 0x00);
  m.mem.write8(0x8d5e, 0x03); // > 1 -> decrement, no fire

  loc_6b3b(m);

  assert.equal(m.tstates, 130, "Path DEC T-state total");
  assert.deepEqual(m.pcSeq, [
    0x6b3e, 0x6b3f, 0x6b40, 0x6b43, 0x6b44, 0x6b45, 0x6b48, 0x6b4a, 0x6b4b,
    0x6b4e, 0x6b4f, 0x6b50, 0x6b51, 0x6b53, 0x6b55, 0x6b56, CALLER_RET,
  ], "Path DEC step boundaries");
  assert.equal(m.mem.read8(0x8d5e), 0x02, "countdown decremented 0x03 -> 0x02");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8780);
});

test("loc_6b3b Path MAIN: countdown==1 -> fire, copy block #1, enqueue 5, tail 0x02ef", () => {
  const m = makeMachine();
  setupFire(m);

  loc_6b3b(m);

  const expected = [
    ...PRE,
    ...BODY,                       // block #1: in-band, copied (b 0x0b -> 0x0a)
    ...SKIP(0x6b71), ...SKIP(0x6b71), ...SKIP(0x6b71), ...SKIP(0x6b71), ...SKIP(0x6b71),
    ...SKIP(0x6b71), ...SKIP(0x6b71), ...SKIP(0x6b71), ...SKIP(0x6b71), // blocks #2..#10 skipped
    ...SKIP(0x6b9b),               // block #11 skipped, djnz falls out (b 0x01 -> 0x00)
    ...TAIL,
  ];
  assert.deepEqual(m.pcSeq, expected, "MAIN full pcSeq (PRE + BODY + 10 SKIP + TAIL)");
  assert.equal(m.tstates, 1284, "Path MAIN T-state total");
  assert.equal(m.pc, 0x02ef, "tail jp lands on 0x02ef");
  assert.deepEqual(m.calls, [0x0038, 0x0038, 0x0038, 0x0038, 0x0038, 0x02ef], "5 rst 0x38 + tail 0x02ef");
  // armed sound/state
  assert.equal(m.mem.read8(0x880a), 0x11, "(0x880a) armed");
  assert.equal(m.mem.read8(0x8d5f), 0x11, "(0x8d5f) armed");
  assert.equal(m.mem.read8(0x8d5e), 0xff, "(0x8d5e) reset to 0xff");
  // block #1 copied into the 0x8d80 list (pointer 0x8ae0 + payload)
  assert.equal(m.mem.read8(0x8d80), 0xe0, "list[0] = IX low");
  assert.equal(m.mem.read8(0x8d81), 0x8a, "list[1] = IX high");
  assert.equal(m.mem.read8(0x8d82), 0x77, "list[2] = (ix+6) payload");
  assert.equal(m.mem.read8(0x8ae6), 0x00, "block #1 (ix+6) cleared");
  assert.equal(m.regs.ix, 0x8be8, "IX advanced 11 * 0x18");
  assert.equal(m.regs.iy, 0x8d83, "IY advanced 3 (one copied block)");
  // Tail jp 0x02ef: its callee ret consumes the seated CALLER_RET -> SP back to baseline.
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
});

test("loc_6b3b MUTATION: `ld ix,nn` mis-charged 10T (not 14T) is caught", () => {
  const m = makeMachine();
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x6b6b ? 10 : cycles);
  setupFire(m);

  loc_6b3b(m);

  assert.equal(m.tstates, 1280, "mutation loses 4 T (14 -> 10)");
  assert.throws(
    () => assert.equal(m.tstates, 1284, "Path MAIN T-state total"),
    /1284/,
    "the 1284-T golden must fail on the mutant",
  );
});
