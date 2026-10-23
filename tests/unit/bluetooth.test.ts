import { describe, it, expect, vi, afterEach } from "vitest";
import { BatteryAdapter, type DeviceStatus } from "../../src/bluetooth/adapter";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function mockDevice(battery?: number) {
  const device = new EventTarget() as BluetoothDevice;
  Object.defineProperty(device, "name", { value: "Test BLE" });
  const characteristic = new EventTarget() as BluetoothRemoteGATTCharacteristic;
  const value = new DataView(new Uint8Array([battery ?? 0]).buffer);
  Object.assign(characteristic, {
    readValue: async () => value,
    properties: { notify: true },
    startNotifications: async () => characteristic,
    value,
  });
  const server = {
    getPrimaryService: async () => {
      if (battery === undefined) throw new Error("service unavailable");
      return { getCharacteristic: async () => characteristic };
    },
    disconnect: vi.fn(),
  };
  Object.assign(device, {
    gatt: { connect: async () => server, disconnect: server.disconnect },
  });
  return { device, server, characteristic };
}
describe("honest BLE states", () => {
  it("reports unsupported browsers without claiming a connection", async () => {
    vi.stubGlobal("navigator", {});
    const states: DeviceStatus[] = [];
    await new BatteryAdapter((s) => states.push(s)).select();
    expect(states.at(-1)?.phase).toBe("error");
    expect(states.at(-1)?.battery).toBe(null);
  });
  it("handles a cancelled device chooser", async () => {
    vi.stubGlobal("navigator", {
      bluetooth: {
        requestDevice: () =>
          Promise.reject(new DOMException("cancel", "NotFoundError")),
      },
    });
    const states: DeviceStatus[] = [];
    await new BatteryAdapter((s) => states.push(s)).select();
    expect(states.at(-1)?.message).toContain("cancelled");
    expect(states.some((s) => s.phase === "connected")).toBe(false);
  });
  it("does not invent battery data when service is absent", async () => {
    const { device } = mockDevice();
    const states: DeviceStatus[] = [];
    await new BatteryAdapter((s) => states.push(s)).connect(device);
    expect(states.at(-1)?.phase).toBe("connected");
    expect(states.at(-1)?.battery).toBe(null);
  });
  it("reads actual battery notifications and clears state on disconnect", async () => {
    const { device, characteristic } = mockDevice(72);
    const states: DeviceStatus[] = [];
    await new BatteryAdapter((s) => states.push(s)).connect(device);
    expect(states.at(-1)?.battery).toBe(72);
    characteristic.value!.setUint8(0, 49);
    characteristic.dispatchEvent(new Event("characteristicvaluechanged"));
    expect(states.at(-1)?.battery).toBe(49);
    device.dispatchEvent(new Event("gattserverdisconnected"));
    expect(states.at(-1)?.phase).toBe("demo");
    expect(states.at(-1)?.battery).toBe(null);
  });
  it("disconnects a late GATT success after the timeout", async () => {
    vi.useFakeTimers();
    let finish: (value: unknown) => void = () => {};
    const { device, server } = mockDevice(50);
    Object.assign(device.gatt!, {
      connect: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const adapter = new BatteryAdapter(() => {});
    const result = adapter.connect(device).catch((e) => e.message);
    await vi.advanceTimersByTimeAsync(15001);
    expect(await result).toContain("timed out");
    finish(server);
    await Promise.resolve();
    expect(server.disconnect).toHaveBeenCalled();
  });
});
