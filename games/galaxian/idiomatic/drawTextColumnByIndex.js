// SPDX-License-Identifier: GPL-3.0-only
//
// drawTextColumnByIndex -- pick a static-text descriptor by index and paint its column.
//
// WHAT IT IS
//   Front door to the static-text kit. It treats A as a small index into the ROM text-descriptor table
//   (TEXT_DESCRIPTOR_TABLE 0x1cf6), whose entries are five bytes each (source word, destination word,
//   count byte), forms the address of that entry, and hands it to drawTextColumnFromDescriptor to paint.
//
// ROLE IN THE MACHINE
//   Used by the attract input readout: drawInputTextColumnsAndSeedScreenFill (ROM 0x1c73) decodes the
//   dip-switch fields out of the input ports into descriptor indices and calls in here once per column
//   to render the current machine settings as on-screen text.
//
//   ROM 0x1ccf.  Grounding: [seen].
//
// LIVE-OUT: one text column painted into VRAM (via drawTextColumnFromDescriptor -> drawTextColumn).
import { drawTextColumnFromDescriptor } from "./drawTextColumnFromDescriptor.js";
import { TEXT_DESCRIPTOR_TABLE } from "./names.js";

// Bytes per descriptor: source word (2) + dest word (2) + count byte (1).
const RECORD_STRIDE = 5;

export function drawTextColumnByIndex(m, index = m.regs.a) {
  // Scale the index by the 5-byte record size and add the table base to reach the chosen descriptor.
  const record = TEXT_DESCRIPTOR_TABLE + index * RECORD_STRIDE;
  // Unpack and paint that descriptor's column.
  return drawTextColumnFromDescriptor(m, record);
}
