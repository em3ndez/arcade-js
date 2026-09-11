// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_a8b4 (ROM 0xa8b4-0xa97c). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam); author-derived, the whole-machine boot-first state diff vs MAME is the integration check.
// The nine JSRs are opaque here (the harness records the call and pulls back the return push16 left, so
// the guest stack stays balanced and the trailing RTS returns to the caller-pushed address); every branch
// the routine takes is driven by the flags/memory it sets itself. Run:
//   node --test games/tempest/translated/test/equivalence-a8b4.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_a8b4 } from "../loc_a8b4.js";

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

// $05 negative -> the early BMI skips the ab14/ab0d block; bit $05 then BMI to lda $3e; beq skips the 2nd
// a97f; $00==4 skips the checksum/table blocks; $0123>=0 skips the ab14; $00!=0x18 -> BNE exits to RTS.
test("loc_a8b4: early-skip path ($05<0, $00=4, $0123>=0, $00!=0x18) -> RTS, 95 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1233); // RTS target = 0x1234
  m.ram[0x05] = 0x80; // negative
  m.ram[0x3e] = 0x05; // nonzero -> a900 BEQ not taken
  m.ram[0x00] = 0x04; // == 4 -> a90c BEQ taken (skip loops); != 0x18 -> a958 BNE taken
  m.ram[0x0123] = 0x00; // >=0 -> a94d BPL taken

  loc_a8b4(m);

  assert.equal(m.ram[0x72], 0x01, "a8b6 sta 0x72 = 1");
  assert.equal(m.pc, 0x1234, "RTS -> caller pushed + 1");
  assert.deepEqual(m.calls, [0xdf6a, 0xb0d1, 0xa97f, 0xa97f, 0xdf39],
    "df6a, b0d1, two a97f, df39 (block C, loops, block P all skipped)");
  assert.equal(
    m.cycles,
    2 + 3 + 6 + 2 + 6 + 3 + 3          // a8b4..a8c2 (bmi taken)
    + 2 + 2 + 6 + 3 + 3               // a8ea..a8f3 (bmi taken)
    + 3 + 2 + 2 + 2 + 6              // a8fe lda; a900 beq not-taken; a902..a905
    + 3 + 2 + 3                      // a908 lda; a90a cmp; a90c beq taken
    + 2 + 2 + 6 + 4 + 3             // a943..a94d (bpl taken)
    + 3 + 2 + 3                     // a954 lda; a956 cmp; a958 bne taken
    + 6,                            // a97c rts
    "95 T total");
  assert.equal(m.cycles, 95, "95 T (redundant check)");
});

// $05>=0 -> full block B (falls to ldx #$06) + block C; ora path + bvc; $00=0x18 -> loops run; $0123<0 ->
// ab14; $00==0x18 -> BNE not taken; $05>=0 -> BPL exits to RTS. Exercises both loops and block B/C.
test("loc_a8b4: $05>=0 runs block B/C + both loops, exits via a95c BPL -> RTS, 398 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000); // RTS target = 0x2001
  m.ram[0x05] = 0x00; // >=0 : block B; later a95c BPL taken
  m.ram[0x03] = 0x00; // and #$20 -> 0 -> a8ca BNE not taken
  m.ram[0x06] = 0x01; // nonzero -> a8d0 BEQ not taken
  m.ram[0xa2] = 0x00; // bit -> N clear -> a8d4 BMI not taken -> ldx #$06
  m.ram[0x31e4] = 0x55; // copied to 2fa6/2fa8
  m.ram[0x43] = 0x10; m.ram[0x44] = 0x00; m.ram[0x45] = 0x00; // ora -> 0x10 (Z clear) -> a900 not taken
  m.ram[0x00] = 0x18; // != 4 -> loops run; == 0x18 -> a958 BNE not taken
  m.ram[0xcde4] = 0x00; m.ram[0xcde5] = 0x00; // X bases = 0
  // aace..aad8 = 0 -> eor leaves A = 0xa7
  m.ram[0x061b] = 0x00; m.ram[0x061c] = 0x00; m.ram[0x061d] = 0x00; // table indices -> 0
  m.ram[0x31fa] = 0x77; // 0x31fa[0] value copied 3x
  m.ram[0x0123] = 0x80; // <0 -> a94d BPL not taken -> ab14

  loc_a8b4(m);

  assert.equal(m.ram[0x72], 0x01, "sta 0x72");
  assert.equal(m.ram[0x2fa6], 0x55, "31e4 -> 2fa6");
  assert.equal(m.ram[0x2fa8], 0x55, "31e4 -> 2fa8");
  assert.equal(m.ram[0x016c], 0xa7, "checksum eor loop leaves 0xa7 (all-zero source)");
  assert.equal(m.ram[0x2f60], 0x77, "table copy [0]");
  assert.equal(m.ram[0x2f62], 0x77, "table copy [1]");
  assert.equal(m.ram[0x2f64], 0x77, "table copy [2]");
  assert.equal(m.ram[0x3b], 0x1d, "sta 0x3b");
  assert.equal(m.ram[0x3c], 0x07, "sta 0x3c");
  assert.equal(m.ram[0x38], 0xff, "counter dec'd past 0 to 0xff");
  assert.equal(m.pc, 0x2001, "a95c BPL -> RTS -> pushed + 1");
  assert.deepEqual(m.calls,
    [0xdf6a, 0xb0d1, 0xab14, 0xab0d, 0xaaa8, 0xa97f, 0xa97f, 0xa9d7, 0xdf39, 0xab14],
    "block C jsrs present; both a97f; a9d7; df39; a951 ab14");
  const kLoop = 11 * 4 + 11 * 2 + 10 * 3 + 1 * 2;      // eor + dey + bpl(10 taken,1 fall)
  const lLoop = 3 * (3 + 4 + 2 + 2 + 4 + 5 + 2 + 2 + 5) + (3 + 3 + 2); // body*3 + bpl(2 taken,1 fall)
  assert.equal(
    m.cycles,
    47                              // a8b4..a8d6 (through block B falling to ldx #$06)
    + 6 + 6 + 4 + 4 + 4 + 6         // block C a8d8..a8e7
    + 2 + 2 + 6 + 3 + 2             // a8ea..a8f3 (bmi not taken)
    + 3 + 3 + 3 + 2 + 3            // block F a8f5..a8fc (bvc taken)
    + 2 + 2 + 2 + 6               // a900 beq not taken; a902 lda; a904 tay; a905 jsr
    + 3 + 2 + 2                   // a908 lda; a90a cmp; a90c beq not taken
    + 2 + 3 + 2 + 3 + 4 + 6       // block J a90e..a919
    + 2 + 2 + kLoop + 4          // a91c ldy; a91e lda; K loop; a926 sta
    + 4 + 2 + 3 + lLoop          // a929 ldx; a92c lda; a92e sta; L loop
    + 2 + 2 + 6 + 4 + 2 + 2 + 6  // a943..a951 (bpl not taken -> ab14)
    + 3 + 2 + 2                  // a954 lda; a956 cmp; a958 bne not taken
    + 3 + 3                      // a95a lda; a95c bpl taken
    + 6,                         // a97c rts
    "398 T total");
  assert.equal(m.cycles, 398, "398 T (redundant check)");
});

// $05 negative but a908 path reaches a95a with $05 still negative -> a95c BPL not taken -> block P/P2/Q.
test("loc_a8b4: block P/P2/Q path ($05<0, $3e=0, $00=0x18, $0102,x nonzero) -> RTS, 365 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x3000); // RTS target = 0x3001
  m.ram[0x05] = 0x80; // <0 : early skip block B/C; later a95c BPL not taken
  m.ram[0x3e] = 0x00; // a8fe lda -> 0 -> a900 BEQ taken (skip 2nd a97f)
  m.ram[0x00] = 0x18; // != 4 -> loops; == 0x18 -> a958 BNE not taken
  m.ram[0xcde4] = 0x00; m.ram[0xcde5] = 0x00;
  m.ram[0x061b] = 0x00; m.ram[0x061c] = 0x00; m.ram[0x061d] = 0x00;
  m.ram[0x31fa] = 0x77;
  m.ram[0x0123] = 0x00; // >=0 -> a94d BPL taken (skip ab14)
  m.ram[0x3d] = 0x01;   // index for a95e/a96a
  m.ram[0x0103] = 0x05; // 0x0102 + 1, nonzero -> a963 BEQ not taken; and reloaded into X at a96c

  loc_a8b4(m);

  assert.equal(m.ram[0x016c], 0xa7, "checksum still built (loops ran)");
  assert.equal(m.ram[0x2f60], 0x77, "table copy [0]");
  assert.equal(m.regs.x, 0x38, "final ldx #$38 leaves X = 0x38");
  assert.equal(m.pc, 0x3001, "RTS -> pushed + 1");
  assert.deepEqual(m.calls,
    [0xdf6a, 0xb0d1, 0xa97f, 0xa9d7, 0xdf39, 0xab14, 0xb0c6, 0xab14, 0xab14],
    "single a97f (block C + 2nd a97f skipped); block P2 ab14+b0c6; block Q two ab14");
  const kLoop = 11 * 4 + 11 * 2 + 10 * 3 + 1 * 2;
  const lLoop = 3 * (3 + 4 + 2 + 2 + 4 + 5 + 2 + 2 + 5) + (3 + 3 + 2);
  assert.equal(
    m.cycles,
    2 + 3 + 6 + 2 + 6 + 3 + 3        // a8b4..a8c2 (bmi taken)
    + 2 + 2 + 6 + 3 + 3             // a8ea..a8f3 (bmi taken)
    + 3 + 3                        // a8fe lda; a900 beq taken
    + 3 + 2 + 2                    // a908 lda; a90a cmp; a90c beq not taken
    + 2 + 3 + 2 + 3 + 4 + 6        // block J a90e..a919
    + 2 + 2 + kLoop + 4           // K loop
    + 4 + 2 + 3 + lLoop           // L loop
    + 2 + 2 + 6 + 4 + 3           // a943..a94d (bpl taken)
    + 3 + 2 + 2                   // a954 lda; a956 cmp; a958 bne not taken
    + 3 + 2                       // a95a lda; a95c bpl not taken
    + 3 + 4 + 2                   // a95e ldx; a960 lda; a963 beq not taken
    + 2 + 6 + 3 + 4 + 6           // block P2 a965..a96f
    + 2 + 6 + 2 + 6               // block Q a972..a979
    + 6,                          // a97c rts
    "365 T total");
  assert.equal(m.cycles, 365, "365 T (redundant check)");
});

// MUTATION: the checksum loop must actually eor 11 cells; a nonzero source must move A off 0xa7.
test("loc_a8b4 MUTATION: checksum loop reads the $aace source (nonzero -> $016c != 0xa7)", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x2000);
  m.ram[0x05] = 0x00;
  m.ram[0x03] = 0x20; // and #$20 -> nonzero -> a8ca BNE taken -> straight to block C (X=0)
  m.ram[0x43] = 0x10;
  m.ram[0x00] = 0x18;
  m.ram[0x31fa] = 0x00;
  m.ram[0x0123] = 0x00;
  m.ram[0xaad8] = 0x01; // top source cell (y=0x0a) -> flips bit0 of the checksum
  loc_a8b4(m);
  assert.equal(m.ram[0x016c], 0xa7 ^ 0x01, "0xa7 eor 0x01 = 0xa6 proves the source cell was read");
});
