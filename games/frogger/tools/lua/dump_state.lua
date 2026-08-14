-- SPDX-License-Identifier: GPL-3.0-only
-- Frogger (Galaxian family) per-frame RAM dump: work RAM, video RAM, OBJRAM in that fixed order,
-- 3328 bytes/frame. Bases mirror hardware.json "stateRegions" AND boards/frogger/memory.js
-- dumpState(), so a golden frame memcmps the renderer's state. SAMPLING: state[0] is power-on
-- (at load, before the CPU runs), state[N] after frames 0..N-1; the notifier fires at a frame's
-- END, hence the extra load-time dump (an off-by-one the boot zero-clear hides). Retain the
-- subscription or GC drops it (truncated file); unbuffered, so readers truncate to whole frames.

local out = assert(io.open(os.getenv("STATE_OUT") or "state.bin", "wb"))
out:setvbuf("no")

local mem = manager.machine.devices[":maincpu"].spaces["program"]

-- CONFIGURATION this ran under (a stray MAME cfg silently corrupts every golden). Frogger is
-- Galaxian family: NO standalone DSW -- dips ride the 8255 PPI ports. dsw0=IN2@0xE004 (Coinage
-- + Cabinet screen-flip, ~0xF1), dsw1=IN1@0xE002 (Lives, ~0xFC); shared checker verifies only
-- dsw0. PPI reads at t=0 valid (8255 resets all-input); control_rom0000=0x3A vs unmapped 0xFF.
local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format("dsw0=0x%02X\ndsw1=0x%02X\ncontrol_rom0000=0x%02X\n",
    mem:read_u8(0xE004), mem:read_u8(0xE002), mem:read_u8(0x0000)))
  local cpu = manager.machine.devices[":maincpu"]
  for _, rn in ipairs({"AF","BC","DE","HL","IX","IY","SP"}) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
  end
  cfgf:close()
end

-- STATE_ENABLED=0 certifies configuration only; a frames-only golden still records its dips.
if os.getenv("STATE_ENABLED") == "0" then return end

-- Order mirrors dumpState(); none of these ranges hit 0x8800 (watchdog) or the write-only latches.
local REGIONS = {
  { 0x8000, 0x87FF, "ram" },
  { 0xA800, 0xABFF, "vram" },
  { 0xB000, 0xB0FF, "objram" }
}

local function sample()
  local parts = {}
  for _, r in ipairs(REGIONS) do
    for a = r[1], r[2] do
      parts[#parts + 1] = string.char(mem:read_u8(a))
    end
  end
  out:write(table.concat(parts))
end

sample()

_G.__frame_count = 1
_G.__state_sub = emu.add_machine_frame_notifier(function()
  sample()
  _G.__frame_count = _G.__frame_count + 1
end)
