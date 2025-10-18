import { PB } from "../proto/dist/protos";
import { MessageCallback, SmartKnobCore } from "./core";

export class SmartKnobWebSerial extends SmartKnobCore {
  private port: SerialPort | null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  private reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  private isClosing = false;

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

  public async disconnect() {
    if (this.isClosing) {
      return;
    }

    this.isClosing = true;

    try {
      if (this.writer) {
        try {
          this.writer.releaseLock();
        } catch {
          // Writer already released
        }
        this.writer = undefined;
      }

      if (this.reader) {
        try {
          await this.reader.cancel();
        } catch {
          // Reader already cancelled
        }
        this.reader = undefined;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (this.port) {
        try {
          if (this.port.readable || this.port.writable) {
            await this.port.close();
          }
        } catch {
          // Port already closed
        }
        this.port = null;
      }

      this.portAvailable = false;
    } catch (e) {
      console.error("Error during disconnect:", e);
    } finally {
      this.isClosing = false;
    }
  }

  public async openAndLoop() {
    if (this.port === null) {
      return;
    }

    try {
      if (this.port.readable || this.port.writable) {
        await this.port.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch {
      // Port already closed
    }

    this.isClosing = false;

    await this.port.open({ baudRate: SmartKnobCore.BAUD });
    if (this.port.readable === null || this.port.writable === null) {
      throw new Error("Port missing readable or writable!");
    }

    this.sendCommand(PB.SmartKnobCommand.GET_KNOB_INFO);

    this.reader = this.port.readable.getReader();
    try {
      const writer = this.port.writable.getWriter();
      writer
        .write(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0]))
        .catch(this.onError);
      this.writer = writer;
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await this.reader!.read();
          if (done) {
            break;
          }
          if (value) {
            this.onConnectCallbacks.forEach((cb) => cb());
            this.onReceivedData(value);
          }
        }
      } finally {
        writer?.releaseLock();
      }
    } finally {
      this.reader?.releaseLock();

      if (!this.isClosing && this.port) {
        await this.port.close();
      }
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
