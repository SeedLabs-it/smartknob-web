import { useEffect, useRef, useState } from "react";
import DashItem from "./DashItem";
import { PB } from "../proto/dist/protos";
import "./LogDashItem.scss";
import { useSmartKnobStore } from "../stores/smartKnobStore";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

let term: Terminal | null = null;

interface LogDashItemProps {
  index: number;
}

const LogDashItem: React.FC<LogDashItemProps> = ({ index }) => {
  const { log, fullLog, knob } = useSmartKnobStore();

  const [selectedLogLevels, setSelectedLogLevels] = useState<Set<PB.LogLevel>>(
    new Set([PB.LogLevel.INFO, PB.LogLevel.WARNING, PB.LogLevel.ERROR]),
  );
  const [verboseLogging, setVerboseLogging] = useState(false);
  const [originLogging, setOriginLogging] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);

  const toggleLogLevel = (logLevel: PB.LogLevel) => {
    if (selectedLogLevels.has(logLevel)) {
      selectedLogLevels.delete(logLevel);
    } else setSelectedLogLevels(selectedLogLevels.add(logLevel));
    localStorage.setItem(
      "logLevels",
      JSON.stringify(Array.from(selectedLogLevels)),
    );
    setSelectedLogLevels(new Set([...selectedLogLevels]));
  };

  const toggleVerboseLogging = () => {
    setVerboseLogging(!verboseLogging);
    localStorage.setItem("verboseLogging", (!verboseLogging).toString());
  };

  const toggleOriginLogging = () => {
    setOriginLogging(!originLogging);
  };

  useEffect(() => {
    if (terminalRef.current && !term) {
      const cols = Math.floor(terminalRef.current.offsetWidth / 9);
      term = new Terminal({ cols: cols > 20 ? cols : 40, rows: 20 });
      term.open(terminalRef.current);
    }
  }, []);

  // Reinitialize terminal when switching between modes (but not on scroll)
  useEffect(() => {
    let hasBeenVisible = false;

    const reinitializeTerminal = () => {
      if (terminalRef.current && !hasBeenVisible) {
        terminalRef.current.innerHTML = "";

        const cols = Math.floor(terminalRef.current.offsetWidth / 9);
        term = new Terminal({ cols: cols > 20 ? cols : 40, rows: 20 });
        term.open(terminalRef.current);
        hasBeenVisible = true;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && terminalRef.current) {
            setTimeout(() => {
              reinitializeTerminal();
            }, 100);
          }
        });
      },
      { threshold: 0.1 },
    );

    if (terminalRef.current) {
      observer.observe(terminalRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (term && terminalRef.current) {
        const cols = Math.floor(terminalRef.current.offsetWidth / 9);
        const newCols = cols > 20 ? cols : 40;

        // Only resize if columns changed significantly
        if (Math.abs(term.cols - newCols) > 5) {
          terminalRef.current.innerHTML = "";
          term = new Terminal({ cols: newCols, rows: 20 });
          term.open(terminalRef.current);
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (localStorage.getItem("logLevels") !== null) {
      const storedLogLevels = new Set<PB.LogLevel>(
        JSON.parse(localStorage.getItem("logLevels")!),
      );
      setSelectedLogLevels(storedLogLevels);
    }
  }, []);

  useEffect(() => {
    if (!term || log.length === 0) return;

    const lastLog = log[log.length - 1];

    if (!selectedLogLevels.has(lastLog.level)) return;
    if (!verboseLogging && lastLog.isVerbose) return;

    const date = new Date(lastLog.timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const timeString = `${hours}:${minutes}:${seconds}`;

    const logLevelString = getLogLevelString(lastLog.level);
    const colorCode = getLogColorCode(lastLog.level);

    let logLine = `[${timeString}] ${colorCode}[${logLevelString}]\x1b[0m ${lastLog.msg}`;

    if (originLogging && lastLog.origin) {
      let origin = lastLog.origin;
      if (origin.length > 40) {
        origin = `...${origin.slice(origin.lastIndexOf("/", 40))}`;
      }
      logLine += ` \x1b[90m[${origin}]\x1b[0m`;
    }

    term.writeln(logLine);
  }, [log, selectedLogLevels, verboseLogging, originLogging]);

  return (
    <DashItem title="LOGS" index={index} saveState={true}>
      <div className="log-download-container">
        <button
          className="log-download-btn"
          onClick={() => {
            const element = document.createElement("a");

            const now = new Date();
            const deviceInfo = [
              "=".repeat(60),
              "SmartKnob Device Log",
              "=".repeat(60),
              `Exported: ${now.toLocaleString()}`,
              "",
              "Device Information:",
              `  MAC Address: ${knob?.macAddress || "Not Connected"}`,
              "",
              "=".repeat(60),
              "",
            ];

            const formattedLog = fullLog.map((msg) => {
              const date = new Date(msg.timestamp);
              const hours = String(date.getHours()).padStart(2, "0");
              const minutes = String(date.getMinutes()).padStart(2, "0");
              const seconds = String(date.getSeconds()).padStart(2, "0");
              const timeString = `${hours}:${minutes}:${seconds}`;
              let logString = `${timeString} [${getLogLevelString(msg.level)}] ${msg.msg}`;
              if (msg.origin && originLogging) {
                if (msg.origin.length > 40) {
                  msg.origin = `...${msg.origin.slice(
                    msg.origin.lastIndexOf("/", 40),
                  )}`;
                }
                logString += ` [${msg.origin}]`;
              }
              return logString;
            });

            const fullContent = [...deviceInfo, ...formattedLog].join("\n");

            const file = new Blob([fullContent], {
              type: "text/plain",
            });
            element.href = URL.createObjectURL(file);
            element.download = `smartknob_log_${knob?.macAddress || "unknown"}_${now.getTime()}.txt`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            }}
          >
            DOWNLOAD LOGS
          </button>
      </div>
      <div className="log-header">
        <button
          className={selectedLogLevels.has(PB.LogLevel.INFO) ? "active" : ""}
          onClick={() => toggleLogLevel(PB.LogLevel.INFO)}
        >
          <div className="log-color-indicator  bg-log-info"></div>
          INFO
        </button>
        <button
          className={selectedLogLevels.has(PB.LogLevel.DEBUG) ? "active" : ""}
          onClick={() => toggleLogLevel(PB.LogLevel.DEBUG)}
        >
          <div className="log-color-indicator bg-log-debug"></div>
          DEBUG
        </button>
        <button
          className={
            selectedLogLevels.has(PB.LogLevel.WARNING) ? "active" : ""
          }
          onClick={() => toggleLogLevel(PB.LogLevel.WARNING)}
        >
          <div className="log-color-indicator bg-log-warning"></div>
          WARNING
        </button>
        <button
          className={selectedLogLevels.has(PB.LogLevel.ERROR) ? "active" : ""}
          onClick={() => toggleLogLevel(PB.LogLevel.ERROR)}
        >
          <div className="log-color-indicator bg-log-error"></div>
          ERROR
        </button>
        <button
          className={`log-toggle ${verboseLogging ? "active" : ""}`}
          onClick={toggleVerboseLogging}
        >
          TOGGLE VERBOSE
        </button>
        <button
          className={`log-toggle ${originLogging ? "active" : ""}`}
          onClick={toggleOriginLogging}
        >
          TOGGLE ORIGIN
        </button>
      </div>
      <div className="log-terminal" ref={terminalRef} />
    </DashItem>
  );
};

const getLogLevelString = (logLevel: PB.LogLevel) => {
  switch (logLevel) {
    case PB.LogLevel.INFO:
      return "INFO";
    case PB.LogLevel.DEBUG:
      return "DEBUG";
    case PB.LogLevel.WARNING:
      return "WARNING";
    case PB.LogLevel.ERROR:
      return "ERROR";
    default:
      return "INFO";
  }
};

const getLogColorCode = (logLevel: PB.LogLevel) => {
  switch (logLevel) {
    case PB.LogLevel.INFO:
      return "\x1b[36m"; // Cyan
    case PB.LogLevel.DEBUG:
      return "\x1b[90m"; // Gray
    case PB.LogLevel.WARNING:
      return "\x1b[33m"; // Yellow
    case PB.LogLevel.ERROR:
      return "\x1b[31m"; // Red
    default:
      return "\x1b[36m"; // Cyan
  }
};

export default LogDashItem;
