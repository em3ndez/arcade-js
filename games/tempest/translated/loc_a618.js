// SPDX-License-Identifier: GPL-3.0-only
// loc_a618 (ROM 0xa618-0xa65a) -- per-frame walk of the 16 enemy slots ($37 = 0x0f..0x00). Copies the
// spawn-timer $010e into $010d, then for each slot x: if $0283,x != 0 the slot is live -> jsr $a6a9 (move)
// + jsr $a721 (step) and mark $010d = 0xff (something active); else (slot free) when $010e != 0 jsr $a65b
// (spawn). After the loop, on odd $03 frames leave $010e alone else decrement it toward spawn; finally if
// $010d stayed 0 (nothing live/spawned) set $00 = 0x12 (a mode/request byte). $010e = spawn countdown.
export function loc_a618(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x010e); regs.setNZ(regs.a); m.step(0xa61b, 4);
  mem.write8(0x010d, regs.a); m.step(0xa61e, 4);
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xa620, 2);
  mem.write8(0x37, regs.x); m.step(0xa622, 3);
  while (true) {
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xa624, 3);
    { const b = 0x0283, e = (b + regs.x) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xa627, 4 + ((b & 0xff00) !== (e & 0xff00) ? 1 : 0)); }
    if (regs.fNZ) {
      // bne taken -> live slot: move + step, mark active
      m.step(0xa634, 3);
      m.push16(0xa636); m.step(0xa637, 6); m.call(0xa6a9); // jsr $a6a9
      m.push16(0xa639); m.step(0xa63a, 6); m.call(0xa721); // jsr $a721
      regs.a = 0xff; regs.setNZ(regs.a); m.step(0xa63c, 2);
      mem.write8(0x010d, regs.a); m.step(0xa63f, 4);
    } else {
      // bne not taken -> free slot
      m.step(0xa629, 2);
      regs.a = mem.read8(0x010e); regs.setNZ(regs.a); m.step(0xa62c, 4);
      if (regs.fZ) { m.step(0xa631, 3); } // beq taken -> no spawn
      else { m.step(0xa62e, 2); m.push16(0xa630); m.step(0xa631, 6); m.call(0xa65b); } // jsr $a65b (spawn)
      regs.clv(); m.step(0xa632, 2);
      m.step(0xa63f, 3); // bvc -> a63f
    }
    { const r = regs.dec8(mem.read8(0x37)); mem.write8(0x37, r); m.step(0xa641, 5); }
    if (regs.fPl) { m.step(0xa622, 3); continue; } // bpl taken -> next slot
    m.step(0xa643, 2); break;
  }
  regs.a = mem.read8(0x03); regs.setNZ(regs.a); m.step(0xa645, 3);
  regs.and(0x01); m.step(0xa647, 2);
  if (regs.fNZ) { m.step(0xa651, 3); } // bne taken (odd frame) -> skip countdown
  else {
    m.step(0xa649, 2);
    regs.a = mem.read8(0x010e); regs.setNZ(regs.a); m.step(0xa64c, 4);
    if (regs.fZ) { m.step(0xa651, 3); } // beq taken -> already 0
    else { m.step(0xa64e, 2); const r = regs.dec8(mem.read8(0x010e)); mem.write8(0x010e, r); m.step(0xa651, 6); }
  }
  regs.a = mem.read8(0x010d); regs.setNZ(regs.a); m.step(0xa654, 4);
  if (regs.fNZ) { m.step(0xa65a, 3); } // bne taken -> nothing to request
  else {
    m.step(0xa656, 2);
    regs.a = 0x12; regs.setNZ(regs.a); m.step(0xa658, 2);
    mem.write8(0x00, regs.a); m.step(0xa65a, 3);
  }
  return m.ret(6); // a65a rts
}
