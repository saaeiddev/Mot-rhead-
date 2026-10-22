import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectBle, disconnectBle, hasWebBluetooth } from './bluetooth'

afterEach(() => vi.unstubAllGlobals())

describe('BLE connection safety', () => {
  it('does not pretend Bluetooth is available without the Web Bluetooth API', async () => {
    vi.stubGlobal('navigator', {})
    expect(hasWebBluetooth()).toBe(false)
    await expect(connectBle()).rejects.toThrow('Web Bluetooth is unavailable')
  })

  it('reads the actual battery characteristic when offered by the device', async () => {
    const getCharacteristic = vi.fn().mockResolvedValue({
      readValue: vi.fn().mockResolvedValue(new DataView(Uint8Array.of(76).buffer))
    })
    const getPrimaryService = vi.fn().mockResolvedValue({ getCharacteristic })
    const connect = vi.fn().mockResolvedValue({})
    const device = {
      id: 'headset-1',
      name: 'BLE Testing Headset',
      gatt: { connected: true, connect, disconnect: vi.fn(), getPrimaryService },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    const requestDevice = vi.fn().mockResolvedValue(device)
    vi.stubGlobal('navigator', { bluetooth: { requestDevice } })
    expect(hasWebBluetooth()).toBe(true)

    const result = await connectBle()
    expect(result).toMatchObject({ device, name: 'BLE Testing Headset', battery: 76 })
    expect(requestDevice).toHaveBeenCalledWith({ acceptAllDevices: true, optionalServices: ['battery_service'] })
    expect(getPrimaryService).toHaveBeenCalledWith('battery_service')
    expect(getCharacteristic).toHaveBeenCalledWith('battery_level')
    disconnectBle(result.device)
    expect(device.gatt.disconnect).toHaveBeenCalledOnce()
  })

  it('never invents battery readings when a GATT service is unavailable', async () => {
    const device = {
      id: 'test-2',
      name: 'Unknown BLE Device',
      gatt: {
        connected: true,
        connect: vi.fn().mockResolvedValue({}),
        disconnect: vi.fn(),
        getPrimaryService: vi.fn().mockRejectedValue(new Error('Service not present'))
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    vi.stubGlobal('navigator', { bluetooth: { requestDevice: vi.fn().mockResolvedValue(device) } })
    await expect(connectBle()).resolves.toMatchObject({ battery: null })
    device.gatt.connected = false
    disconnectBle(device)
    expect(device.gatt.disconnect).not.toHaveBeenCalled()
  })

  it('rejects devices without GATT rather than showing a connected state', async () => {
    vi.stubGlobal('navigator', { bluetooth: { requestDevice: vi.fn().mockResolvedValue({ id: 'classic-headset' }) } })
    await expect(connectBle()).rejects.toThrow('does not expose BLE GATT')
  })
})
