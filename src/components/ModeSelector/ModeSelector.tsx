import { IconCpu, IconSettings } from "@tabler/icons-react";

export type AppMode = "configurator" | "firmware";

interface ModeSelectorProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export default function ModeSelector({
  currentMode,
  onModeChange,
}: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      <div className="mode-selector-container">
        <h3 className="mode-selector-title">Select Mode</h3>
        <div className="mode-selector-options">
          <button
            className={`mode-selector-option ${currentMode === "configurator" ? "active" : ""}`}
            onClick={() => onModeChange("configurator")}
          >
            <IconSettings size={24} />
            <span>Configurator</span>
            <p>Configure device settings and calibrations</p>
          </button>

          <button
            className={`mode-selector-option ${currentMode === "firmware" ? "active" : ""}`}
            onClick={() => onModeChange("firmware")}
          >
            <IconCpu size={24} />
            <span>Firmware Flashing</span>
            <p>Flash firmware to the device</p>
          </button>
        </div>
      </div>
    </div>
  );
}
