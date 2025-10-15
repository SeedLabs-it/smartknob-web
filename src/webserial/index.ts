// import SerialPort from 'serialport';
import { PB } from "../proto/dist/protos";
import { MessageCallback, SmartKnobCore } from "./core";

export class SmartKnobWebSerial extends SmartKnobCore {
  private port: SerialPort | null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | undefined =
    undefined;

  private onConnectCallbacks: (() => void)[] = [];
  private disconnectCallbacks: (() => void)[] = [];

  constructor(port: SerialPort, onMessage: MessageCallback) {
    super(onMessage, (packet: Uint8Array) => {
      this.writer?.write(packet).catch(this.onError);
    });
    this.port = port;
    this.portAvailable = true;
    this.port.addEventListener("disconnect", async () => {
      this.disconnectCallbacks.forEach((cb) => cb());
    });
  }

  public addConnectCB(cb: () => void) {
    this.onConnectCallbacks.push(cb);
  }

  public addDisconnectCB(cb: () => void) {
    this.disconnectCallbacks.push(cb);
  }

  public async openAndLoop() {
    if (this.port === null) {
      return;
    }
    await this.port.open({ baudRate: SmartKnobCore.BAUD });
    if (this.port.readable === null || this.port.writable === null) {
      throw new Error("Port missing readable or writable!");
    }

    this.sendCommand(PB.SmartKnobCommand.GET_KNOB_INFO);

    const reader = this.port.readable.getReader();
    try {
      const writer = this.port.writable.getWriter();
      writer
        .write(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0]))
        .catch(this.onError);
      this.writer = writer;
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          if (value !== undefined) {
            this.onConnectCallbacks.forEach((cb) => cb());
            this.onReceivedData(value);
          }
        }
      } finally {
        console.log("Releasing writer");
        writer?.releaseLock();
      }
    } finally {
      console.log("Releasing reader");
      reader.releaseLock();
      await this.port.close();
      console.log("Port closed");
    }
  }

  private onError(e: unknown) {
    console.error("Error writing serial", e);
    this.port?.close();
    this.port = null;
    this.portAvailable = false;
    this.writer = undefined;
  }
}
