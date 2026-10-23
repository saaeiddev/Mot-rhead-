export interface DeviceStatus {
  phase: "demo" | "selecting" | "connecting" | "connected" | "error";
  name: string;
  battery: number | null;
  message: string;
}
export interface HeadphoneAdapter {
  id: string;
  optionalServices: BluetoothServiceUUID[];
  supports(device: BluetoothDevice): boolean;
  connect(device: BluetoothDevice): Promise<void>;
  disconnect(): void;
}
// Future manufacturer adapters must implement a documented, model-specific protocol.
// Generic battery reads never imply ANC, transparency, spatial, or remapping support.
export class BatteryAdapter implements HeadphoneAdapter {
  id = "standard-battery";
  optionalServices: BluetoothServiceUUID[] = ["battery_service"];
  device: BluetoothDevice | null = null;
  characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  generation = 0;
  constructor(private publish: (s: DeviceStatus) => void) {}
  supports() {
    return true;
  }
  private state: DeviceStatus = {
    phase: "demo",
    name: "No BLE device",
    battery: null,
    message: "Audio output is managed by your system.",
  };
  private update(patch: Partial<DeviceStatus>) {
    this.state = { ...this.state, ...patch };
    this.publish(this.state);
  }
  private disconnected = () => {
    this.generation++;
    this.cleanup();
    this.update({
      phase: "demo",
      battery: null,
      name: "No BLE device",
      message: "BLE disconnected. System audio routing is unchanged.",
    });
  };
  private batteryChanged = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    const level = value?.getUint8(0);
    if (level !== undefined && level <= 100) this.update({ battery: level });
  };
  private cleanup() {
    this.characteristic?.removeEventListener(
      "characteristicvaluechanged",
      this.batteryChanged,
    );
    this.characteristic = null;
    this.device?.removeEventListener(
      "gattserverdisconnected",
      this.disconnected,
    );
    this.device = null;
  }
  async select() {
    if (!navigator.bluetooth) {
      this.update({
        phase: "error",
        message:
          "Web Bluetooth is unavailable here. Pair your headphones in system Bluetooth settings; all in-app sound tools still work.",
      });
      return;
    }
    this.update({
      phase: "selecting",
      message:
        "Choose a compatible BLE device. This does not pair Bluetooth audio.",
    });
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.optionalServices,
      });
      await this.connect(device);
    } catch (error) {
      this.update({
        phase: "error",
        name: "No BLE device",
        battery: null,
        message:
          error instanceof DOMException && error.name === "NotFoundError"
            ? "Device selection cancelled. You can keep using the music player."
            : error instanceof Error
              ? error.message
              : "Could not connect to this device.",
      });
    }
  }
  async connect(device: BluetoothDevice) {
    this.disconnect();
    this.device = device;
    const generation = ++this.generation;
    this.update({
      phase: "connecting",
      name: device.name || "Unnamed BLE device",
      battery: null,
      message: "Connecting to GATT…",
    });
    device.addEventListener("gattserverdisconnected", this.disconnected);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!device.gatt) throw new Error("This device does not expose GATT.");
      const pending = device.gatt.connect();
      pending.then(
        (server) => {
          if (generation !== this.generation) server.disconnect();
        },
        () => {},
      );
      const server = await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "Connection timed out. Bring the device closer and try again.",
                ),
              ),
            15000,
          );
        }),
      ]);
      clearTimeout(timer);
      if (generation !== this.generation) return;
      this.update({
        phase: "connected",
        message: "BLE connected. Reading supported services…",
      });
      try {
        const service = await server.getPrimaryService("battery_service");
        const characteristic = await service.getCharacteristic("battery_level");
        const value = await characteristic.readValue();
        if (generation !== this.generation) return;
        this.characteristic = characteristic;
        const level = value.getUint8(0);
        this.update({
          battery: level <= 100 ? level : null,
          message:
            "Standard battery service available. No manufacturer controls are enabled.",
        });
        if (characteristic.properties.notify) {
          await characteristic.startNotifications();
          if (generation === this.generation)
            characteristic.addEventListener(
              "characteristicvaluechanged",
              this.batteryChanged,
            );
        }
      } catch {
        if (generation === this.generation)
          this.update({
            message:
              "BLE connected. Battery service is unavailable or not permitted. Manufacturer controls are unsupported.",
          });
      }
    } catch (error) {
      clearTimeout(timer);
      this.generation++;
      this.cleanup();
      device.gatt?.disconnect();
      throw error;
    }
  }
  disconnect() {
    const device = this.device;
    this.generation++;
    this.cleanup();
    device?.gatt?.disconnect();
    this.update({
      phase: "demo",
      name: "No BLE device",
      battery: null,
      message: "Audio output is managed by your system.",
    });
  }
}
