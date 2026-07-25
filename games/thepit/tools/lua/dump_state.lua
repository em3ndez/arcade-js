-- SPDX-License-Identifier: GPL-3.0-only
-- Per-emulated-frame state dump for The Pit (game #2). Adapted from games/dkong/tools/
-- lua/dump_state.lua -- see that file for the MAME-Lua landmines (retain the notifier
-- subscription in a global; setvbuf("no") because MAME exits without a Lua stop hook).
--
-- Dumps four RAM regions once per emulated frame, in this fixed order:
--   work    0x8000-0x87FF  2048 bytes
--   colour  0x8800-0x8BFF  1024 bytes
--   video   0x9000-0x93FF  1024 bytes
--   attrspr 0x9800-0x98FF   256 bytes
--                          ---- 4352 bytes per frame
--
-- state[0] = power-on (sampled at script load before the CPU runs); state[N] = after
-- frames 0..N-1. These regions mirror boards/thepit/hardware.json "stateRegions" and the
-- engine constants in boards/thepit/memory.js -- keep them consistent.

local out = assert(io.open(os.getenv("STATE_OUT") or "state.bin", "wb"))
out:setvbuf("no")

local mem = manager.machine.devices[":maincpu"].spaces["program"]

-- Certify the machine configuration this capture ran under. The Pit reads its DSW at
-- 0xB000; the ROM control byte at 0x0000 is the reset-vector opcode (0xC3, JP nn).
local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format("dsw0=0x%02X\ncontrol_rom0000=0x%02X\n",
    mem:read_u8(0xB000), mem:read_u8(0x0000)))
  local cpu = manager.machine.devices[":maincpu"]
  for _, rn in ipairs({"AF","BC","DE","HL","IX","IY","SP"}) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
  end
  cfgf:close()
end

if os.getenv("STATE_ENABLED") == "0" then return end

local REGIONS = {
  { 0x8000, 0x87FF },  -- work
  { 0x8800, 0x8BFF },  -- colour
  { 0x9000, 0x93FF },  -- video
  { 0x9800, 0x98FF },  -- attribute + sprite
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

sample() -- state[0]: power-on, before the CPU runs

_G.__frame_count = 1
_G.__state_sub = emu.add_machine_frame_notifier(function()
  sample()
  _G.__frame_count = _G.__frame_count + 1
end)
