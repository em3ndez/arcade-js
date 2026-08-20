// SPDX-License-Identifier: GPL-3.0-only
/**
 * Drafter test for translated loc_1b43 (ROM 0x1b43-0x1b7f, Pooyan) -- a 0x15a8-dispatch state
 * handler. Runs 0x02c9 (bails via `ret nz` if not-done), 0x02e3, 0x075d (BC=0x0819), enqueues two
 * display commands (rst 0x38, DE=0x0600 then E=0x02), runs 0x7960, sets (0x880a)=0x0c and clears
 * (0x8808). Then it folds a 34-byte checksum over 0x5593 (each byte: & 0x37, rrca, adc a,c) into C;
 * if the result != 0x7c it bumps (0x881e). Finally it seeds DE=0x1ff2 / HL=0x89f0 and FALLS THROUGH
 * into loc_1b80 -- modelled as a tail m.call(0x1b80) with NO push16 (frame reuse), so loc_1b80's ret
 * would return to loc_1b43's caller. The mock's call pops that seated CALLER_RET, so the final SP
 * unwinds to the pre-seat baseline (stack tooth) and pc lands on 0x1b80.
 *
 * The mock's `call` POPS the pushed return, so a missing push16 desyncs SP. The only load-bearing
 * callee effect is 0x02c9's `dec (0x8809)` flag (`ret nz` at 0x1b46) -- modelled via decMem8.
 *
 * Path BUMP (checksum != 0x7c): all-zero source -> C=0 -> jr z NOT taken -> inc (0x881e), fall
 *   through to loc_1b80. Full pcSeq + T=1759. Path SKIP (checksum == 0x7c): source 0x06 x33 + 0x32
 *   folds to C=0x7c -> jr z taken -> skips the bump. Path EARLY (0x02c9 not-done): ret nz at 0x1b46.
 * TEETH: mis-charge `ld (0x880a),a` at 0x1b5c (13 T) as 7 T -> the 1759 golden catches it.
 * POSITIVE CONTROL (performed): deleting push16(0x1b46) makes call(0x02c9) pop CALLER_RET, SP ends
 * off by 2 and the baseline assertion throws; restored.
 *
 * Run: node --test games/pooyan/translated/test/loc_1b43.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { loc_1b43 } from "../loc_1b43.js";

const CALLER_RET = 0xabcd;

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
  };
  return {
    regs, mem, ram, calls: [], tstates: 0, pc: 0x1b43, pcSeq: [],
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
    // The callee's `ret` pops the return the call site pushed -- a missing push16 then desyncs SP.
    // The only load-bearing effect is 0x02c9's terminal `dec (0x8809)`, whose Z flag `ret nz` reads.
    call(addr) {
      this.calls.push(addr);
      this.pop16();
      if (addr === 0x02c9) regs.decMem8(mem, 0x8809);
      return undefined;
    },
  };
}

function seatCaller(m) { m.regs.sp = 0x8780; m.push16(CALLER_RET); }

const PRE = [
  0x02c9, 0x1b47, 0x02e3, 0x1b4d, 0x075d, 0x1b53, 0x0038, 0x1b56, 0x0038, 0x7960,
  0x1b5c, 0x1b5f, 0x1b60, 0x1b63, 0x1b66, 0x1b69,
];
// The B=0x22 checksum loop: 33 iters with djnz taken (-> 0x1b69) then 1 with djnz falling out (-> 0x1b72).
function loopSeq() {
  const NON_LAST = [0x1b6a, 0x1b6c, 0x1b6d, 0x1b6e, 0x1b6f, 0x1b70, 0x1b69];
  const LAST = [0x1b6a, 0x1b6c, 0x1b6d, 0x1b6e, 0x1b6f, 0x1b70, 0x1b72];
  const a = [];
  for (let i = 0; i < 33; i++) a.push(...NON_LAST);
  a.push(...LAST);
  return a;
}
const LOOP_T = 45 * 33 + 40; // (32 body + 13 djnz) x33 + (32 body + 8 djnz) = 1525

const PC_BUMP = [...PRE, ...loopSeq(), 0x1b74, 0x1b76, 0x1b79, 0x1b7a, 0x1b7d, 0x1b80];
const GOLDEN_BUMP = 179 + LOOP_T + 55; // pre + loop + (cp7 jr7 ldhl10 inc11 ldde10 ldhl10)

const PC_SKIP = [...PRE, ...loopSeq(), 0x1b74, 0x1b7a, 0x1b7d, 0x1b80];
const GOLDEN_SKIP = 179 + LOOP_T + 39; // pre + loop + (cp7 jr12 ldde10 ldhl10)

test("loc_1b43 Path BUMP: checksum != 0x7c -> inc (0x881e), fall through to loc_1b80", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8809, 0x01); // 0x02c9 dec -> 0 -> Z set -> ret nz not taken (continue)
  // source 0x5593.. left zero -> checksum folds to C=0 (!= 0x7c) -> jr z not taken

  loc_1b43(m);

  assert.equal(m.tstates, GOLDEN_BUMP, "Path BUMP T-state total");
  assert.deepEqual(m.pcSeq, PC_BUMP, "step boundaries match the ROM bytes");
  assert.equal(m.pc, 0x1b80, "fall-through tail lands on loc_1b80");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline (loc_1b80's ret would hit CALLER_RET)");
  assert.deepEqual(m.calls, [0x02c9, 0x02e3, 0x075d, 0x0038, 0x0038, 0x7960, 0x1b80],
    "0x02c9, 0x02e3, 0x075d, two rst 0x38, 0x7960, then fall-through into loc_1b80");
  assert.equal(m.mem.read8(0x880a), 0x0c, "(0x880a) = 0x0c");
  assert.equal(m.mem.read8(0x8808), 0x00, "(0x8808) cleared");
  assert.equal(m.regs.c, 0x00, "checksum accumulator C = 0 for all-zero source");
  assert.equal(m.mem.read8(0x881e), 0x01, "(0x881e) bumped 0 -> 1 (checksum != 0x7c)");
  assert.equal(m.regs.de, 0x1ff2, "DE seeded for loc_1b80");
  assert.equal(m.regs.hl, 0x89f0, "HL seeded for loc_1b80");
});

test("loc_1b43 Path SKIP: checksum == 0x7c -> jr z skips the (0x881e) bump", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8809, 0x01); // continue past ret nz
  // Fold 33 bytes of 0x06 (rrca(0x06)=0x03, +3 each -> C=99) then one 0x32 (rrca(0x32)=0x19, +25) = 0x7c.
  for (let i = 0; i < 33; i++) m.mem.write8(0x5593 + i, 0x06);
  m.mem.write8(0x5593 + 33, 0x32);
  m.mem.write8(0x881e, 0x05); // must stay untouched on the skip path

  loc_1b43(m);

  assert.equal(m.tstates, GOLDEN_SKIP, "Path SKIP T-state total");
  assert.deepEqual(m.pcSeq, PC_SKIP, "jr z taken skips 0x1b76/0x1b79");
  assert.equal(m.pc, 0x1b80, "fall-through tail lands on loc_1b80");
  assert.equal(m.regs.sp, 0x8780, "stack fully unwound to baseline");
  assert.equal(m.regs.c, 0x7c, "checksum accumulator C = 0x7c");
  assert.equal(m.mem.read8(0x881e), 0x05, "(0x881e) untouched (checksum matched)");
  assert.deepEqual(m.calls, [0x02c9, 0x02e3, 0x075d, 0x0038, 0x0038, 0x7960, 0x1b80]);
});

test("loc_1b43 Path EARLY: 0x02c9 reports not-done -> ret nz at 0x1b46", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8809, 0x05); // 0x02c9 dec -> 0x04 -> Z clear -> ret nz taken

  loc_1b43(m);

  assert.equal(m.tstates, 17 + 11, "call 0x02c9 (17) + ret nz taken (11)");
  assert.deepEqual(m.pcSeq, [0x02c9, CALLER_RET], "call target then immediate ret");
  assert.equal(m.pc, CALLER_RET, "ret nz to seated caller");
  assert.equal(m.regs.sp, 0x8780, "stack balanced");
  assert.deepEqual(m.calls, [0x02c9], "only 0x02c9 ran");
});

test("loc_1b43 MUTATION: `ld (0x880a),a` at 0x1b5c mis-charged 7T (not 13) is caught", () => {
  const m = makeMachine();
  seatCaller(m);
  m.mem.write8(0x8809, 0x01);
  const realStep = m.step.bind(m);
  m.step = (nextAddr, cycles) => realStep(nextAddr, nextAddr === 0x1b5f ? 7 : cycles);

  loc_1b43(m);

  assert.equal(m.tstates, GOLDEN_BUMP - 6, "mutation loses 6 T (13 -> 7)");
  assert.throws(
    () => assert.equal(m.tstates, GOLDEN_BUMP, "Path BUMP T-state total"),
    /Path BUMP T-state total/,
    "the 1759-T golden must fail on the mutant",
  );
});
