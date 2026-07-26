// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_1493 (ROM 0x1493-0x14cc): one arm of the mode-idle object
// dispatcher. If the 0x807e busy flag is set it defers to 0x1b5b; else it forces
// 0x8069=0xb2, derives a tile coordinate A = 0x1f - ((0x8068 - E + 3) >> 3),
// stores it to 0x8073 and H, and branches: coordinate != 0x16 -> loc_14cd;
// coordinate == 0x16 with 0x8076 clear -> loc_14cd; coordinate == 0x16 with 0x8076
// set -> clear 0x8076/0x80bd, set 0x80aa=9, tail-jump 0x2bd3. This test drives all
// FOUR exit paths, asserting the exact T-state total, the instruction-boundary step
// sequence, the tail-jump target, the residual A/H, and the memory writes on the
// boundary path. mem[0x8068]=0x45 / E=0 is chosen so the /8 arithmetic lands on
// exactly 0x16. It then re-runs a copy whose `jp nz` target is corrupted
// 0x1b5b -> 0x1b5c and proves the step/call-target assertions catch it even though
// the cycle total is unchanged (a taken jp cc is 10T either way).

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_1493 } from "../loc_1493.js";

// Minimal leaf-routine machine double: the surface loc_1493 touches (regs, mem,
// step, call). step records its target + charges cycles; call records the
// tail-jump target WITHOUT invoking a real routine (0x1b5b/0x14cd/0x2bd3 are
// separate units), so `return m.call(t)` models "control transferred to t and
// never came back". regE seeds the position delta the routine was handed in E.
function makeMachine(seed = {}, regE = 0) {
  const rom = new Uint8Array(0x5000); // ROM_END + 1; unused by this routine
  const m = {
    regs: new Regs(),
    io: new Io(),
    cycles: 0,
    pc: 0x1493,
    steps: [],
    calls: [],
    returned: false,
    ret(cycles = 10) {
      this.cycles += cycles;
      this.returned = true;
    },
    call(addr) {
      this.calls.push(addr);
      return undefined; // callee's own ret returns to OUR caller; nothing to do here
    },
  };
  m.mem = new AddressSpace(rom, m.io);
  m.step = (nextAddr, cycles) => {
    m.pc = nextAddr;
    m.cycles += cycles;
    m.steps.push(nextAddr);
  };
  for (const [addr, val] of Object.entries(seed)) m.mem.write8(Number(addr), val);
  m.regs.e = regE;
  return m;
}

function assertPath(m, exp) {
  assert.deepEqual(m.steps, exp.steps, "step targets");
  assert.deepEqual(m.calls, exp.calls, "call targets");
  assert.equal(m.returned, exp.returned, "early ret");
  assert.equal(m.cycles, exp.cycles, "T-state total");
  assert.equal(m.pc, exp.pc, "final PC");
  assert.equal(m.regs.a, exp.a, "A register");
  if (exp.h !== undefined) assert.equal(m.regs.h, exp.h, "H register");
  if (exp.mem !== undefined) {
    for (const [addr, val] of Object.entries(exp.mem)) {
      assert.equal(m.mem.read8(Number(addr)), val, `mem[0x${Number(addr).toString(16)}]`);
    }
  }
}

// Instruction-boundary addresses of the common prefix, up to and including the
// `cp 0x16` step (used by every non-defer path).
const PREFIX = [
  0x1496, 0x1497, // ld a,(807e) ; and a
  0x149a, 0x149c, 0x149f, 0x14a2, 0x14a3, // jp-nz-nt ; ld a,b2 ; ld (8069) ; ld a,(8068) ; sub e
  0x14a5, 0x14a7, 0x14a9, // add 03 ; srl a
  0x14ab, 0x14ad, // srl a ; srl a
  0x14af, 0x14b2, 0x14b3, 0x14b5, // neg ; add 1f ; ld (8073) ; ld h,a ; cp 16
];
// T-states of that prefix (jp nz NOT taken = 10):
const PREFIX_T = 13 + 4 + 10 + 7 + 13 + 13 + 4 + 7 + 8 + 8 + 8 + 8 + 7 + 13 + 4 + 7; // 134

const PATHS = {
  // 0x807e busy flag set -> jp nz 0x1b5b immediately; A = the flag value.
  busy_1b5b: {
    regE: 0x00,
    seed: { 0x807e: 0x03 },
    exp: {
      steps: [0x1496, 0x1497, 0x1b5b],
      calls: [0x1b5b],
      returned: false,
      cycles: 13 + 4 + 10,
      pc: 0x1b5b,
      a: 0x03,
    },
  },
  // Flag clear, coordinate != 0x16 (0x8068=0x00,E=0 -> 0x1f) -> jr nz 0x14cd.
  coord_14cd: {
    regE: 0x00,
    seed: { 0x807e: 0x00, 0x8068: 0x00 },
    exp: {
      steps: [...PREFIX, 0x14cd],
      calls: [0x14cd],
      returned: false,
      cycles: PREFIX_T + 12, // jr nz taken
      pc: 0x14cd,
      a: 0x1f,
      h: 0x1f,
      mem: { 0x8069: 0xb2, 0x8073: 0x1f },
    },
  },
  // coordinate == 0x16 (0x8068=0x45,E=0), 0x8076 clear -> jr z 0x14cd.
  boundary_flagclear_14cd: {
    regE: 0x00,
    seed: { 0x807e: 0x00, 0x8068: 0x45, 0x8076: 0x00 },
    exp: {
      steps: [...PREFIX, 0x14b7, 0x14ba, 0x14bb, 0x14cd],
      calls: [0x14cd],
      returned: false,
      cycles: PREFIX_T + 7 + 13 + 4 + 12, // jr nz nt ; ld a,(8076) ; or a ; jr z taken
      pc: 0x14cd,
      a: 0x00, // mem[0x8076] == 0, unchanged by `or a`
      h: 0x16,
      mem: { 0x8069: 0xb2, 0x8073: 0x16 },
    },
  },
  // coordinate == 0x16, 0x8076 set -> boundary reached: clear 0x8076/0x80bd,
  // set 0x80aa=9, jp 0x2bd3.
  boundary_flagset_2bd3: {
    regE: 0x00,
    seed: { 0x807e: 0x00, 0x8068: 0x45, 0x8076: 0x01, 0x80bd: 0xff, 0x80aa: 0x00 },
    exp: {
      steps: [
        ...PREFIX,
        0x14b7, 0x14ba, 0x14bb, // ld a,(8076) ; or a ; jr z NOT taken
        0x14bd, 0x14bf, 0x14c2, 0x14c5, 0x14c7, 0x14ca, // the boundary block
        0x2bd3,
      ],
      calls: [0x2bd3],
      returned: false,
      cycles: PREFIX_T + 7 + 13 + 4 + 7 + 7 + 13 + 13 + 7 + 13 + 10,
      pc: 0x2bd3,
      a: 0x09,
      h: 0x16,
      mem: { 0x8069: 0xb2, 0x8073: 0x16, 0x8076: 0x00, 0x80bd: 0x00, 0x80aa: 0x09 },
    },
  },
};

for (const [name, { regE, seed, exp }] of Object.entries(PATHS)) {
  test(`path ${name}`, () => {
    const m = makeMachine(seed, regE);
    loc_1493(m);
    assertPath(m, exp);
  });
}

// Sanity anchor: the E delta actually shifts the coordinate. With 0x8068=0x45 and
// E=0x08 the (0x45-0x08+3)=0x40 -> >>3 = 0x08 -> neg+0x1f = 0x17, so cp 0x16 is
// NZ and we take the jr nz to 0x14cd instead of the boundary path.
test("E shifts the coordinate (0x8068=0x45,E=0x08 -> 0x17 -> 0x14cd)", () => {
  const m = makeMachine({ 0x807e: 0x00, 0x8068: 0x45, 0x8076: 0x01 }, 0x08);
  loc_1493(m);
  assert.deepEqual(m.calls, [0x14cd], "coordinate 0x17 must divert to 0x14cd");
  assert.equal(m.regs.a, 0x17, "coordinate");
  assert.equal(m.mem.read8(0x8073), 0x17, "stored coordinate");
});

test("mutation: a corrupted jp-nz target is caught", () => {
  // Byte-identical to loc_1493 up through the jp nz, except its target is 0x1b5c
  // instead of 0x1b5b. A taken jp cc is 10T either way, so the cycle total is
  // UNCHANGED; it is precisely the step/call-target assertions that must reject
  // it -- not the cycle count.
  function loc_1493_mutant(m) {
    const { regs, mem } = m;
    regs.a = mem.read8(0x807e);
    m.step(0x1496, 13);
    regs.and(regs.a);
    m.step(0x1497, 4);
    if (regs.fNZ) {
      m.step(0x1b5c, 10); // BUG: should be 0x1b5b
      return m.call(0x1b5c); // BUG: should be 0x1b5b
    }
    m.step(0x149a, 10);
    // (the rest is irrelevant to this mutation and omitted)
  }

  const m = makeMachine(PATHS.busy_1b5b.seed, PATHS.busy_1b5b.regE);
  loc_1493_mutant(m);
  assert.equal(m.cycles, PATHS.busy_1b5b.exp.cycles, "mutation preserves the cycle total");
  assert.throws(() => assertPath(m, PATHS.busy_1b5b.exp), /step targets/);
});
