import { createFileRoute } from "@tanstack/react-router";
import { useSmartKnobStore } from "@/stores/smartKnobStore";
import { useState } from "react";
import { PB } from "@/proto/dist/protos";
import LogDashItem from "@/components/LogDashItem";

import "@/App.scss";
import { toast } from "react-toastify";
import { evaluate } from "mathjs";

export const Route = createFileRoute("/_layout/motor")({
  component: Motor,
});

function Motor() {
  const { connected, serial } = useSmartKnobStore();

  const [motorMode, setMotorMode] = useState(false);
  const [dir, setDir] = useState("right");
  const [speed, setSpeed] = useState(10);

  let config: {
    [k: string]: any;
  } = {
    position: 0,
    subPositionUnit: 0,
    positionNonce: 0,
    minPosition: 0,
    maxPosition: -1,
    positionWidthRadians: "(2.4*PI)/30",
    detentStrengthUnit: 3,
    endstopStrengthUnit: 1,
    snapPoint: 0.5,
    snapPointBias: 0,
    ledHue: 0,
  };

  const [prevConfig, setConfig] = useState(config);

  const handleChange = (key: any, value: any) => {
    setConfig(() => ({
      ...prevConfig,
      [key]: value,
    }));
  };

  const sendMotorConfig = (mode: boolean, dir: string, speed: number) => {
    try {
      // const parsedConfig = JSON.parse(textConfig);
      let val = evaluate(prevConfig.positionWidthRadians);
      let config_ = PB.SmartKnobConfig.create({
        ...prevConfig,
        positionWidthRadians: val,
      });

      serial?.sendConfig(
        PB.SmartKnobConfig.create({
          ...config_,
          id: `MOTOR_TESTING-${mode ? dir : "none"}-${speed}`,
        }),
      );
      toast.success("Config sent");
    } catch (error) {
      toast.error("Invalid json config");
      return;
    }
  };
  return (
    <>
      <div>
        <button
          className="btn"
          onClick={() => {
            sendMotorConfig(!motorMode, dir, speed);
            setMotorMode(!motorMode);
          }}
          disabled={!connected}
        >
          TOGGLE MOTOR MODE
        </button>
        <button
          className="btn"
          onClick={() => {
            sendMotorConfig(
              motorMode,
              dir === "left" ? "right" : "left",
              speed,
            );
            dir === "left" ? setDir("right") : setDir("left");
          }}
          disabled={!connected}
        >
          Toggle Direction
        </button>
        <p>Speed</p>
        <input
          type="text"
          value={speed}
          onChange={(e: any) => {
            setSpeed(e.target.value);
          }}
        />
        <button
          className="btn"
          onClick={() => sendMotorConfig(motorMode, dir, speed)}
          disabled={!connected}
        >
          Send config.
        </button>
      </div>
      {/* JSON EDITOR generated from json */}
      <div>
        <p>Config</p>
        <div style={{ whiteSpace: "pre-line" }}>
          {Object.entries(prevConfig).map(([key, value]) => (
            <div key={key} style={{ display: "flex", margin: "5px 0" }}>
              <span style={{ fontWeight: "bold", marginRight: "10px" }}>
                {key}:
              </span>
              {typeof value === "number" && key !== "positionWidthRadians" ? (
                <input
                  type="number"
                  value={value}
                  onChange={(e) =>
                    handleChange(key, parseFloat(e.target.value))
                  }
                  style={{
                    flex: "1",
                    padding: "5px",
                    fontSize: "14px",
                    fontFamily: "monospace",
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleChange(key, e.target.value)}
                  style={{
                    flex: "1",
                    padding: "5px",
                    fontSize: "14px",
                    fontFamily: "monospace",
                  }}
                />
              )}
            </div>
          ))}
        </div>
        {/* <textarea
          name="test"
          id=""
          style={{ width: "100%", height: "600px" }}
          value={textConfig}
          onChange={(e) => {
            setTextConfig(e.target.value);
          }}
        ></textarea> */}
      </div>
      <LogDashItem index={0} />
    </>
  );
}
