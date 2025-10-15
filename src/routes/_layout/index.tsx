import { createFileRoute } from "@tanstack/react-router";

import "@/App.scss";
import { PB } from "@/proto/dist/protos";
import DashItem from "@/components/DashItem";
import LogDashItem from "@/components/LogDashItem";
import StrainCalib from "@/components/StrainCalibration/StrainCalib";
import { useSmartKnobStore } from "@/stores/smartKnobStore";
import ConfigDashItem from "@/components/ConfigDashItem/ConfigDashItem";

export const Route = createFileRoute("/_layout/")({
  component: Index,
});

function Index() {
  const { connected, knob, serial } = useSmartKnobStore();

  let index = 1;

  return (
    <div>
      <div
        id="skdk-inner-container"
        className={`${connected ? "" : "disabled"}`}
      >
        <ConfigDashItem index={index++} />

        <DashItem
          title="MOTOR CALIBRATION"
          index={index++}
          status={
            knob?.persistentConfig?.motor?.calibrated
              ? "CALIBRATED"
              : "NOT CALIBRATED"
          }
        >
          <button
            className="btn m-3"
            onClick={() =>
              serial?.sendCommand(PB.SmartKnobCommand.MOTOR_CALIBRATE)
            }
          >
            Press to start motor calibration.
          </button>
        </DashItem>
        <StrainCalib index={index++} />

        <LogDashItem index={index++} />
      </div>
    </div>
  );
}
