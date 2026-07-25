// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for entry_0066 (ROM 0x0066-0x01a3): the vblank NMI / per-frame
// service handler. It exercises two real control-flow paths end-to-end --
//   (1) the full service path that ticks the timers, debounces the inputs, runs
//       the coin/credit accounting and returns via loc_019c's `ret`; and
//   (2) the early credit-overflow bail that tail-jumps to the reset vector 0x01a4
// -- asserting the exact T-state total, the instruction-boundary step sequence
// (including the 32 LDIR iterations), the register/flag restore across the
// ex af,af'/exx shadow-set save, the RAM the routine mutates (timers, debounce
// bytes, the LDIR block copy) and the LS259 NMI-mask writes. It then re-runs a
// mutant whose reset tail-jump target is corrupted (0x01a5 vs 0x01a4) and proves
// the step/call assertions catch it even though the cycle total is unchanged.

import test from "node:test";
import assert from "node:assert/strict";

import { Regs, F_C } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { entry_0066 } from "../entry_0066.js";

// Machine double: the surface entry_0066 touches. step/push16/pop16/ldirAt are
// faithful (ldirAt is copied verbatim from games/dkong/machine.js so the LDIR
// charges 21 T per repeat + 16 T on exit). ret() records the epilogue return
// WITHOUT popping (0x01a3 is the real handler's exit; there is no further
// translated frame here). call() records an inter-routine tail-jump / call
// target WITHOUT invoking it -- 0x01a4/0x021c/0x022d/0x4c4d/0x4c5b are separate
// units -- so `return m.call(t)` models "control left for t and never returned".
function makeMachine(seed = {}) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x0066,
    steps: [],
    calls: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined;
    },
    push16(value) {
      this.regs.sp = (this.regs.sp - 2) & 0xffff;
      this.mem.write8(this.regs.sp, value & 0xff);
      this.mem.write8((this.regs.sp + 1) & 0xffff, (value >> 8) & 0xff);
    },
    pop16() {
      const lo = this.mem.read8(this.regs.sp);
      const hi = this.mem.read8((this.regs.sp + 1) & 0xffff);
      this.regs.sp = (this.regs.sp + 2) & 0xffff;
      return lo | (hi << 8);
    },
    // Verbatim from games/dkong/machine.js: block-copy (DE)<-(HL), BC down,
    // charging 21 T per repeating iteration and 16 T on the terminating one.
    ldirAt(self, nextAddr) {
      const { regs, mem } = this;
      for (;;) {
        mem.write8(regs.de, mem.read8(regs.hl));
        regs.hl = (regs.hl + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
        regs.bc = (regs.bc - 1) & 0xffff;
        if (regs.bc === 0) {
          this.step(nextAddr, 16);
          return;
        }
        this.step(self, 21);
      }
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(seed)) m.mem.write8(Number(addr), val);
  return m;
}

// ---- Path 1: full per-frame service path ending in loc_019c `ret` ----------
//
// Seed picks: 0x8000/0x801c/0x812c all equal and < 10 (credit checks pass);
// 0x801e==0x801f (ring empty -> jr z,0x00a5); 0x8006/0x8007 decrement to
// non-zero (timers keep running); IN1(0)==0x8016 and IN0(0xff)==0x8019 (both
// debounce stable -> latch 0x8015/0x8018); 0x8015 bit0 clear (coin-1 not
// asserted -> jr z,0x0110); 0x8003 != 0x55 (no coin-1 edge -> jr nz,0x0142);
// 0x8048==0 and 0x8001 in {1,2} (jr c,0x019c) -> straight to the ret epilogue.
const MAIN_SEED = {
  0x8000: 0x05, 0x801c: 0x05, 0x812c: 0x05,
  0x801e: 0x03, 0x801f: 0x03,
  0x8009: 0x01, 0x8006: 0x02, 0x8007: 0x02,
  0x8016: 0x00, 0x8019: 0xff, 0x8003: 0x00,
  0x8048: 0x00, 0x8001: 0x01,
  0x8220: 0x7e, 0x823f: 0x81, // LDIR source endpoints
};

// The step-target trace, block by block. LDIR contributes 0x00ae 32 times
// (once from `ld bc,0x0020`, then 31 repeating iterations) then 0x00b0.
const MAIN_STEPS = [
  // entry 0x0066..0x008c, jr z,0x00a5 taken
  0x0067, 0x0068, 0x006a, 0x006d, 0x0070, 0x0072, 0x0075, 0x0076, 0x0079, 0x007a,
  0x007d, 0x0080, 0x0081, 0x0084, 0x0087, 0x0088, 0x008b, 0x008c, 0x00a5,
  // loc_00a5: ld de/hl/bc, LDIR, timer 0x8009/0x8006, jr nz,0x00cc taken
  0x00a8, 0x00ab, ...Array(32).fill(0x00ae), 0x00b0,
  0x00b3, 0x00b4, 0x00b7, 0x00ba, 0x00bb, 0x00be, 0x00cc,
  // loc_00cc: timer 0x8007, jr nz,0x00e1 taken
  0x00cf, 0x00d0, 0x00d3, 0x00e1,
  // loc_00e1: IN1 debounce, jr nz not taken, latch 0x8015
  0x00e4, 0x00e5, 0x00e8, 0x00e9, 0x00eb, 0x00ee,
  // loc_00ee: IN0 debounce, jr nz not taken, latch 0x8018
  0x00f1, 0x00f4, 0x00f5, 0x00f8, 0x00f9, 0x00fb, 0x00fe,
  // loc_00fe: bit 0,c, jr z,0x0110 taken
  0x0101, 0x0104, 0x0105, 0x0108, 0x010a, 0x0110,
  // loc_0110: (hl)=0xaa, cp 0x55, jr nz,0x0142 taken
  0x0111, 0x0113, 0x0115, 0x0142,
  // loc_0142: or a (jr nz not taken), dec+cp, jr c,0x019c taken
  0x0145, 0x0146, 0x0148, 0x014b, 0x014c, 0x014e, 0x019c,
  // loc_019c: re-enable NMI, ex af,af'/exx (ret does not push a step target)
  0x019e, 0x01a1, 0x01a2, 0x01a3,
];

const MAIN_CYCLES =
  162 + // entry, jr z taken
  769 + // loc_00a5 incl LDIR(667) + ld bc(10), jr nz taken
  42 +  // loc_00cc jr nz taken
  54 +  // loc_00e1 jr nz not taken
  67 +  // loc_00ee jr nz not taken
  60 +  // loc_00fe jr z taken
  36 +  // loc_0110 jr nz taken
  60 +  // loc_0142 jr c taken
  38;   // loc_019c ret   => 1288

test("path 1: full service path ticks timers, debounces inputs, returns via ret", () => {
  const m = makeMachine(MAIN_SEED);
  m.regs.a = 0x99; // sentinel: the ex af,af' pair must restore it
  entry_0066(m);

  // Control flow + timing.
  assert.deepEqual(m.steps, MAIN_STEPS, "step targets");
  assert.deepEqual(m.calls, [], "no inter-routine call/jump on this path");
  assert.equal(m.returned, true, "reached loc_019c ret");
  assert.equal(m.pc, 0x01a3, "final PC = the ret opcode");
  assert.equal(m.cycles, MAIN_CYCLES, "T-state total");
  assert.equal(m.cycles, 1288, "T-state total (literal)");

  // Register/flag restore across the shadow-set save.
  assert.equal(m.regs.a, 0x99, "main A restored by the closing ex af,af'");
  assert.equal(m.regs.a_, 0x01, "routine's final working A parked in the shadow");
  assert.notEqual(m.regs.f_ & F_C, 0, "carry set by the final cp 0x02, parked in the shadow F");

  // Memory effects.
  assert.equal(m.mem.read8(0x8009), 0x00, "0x8009 timer decremented 1->0");
  assert.equal(m.mem.read8(0x8006), 0x01, "0x8006 timer decremented 2->1");
  assert.equal(m.mem.read8(0x8007), 0x01, "0x8007 timer decremented 2->1");
  assert.equal(m.mem.read8(0x8015), 0x00, "IN1 debounced value latched");
  assert.equal(m.mem.read8(0x8016), 0x00, "IN1 sample rolled");
  assert.equal(m.mem.read8(0x8018), 0xff, "IN0 debounced value latched");
  assert.equal(m.mem.read8(0x8019), 0xff, "IN0 sample rolled");
  assert.equal(m.mem.read8(0x8003), 0xaa, "coin-1 accumulator written 0xaa");
  assert.equal(m.mem.read8(0x9840), 0x7e, "LDIR copied 0x8220 -> sprite RAM 0x9840");
  assert.equal(m.mem.read8(0x985f), 0x81, "LDIR copied 0x823f -> sprite RAM 0x985f");
  assert.equal(m.mem.read8(0x8000), 0x05, "credit untouched on this path");

  // Hardware: NMI acknowledged (b0=0) then re-enabled (b0=1) at loc_019c.
  assert.equal(m.io.nmiMask, true, "NMI re-enabled (LS259 b0 = 1) at exit");
});

// ---- Path 2: credit overflow -> reset tail-jump 0x01a4 ----------------------
const TAIL_STEPS = [0x0067, 0x0068, 0x006a, 0x006d, 0x0070, 0x0072, 0x01a4];
const TAIL_CYCLES = 4 + 4 + 7 + 13 + 13 + 7 + 10; // 58

test("path 2: credit >= 10 bails to the reset vector 0x01a4", () => {
  const m = makeMachine({ 0x8000: 0x0a }); // cp 0x0a -> NC -> jp nc taken
  entry_0066(m);
  assert.deepEqual(m.steps, TAIL_STEPS, "step targets");
  assert.deepEqual(m.calls, [0x01a4], "tail-jump to the reset vector");
  assert.equal(m.returned, false, "a jp-out never reaches loc_019c's ret");
  assert.equal(m.pc, 0x01a4, "final PC = reset vector");
  assert.equal(m.cycles, TAIL_CYCLES, "T-state total");
  assert.equal(m.io.nmiMask, false, "NMI left masked (b0 = 0) on the bail path");
});

test("mutation: a corrupted reset tail-jump target is caught", () => {
  // Byte-identical to the entry block except the credit-overflow bail vectors to
  // 0x01a5 instead of 0x01a4. `jp nc` is 10 T whether taken or not, so the cycle
  // total is UNCHANGED -- only the step/call-target assertions can reject it.
  function entry_0066_mutant(m) {
    const { regs, mem } = m;
    regs.exAf();
    m.step(0x0067, 4);
    regs.exx();
    m.step(0x0068, 4);
    regs.a = 0x00;
    m.step(0x006a, 7);
    mem.write8(0xb000, regs.a, 10);
    m.step(0x006d, 13);
    regs.a = mem.read8(0x8000);
    m.step(0x0070, 13);
    regs.cp(0x0a);
    m.step(0x0072, 7);
    if (regs.fNC) {
      m.step(0x01a5, 10); // BUG: should be 0x01a4
      return m.call(0x01a5); // BUG: should be 0x01a4
    }
    m.step(0x0075, 10);
    throw new Error("unreached on the overflow seed");
  }

  const m = makeMachine({ 0x8000: 0x0a });
  entry_0066_mutant(m);
  assert.equal(m.cycles, TAIL_CYCLES, "mutation preserves the cycle total (so cycles cannot catch it)");
  assert.throws(
    () => {
      assert.deepEqual(m.steps, TAIL_STEPS, "step targets");
      assert.deepEqual(m.calls, [0x01a4], "tail-jump to the reset vector");
    },
    /step targets/,
    "the step/call-target assertions must reject the corrupted vector",
  );
});
