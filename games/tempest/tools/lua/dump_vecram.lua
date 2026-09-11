-- SPDX-License-Identifier: GPL-3.0-only
-- Tempest crown-validation dump: per frame, write vector RAM (0x2000-0x2FFF, 4096B) + colorram shadow (16B,
-- from writes to 0x0800-0x080F) + flip byte (from writes to 0x4000) = 4113B/frame, to VECRAM_OUT.
-- Colorram is CPU-write-only so it is shadowed via a write tap; vector RAM is plain RAM read directly.
-- Frame index 0 = power-on (load time); the notifier fires at frame end (delta-0 with the AVI, like the
-- state golden). Retain taps/subscription in globals or the GC drops them.

local out = assert(io.open(os.getenv("VECRAM_OUT") or "vecram.bin", "wb"))
out:setvbuf("no")

local cpu = manager.machine.devices[":maincpu"]
local mem = cpu.spaces["program"]

_G.__colorram = {}
for i = 0, 15 do _G.__colorram[i] = 0 end
_G.__flip = 0

_G.__tap_col = mem:install_write_tap(0x0800, 0x080f, "col", function(offset, data, mask)
  _G.__colorram[(offset - 0x0800) & 0xf] = data & 0xff
end)
_G.__tap_flip = mem:install_write_tap(0x4000, 0x4000, "flip", function(offset, data, mask)
  _G.__flip = data & 0xff
end)

local function sample()
  local parts = {}
  for a = 0x2000, 0x2fff do
    parts[#parts + 1] = string.char(mem:read_u8(a))
  end
  for i = 0, 15 do
    parts[#parts + 1] = string.char(_G.__colorram[i] & 0xff)
  end
  parts[#parts + 1] = string.char(_G.__flip & 0xff)
  out:write(table.concat(parts))
end

sample()
_G.__vecram_sub = emu.add_machine_frame_notifier(function() sample() end)
