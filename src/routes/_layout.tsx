import { PB, SETTINGS } from "@/proto/dist/protos";
import { useSmartKnobStore } from "@/stores/smartKnobStore";
import { SmartKnobLog } from "@/types";
import { SmartKnobWebSerial } from "@/webserial";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import seedlabsLogo from "@/assets/logoFull_white_transparent.webp";
import { toast } from "react-toastify";

export const Route = createFileRoute("/_layout")({
  component: LayoutComponent,
});

function LayoutComponent() {
  const { connected, knob, log, fullLog } = useSmartKnobStore();

  const [darkMode, setDarkMode] = useState(false);

  const [_, setStrainCalibState] = useState<PB.StrainCalibState | undefined>(
    undefined,
  );
  const [newLogMessage, setNewLogMessage] = useState<SmartKnobLog>();

  const connectToSmartKnob = async (serialPort: SerialPort) => {
    try {
      // var smartKnob = null;
      const smartKnob_ = new SmartKnobWebSerial(serialPort, onMessage);
      // setSmartKnob(smartKnob_);
      useSmartKnobStore.setState({ serial: smartKnob_ });
      if (smartKnob_ !== null) {
        await smartKnob_.openAndLoop();
      }
    } catch (error) {
      console.error("Error with serial port:", error);
      useSmartKnobStore.setState({ serial: undefined });
      useSmartKnobStore.setState({ connected: false });
    }
  };

  const disconnectAlert = () =>
    toast("Device disconnected", {
      type: "warning",
      closeOnClick: true,
      autoClose: 3000,
    });
  const connectToSerial = async () => {
    try {
      if (navigator.serial) {
        const serialPort = await navigator.serial.requestPort({
          filters: SmartKnobWebSerial.USB_DEVICE_FILTERS,
        });
        serialPort.addEventListener("disconnect", async () => {
          useSmartKnobStore.setState({ connected: false });
          console.log("Device disconnected");
          disconnectAlert();
        });
        await connectToSmartKnob(serialPort);
      } else {
        console.error("Web Serial API is not supported in this browser.");
        // setSmartKnob(undefined);
        useSmartKnobStore.setState({ serial: undefined });
        useSmartKnobStore.setState({ connected: false });
      }
    } catch (error) {
      console.error("Error with serial port:", error);
      useSmartKnobStore.setState({ serial: undefined });
      useSmartKnobStore.setState({ connected: false });
    }
  };

  const onMessage = (message: PB.FromSmartKnob) => {
    if (message.payload) {
      useSmartKnobStore.setState({ connected: true });
    }

    if (message.payload != "log" && message.payload != "smartknobState")
      console.log(message);

    if (message.payload === "knob" && message.knob !== null) {
      const knob_ = PB.Knob.create(message.knob);

      useSmartKnobStore.setState({ knob: knob_ });
      if (knob_.settings !== null) {
        const settings = SETTINGS.Settings.create(knob_.settings);
        useSmartKnobStore.setState({
          settings: {
            screen: {
              dim: settings.screen?.dim ?? true,
              timeout: settings.screen?.timeout
                ? settings.screen?.timeout / 1000
                : 30,
              maxBright: settings.screen?.maxBright
                ? settings.screen?.maxBright / (65535 / 100)
                : 100,
              minBright: settings.screen?.minBright
                ? settings.screen?.minBright / (65535 / 100)
                : 10,
            },
            ledRing: {
              enabled: settings.ledRing?.enabled ?? true,
              dim: settings.ledRing?.dim ?? true,
              maxBright: settings.ledRing?.maxBright
                ? settings.ledRing?.maxBright / (65535 / 100)
                : 100,
              minBright: settings.ledRing?.minBright
                ? settings.ledRing?.minBright / (65535 / 100)
                : 10,
              color:
                "#" + settings.ledRing?.color?.toString(16).padStart(6, "0"),
              beacon: {
                enabled: settings.ledRing?.beacon?.enabled ?? true,
                brightness: settings.ledRing?.beacon?.brightness ?? 10,
                color:
                  // @ts-expect-error unnecessary nullish coalescing
                  "#" +
                  settings.ledRing?.beacon?.color
                    ?.toString(16)
                    .padStart(6, "0"),
              },
            },
          },
        });
      }
    }

    if (message.payload !== "log") {
      console.log(message.payload);
    }

    if (
      message.payload === "strainCalibState" &&
      message.strainCalibState !== null
    ) {
      const state = PB.StrainCalibState.create(message.strainCalibState);
      console.log(state);

      setStrainCalibState(state);
    }

    if (message.payload === "log" && message.log !== null) {
      const timestamp = Date.now();

      const log = {
        timestamp,
        isVerbose: message.log?.isVerbose || false,
        level: message.log?.level || PB.LogLevel.INFO,
        origin: message.log?.origin || "",
        msg: message.log?.msg || "",
      };
      setNewLogMessage(log);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem("darkMode", (!darkMode).toString());
    document.body.classList.toggle("dark");
  };

  useEffect(() => {
    if (localStorage.getItem("darkMode") === "true") {
      setDarkMode(true);
      document.body.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    if (newLogMessage == null) return;
    useSmartKnobStore.setState({ fullLog: [...fullLog, newLogMessage] });

    const storedLogLevels = new Set<PB.LogLevel>(
      JSON.parse(localStorage.getItem("logLevels")!),
    );

    const verboseLogging = localStorage.getItem("verboseLogging") === "true";

    // console.log(verboseLogging);

    if (storedLogLevels.has(newLogMessage.level)) {
      if (!verboseLogging && newLogMessage.isVerbose) return;
      useSmartKnobStore.setState({ log: [...log, newLogMessage] });
    }
  }, [newLogMessage]);

  return (
    <>
      <div className="skdk-container">
        <button className="color-mode-toggle" onClick={toggleDarkMode}>
          {darkMode ? <IconSun size={24} /> : <IconMoon size={24} />}
        </button>
        <div className="page-title">
          <h1>SMARTKNOB DEV KIT</h1>
          <h3>Configuration and Debugging console</h3>
        </div>
        {navigator.serial ? (
          <button
            className="connect-btn"
            onClick={connectToSerial}
            disabled={connected}
          >
            {connected ? <>{knob?.macAddress}</> : <>CONNECT</>}
          </button>
        ) : null}
        {navigator.serial ? (
          <Outlet />
        ) : (
          "Web Serial API is not supported in this browser."
        )}
        <div className="flex-grow content-end">
          <img
            src={seedlabsLogo}
            className="flex h-full w-60 flex-col"
            alt=""
          />
        </div>
      </div>
    </>
  );
}
