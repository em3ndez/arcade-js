// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_99a5 (ROM 0x99a5-0x9a86). Minimal 6502 harness (Regs + flat RAM + the page-1
// stack seam); author-derived. JSR $9a87 is opaque here: the harness records the call, balances the pushed
// return, and an optional onCall hook stamps the Z flag the callee would leave so both the "return nonzero
// -> rts" and "return zero -> keep scanning" arms are exercised. The whole-machine state diff vs MAME is the
// integration check. Run: node --test games/tempest/translated/test/equivalence-99a5.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_99a5 } from "../loc_99a5.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [], onCall: null,
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } if (this.onCall) this.onCall(a); return undefined; },
  };
}

// count==0 path: every $013d column ends zero, so `tya` sets Z and `beq 0x9a82` clears $29 and returns.
test("loc_99a5: zero nonzero-columns -> clears $29, RTS, no JSR; 363 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000); // RTS -> 0x1001
  m.ram[0x0029] = 0x5a; // will be cleared by the tail
  m.ram[0x011c] = 0x00; // Y=0: loop3 runs once and is skipped
  m.ram[0x02df] = 0x00; // $02df[0]==0 -> loop3 body skipped
  for (let x = 0; x < 5; x++) { m.ram[0x012e + x] = 0x00; m.ram[0x0142 + x] = 0x01; } // $012e-$0142 < 0 -> $013d stays 0

  loc_99a5(m);

  assert.equal(m.ram[0x0029], 0x00, "$29 cleared by the 0x9a82 tail");
  assert.equal(m.pc, 0x1001, "RTS returns to pushed + 1");
  assert.deepEqual(m.calls, [], "no JSR $9a87 on the empty-column path");
  for (let x = 0; x < 5; x++) assert.equal(m.ram[0x013d + x], 0x00, `$013d[${x}] stays 0`);
  assert.equal(m.cycles, 363, "full setup sweep + beq 0x9a82 + tail");
});

// Exactly one nonzero column, its $0129 slot set, JSR $9a87 returns nonzero -> internal RTS at 0x9a1f.
test("loc_99a5: single column, JSR returns nonzero -> RTS at 0x9a1f; calls [0x9a87]; 452 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x0029] = 0x5a; // must survive: block-A RTS returns before the $29-clear tail
  m.ram[0x011c] = 0x00;
  m.ram[0x02df] = 0x00;
  for (let x = 0; x < 5; x++) { m.ram[0x0142 + x] = 0x00; m.ram[0x012e + x] = 0x00; }
  m.ram[0x012e] = 0x01; // -> $013d[0] = 1 (only nonzero column, x=0)
  m.ram[0x0129] = 0x10; // $0129[0] nonzero so the JSR arm is reached
  m.onCall = () => { m.regs.setNZ(0x01); }; // callee returns nonzero -> Z clear

  loc_99a5(m);

  assert.equal(m.ram[0x013d], 0x01, "$013d[0] holds the single deficit");
  assert.deepEqual(m.calls, [0x9a87], "one JSR $9a87 from block A");
  assert.equal(m.pc, 0x1001, "RTS at 0x9a1f returns to pushed + 1");
  assert.equal(m.ram[0x0029], 0x5a, "block-A RTS does not reach the $29-clear tail");
  assert.equal(m.regs.fZ, false, "Z clear from the callee's nonzero return");
  assert.equal(m.cycles, 452, "setup sweep + block-A scan hitting the JSR then RTS");
});

// Same single-column setup but JSR returns zero -> scan exhausts, clv/bvc falls to the 0x9a82 tail.
test("loc_99a5: single column, JSR returns zero -> clv/bvc to tail, clears $29; 467 T", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x0029] = 0x77;
  m.ram[0x011c] = 0x00;
  m.ram[0x02df] = 0x00;
  for (let x = 0; x < 5; x++) { m.ram[0x0142 + x] = 0x00; m.ram[0x012e + x] = 0x00; }
  m.ram[0x012e] = 0x01;
  m.ram[0x0129] = 0x10;
  m.onCall = () => { m.regs.setNZ(0x00); }; // callee returns zero -> Z set -> beq 0x9a20 taken

  loc_99a5(m);

  assert.deepEqual(m.calls, [0x9a87], "one JSR $9a87, then the loop exhausts");
  assert.equal(m.ram[0x0029], 0x00, "reached the 0x9a82 tail -> $29 cleared");
  assert.equal(m.pc, 0x1001, "tail RTS returns to pushed + 1");
  assert.equal(m.cycles, 467, "setup + block-A scan (JSR, keep going) + clv/bvc + tail");
});

// loop3 side effect: nonzero $02df[y] with ($028a[y]&3)!=0 dec's $013c[x] twice (x remapped 3->5).
// loop2 seeds $013d[0]=3 (=$012e[0]); loop3 dec's it twice to 1; loop4's A=$011c+1=0x11 keeps loop5 from
// clamping it (0x11 >= 1). Net observable: $013d[0] == 1.
test("loc_99a5: loop3 dec's $013c[x] twice when $02df[y] and $028a[y]&3 are set", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x011c] = 0x10; // loop3 runs y=0x10..0; loop4 A = 0x11 (won't clamp)
  m.ram[0x02df] = 0x01; // $02df[0] nonzero -> loop3 body runs at y=0
  m.ram[0x028a] = 0x01; // &3 = 1 -> x=1 -> dec $013c+1 == $013d[0] twice
  for (let x = 0; x < 5; x++) { m.ram[0x012e + x] = 0x00; m.ram[0x0142 + x] = 0x00; }
  m.ram[0x012e] = 0x03; // loop2 -> $013d[0] = 3

  loc_99a5(m);

  assert.equal(m.ram[0x013d], 0x01, "$013d[0]: 3 (loop2) decremented twice by loop3 -> 1, not clamped");
});

// MUTATION: a mischarged JSR (7T instead of 6T) blows the golden T-state total.
test("loc_99a5 MUTATION: JSR mischarged 7T is caught by the total", () => {
  const m = makeMachine();
  m.regs.s = 0xfd;
  m.push16(0x1000);
  m.ram[0x011c] = 0x00;
  m.ram[0x02df] = 0x00;
  for (let x = 0; x < 5; x++) { m.ram[0x0142 + x] = 0x00; m.ram[0x012e + x] = 0x00; }
  m.ram[0x012e] = 0x01;
  m.ram[0x0129] = 0x10;
  m.onCall = () => { m.regs.setNZ(0x01); };
  const realStep = m.step.bind(m);
  m.step = (n, c) => realStep(n, n === 0x9a1d ? 7 : c); // the JSR step lands PC at 0x9a1d
  loc_99a5(m);
  assert.notEqual(m.cycles, 452, "a mischarged JSR cycle blows the golden total");
});
