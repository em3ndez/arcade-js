// SPDX-License-Identifier: GPL-3.0-only
//
// Equivalence test for loc_0378 (ROM 0x0378-0x039a): vertical-mirror a 24-entry, 4-byte
// sprite table at 0x8840. Per entry byte0/byte2 := -(v)-0x10, byte1 flips its two high bits
// (low nibble kept), byte3 untouched. B counts the 24 entries; DE walks by `inc e`.
//
// Run: node --test games/pooyan/translated/test/loc_0378.test.js

import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_0378 } from "../loc_0378.js";

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
    call(addr) { this.calls.push(addr); return undefined; },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

// Seed all 24 entries with the same 4-byte pattern so every transformed entry is identical.
function seedTable(m) {
  for (let e = 0; e < 24; e++) {
    const base = 0x8840 + e * 4;
    m.mem.write8(base + 0, 0x20); // byte0 -> -(0x20)-0x10 = 0xd0
    m.mem.write8(base + 1, 0x3f); // byte1 -> flip high bits: 0x3f -> 0xcf
    m.mem.write8(base + 2, 0x30); // byte2 -> -(0x30)-0x10 = 0xc0
    m.mem.write8(base + 3, 0x99); // byte3 -> untouched
  }
}

test("loc_0378: 24 entries mirrored, ret; loop runs 24x; 3310 T", () => {
  const m = makeMachine();
  seatCaller(m);
  seedTable(m);

  loc_0378(m);

  assert.equal(m.tstates, 3310, "loc_0378 T-state total");
  assert.equal(m.pc, CALLER_RET, "returns via ret");
  assert.deepEqual(m.calls, [], "leaf: no calls");
  assert.equal(m.regs.de, 0x88a0, "DE walked past all 24 * 4 bytes");

  // entry 0 and entry 23 (first + last) confirm the transform ran end to end
  for (const base of [0x8840, 0x889c]) {
    assert.equal(m.mem.read8(base + 0), 0xd0, `entry@${base.toString(16)} byte0`);
    assert.equal(m.mem.read8(base + 1), 0xcf, `entry@${base.toString(16)} byte1`);
    assert.equal(m.mem.read8(base + 2), 0xc0, `entry@${base.toString(16)} byte2`);
    assert.equal(m.mem.read8(base + 3), 0x99, `entry@${base.toString(16)} byte3 untouched`);
  }

  const bodyLandings = m.pcSeq.filter((p) => p === 0x037e).length;
  assert.equal(bodyLandings, 24, "the `ld a,(de)` body head lands once per entry");
});

test("loc_0378 MUTATION: zeroing the `neg` step (8T) drops 24*8 = 192 T", () => {
  const full = makeMachine();
  seatCaller(full);
  seedTable(full);
  loc_0378(full);

  const mut = makeMachine();
  seatCaller(mut);
  seedTable(mut);
  const realStep = mut.step.bind(mut);
  mut.step = (n, c) => realStep(n, n === 0x0380 ? 0 : c);
  loc_0378(mut);

  assert.equal(full.tstates - mut.tstates, 192, "the 24 neg steps contribute 192 T; a dropped step is caught");
});
