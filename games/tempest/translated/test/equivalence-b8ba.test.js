// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_b8ba (ROM 0xb8ba-0xb943) -- clears $68-$6d/$0202, seeds $5f/$5b, loops index $37
// from 0x0f down drawing each active entry ($0283,x!=0), and falls through into loc_b944. JSRs are opaque
// (recorded, not run). The all-empty-table path skips every body and exercises setup + loop skip + tail. Run:
//   node --test games/tempest/translated/test/equivalence-b8ba.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_b8ba } from "../loc_b8ba.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

test("loc_b8ba: empty table -> setup, 16 loop skips, tail; falls through to loc_b944, 368 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233);
  // $0283..$0292 all zero (RAM default) -> every entry beq-skips its body

  loc_b8ba(m);

  // setup writes
  assert.equal(m.ram[0x6a], 0x00, "$6a cleared");
  assert.equal(m.ram[0x6b], 0x00, "$6b cleared");
  assert.equal(m.ram[0x6c], 0x00, "$6c cleared");
  assert.equal(m.ram[0x6d], 0x00, "$6d cleared");
  assert.equal(m.ram[0x0202], 0x00, "$0202 cleared");
  assert.equal(m.ram[0x68], 0x00, "$68 cleared");
  assert.equal(m.ram[0x69], 0x00, "$69 cleared");
  assert.equal(m.ram[0x5f], 0xe0, "$5f = 0xe0");
  assert.equal(m.ram[0x5b], 0xff, "$5b = 0xff");
  // b967 opaque -> A stays 0xff (lda #0xff), X stays 0xf2 (ldx #0xf2)
  assert.equal(m.ram[0x77], 0xff, "$77 <- A (opaque b967 leaves 0xff)");
  assert.equal(m.ram[0x76], 0xf2, "$76 <- X (0xf2)");
  // loop counter runs 0x0f..0x00 then dec -> 0xff exits
  assert.equal(m.ram[0x37], 0xff, "$37 decremented past 0 to 0xff");
  assert.deepEqual(m.calls, [0xdf39, 0xb967, 0xb944, 0xdf6a, 0xdf09, 0xb944],
    "df39, b967, then tail b944/df6a/df09, then fall-through into loc_b944");
  assert.equal(m.pc, 0xb944, "final PC at loc_b944 entry (fall-through)");
  assert.equal(m.cycles, 368, "setup 61 + loop 287 + tail 20");
});

test("loc_b8ba: one active entry pulls the per-entry cells into $56-$58 and runs the body chain", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  // entry index 5 active
  m.ram[0x0283 + 5] = 0x40; // !=0 -> body runs; last written to $57
  m.ram[0x0263 + 5] = 0x11; // -> $56
  m.ram[0x02a3 + 5] = 0x22; // -> $58

  loc_b8ba(m);

  // $37 counts down; when it hits 5 the body copies the cells. Later indices (4..0) are empty -> after the
  // body for index 5, $56/$57/$58 hold that entry's data (no later entry overwrites them).
  assert.equal(m.ram[0x56], 0x11, "$0263+5 -> $56");
  assert.equal(m.ram[0x57], 0x40, "$0283+5 -> $57");
  assert.equal(m.ram[0x58], 0x22, "$02a3+5 -> $58");
  assert.equal(m.ram[0x73], 0x00, "$73 cleared in the body");
  // body chain calls appear once, in order, embedded in the loop
  const bodyCalls = [0xc098, 0xb944, 0xc3ba, 0xb56a, 0xb944, 0xc772, 0xb955, 0xdf6c, 0xdf4c, 0xdf4a, 0xb967, 0xdf39];
  for (const c of bodyCalls) assert.ok(m.calls.includes(c), `body called 0x${c.toString(16)}`);
  assert.equal(m.pc, 0xb944, "still falls through to loc_b944");
});
