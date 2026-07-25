// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter test for loc_4644 (ROM 0x4644-0x4672): copies the active player's
// 5-byte state block (stride 3) into the shared display slot at 0x8028. The
// destination base is 0x8028; the source base is 0x8029 for player 1 (the
// `dec a` on the 0x8002 index makes it zero, so `jr z` skips `inc iy`) and
// 0x802A for any other player.
//
// Asserts the T-state total for BOTH control-flow paths, the five memory
// copies, the IX/IY final values, the register (A) and flag (from `dec a`)
// residue, and the ret landing -- each against the disassembly. Ends with a
// MUTATION (the `inc iy` bump dropped) proven to be caught by both the memory
// and the T-state assertions.

import { test } from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/z80.js";
import { AddressSpace } from "../../../../boards/thepit/memory.js";
import { Io } from "../../../../boards/thepit/io.js";
import { loc_4644 } from "../loc_4644.js";

const RET = 0x1234; // sentinel return address pushed before the call

// Minimal machine: real Regs + real Pit AddressSpace, plus the step/ret seam
// loc_4644 drives. No m.call here (the routine has none).
function makeMachine(presets = {}) {
  const io = new Io();
  const mem = new AddressSpace(new Uint8Array(0x5000), io);
  const regs = new Regs();
  regs.sp = 0x8700; // stack inside work RAM (0x8000-0x87FF)

  const m = {
    regs,
    mem,
    tstates: 0,
    pc: 0x4644,
    returned: false,
    step(addr, cycles) {
      this.pc = addr;
      this.tstates += cycles;
    },
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
    ret(cycles = 10) {
      this.pc = this.pop16();
      this.tstates += cycles;
      this.returned = true;
    },
    call(addr) {
      throw new Error(`unexpected m.call(0x${addr.toString(16).padStart(4, "0")})`);
    },
  };

  for (const [addr, val] of Object.entries(presets)) {
    mem.write8(Number(addr), val);
  }
  m.push16(RET); // the return address loc_4644's `ret` must pop
  return m;
}

// The five (source-offset -> dest-address) copies, relative to each base.
const DEST = [0x8028, 0x802b, 0x802e, 0x8031, 0x8034]; // ix + {0,3,6,9,0xc}
const OFFS = [0x00, 0x03, 0x06, 0x09, 0x0c];

// Distinct byte payloads so a wrong source base is caught by the copies.
const P1 = [0xaa, 0xbb, 0xcc, 0xdd, 0xee]; // player-1 block at 0x8029..
const P2 = [0x11, 0x22, 0x33, 0x44, 0x55]; // player-2 block at 0x802a..

// Seed both player blocks (source bases 0x8029 and 0x802a) so the two paths are
// genuinely distinguishable by which bytes land in the shared slot.
function seedBoth(presets = {}) {
  for (let i = 0; i < 5; i++) {
    presets[0x8029 + OFFS[i]] = P1[i]; // player 1 source
    presets[0x802a + OFFS[i]] = P2[i]; // player >=2 source
  }
  return presets;
}

// ---- path A: player 1 (0x8002 == 1) -> source base 0x8029, NO inc iy --------
test("player 1: copies the 0x8029 block into 0x8028, IY stays 0x8029, 257 T", () => {
  const m = makeMachine(seedBoth({ 0x8002: 1 }));
  loc_4644(m);

  for (let i = 0; i < 5; i++) {
    assert.equal(m.mem.read8(DEST[i]), P1[i], `dest 0x${DEST[i].toString(16)} <- player-1 byte`);
  }
  assert.equal(m.regs.ix, 0x8028, "IX destination base unchanged");
  assert.equal(m.regs.iy, 0x8029, "IY source base NOT bumped for player 1");
  assert.equal(m.regs.a, P1[4], "A holds the last byte read (iy+0x0c)");
  // flag residue is the `dec a` of A==1 -> 0: Z set, N set, no carry
  assert.equal(m.regs.fZ, true, "dec a of 1 -> 0 sets Z");
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
  // T: head 45 (14+14+13+4) + jr-z-taken 12 + copy 190 (19*10) + ret 10
  assert.equal(m.tstates, 45 + 12 + 190 + 10);
  assert.equal(m.tstates, 257);
});

// ---- path B: player 2 (0x8002 == 2) -> inc iy -> source base 0x802a, 262 T ---
test("player 2: bumps IY to 0x802a, copies the 0x802a block, 262 T", () => {
  const m = makeMachine(seedBoth({ 0x8002: 2 }));
  loc_4644(m);

  for (let i = 0; i < 5; i++) {
    assert.equal(m.mem.read8(DEST[i]), P2[i], `dest 0x${DEST[i].toString(16)} <- player-2 byte`);
  }
  assert.equal(m.regs.ix, 0x8028);
  assert.equal(m.regs.iy, 0x802a, "IY bumped past player 1's byte");
  assert.equal(m.regs.a, P2[4]);
  // dec a of A==2 -> 1: NZ, no carry
  assert.equal(m.regs.fZ, false, "dec a of 2 -> 1 clears Z");
  assert.equal(m.returned, true);
  assert.equal(m.pc, RET);
  // T: head 45 + jr-z-not-taken 7 + inc iy 10 + copy 190 + ret 10
  assert.equal(m.tstates, 45 + 7 + 10 + 190 + 10);
  assert.equal(m.tstates, 262);
});

// ---- edge: player 0 (0x8002 == 0) still takes the not-taken path (inc iy) ----
// The branch keys on `dec a == 0` (i.e. player == 1), NOT on `a == 0`. A==0
// decrements to 0xFF (NZ), so player 0 must also bump IY to 0x802a.
test("player 0: dec a -> 0xFF (NZ) so IY still bumps to 0x802a", () => {
  const m = makeMachine(seedBoth({ 0x8002: 0 }));
  loc_4644(m);

  assert.equal(m.regs.iy, 0x802a, "player 0 also takes the inc-iy path");
  assert.equal(m.mem.read8(0x8028), P2[0], "copies the 0x802a block, not 0x8029");
  assert.equal(m.regs.fZ, false, "dec a of 0 -> 0xFF is non-zero");
  assert.equal(m.tstates, 262);
});

// ---- MUTATION: the `inc iy` bump (and its 10 T) dropped ----------------------
// A faithful reproduction of the player-2 path but with `inc iy` removed, so IY
// wrongly stays at 0x8029 and reads the player-1 block. The correct routine
// lands the P2 bytes and costs 262 T; the mutant lands the P1 bytes and costs
// 252 T -- so BOTH the memory and the T-state assertions must reject it.
function loc_4644_mut(m) {
  const { regs, mem } = m;
  regs.ix = 0x8028; m.step(0x4648, 14);
  regs.iy = 0x8029; m.step(0x464c, 14);
  regs.a = mem.read8(0x8002); m.step(0x464f, 13);
  regs.a = regs.dec8(regs.a); m.step(0x4650, 4);
  m.step(0x4652, 7); // jr z not taken (player != 1)
  // BUG: `inc iy` and its 10 T dropped -- IY wrongly stays at 0x8029.
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x4657, 19);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x465a, 19);
  regs.a = mem.read8((regs.iy + 0x03) & 0xffff); m.step(0x465d, 19);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x4660, 19);
  regs.a = mem.read8((regs.iy + 0x06) & 0xffff); m.step(0x4663, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x4666, 19);
  regs.a = mem.read8((regs.iy + 0x09) & 0xffff); m.step(0x4669, 19);
  mem.write8((regs.ix + 0x09) & 0xffff, regs.a); m.step(0x466c, 19);
  regs.a = mem.read8((regs.iy + 0x0c) & 0xffff); m.step(0x466f, 19);
  mem.write8((regs.ix + 0x0c) & 0xffff, regs.a); m.step(0x4672, 19);
  m.ret();
}

function assertPlayer2Path(fn) {
  const m = makeMachine(seedBoth({ 0x8002: 2 }));
  fn(m);
  assert.equal(m.mem.read8(0x8028), P2[0], "must copy the player-2 block at base 0x802a");
  assert.equal(m.tstates, 262, "player-2 path must cost 262 T");
}

test("the assertions have teeth: the dropped-inc-iy mutation is caught", () => {
  assertPlayer2Path(loc_4644); // the real routine passes it
  assert.throws(() => assertPlayer2Path(loc_4644_mut), /player-2 block|262 T/);
});
