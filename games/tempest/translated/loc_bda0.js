// SPDX-License-Identifier: GPL-3.0-only
// loc_bda0  (ROM 0xbda0-0xbfb4) -- early-out unless $5b<0 or $57>=$5f; sets up $56/$57/$58 pairs,
// calls df4c/c098/c765/c098/df6c, forms clamped signed deltas ($79 from $61-$6a, $89 from $63-$6c),
// runs a 24-bit x5 spread math block, then loops the $bfd2/$bfd3 table writing 4-byte records via
// ($74),y ($99 times); tail-jumps to df5f. loc_bdcb is a mid-entry (jsr'd from 0xb607/0xb751): it
// enters at the $5b<0/$57>=$5f early-out check (0xbdcb), skipping loc_bda0's 0xbda0-0xbdca setup.
export function loc_bda0(m) {
  const { regs, mem } = m;
  mem.write8(0x36, regs.a); m.step(0xbda2, 3);
  regs.a = mem.read8((0x03ce + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbda5, 4);
  mem.write8(0x56, regs.a); m.step(0xbda7, 3);
  regs.a = mem.read8((0x03de + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbdaa, 4);
  mem.write8(0x58, regs.a); m.step(0xbdac, 3);
  regs.a = mem.read8(0x57); regs.setNZ(regs.a); m.step(0xbdae, 3);
  mem.write8(0x2f, regs.a); m.step(0xbdb0, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xbdb1, 2);
  regs.clc(); m.step(0xbdb2, 2);
  regs.adc(0x01); m.step(0xbdb4, 2);
  regs.and(0x0f); m.step(0xbdb6, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xbdb7, 2);
  regs.a = mem.read8((0x03ce + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xbdba, 4);
  mem.write8(0x2e, regs.a); m.step(0xbdbc, 3);
  regs.a = mem.read8((0x03de + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xbdbf, 4);
  mem.write8(0x30, regs.a); m.step(0xbdc1, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xbdc3, 2);
  mem.write8(0x59, regs.a); m.step(0xbdc5, 3);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xbdc7, 2);
  mem.write8(0x5a, regs.a); m.step(0xbdc9, 3);
  regs.y = mem.read8(0x36); regs.setNZ(regs.y); m.step(0xbdcb, 3);
  return loc_bdcb(m);
}

export function loc_bdcb(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x5b); regs.setNZ(regs.a); m.step(0xbdcd, 3);
  if (regs.fN) {
    m.step(0xbdd6, 3);
  } else {
    m.step(0xbdcf, 2);
    regs.a = mem.read8(0x57); regs.setNZ(regs.a); m.step(0xbdd1, 3);
    regs.cmp(mem.read8(0x5f)); m.step(0xbdd3, 3);
    if (regs.fC) {
      m.step(0xbdd6, 3);
    } else {
      m.step(0xbdd5, 2);
      return m.ret(6);
    }
  }
  // bdd6:
  regs.a = mem.read8((0xbfb6 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbdd9, 4);
  mem.write8(0x99, regs.a); m.step(0xbddb, 3);
  regs.a = mem.read8((0xbfc4 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbdde, 4);
  mem.write8(0x38, regs.a); m.step(0xbde0, 3);
  regs.y = mem.read8(0x9e); regs.setNZ(regs.y); m.step(0xbde2, 3);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xbde4, 2);
  m.push16(0xbde6); m.step(0xbde7, 6); m.call(0xdf4c);
  m.push16(0xbde9); m.step(0xbdea, 6); m.call(0xc098);
  regs.x = 0x61; regs.setNZ(regs.x); m.step(0xbdec, 2);
  m.push16(0xbdee); m.step(0xbdef, 6); m.call(0xc765);
  regs.a = mem.read8(0x2e); regs.setNZ(regs.a); m.step(0xbdf1, 3);
  mem.write8(0x56, regs.a); m.step(0xbdf3, 3);
  regs.a = mem.read8(0x2f); regs.setNZ(regs.a); m.step(0xbdf5, 3);
  mem.write8(0x57, regs.a); m.step(0xbdf7, 3);
  regs.a = mem.read8(0x30); regs.setNZ(regs.a); m.step(0xbdf9, 3);
  mem.write8(0x58, regs.a); m.step(0xbdfb, 3);
  m.push16(0xbdfd); m.step(0xbdfe, 6); m.call(0xc098);
  regs.y = mem.read8(0x59); regs.setNZ(regs.y); m.step(0xbe00, 3);
  regs.a = mem.read8(0x5a); regs.setNZ(regs.a); m.step(0xbe02, 3);
  m.push16(0xbe04); m.step(0xbe05, 6); m.call(0xdf6c);
  regs.a = mem.read8(0x61); regs.setNZ(regs.a); m.step(0xbe07, 3);
  regs.sec(); m.step(0xbe08, 2);
  regs.sbc(mem.read8(0x6a)); m.step(0xbe0a, 3);
  mem.write8(0x79, regs.a); m.step(0xbe0c, 3);
  regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xbe0e, 3);
  regs.sbc(mem.read8(0x6b)); m.step(0xbe10, 3);
  mem.write8(0x9b, regs.a); m.step(0xbe12, 3);
  // ---- clamp delta 1 -> $79, converge at be33 ----
  if (regs.fN) {
    m.step(0xbe1d, 3);
    regs.cmp(0xff); m.step(0xbe1f, 2);
    if (regs.fZ) {
      m.step(0xbe26, 3);
      regs.a = mem.read8(0x79); regs.setNZ(regs.a); m.step(0xbe28, 3);
      regs.eor(0xff); m.step(0xbe2a, 2);
      regs.clc(); m.step(0xbe2b, 2);
      regs.adc(0x01); m.step(0xbe2d, 2);
      if (regs.fNC) {
        m.step(0xbe31, 3);
      } else {
        m.step(0xbe2f, 2);
        regs.a = 0xff; regs.setNZ(regs.a); m.step(0xbe31, 2);
      }
    } else {
      m.step(0xbe21, 2);
      regs.a = 0xff; regs.setNZ(regs.a); m.step(0xbe23, 2);
      regs.clv(); m.step(0xbe24, 2);
      m.step(0xbe31, 3);
    }
    mem.write8(0x79, regs.a); m.step(0xbe33, 3);
  } else {
    m.step(0xbe14, 2);
    if (regs.fZ) {
      m.step(0xbe1a, 3);
    } else {
      m.step(0xbe16, 2);
      regs.a = 0xff; regs.setNZ(regs.a); m.step(0xbe18, 2);
      mem.write8(0x79, regs.a); m.step(0xbe1a, 3);
    }
    regs.clv(); m.step(0xbe1b, 2);
    m.step(0xbe33, 3);
  }
  // be33:
  regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xbe35, 3);
  regs.sec(); m.step(0xbe36, 2);
  regs.sbc(mem.read8(0x6c)); m.step(0xbe38, 3);
  mem.write8(0x89, regs.a); m.step(0xbe3a, 3);
  regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xbe3c, 3);
  regs.sbc(mem.read8(0x6d)); m.step(0xbe3e, 3);
  mem.write8(0x9d, regs.a); m.step(0xbe40, 3);
  // ---- clamp delta 2 -> $89, converge at be5d ----
  if (regs.fN) {
    m.step(0xbe4b, 3);
    regs.cmp(0xff); m.step(0xbe4d, 2);
    if (regs.fZ) {
      m.step(0xbe54, 3);
      regs.a = mem.read8(0x89); regs.setNZ(regs.a); m.step(0xbe56, 3);
      regs.eor(0xff); m.step(0xbe58, 2);
      regs.clc(); m.step(0xbe59, 2);
      regs.adc(0x01); m.step(0xbe5b, 2);
    } else {
      m.step(0xbe4f, 2);
      regs.a = 0xff; regs.setNZ(regs.a); m.step(0xbe51, 2);
      regs.clv(); m.step(0xbe52, 2);
      m.step(0xbe5b, 3);
    }
    mem.write8(0x89, regs.a); m.step(0xbe5d, 3);
  } else {
    m.step(0xbe42, 2);
    if (regs.fZ) {
      m.step(0xbe48, 3);
    } else {
      m.step(0xbe44, 2);
      regs.a = 0xff; regs.setNZ(regs.a); m.step(0xbe46, 2);
      mem.write8(0x89, regs.a); m.step(0xbe48, 3);
    }
    regs.clv(); m.step(0xbe49, 2);
    m.step(0xbe5d, 3);
  }
  // be5d: 24-bit x5 spread math (no branches)
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xbe5f, 2);
  mem.write8(0x82, regs.a); m.step(0xbe61, 3);
  mem.write8(0x92, regs.a); m.step(0xbe63, 3);
  regs.a = mem.read8(0x79); regs.setNZ(regs.a); m.step(0xbe65, 3);
  regs.a = regs.asl(regs.a); m.step(0xbe66, 2);
  mem.write8(0x82, regs.rol(mem.read8(0x82))); m.step(0xbe68, 5);
  mem.write8(0x7a, regs.a); m.step(0xbe6a, 3);
  regs.a = regs.asl(regs.a); m.step(0xbe6b, 2);
  mem.write8(0x7c, regs.a); m.step(0xbe6d, 3);
  regs.a = mem.read8(0x82); regs.setNZ(regs.a); m.step(0xbe6f, 3);
  regs.a = regs.rol(regs.a); m.step(0xbe70, 2);
  mem.write8(0x84, regs.a); m.step(0xbe72, 3);
  regs.a = mem.read8(0x7c); regs.setNZ(regs.a); m.step(0xbe74, 3);
  regs.adc(mem.read8(0x79)); m.step(0xbe76, 3);
  mem.write8(0x7d, regs.a); m.step(0xbe78, 3);
  regs.a = mem.read8(0x84); regs.setNZ(regs.a); m.step(0xbe7a, 3);
  regs.adc(0x00); m.step(0xbe7c, 2);
  mem.write8(0x85, regs.a); m.step(0xbe7e, 3);
  regs.a = mem.read8(0x7a); regs.setNZ(regs.a); m.step(0xbe80, 3);
  regs.adc(mem.read8(0x79)); m.step(0xbe82, 3);
  mem.write8(0x7b, regs.a); m.step(0xbe84, 3);
  regs.a = mem.read8(0x82); regs.setNZ(regs.a); m.step(0xbe86, 3);
  regs.adc(0x00); m.step(0xbe88, 2);
  mem.write8(0x83, regs.a); m.step(0xbe8a, 3);
  mem.write8(0x86, regs.a); m.step(0xbe8c, 3);
  regs.a = mem.read8(0x7b); regs.setNZ(regs.a); m.step(0xbe8e, 3);
  regs.a = regs.asl(regs.a); m.step(0xbe8f, 2);
  mem.write8(0x7e, regs.a); m.step(0xbe91, 3);
  mem.write8(0x86, regs.rol(mem.read8(0x86))); m.step(0xbe93, 5);
  regs.adc(mem.read8(0x79)); m.step(0xbe95, 3);
  mem.write8(0x7f, regs.a); m.step(0xbe97, 3);
  regs.a = mem.read8(0x86); regs.setNZ(regs.a); m.step(0xbe99, 3);
  regs.adc(0x00); m.step(0xbe9b, 2);
  mem.write8(0x87, regs.a); m.step(0xbe9d, 3);
  regs.a = mem.read8(0x89); regs.setNZ(regs.a); m.step(0xbe9f, 3);
  regs.a = regs.asl(regs.a); m.step(0xbea0, 2);
  mem.write8(0x92, regs.rol(mem.read8(0x92))); m.step(0xbea2, 5);
  mem.write8(0x8a, regs.a); m.step(0xbea4, 3);
  regs.a = regs.asl(regs.a); m.step(0xbea5, 2);
  mem.write8(0x8c, regs.a); m.step(0xbea7, 3);
  regs.a = mem.read8(0x92); regs.setNZ(regs.a); m.step(0xbea9, 3);
  regs.a = regs.rol(regs.a); m.step(0xbeaa, 2);
  mem.write8(0x94, regs.a); m.step(0xbeac, 3);
  regs.a = mem.read8(0x8c); regs.setNZ(regs.a); m.step(0xbeae, 3);
  regs.adc(mem.read8(0x89)); m.step(0xbeb0, 3);
  mem.write8(0x8d, regs.a); m.step(0xbeb2, 3);
  regs.a = mem.read8(0x94); regs.setNZ(regs.a); m.step(0xbeb4, 3);
  regs.adc(0x00); m.step(0xbeb6, 2);
  mem.write8(0x95, regs.a); m.step(0xbeb8, 3);
  regs.a = mem.read8(0x8a); regs.setNZ(regs.a); m.step(0xbeba, 3);
  regs.adc(mem.read8(0x89)); m.step(0xbebc, 3);
  mem.write8(0x8b, regs.a); m.step(0xbebe, 3);
  regs.a = mem.read8(0x92); regs.setNZ(regs.a); m.step(0xbec0, 3);
  regs.adc(0x00); m.step(0xbec2, 2);
  mem.write8(0x93, regs.a); m.step(0xbec4, 3);
  mem.write8(0x96, regs.a); m.step(0xbec6, 3);
  regs.a = mem.read8(0x8b); regs.setNZ(regs.a); m.step(0xbec8, 3);
  regs.a = regs.asl(regs.a); m.step(0xbec9, 2);
  mem.write8(0x8e, regs.a); m.step(0xbecb, 3);
  mem.write8(0x96, regs.rol(mem.read8(0x96))); m.step(0xbecd, 5);
  regs.adc(mem.read8(0x89)); m.step(0xbecf, 3);
  mem.write8(0x8f, regs.a); m.step(0xbed1, 3);
  regs.a = mem.read8(0x96); regs.setNZ(regs.a); m.step(0xbed3, 3);
  regs.adc(0x00); m.step(0xbed5, 2);
  mem.write8(0x97, regs.a); m.step(0xbed7, 3);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0xbed9, 2);
  mem.write8(0xa9, regs.y); m.step(0xbedb, 3);
  // ---- record-emit loop: bedb..bfac, exits when $99 hits 0 ----
  do {
    regs.y = mem.read8(0x38); regs.setNZ(regs.y); m.step(0xbedd, 3);
    regs.a = mem.read8((0xbfd3 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbee0, 4);
    regs.cmp(0x01); m.step(0xbee2, 2);
    if (regs.fNZ) {
      m.step(0xbee6, 3);
    } else {
      m.step(0xbee4, 2);
      regs.a = 0xc0; regs.setNZ(regs.a); m.step(0xbee6, 2);
    }
    mem.write8(0x73, regs.a); m.step(0xbee8, 3);
    regs.a = mem.read8((0xbfd2 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbeeb, 4);
    mem.write8(0x2d, regs.a); m.step(0xbeed, 3);
    regs.y = regs.inc8(regs.y); m.step(0xbeee, 2);
    regs.y = regs.inc8(regs.y); m.step(0xbeef, 2);
    mem.write8(0x38, regs.y); m.step(0xbef1, 3);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xbef2, 2);
    regs.and(0x07); m.step(0xbef4, 2);
    regs.y = regs.a; regs.setNZ(regs.y); m.step(0xbef5, 2);
    regs.a = regs.x; regs.setNZ(regs.a); m.step(0xbef6, 2);
    regs.a = regs.asl(regs.a); m.step(0xbef7, 2);
    mem.write8(0x2b, regs.a); m.step(0xbef9, 3);
    regs.a = regs.lsr(regs.a); m.step(0xbefa, 2);
    regs.a = regs.lsr(regs.a); m.step(0xbefb, 2);
    regs.a = regs.lsr(regs.a); m.step(0xbefc, 2);
    regs.a = regs.lsr(regs.a); m.step(0xbefd, 2);
    regs.and(0x07); m.step(0xbeff, 2);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xbf00, 2);
    regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0xbf02, 3);
    regs.eor(mem.read8(0x9b)); m.step(0xbf04, 3);
    if (regs.fN) {
      m.step(0xbf11, 3);
      regs.a = mem.read8((0x0078 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbf14, 4);
      regs.eor(0xff); m.step(0xbf16, 2);
      regs.clc(); m.step(0xbf17, 2);
      regs.adc(0x01); m.step(0xbf19, 2);
      mem.write8(0x61, regs.a); m.step(0xbf1b, 3);
      regs.a = mem.read8((0x0080 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbf1e, 4);
      regs.eor(0xff); m.step(0xbf20, 2);
      regs.adc(0x00); m.step(0xbf22, 2);
    } else {
      m.step(0xbf06, 2);
      regs.a = mem.read8((0x0078 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbf09, 4);
      mem.write8(0x61, regs.a); m.step(0xbf0b, 3);
      regs.a = mem.read8((0x0080 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbf0e, 4);
      regs.clv(); m.step(0xbf0f, 2);
      m.step(0xbf22, 3);
    }
    mem.write8(0x62, regs.a); m.step(0xbf24, 3);
    regs.a = mem.read8(0x2d); regs.setNZ(regs.a); m.step(0xbf26, 3);
    regs.eor(mem.read8(0x9d)); m.step(0xbf28, 3);
    if (regs.fPl) {
      m.step(0xbf38, 3);
      regs.a = mem.read8(0x61); regs.setNZ(regs.a); m.step(0xbf3a, 3);
      regs.sec(); m.step(0xbf3b, 2);
      regs.sbc(mem.read8((0x88 + regs.x) & 0xff)); m.step(0xbf3d, 4);
      mem.write8(0x61, regs.a); m.step(0xbf3f, 3);
      regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xbf41, 3);
      regs.sbc(mem.read8((0x90 + regs.x) & 0xff)); m.step(0xbf43, 4);
    } else {
      m.step(0xbf2a, 2);
      regs.a = mem.read8((0x88 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xbf2c, 4);
      regs.clc(); m.step(0xbf2d, 2);
      regs.adc(mem.read8(0x61)); m.step(0xbf2f, 3);
      mem.write8(0x61, regs.a); m.step(0xbf31, 3);
      regs.a = mem.read8((0x90 + regs.x) & 0xff); regs.setNZ(regs.a); m.step(0xbf33, 4);
      regs.adc(mem.read8(0x62)); m.step(0xbf35, 3);
      regs.clv(); m.step(0xbf36, 2);
      m.step(0xbf43, 3);
    }
    mem.write8(0x62, regs.a); m.step(0xbf45, 3);
    regs.a = mem.read8(0x2b); regs.setNZ(regs.a); m.step(0xbf47, 3);
    regs.eor(mem.read8(0x9d)); m.step(0xbf49, 3);
    if (regs.fN) {
      m.step(0xbf56, 3);
      regs.a = mem.read8((0x0088 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbf59, 4);
      regs.eor(0xff); m.step(0xbf5b, 2);
      regs.clc(); m.step(0xbf5c, 2);
      regs.adc(0x01); m.step(0xbf5e, 2);
      mem.write8(0x63, regs.a); m.step(0xbf60, 3);
      regs.a = mem.read8((0x0090 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbf63, 4);
      regs.eor(0xff); m.step(0xbf65, 2);
      regs.adc(0x00); m.step(0xbf67, 2);
    } else {
      m.step(0xbf4b, 2);
      regs.a = mem.read8((0x0088 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbf4e, 4);
      mem.write8(0x63, regs.a); m.step(0xbf50, 3);
      regs.a = mem.read8((0x0090 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xbf53, 4);
      regs.clv(); m.step(0xbf54, 2);
      m.step(0xbf67, 3);
    }
    mem.write8(0x64, regs.a); m.step(0xbf69, 3);
    regs.a = mem.read8(0x2d); regs.setNZ(regs.a); m.step(0xbf6b, 3);
    regs.eor(mem.read8(0x9b)); m.step(0xbf6d, 3);
    if (regs.fPl) {
      m.step(0xbf7d, 3);
      regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xbf7f, 3);
      regs.clc(); m.step(0xbf80, 2);
      regs.adc(mem.read8((0x78 + regs.x) & 0xff)); m.step(0xbf82, 4);
      mem.write8(0x63, regs.a); m.step(0xbf84, 3);
      regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xbf86, 3);
      regs.adc(mem.read8((0x80 + regs.x) & 0xff)); m.step(0xbf88, 4);
    } else {
      m.step(0xbf6f, 2);
      regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xbf71, 3);
      regs.sec(); m.step(0xbf72, 2);
      regs.sbc(mem.read8((0x78 + regs.x) & 0xff)); m.step(0xbf74, 4);
      mem.write8(0x63, regs.a); m.step(0xbf76, 3);
      regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xbf78, 3);
      regs.sbc(mem.read8((0x80 + regs.x) & 0xff)); m.step(0xbf7a, 4);
      regs.clv(); m.step(0xbf7b, 2);
      m.step(0xbf88, 3);
    }
    mem.write8(0x64, regs.a); m.step(0xbf8a, 3);
    regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xbf8c, 3);
    regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xbf8e, 3);
    mem.write8((((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff), regs.a); m.step(0xbf90, 6);
    regs.y = regs.inc8(regs.y); m.step(0xbf91, 2);
    regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xbf93, 3);
    regs.and(0x1f); m.step(0xbf95, 2);
    mem.write8((((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff), regs.a); m.step(0xbf97, 6);
    regs.y = regs.inc8(regs.y); m.step(0xbf98, 2);
    regs.a = mem.read8(0x61); regs.setNZ(regs.a); m.step(0xbf9a, 3);
    mem.write8((((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff), regs.a); m.step(0xbf9c, 6);
    regs.y = regs.inc8(regs.y); m.step(0xbf9d, 2);
    regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xbf9f, 3);
    regs.and(0x1f); m.step(0xbfa1, 2);
    regs.ora(mem.read8(0x73)); m.step(0xbfa3, 3);
    mem.write8((((mem.read8(0x74) | (mem.read8(0x75) << 8)) + regs.y) & 0xffff), regs.a); m.step(0xbfa5, 6);
    regs.y = regs.inc8(regs.y); m.step(0xbfa6, 2);
    mem.write8(0xa9, regs.y); m.step(0xbfa8, 3);
    mem.write8(0x99, regs.dec8(mem.read8(0x99))); m.step(0xbfaa, 5);
    if (regs.fZ) { m.step(0xbfaf, 3); break; }
    m.step(0xbfac, 2);
    m.step(0xbedb, 3);
  } while (true);
  // bfaf:
  regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xbfb1, 3);
  regs.y = regs.dec8(regs.y); m.step(0xbfb2, 2);
  m.step(0xdf5f, 3); return m.call(0xdf5f);
}
