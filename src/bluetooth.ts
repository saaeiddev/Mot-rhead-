/** Web Bluetooth is BLE GATT only; never claim that it pairs classic Bluetooth audio. */
type BatteryCharacteristic = { readValue(): Promise<DataView> }
type BatteryService = { getCharacteristic(name: string): Promise<BatteryCharacteristic> }
type GattServer = { connected: boolean; connect(): Promise<GattServer>; disconnect(): void; getPrimaryService(name: string): Promise<BatteryService> }
export type BleDevice = { name?: string; id: string; gatt?: GattServer; addEventListener(type: string, callback: EventListener): void; removeEventListener(type: string, callback: EventListener): void }
type BleApi = { requestDevice(options: { acceptAllDevices: true; optionalServices: string[] }): Promise<BleDevice> }
export type ConnectionInfo = { device: BleDevice; battery: number | null; name: string }
export function hasWebBluetooth() { return typeof navigator !== 'undefined' && 'bluetooth' in navigator && Boolean((navigator as Navigator & { bluetooth?: BleApi }).bluetooth) }
export async function connectBle(): Promise<ConnectionInfo> {
  const api = (navigator as Navigator & { bluetooth?: BleApi }).bluetooth
  if (!api) throw new Error('Web Bluetooth is unavailable in this browser. Audio pairing stays in device settings.')
  const device = await api.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service'] })
  if (!device.gatt) throw new Error('This device does not expose BLE GATT services.')
  await device.gatt.connect()
  let battery: number | null = null
  try {
    const service = await device.gatt.getPrimaryService('battery_service')
    const characteristic = await service.getCharacteristic('battery_level')
    battery = characteristic.readValue ? (await characteristic.readValue()).getUint8(0) : null
  } catch { /* battery service not available or permission denied */ }
  return { device, name: device.name || 'Unnamed BLE device', battery }
}
export function disconnectBle(device: BleDevice | null) { if (device?.gatt?.connected) device.gatt.disconnect() }
