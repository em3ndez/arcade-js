// SPDX-License-Identifier: GPL-3.0-only
// loc_99a5  (ROM 0x99a5-0x9a86) -- builds the per-column deficit table $013d[0..4] from $012e/$0142 and
// $02df/$028a/$011c, then per nonzero-column count (0/1/many) walks $0129/$013d/$0142 calling loc_9a87
// (rts if it returns nonzero); the no-hit tails all clear $29 and rts.
export function loc_99a5(m) {
  const { regs, mem } = m;
  tail: {
    // ---- clear $013d..$0141 ----
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0x99a7, 2);
    regs.x = 0x04; regs.setNZ(regs.x); m.step(0x99a9, 2);
    while (true) {
      mem.write8((0x013d + regs.x) & 0xffff, regs.a); m.step(0x99ac, 5);
      regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x99ad, 2);
      if (!regs.fN) { m.step(0x99a9, 3); continue; }
      m.step(0x99af, 2); break;
    }
    // ---- $013d[x] = $012e[x] - $0142[x] where nonnegative ----
    regs.x = 0x04; regs.setNZ(regs.x); m.step(0x99b1, 2);
    while (true) {
      regs.a = mem.read8((0x012e + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x99b4, 4);
      regs.sec(); m.step(0x99b5, 2);
      regs.sbc(mem.read8((0x0142 + regs.x) & 0xffff)); m.step(0x99b8, 4);
      if (regs.fNC) { m.step(0x99bd, 3); }
      else {
        m.step(0x99ba, 2);
        mem.write8((0x013d + regs.x) & 0xffff, regs.a); m.step(0x99bd, 5);
      }
      regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x99be, 2);
      if (!regs.fN) { m.step(0x99b1, 3); continue; }
      m.step(0x99c0, 2); break;
    }
    // ---- for y=$011c..0: if $02df[y] && ($028a[y]&3), dec $013c[x] twice (x from that&3, remapped 3->5) ----
    regs.y = mem.read8(0x011c); regs.setNZ(regs.y); m.step(0x99c3, 4);
    while (true) {
      iter: {
        regs.a = mem.read8((0x02df + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x99c6, 4);
        if (regs.fZ) { m.step(0x99dc, 3); break iter; }
        m.step(0x99c8, 2);
        regs.a = mem.read8((0x028a + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x99cb, 4);
        regs.and(0x03); m.step(0x99cd, 2);
        if (regs.fZ) { m.step(0x99dc, 3); break iter; }
        m.step(0x99cf, 2);
        regs.x = regs.a; regs.setNZ(regs.x); m.step(0x99d0, 2);
        regs.cpx(0x03); m.step(0x99d2, 2);
        if (regs.fNZ) { m.step(0x99d6, 3); }
        else {
          m.step(0x99d4, 2);
          regs.x = 0x05; regs.setNZ(regs.x); m.step(0x99d6, 2);
        }
        { const a = (0x013c + regs.x) & 0xffff; const v = (mem.read8(a) - 1) & 0xff; mem.write8(a, v); regs.setNZ(v); } m.step(0x99d9, 7);
        { const a = (0x013c + regs.x) & 0xffff; const v = (mem.read8(a) - 1) & 0xff; mem.write8(a, v); regs.setNZ(v); } m.step(0x99dc, 7);
      }
      regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0x99dd, 2);
      if (!regs.fN) { m.step(0x99c3, 3); continue; }
      m.step(0x99df, 2); break;
    }
    // ---- A = ($011c+1) - sum($0142[0..4]) ----
    regs.x = 0x04; regs.setNZ(regs.x); m.step(0x99e1, 2);
    regs.a = mem.read8(0x011c); regs.setNZ(regs.a); m.step(0x99e4, 4);
    regs.clc(); m.step(0x99e5, 2);
    regs.adc(0x01); m.step(0x99e7, 2);
    while (true) {
      regs.sec(); m.step(0x99e8, 2);
      regs.sbc(mem.read8((0x0142 + regs.x) & 0xffff)); m.step(0x99eb, 4);
      regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x99ec, 2);
      if (!regs.fN) { m.step(0x99e7, 3); continue; }
      m.step(0x99ee, 2); break;
    }
    // ---- $013d[x] = min($013d[x], A) for x=4..0 ----
    regs.x = 0x04; regs.setNZ(regs.x); m.step(0x99f0, 2);
    while (true) {
      regs.cmp(mem.read8((0x013d + regs.x) & 0xffff)); m.step(0x99f3, 4);
      if (regs.fC) { m.step(0x99f8, 3); }
      else {
        m.step(0x99f5, 2);
        mem.write8((0x013d + regs.x) & 0xffff, regs.a); m.step(0x99f8, 5);
      }
      regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x99f9, 2);
      if (!regs.fN) { m.step(0x99f0, 3); continue; }
      m.step(0x99fb, 2); break;
    }
    // ---- Y = count of nonzero $013d[0..4] ----
    regs.x = 0x04; regs.setNZ(regs.x); m.step(0x99fd, 2);
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0x99ff, 2);
    while (true) {
      regs.a = mem.read8((0x013d + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x9a02, 4);
      if (regs.fZ) { m.step(0x9a05, 3); }
      else {
        m.step(0x9a04, 2);
        regs.y = (regs.y + 1) & 0xff; regs.setNZ(regs.y); m.step(0x9a05, 2);
      }
      regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x9a06, 2);
      if (!regs.fN) { m.step(0x99ff, 3); continue; }
      m.step(0x9a08, 2); break;
    }
    // ---- dispatch on the count ----
    regs.a = regs.y; regs.setNZ(regs.a); m.step(0x9a09, 2);
    if (regs.fZ) { m.step(0x9a82, 3); break tail; }
    m.step(0x9a0b, 2);
    regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0x9a0c, 2);
    if (regs.fNZ) { m.step(0x9a26, 3); }
    else {
      m.step(0x9a0e, 2);
      // ===== block A: single nonzero column =====
      regs.x = 0x04; regs.setNZ(regs.x); m.step(0x9a10, 2);
      while (true) {
        aiter: {
          regs.a = mem.read8((0x013d + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x9a13, 4);
          if (regs.fZ) { m.step(0x9a20, 3); break aiter; }
          m.step(0x9a15, 2);
          regs.a = mem.read8((0x0129 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x9a18, 4);
          if (regs.fZ) { m.step(0x9a20, 3); break aiter; }
          m.step(0x9a1a, 2);
          m.push16(0x9a1c); m.step(0x9a1d, 6); m.call(0x9a87);
          if (regs.fZ) { m.step(0x9a20, 3); break aiter; }
          m.step(0x9a1f, 2);
          return m.ret(6);
        }
        regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x9a21, 2);
        if (!regs.fN) { m.step(0x9a10, 3); continue; }
        m.step(0x9a23, 2); break;
      }
      regs.clv(); m.step(0x9a24, 2);
      m.step(0x9a82, 3); break tail;
    }
    // ===== block B: many nonzero columns (reached via 9a0c bne) =====
    mem.write8(0x0061, regs.y); m.step(0x9a28, 3);
    regs.x = 0x04; regs.setNZ(regs.x); m.step(0x9a2a, 2);
    while (true) {
      biter: {
        regs.a = mem.read8((0x013d + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x9a2d, 4);
        if (regs.fZ) { m.step(0x9a3d, 3); break biter; }
        m.step(0x9a2f, 2);
        regs.a = mem.read8((0x0142 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x9a32, 4);
        regs.cmp(mem.read8((0x0129 + regs.x) & 0xffff)); m.step(0x9a35, 4);
        if (regs.fC) { m.step(0x9a3d, 3); break biter; }
        m.step(0x9a37, 2);
        m.push16(0x9a39); m.step(0x9a3a, 6); m.call(0x9a87);
        if (regs.fZ) { m.step(0x9a3d, 3); break biter; }
        m.step(0x9a3c, 2);
        return m.ret(6);
      }
      regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x9a3e, 2);
      if (!regs.fN) { m.step(0x9a2a, 3); continue; }
      m.step(0x9a40, 2); break;
    }
    // ---- if $0140 && $013f: pick x from $03ac[$2a] vs 0xcc, try loc_9a87 ----
    b40: {
      regs.a = mem.read8(0x0140); regs.setNZ(regs.a); m.step(0x9a43, 4);
      if (regs.fZ) { m.step(0x9a61, 3); break b40; }
      m.step(0x9a45, 2);
      regs.a = mem.read8(0x013f); regs.setNZ(regs.a); m.step(0x9a48, 4);
      if (regs.fZ) { m.step(0x9a61, 3); break b40; }
      m.step(0x9a4a, 2);
      regs.y = mem.read8(0x2a); regs.setNZ(regs.y); m.step(0x9a4c, 3);
      regs.a = mem.read8((0x03ac + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9a4f, 4);
      if (regs.fNZ) { m.step(0x9a53, 3); }
      else {
        m.step(0x9a51, 2);
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0x9a53, 2);
      }
      regs.x = 0x03; regs.setNZ(regs.x); m.step(0x9a55, 2);
      regs.cmp(0xcc); m.step(0x9a57, 2);
      if (regs.fC) { m.step(0x9a5b, 3); }
      else {
        m.step(0x9a59, 2);
        regs.x = 0x02; regs.setNZ(regs.x); m.step(0x9a5b, 2);
      }
      m.push16(0x9a5d); m.step(0x9a5e, 6); m.call(0x9a87);
      if (regs.fZ) { m.step(0x9a61, 3); break b40; }
      m.step(0x9a60, 2);
      return m.ret(6);
    }
    // ---- final sweep: x from ($60da&3)+1, y=4..0 over $0129/$013d ----
    regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0x9a64, 4);
    regs.and(0x03); m.step(0x9a66, 2);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0x9a67, 2);
    regs.x = (regs.x + 1) & 0xff; regs.setNZ(regs.x); m.step(0x9a68, 2);
    regs.y = 0x04; regs.setNZ(regs.y); m.step(0x9a6a, 2);
    while (true) {
      citer: {
        regs.a = mem.read8((0x0129 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x9a6d, 4);
        if (regs.fZ) { m.step(0x9a7a, 3); break citer; }
        m.step(0x9a6f, 2);
        regs.a = mem.read8((0x013d + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0x9a72, 4);
        if (regs.fZ) { m.step(0x9a7a, 3); break citer; }
        m.step(0x9a74, 2);
        m.push16(0x9a76); m.step(0x9a77, 6); m.call(0x9a87);
        if (regs.fZ) { m.step(0x9a7a, 3); break citer; }
        m.step(0x9a79, 2);
        return m.ret(6);
      }
      regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x9a7b, 2);
      if (!regs.fN) { m.step(0x9a7f, 3); }
      else {
        m.step(0x9a7d, 2);
        regs.x = 0x04; regs.setNZ(regs.x); m.step(0x9a7f, 2);
      }
      regs.y = (regs.y - 1) & 0xff; regs.setNZ(regs.y); m.step(0x9a80, 2);
      if (!regs.fN) { m.step(0x9a6a, 3); continue; }
      m.step(0x9a82, 2); break;
    }
  }
  // ---- 9a82 tail: clear $29 and return ----
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9a84, 2);
  mem.write8(0x0029, regs.a); m.step(0x9a86, 3);
  return m.ret(6);
}
