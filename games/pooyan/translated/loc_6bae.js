// SPDX-License-Identifier: GPL-3.0-only

// loc_6bae  (ROM 0x6bae-0x6bb1) -- a tiny two-instruction tail: enqueue one display command,
// then jump to 0x02ef. The `rst 0x38` (-> loc_0038) queues the display cmd held in DE into the
// 0x88a0 ring (return pushed = 0x6baf), then the ret from loc_0038 lands on `jp 0x02ef`, an
// unconditional tail-jump (control does not return here). Entered both as a fixed target and via
// the `jr 0x6bae` at 0x6bec that follows the five DE-load / rst-0x38 enqueues in loc_6bb2's block.
export function loc_6bae(m) {
  const { regs, mem } = m;

  m.push16(0x6baf); // 6bae  rst 0x38 pushes its return
  m.step(0x0038, 11); // 6bae  rst 0x38 -> loc_0038 enqueue display cmd (DE); rets to 0x6baf
  m.call(0x0038);

  m.step(0x02ef, 10); // 6baf  jp 0x02ef -- unconditional tail-jump
  return m.call(0x02ef);
}
