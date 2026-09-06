// SPDX-License-Identifier: GPL-3.0-only
// Shared tail of the slot-walk loop (a second entry sharing the tail): restore the slot pointer and the
// count/stride word saved on the stack, advance the pointer's low byte by the per-slot stride, then loop
// back to the walk head while slots remain, else return to the loop caller.
import { loc_207d } from "./loc_207d.js";

export function loc_2094(m, savedHl, savedBc) {
  // Restore the saved slot pointer and the count(B)/stride(C) word -- from the walk head's forwarded locals
  // when called in-loop (the push-free layer never stacks them), else the machine stack.
  const savedPtr = savedHl === undefined ? m.pop16() : savedHl; // pop hl
  const bc = savedBc === undefined ? m.pop16() : savedBc; // pop bc
  const stride = bc & 0xff; // C -- per-slot pointer stride
  const count = ((bc >> 8) - 1) & 0xff; // B spent one slot by the djnz decrement

  // Advance only the pointer's low byte (ld a,l / add a,c / ld l,a), keeping the page byte.
  const low = (savedPtr + stride) & 0xff;
  const ptr = ((savedPtr >> 8) << 8) | low;
  const bcOut = (count << 8) | stride;

  // Re-seat the pointer/count/accumulator the walk head reads back, then loop for the next slot while the
  // count holds, else return through the loop caller.
  return (m.regs.hl = ptr, m.regs.bc = bcOut, m.regs.a = low, count !== 0 ? loc_207d(m) : m.ret());
}
