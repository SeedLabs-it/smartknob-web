import { useState, useRef, useEffect } from "react";
import { IconUpload, IconBrandGithub, IconBolt } from "@tabler/icons-react";
import { ESPLoader, FlashOptions, LoaderOptions, Transport } from "esptool-js";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import CryptoJS from "crypto-js";
import { toast } from "react-toastify";

let term: Terminal | null = null;

export default function FirmwareFlashing() {
  const [isFlashing, setIsFlashing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedFiles, setExtractedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current && !term) {
      term = new Terminal({ cols: 80, rows: 22 });
      term.open(terminalRef.current);

      term.writeln("ESP32-S3 Firmware Flashing Terminal");
      term.writeln("=====================================");
      term.writeln("");
    }
  }, []);

  // Temp fix for terminal not being initialized when component becomes visible after swtiching between modes
  useEffect(() => {
    const reinitializeTerminal = () => {
      if (terminalRef.current) {
        terminalRef.current.innerHTML = "";

        term = new Terminal({ cols: 80, rows: 22 });
        term.open(terminalRef.current);

        term.writeln("ESP32-S3 Firmware Flashing Terminal");
        term.writeln("=====================================");
        term.writeln("");
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

  const getFlashAddress = (fileName: string): number => {
    const lowerName = fileName.toLowerCase();

    if (lowerName.includes("bootloader")) return 0x0000;
    if (lowerName.includes("partition")) return 0x8000;
    if (lowerName.includes("boot_app0")) return 0xe000;
    if (lowerName.includes("firmware")) return 0x10000;
    if (lowerName.includes("fatfs")) return 0xc50000;

    return 0x10000;
  };

  const extractZipFile = async (
    file: File,
  ): Promise<{
    files: File[];
  }> => {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      const extractedFiles: File[] = [];

      for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async("blob");
          const extractedFile = new File([content], filename, {
            type: content.type,
          });
          extractedFiles.push(extractedFile);
        }
      }

      return { files: extractedFiles };
    } catch (error) {
      console.error("Error extracting zip file:", error);
      throw new Error(
        `Failed to extract zip file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExtractedFiles([]);

      try {
        const result = await extractZipFile(file);
        setExtractedFiles(result.files);

        const firmwareFiles = result.files.filter((file) => {
          const fileName = file.name.toLowerCase();
          return (
            fileName.endsWith(".bin") &&
            (fileName.includes("bootloader") ||
              fileName.includes("partitions") ||
              fileName.includes("boot_app0") ||
              fileName.includes("firmware") ||
              fileName.includes("fatfs"))
          );
        });

        if (firmwareFiles.length > 0) {
          toast.success(
            `Found ${firmwareFiles.length} firmware files. Click "Flash Now" to begin.`,
          );
        } else {
          toast.error(
            `No valid firmware files found in zip. Expected: bootloader.bin, partitions.bin, boot_app0.bin, firmware.bin, fatfs.bin\n\nFiles found: ${result.files.map((f) => f.name).join(", ")}`,
          );
        }
      } catch (error) {
        console.error("Error during zip extraction:", error);
        toast.error(
          `Failed to extract zip file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  };

  const handleFlash = async (filesToUse?: File[]) => {
    setIsFlashing(true);

    const filesToFlash =
      filesToUse ||
      (extractedFiles.length > 0 ? extractedFiles : [selectedFile!]);

    try {
      if (!navigator.serial) {
        throw new Error("Web Serial API is not supported in this browser");
      }

      const port = await navigator.serial.requestPort({});

      try {
        if (port.readable) {
          await port.close();
        }
      } catch (e) {
        // Handle port already being closed
      }

      // Wait a bit for port to be fully closed
      await new Promise((resolve) => setTimeout(resolve, 100));

      const transport = new Transport(port, true);

      const espLoaderTerminal = {
        clean() {
          term?.clear();
        },
        writeLine(data: string) {
          term?.writeln(data);
        },
        write(data: string) {
          term?.write(data);
        },
      };
      const loaderOptions = {
        transport,
        baudrate: 921600,
        terminal: espLoaderTerminal,
      } as LoaderOptions;

      const loader = new ESPLoader(loaderOptions);

      await loader.main();
      await new Promise((resolve) => setTimeout(resolve, 500));

      const firmwareFiles = filesToFlash.filter((file) => {
        const fileName = file.name.toLowerCase();
        return (
          fileName.endsWith(".bin") &&
          (fileName.includes("bootloader") ||
            fileName.includes("partitions") ||
            fileName.includes("boot_app0") ||
            fileName.includes("firmware") ||
            fileName.includes("fatfs"))
        );
      });

      if (firmwareFiles.length === 0) {
        throw new Error(
          "No valid firmware files found. Expected: bootloader.bin, partitions.bin, boot_app0.bin, firmware.bin, fatfs.bin",
        );
      }

      const fileArray = [];

      for (let i = 0; i < firmwareFiles.length; i++) {
        const file = firmwareFiles[i];
        const flashAddress = getFlashAddress(file.name);
        const fileBuffer = await file.arrayBuffer();
        const data = new Uint8Array(fileBuffer);

        let dataString = "";
        for (let j = 0; j < data.length; j++) {
          dataString += String.fromCharCode(data[j]);
        }

        fileArray.push({ data: dataString, address: flashAddress });
      }
      try {
        const flashOptions: FlashOptions = {
          fileArray: fileArray,
          eraseAll: false,
          compress: true,
          flashSize: "keep",
          flashMode: "dio",
          flashFreq: "40m",
          calculateMD5Hash: (image: string) =>
            CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)).toString(),
        };

        await loader.writeFlash(flashOptions);

        // Add a small delay before calling after() to ensure all operations complete
        await new Promise((resolve) => setTimeout(resolve, 1000));

        await loader.after();
      } catch (flashError) {
        if (
          flashError instanceof Error &&
          (flashError.message.includes("timeout") ||
            flashError.message.includes("Read timeout exceeded") ||
            flashError.message.includes("No serial data received"))
        ) {
          toast.warning(
            "⚠️ Flashing completed but verification timed out.\n\nThis usually means the device exited bootloader mode during verification.\nThe firmware may have been written successfully - try resetting the device.",
          );

          try {
            await loader.after();
          } catch (e) {
            // Cleanup failed, but continue
          }

          return;
        }

        throw new Error(
          `Failed to flash firmware: ${flashError instanceof Error ? flashError.message : "Unknown error"}`,
        );
      }

      // Trigger hard reset to boot with new firmware
      try {
        await transport.setRTS(false);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await transport.setRTS(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await transport.setRTS(false);
      } catch (resetError) {
        try {
          await loader.softReset(false);
        } catch (softResetError) {
          // Reset failed, but continue
        }
      }

      try {
        await transport.disconnect();
      } catch (e) {
        // Continue even if disconnect fails
      }

      try {
        if (port.readable) {
          await port.close();
        }
      } catch (e) {
        // Continue even if port close fails
      }

      // Show success message
      toast.success("🎉 Firmware flashing completed successfully!");

      setSelectedFile(null);
      setExtractedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("❌ Firmware flashing failed!", error);

      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        if (error.message.includes("Invalid head of packet")) {
          errorMessage =
            "Device communication error. This usually means:\n1. Device exited bootloader mode during flashing\n2. USB connection is unstable\n3. Device needs to be reset\n\nTry: Hold BOOT button, press RESET, release BOOT, then try again";
        } else if (error.message.includes("Failed to execute 'open'")) {
          errorMessage =
            "Serial port already in use. Please close other applications using the device.";
        } else if (
          error.message.includes("timeout") ||
          error.message.includes("Timeout")
        ) {
          errorMessage =
            "Connection timeout. This usually means:\n1. Device is not in bootloader mode\n2. USB connection is unstable\n3. Device needs to be reset\n\nTry: Hold BOOT button, press RESET, release BOOT, then try again";
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(`❌ Firmware flashing failed!\n\nError: ${errorMessage}`);
    } finally {
      setIsFlashing(false);
    }
  };

  const handleDownloadLatestRelease = async () => {
    try {
      const response = await fetch(
        "https://api.github.com/repos/SeedLabs-it/smartknob-firmware/releases/latest",
      );
      const releaseData = await response.json();

      if (!response.ok) {
        throw new Error("Failed to fetch release data");
      }

      const zipAsset = releaseData.assets.find((asset: File) =>
        asset.name.endsWith(".zip"),
      );

      if (!zipAsset) {
        throw new Error("No zip file found in release");
      }

      const link = document.createElement("a");
      link.href = zipAsset.browser_download_url;
      link.download = zipAsset.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`✓ Downloaded ${zipAsset.name} successfully!`);
    } catch (error) {
      toast.error(
        `✗ Failed to download latest release: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  return (
    <div className="firmware-flashing">
      <div className="firmware-flashing-content">
        <div className="firmware-flashing-section">
          <div className="firmware-flashing-section-header">
            <h3>Upload Firmware</h3>
            <button
              className="firmware-flashing-action-btn secondary"
              onClick={handleDownloadLatestRelease}
              disabled={isFlashing}
            >
              <IconBrandGithub size={20} />
              Download Latest Release
            </button>
          </div>
          <div className="firmware-flashing-file-upload">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              className="firmware-flashing-file-input"
              disabled={isFlashing}
            />
            <button
              className="firmware-flashing-file-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isFlashing}
            >
              <IconUpload size={20} />
              {selectedFile
                ? extractedFiles.length > 0
                  ? `${selectedFile.name} (${extractedFiles.length} files extracted)`
                  : selectedFile.name
                : "Select Firmware Zip File (.zip)"}
            </button>
            <button
              className="firmware-flashing-flash-button"
              onClick={() => handleFlash()}
              disabled={isFlashing || extractedFiles.length === 0}
            >
              <IconBolt size={20} />
              Flash Now
            </button>
          </div>
        </div>

        <div className="firmware-flashing-section">
          <h3>Terminal Output</h3>
          <div ref={terminalRef} className="firmware-flashing-terminal" />
        </div>
      </div>
    </div>
  );
}
