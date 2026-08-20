// SPDX-License-Identifier: GPL-3.0-only

// loc_1583  (ROM 0x1583-0x15a7) -- per-frame tick on the 0x8f4d counter. inc + low-nibble!=0 -> return.
// Every 16th frame it queues a display command via rst 0x38 (DE = 0x0635, or 0x06b5 when counter bit4
// is set), then -- gated by (0x89ef)!=0 -- refreshes state (0x7912) and dispatches on (0x880a)&0x1f
// through the rst-0x28 word table at 0x15a8, whose handler ret's to the pushed continuation 0x15d1.
// The rst 0x28 dispatch mirrors loc_0c4e: push the continuation, rst 0x28, then tail into 0x15d1.
export function loc_1583(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f4d;             m.step(0x1586, 10);
  regs.incMem8(mem, regs.hl);   m.step(0x1587, 11);
  regs.a = mem.read8(regs.hl);  m.step(0x1588, 7);
  regs.b = regs.a;              m.step(0x1589, 4);
  regs.and(0x0f);               m.step(0x158b, 7);
  if (regs.fNZ) { m.ret(11); return; } // ret nz -- not a 16-frame boundary
  m.step(0x158c, 5);
  regs.bit(4, regs.b);          m.step(0x158e, 8);
  regs.de = 0x0635;             m.step(0x1591, 10);
  if (regs.fZ) {
    m.step(0x1595, 12);         // jr z,0x1595 taken -- bit4 clear, DE stays 0x0635
  } else {
    m.step(0x1593, 7);
    regs.e = 0xb5;              m.step(0x1595, 7); // DE = 0x06b5
  }
  m.push16(0x1596);             m.step(0x0038, 11); // rst 0x38 -- enqueue DE
  m.call(0x0038);
  regs.a = mem.read8(0x89ef);   m.step(0x1599, 13);
  regs.and(regs.a);             m.step(0x159a, 4);
  if (regs.fZ) { m.ret(11); return; } // ret z -- feature disabled
  m.step(0x159b, 5);
  m.push16(0x159e);             m.step(0x7912, 17); // call 0x7912
  m.call(0x7912);
  regs.hl = 0x15d1;             m.step(0x15a1, 10);
  m.push16(regs.hl);            m.step(0x15a2, 11); // push hl -- dispatched handler ret's to 0x15d1
  regs.a = mem.read8(0x880a);   m.step(0x15a5, 13);
  regs.and(0x1f);               m.step(0x15a7, 7);
  m.push16(0x15a8);             m.step(0x0028, 11); // rst 0x28 -- table base 0x15a8, jp to handler
  m.call(0x0028);
  return m.call(0x15d1);        // post-dispatch continuation (rets to loc_1583's caller)
}
