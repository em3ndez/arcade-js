// SPDX-License-Identifier: GPL-3.0-only

// loc_29f9  (ROM 0x29F9-0x2A69) — IX sprite-object motion arm. Active while (ix+0x06)!=0 and the gate
// (0x842C)==0; counts down the (ix+0x09) move timer. On expiry it drifts the object toward/away from the
// frog X (0x8014) along (ix+0x00..0x02), or — past screen row 0x60 — steps (ix+0x03) by +2/-2, and flips
// the direction bit (ix+0x05)/(iy+0x01) at the turn.
export function loc_29f9(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);
  m.step(0x29fc, 19);
  regs.or(regs.a);
  m.step(0x29fd, 4);
  if (regs.fZ) { m.ret(11); return; } // ret z -- inactive
  m.step(0x29fe, 5);
  regs.a = mem.read8(0x842c);
  m.step(0x2a01, 13); // ld a,(0x842c) -- global gate
  regs.or(regs.a);
  m.step(0x2a02, 4);
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- gated off
  m.step(0x2a03, 5);
  regs.decMem8(mem, (regs.ix + 0x09) & 0xffff);
  m.step(0x2a06, 23); // dec (ix+0x09) -- move timer
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- not yet expired
  m.step(0x2a07, 5);
  mem.write8((regs.ix + 0x09) & 0xffff, 0x08);
  m.step(0x2a0b, 19); // ld (ix+0x09),0x08 -- reload
  regs.a = mem.read8((regs.iy + 0x03) & 0xffff);
  m.step(0x2a0e, 19);
  regs.cp(0x60);
  m.step(0x2a10, 7);
  if (regs.fNC) { m.step(0x2a3c, 12); return block_2a3c(); } // jr nc,0x2a3c -- below the row
  m.step(0x2a12, 7);
  mem.write8((regs.ix + 0x07) & 0xffff, 0x01);
  m.step(0x2a16, 19);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
  m.step(0x2a19, 19); // ld a,(ix+0x05) -- direction bit
  regs.or(regs.a);
  m.step(0x2a1a, 4);
  if (regs.fNZ) { m.step(0x2a2d, 10); return block_2a2d(); } // jp nz,0x2a2d
  m.step(0x2a1d, 10);
  regs.a = mem.read8(0x8014);
  m.step(0x2a20, 13); // ld a,(0x8014) -- frog X
  regs.sub(mem.read8((regs.ix + 0x00) & 0xffff));
  m.step(0x2a23, 19);
  if (regs.fC) { m.ret(11); return; } // ret c
  m.step(0x2a24, 5);
  regs.cp(mem.read8((regs.iy + 0x00) & 0xffff));
  m.step(0x2a27, 19);
  if (regs.fNC) { m.step(0x2a53, 12); return block_2a53(); } // jr nc,0x2a53 -- reached, turn
  m.step(0x2a29, 7);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
  m.step(0x2a2c, 23); // inc (ix+0x02) -- step toward
  m.ret(10);

  function block_2a2d() {
    regs.a = mem.read8(0x8014);
    m.step(0x2a30, 13);
    regs.sub(mem.read8((regs.ix + 0x01) & 0xffff));
    m.step(0x2a33, 19);
    regs.cp(mem.read8((regs.iy + 0x00) & 0xffff));
    m.step(0x2a36, 19);
    if (regs.fC) { m.step(0x2a53, 12); return block_2a53(); } // jr c,0x2a53
    m.step(0x2a38, 7);
    regs.decMem8(mem, (regs.ix + 0x02) & 0xffff);
    m.step(0x2a3b, 23); // dec (ix+0x02) -- step away
    m.ret(10);
  }

  function block_2a3c() {
    mem.write8((regs.ix + 0x07) & 0xffff, 0x01);
    m.step(0x2a40, 19);
    regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
    m.step(0x2a43, 19);
    regs.or(regs.a);
    m.step(0x2a44, 4);
    if (regs.fZ) { m.step(0x2a4a, 12); return block_2a4a(); } // jr z,0x2a4a
    m.step(0x2a46, 7);
    regs.a = 0x02;
    m.step(0x2a48, 7);
    m.step(0x2a4c, 12); // jr 0x2a4c
    return block_2a4c();
  }

  function block_2a4a() {
    regs.a = 0xfe;
    m.step(0x2a4c, 7); // ld a,0xfe -- -2
    return block_2a4c();
  }

  function block_2a4c() {
    regs.add(mem.read8((regs.ix + 0x03) & 0xffff));
    m.step(0x2a4f, 19); // add a,(ix+0x03) -- signed step
    mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
    m.step(0x2a52, 19);
    m.ret(10);
  }

  function block_2a53() {
    regs.a = mem.read8((regs.ix + 0x05) & 0xffff);
    m.step(0x2a56, 19);
    regs.xor(0x80);
    m.step(0x2a58, 7); // xor 0x80 -- flip direction
    mem.write8((regs.ix + 0x05) & 0xffff, regs.a);
    m.step(0x2a5b, 19);
    regs.a = mem.read8((regs.iy + 0x04) & 0xffff);
    m.step(0x2a5e, 19);
    mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
    m.step(0x2a61, 19);
    regs.a = mem.read8((regs.iy + 0x01) & 0xffff);
    m.step(0x2a64, 19);
    regs.xor(0x80);
    m.step(0x2a66, 7); // xor 0x80 -- flip sprite flip-bit
    mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
    m.step(0x2a69, 19);
    m.ret(10);
  }
}
