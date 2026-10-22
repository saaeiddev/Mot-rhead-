import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AudioLines, Bluetooth, Check, ChevronLeft, ChevronRight, CircleHelp, Disc3,
  Download, Headphones, Heart, ListMusic, Menu, Minus, MoreHorizontal, Music2,
  Pause, Play, Plus, RotateCcw, Save, Settings2, Shuffle, SkipBack, SkipForward,
  SlidersHorizontal, Sparkles, Trash2, Upload, Volume2, VolumeX, Waves, X
} from 'lucide-react'
import HeadphoneScene from './HeadphoneScene'
import Visualizer from './Visualizer'
import { AudioEngine } from './audio'
import { connectBle, disconnectBle, hasWebBluetooth, type BleDevice } from './bluetooth'
import { DEFAULTS, FACTORY_PRESETS, readSaved, sanitizeSettings, saveSettings, type SoundPreset, type SoundSettings } from './presets'

type Tab = 'HOME' | 'SOUND' | 'PRESETS' | 'CONTROLS' | 'MORE'
type Track = { id: number; name: string; artist: string; url: string }
type RepeatMode = 'off' | 'all' | 'one'
const TABS: Tab[] = ['HOME', 'SOUND', 'PRESETS', 'CONTROLS', 'MORE']
const FREQUENCIES = ['60', '250', '1K', '4K', '12K']
const ICONS = [Headphones, AudioLines, Disc3, Settings2, MoreHorizontal]
const GESTURES = [
  { name: 'SINGLE TAP', action: 'Play / Pause', detail: 'Toggle in-app playback' },
  { name: 'DOUBLE TAP', action: 'Next Track', detail: 'Jump to next in-app file' },
  { name: 'TRIPLE TAP', action: 'Previous Track', detail: 'Jump to previous in-app file' },
  { name: 'PRESS & HOLD', action: 'Mute / Unmute', detail: 'Toggle in-app output volume' }
]
const formatTime = (time: number) => Number.isFinite(time) ? Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0') : '0:00'
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

function LineButton({ children, onClick, disabled = false, className = '', title }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string; title?: string
}) {
  return <button type="button" title={title} disabled={disabled} className={'line-button ' + className} onClick={onClick}>{children}</button>
}

function SlideControl({ label, value, min, max, step = 1, onChange, suffix = '' }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; suffix?: string
}) {
  return <div className="slide-control">
    <div className="slider-title"><span>{label}</span><strong>{value}{suffix}</strong></div>
    <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.currentTarget.value))} />
  </div>
}

function Logo() { return <div className="logo" aria-label="Mot-rhead"><span>MOT</span><span className="logo-mark">/</span><span>RHEAD</span><sup>®</sup></div> }

export default function App() {
  const [tab, setTab] = useState<Tab>('HOME')
  const [sound, setSound] = useState<SoundSettings>(() => sanitizeSettings(readSaved('mot-sound', DEFAULTS)))
  const [volume, setVolume] = useState(() => Math.max(0, Math.min(1, readSaved<number>('mot-volume', 0.8))))
  const [muted, setMuted] = useState(false)
  const [custom, setCustom] = useState<SoundPreset[]>(() => {
    const saved = readSaved<SoundPreset[]>('mot-custom', [])
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string').map(item => ({
      ...sanitizeSettings(item), id: item.id, name: item.name.slice(0, 32), description: 'Your custom sound', custom: true
    })) : []
  })
  const [activePreset, setActivePreset] = useState('custom')
  const [presetName, setPresetName] = useState('')
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [ble, setBle] = useState<{ device: BleDevice; name: string; battery: number | null } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [notice, setNotice] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const engine = useRef<AudioEngine | null>(null)
  const tracksRef = useRef<Track[]>([])
  const indexRef = useRef(0)
  const track = tracks[currentIndex]
  tracksRef.current = tracks
  indexRef.current = currentIndex

  useEffect(() => { saveSettings('mot-sound', sound); engine.current?.setSettings(sound) }, [sound])
  useEffect(() => { saveSettings('mot-volume', volume); engine.current?.setVolume(muted ? 0 : volume) }, [volume, muted])
  useEffect(() => { saveSettings('mot-custom', custom) }, [custom])
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    try { engine.current = new AudioEngine(audio); engine.current.setSettings(sound); engine.current.setVolume(volume) }
    catch (error) { setNotice('Audio processing is unavailable: ' + errorMessage(error)) }
    const soundEngine = engine.current
    return () => { void soundEngine?.close(); engine.current = null }
  // AudioContext belongs to this specific <audio> element and is created once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => () => { tracksRef.current.forEach(item => URL.revokeObjectURL(item.url)) }, [])
  useEffect(() => {
    if (!notice) return
    // User dismissed notices remain dismissed; no hidden auto-correction of failures.
  }, [notice])

  const updateSound = (partial: Partial<SoundSettings>) => {
    setActivePreset('custom')
    setSound(previous => sanitizeSettings({ ...previous, ...partial }))
  }
  const importFiles = (files: FileList | null) => {
    if (!files?.length) return
    const incoming: Track[] = []
    Array.from(files).forEach((file, i) => {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name)) return
      const base = file.name.replace(/\.[^/.]+$/, '')
      const parts = base.split(' - ')
      incoming.push({ id: Date.now() + i + Math.round(Math.random() * 100000), name: parts.length > 1 ? parts.slice(1).join(' - ') : base, artist: parts.length > 1 ? parts[0] : 'Local Audio', url: URL.createObjectURL(file) })
    })
    if (!incoming.length) { setNotice('Select compatible audio files (MP3, WAV, AAC, OGG, etc.).'); return }
    setTracks(old => [...old, ...incoming])
    if (tracksRef.current.length === 0) { setCurrentIndex(0); setPlaying(false) }
    setNotice(incoming.length + ' track' + (incoming.length > 1 ? 's' : '') + ' imported for in-app playback.')
  }
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!tracksRef.current.length) { inputRef.current?.click(); return }
    if (!audio.paused) { audio.pause(); setPlaying(false); return }
    try {
      await engine.current?.unlock()
      await audio.play()
      setPlaying(true)
    } catch (error) { setPlaying(false); setNotice('Unable to play: ' + errorMessage(error)) }
  }, [])
  const goTrack = useCallback((direction: number, forcedIndex?: number) => {
    const total = tracksRef.current.length
    if (!total) return
    setCurrentIndex(index => {
      if (forcedIndex !== undefined) return Math.max(0, Math.min(total - 1, forcedIndex))
      if (shuffle && total > 1) {
        const offset = 1 + Math.floor(Math.random() * (total - 1))
        return (index + offset) % total
      }
      return (index + direction + total) % total
    })
    setTime(0)
  }, [shuffle])
  const onEnded = () => {
    const audio = audioRef.current
    if (repeat === 'one' && audio) { audio.currentTime = 0; void audio.play().catch(() => setPlaying(false)); return }
    if (tracks.length > 1 && (repeat === 'all' || shuffle || currentIndex < tracks.length - 1)) goTrack(1)
    else setPlaying(false)
  }
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!track) { audio.removeAttribute('src'); audio.load(); return }
    audio.src = track.url
    audio.load()
    setDuration(0); setTime(0)
    if (playing) { void engine.current?.unlock().then(() => audio.play()).catch(error => { setPlaying(false); setNotice(errorMessage(error)) }) }
  // Switching tracks should use current playback preference.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id])
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.name, artist: track.artist, album: 'MOT-RHEAD Local Library' })
      navigator.mediaSession.setActionHandler('play', () => { void togglePlay() })
      navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause())
      navigator.mediaSession.setActionHandler('previoustrack', () => goTrack(-1))
      navigator.mediaSession.setActionHandler('nexttrack', () => goTrack(1))
    } catch { /* browser may not support these actions */ }
  }, [track, goTrack, togglePlay])
  const connect = async () => {
    if (connecting) return
    setConnecting(true)
    setNotice('')
    try {
      const result = await connectBle()
      const handler = () => { setBle(null); setNotice('BLE device disconnected.') }
      result.device.addEventListener('gattserverdisconnected', handler)
      setBle(result)
      setNotice('Connected to ' + result.name + ' over BLE GATT. This does not pair headphone audio.')
    } catch (error) { setNotice('BLE connection not established: ' + errorMessage(error)) }
    finally { setConnecting(false) }
  }
  const disconnect = () => { disconnectBle(ble?.device ?? null); setBle(null); setNotice('BLE connection closed. OS audio routing is unchanged.') }
  const choosePreset = (preset: SoundPreset) => { setSound(sanitizeSettings(preset)); setActivePreset(preset.id) }
  const saveCustom = () => {
    const name = presetName.trim().slice(0, 32)
    if (!name) { setNotice('Enter a name for your sound preset.'); return }
    const profile: SoundPreset = { ...sound, id: 'custom-' + Date.now(), name, description: 'Your custom sound', custom: true }
    setCustom(old => [...old, profile])
    setActivePreset(profile.id)
    setPresetName('')
    setNotice('Preset saved locally on this device.')
  }
  const renamePreset = (profile: SoundPreset) => {
    const newName = window.prompt('Rename custom preset:', profile.name)?.trim().slice(0, 32)
    if (newName) setCustom(old => old.map(item => item.id === profile.id ? { ...item, name: newName } : item))
  }
  const demoGesture = (index: number) => {
    if (index === 0) void togglePlay()
    if (index === 1) goTrack(1)
    if (index === 2) goTrack(-1)
    if (index === 3) setMuted(old => !old)
    if (!tracks.length && index > 0 && index < 3) setNotice('Import audio files to test track gestures.')
  }
  const player = <div className="player">
    <div className="player-info"><div className="album-art"><Music2 size={23} /></div><div className="player-meta"><b>{track?.name || 'YOUR SOUNDTRACK'}</b><span>{track?.artist || 'Import your music to begin'}</span></div><LineButton className="icon-soft" title="Import music" onClick={() => inputRef.current?.click()}><Plus size={22} /></LineButton></div>
    <div className="seek"><input aria-label="Playback position" type="range" min="0" max={Math.max(1, duration)} step=".1" value={Math.min(time, Math.max(1, duration))} disabled={!track || !duration} onChange={e => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value); setTime(Number(e.target.value)) }} /><div><span>{formatTime(time)}</span><span>{formatTime(duration)}</span></div></div>
    <div className="player-actions">
      <LineButton title="Shuffle" className={shuffle ? 'selected' : ''} onClick={() => setShuffle(old => !old)}><Shuffle size={19} /></LineButton>
      <LineButton title="Previous track" onClick={() => goTrack(-1)}><SkipBack size={21} fill="currentColor" /></LineButton>
      <LineButton title={playing ? 'Pause' : 'Play'} className="big-play" onClick={() => { void togglePlay() }}>{playing ? <Pause fill="currentColor" size={23} /> : <Play fill="currentColor" size={23} />}</LineButton>
      <LineButton title="Next track" onClick={() => goTrack(1)}><SkipForward size={21} fill="currentColor" /></LineButton>
      <LineButton title={'Repeat: ' + repeat} className={repeat !== 'off' ? 'selected' : ''} onClick={() => setRepeat(old => old === 'off' ? 'all' : old === 'all' ? 'one' : 'off')}><RotateCcw size={19} />{repeat === 'one' && <sup>1</sup>}</LineButton>
    </div>
  </div>
  return <div className="app">
    <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac,.opus" multiple hidden onChange={e => { importFiles(e.target.files); e.target.value = '' }} />
    <audio ref={audioRef} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={e => setTime(e.currentTarget.currentTime)} onDurationChange={e => setDuration(e.currentTarget.duration || 0)} onEnded={onEnded} onError={() => { if (track) setNotice('This audio format cannot be decoded by your browser.') }} />
    <div className="desktop-shell">
      <header className="topbar">
        <Logo />
        <div className="topbar-right"><span className="top-tag">OWN THE NOISE © 2026</span><span className={'status-dot ' + (ble ? 'connected' : '')} /><span className="status-text">{ble ? 'BLE CONNECTED' : 'DEMO MODE'}</span><button className="settings-button" type="button" aria-label="Open settings" onClick={() => setTab('MORE')}><Settings2 size={19} /></button></div>
      </header>
      <div className="layout">
        <aside className="sidebar"><div className="side-mark">SOUND<br />WITHOUT<br /><i>RULES.</i></div><nav aria-label="Main navigation">{TABS.map((item, i) => { const Icon = ICONS[i]; return <button type="button" key={item} className={'side-link ' + (tab === item ? 'active' : '')} onClick={() => setTab(item)}><Icon size={18} />{item}<ChevronRight size={15} /></button> })}</nav><div className="side-footer"><span>THE STREET IS OUR STUDIO</span><strong>01 / 05</strong></div></aside>
        <main id="main-content">
          {tab === 'HOME' && <div className="screen home-screen">
            <div className="eyebrow"><span className="small-square" /> YOUR PERSONAL SOUND SYSTEM <span className="slash">///</span> 001</div>
            <div className="home-hero"><div className="hero-copy"><p className="hero-script">More than music.</p><h1>CONNECTED<br /><em>AND</em> READY<span className="punctuation">.</span></h1><p className="lead">TURN IT UP. TUNE IT OUT.<br />THIS IS YOUR SOUND, YOUR RULES.</p></div><div className="hero-object"><HeadphoneScene /><span className="hero-object-label">DRAG TO ROTATE / 3D</span><span className="hero-decor">R<br/>H<br/>D</span></div></div>
            <div className="home-bottom"><div className="device-card"><div className="section-heading"><span>01 — YOUR GEAR</span><Bluetooth size={18} /></div><h2>{ble?.name || 'HEADPHONE STUDIO'}</h2><p>{ble ? 'BLE GATT session connected — audio routes through your operating system' : 'Demo mode — pair Bluetooth audio through your device settings'}</p><div className="device-status"><span><i className={'status-dot ' + (ble ? 'connected' : '')} />{ble ? 'BLE CONNECTED' : 'NO BLE DEVICE'}</span><span>{ble?.battery !== null && ble?.battery !== undefined ? ble.battery + '% BATTERY' : 'BATTERY UNKNOWN'}</span></div><button className="white-button" type="button" onClick={ble ? disconnect : connect} disabled={connecting || (!ble && !hasWebBluetooth())}>{ble ? 'DISCONNECT BLE' : connecting ? 'CONNECTING...' : hasWebBluetooth() ? 'CONNECT BLE DEVICE ↗' : 'BLE NOT AVAILABLE'}</button></div>
            <div className="quick-card"><div className="section-heading"><span>02 — QUICK CONTROL</span><AudioLines size={18} /></div><div className="quick-grid"><button type="button" className={'quick-control ' + (sound.bassEnabled ? 'on' : '')} onClick={() => updateSound({ bassEnabled: !sound.bassEnabled, bass: sound.bass || 5 })}><Waves /><b>BASS BOOST</b><small>{sound.bassEnabled ? 'ON' : 'OFF'}</small></button><button type="button" className="quick-control" onClick={() => setTab('SOUND')}><SlidersHorizontal /><b>EQUALIZER</b><small>5 BANDS</small></button><button type="button" className="quick-control" onClick={() => setNotice('Active noise cancellation requires the manufacturer’s documented device protocol. Unavailable in this generic web app.')}><Headphones /><b>NOISE CANCEL</b><small>UNSUPPORTED</small></button><button type="button" className="quick-control" onClick={() => setNotice('Transparency and spatial modes require manufacturer-specific hardware APIs. They are not simulated.')}><Sparkles /><b>SPATIAL / AMBIENT</b><small>UNSUPPORTED</small></button></div></div></div>
            <div className="home-player"><div className="section-heading">03 — NOW PLAYING <button className="text-link" type="button" onClick={() => setTab('SOUND')}>OPEN SOUND STUDIO <ChevronRight size={15} /></button></div>{player}</div>
          </div>}
          {tab === 'SOUND' && <div className="screen"><div className="eyebrow">02 / SOUND LAB <span className="slash">///</span> REAL-TIME WEB AUDIO</div><div className="page-title"><h1>FEEL THE <em>BEAT.</em></h1><span className="handwritten">Tune your movement.</span></div><div className="sound-layout"><section className="panel equalizer-panel"><div className="section-heading"><span>01 — 5-BAND EQUALIZER</span><LineButton title={sound.eqEnabled ? 'Bypass EQ' : 'Enable EQ'} onClick={() => updateSound({ eqEnabled: !sound.eqEnabled })}>{sound.eqEnabled ? 'EQ ON' : 'EQ BYPASS'}</LineButton></div><div className="eq-visual"><Visualizer analyser={engine.current?.analyser ?? null} playing={playing} /></div><div className={'eq-bands ' + (!sound.eqEnabled ? 'disabled-eq' : '')}>{FREQUENCIES.map((hz, index) => <div className="eq-band" key={hz}><span className="eq-value">{sound.eq[index] > 0 ? '+' : ''}{sound.eq[index]} dB</span><input type="range" aria-label={hz + ' hertz equalizer gain'} min="-12" max="12" step="1" value={sound.eq[index]} onChange={e => { const eq = [...sound.eq] as SoundSettings['eq']; eq[index] = Number(e.currentTarget.value); updateSound({ eq }) }} /><b>{hz}</b><small>HZ</small></div>)}</div><div className="row-actions"><button className="subtle-button" type="button" onClick={() => updateSound({ eq: [0, 0, 0, 0, 0] })}><RotateCcw size={15} /> RESET EQ</button><button className="subtle-button" type="button" onClick={() => setTab('PRESETS')}><Save size={15} /> SAVE PRESET ↗</button></div></section>
            <section className="sound-sidebar"><div className="panel sound-settings"><div className="section-heading"><span>02 — DRIVE THE SOUND</span><Waves size={17} /></div><SlideControl label="VOLUME — APP ONLY" value={Math.round((muted ? 0 : volume) * 100)} min={0} max={100} suffix="%" onChange={n => { setMuted(false); setVolume(n / 100) }} /><button type="button" className="toggle-line" onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={21} /> : <Volume2 size={21} />} {muted ? 'UNMUTE' : 'MUTE'} <span>{muted ? 'OFF' : 'ON'}</span></button><button type="button" className="toggle-line" onClick={() => updateSound({ bassEnabled: !sound.bassEnabled })}><Waves size={21} /> BASS BOOST <span>{sound.bassEnabled ? 'ON' : 'OFF'}</span></button><SlideControl label="BASS INTENSITY" min={0} max={12} value={sound.bass} suffix=" dB" onChange={bass => updateSound({ bass, bassEnabled: true })} /><SlideControl label="PUNCH / DYNAMICS" min={0} max={100} value={sound.punch} suffix="%" onChange={punch => updateSound({ punch })} /></div><div className="panel player-panel"><div className="section-heading">03 — YOUR PLAYER</div>{player}</div></section></div><p className="disclaimer">All EQ, bass and volume changes affect only audio played inside MOT-RHEAD. System-wide audio and third-party apps cannot be processed by this web app.</p></div>}
          {tab === 'PRESETS' && <div className="screen"><div className="eyebrow">03 / SOUND PROFILES <span className="slash">///</span> YOUR CITY. YOUR FREQUENCY.</div><div className="page-title"><h1>DIFFERENT STREETS.<br /><em>SAME SOUND.</em></h1><span className="handwritten">Choose your energy.</span></div><div className="preset-grid">{FACTORY_PRESETS.map((preset, i) => <button type="button" key={preset.id} onClick={() => choosePreset(preset)} className={'preset-card preset-' + preset.id + ' ' + (activePreset === preset.id ? 'active' : '')}><span className="preset-count">0{i + 1} / AUDIO PROFILE {activePreset === preset.id && <Check size={19} />}</span><span className="preset-art" aria-hidden="true">{['S', 'B', 'C', 'X'][i]}</span><strong>{preset.name}</strong><small>{preset.description}</small><span className="preset-cta">{activePreset === preset.id ? 'ACTIVE PROFILE' : 'LOAD PROFILE'} ↗</span></button>)}</div><div className="panel custom-panel"><div className="section-heading">05 — CUSTOM PROFILES <span>{custom.length} SAVED</span></div><p>Save the current EQ, bass and punch settings. Profiles stay in this browser.</p><form className="save-form" onSubmit={e => { e.preventDefault(); saveCustom() }}><input aria-label="Custom preset name" maxLength={32} placeholder="NAME YOUR SOUND" value={presetName} onChange={e => setPresetName(e.target.value)} /><button type="submit" className="dark-button"><Plus size={16} /> SAVE CURRENT SOUND</button></form>{custom.length > 0 && <div className="custom-list">{custom.map(preset => <div className="custom-item" key={preset.id}><button type="button" className="profile-select" onClick={() => choosePreset(preset)}><Disc3 size={18} /> {preset.name}{activePreset === preset.id && <Check size={17} />}</button><button type="button" aria-label={'Rename ' + preset.name} onClick={() => renamePreset(preset)}><Settings2 size={18} /></button><button type="button" aria-label={'Delete ' + preset.name} onClick={() => setCustom(old => old.filter(item => item.id !== preset.id))}><Trash2 size={17} /></button></div>)}</div>}<button type="button" className="subtle-button" onClick={() => { setSound(DEFAULTS); setActivePreset('custom'); setNotice('Default sound settings restored. Saved custom profiles were kept.') }}><RotateCcw size={15} /> RESTORE FLAT SOUND</button></div></div>}
          {tab === 'CONTROLS' && <div className="screen"><div className="eyebrow">04 / CONTROL DECK <span className="slash">///</span> IN-APP GESTURE DEMO</div><div className="page-title"><h1>EVERY MOVE<br /><em>MATTERS.</em></h1><span className="handwritten">Stay in control.</span></div><div className="control-intro"><div className="control-ring"><Headphones size={85} strokeWidth={1} /><span>TOUCH / TAP / REPEAT</span></div><div className="control-copy"><h2>PLAY IT<br />YOUR WAY.</h2><p>Try each gesture below. The action controls your imported tracks inside this app. Reprogramming physical headphone buttons requires a compatible manufacturer's protocol and is not available in this version.</p><button className="white-button" type="button" onClick={() => inputRef.current?.click()}><Upload size={16} /> IMPORT MUSIC</button></div></div><div className="gesture-grid">{GESTURES.map((gesture, index) => <div className="gesture-item" key={gesture.name}><div><span>0{index + 1}</span><h3>{gesture.name}</h3><p>{gesture.action}</p><small>{gesture.detail}</small></div><button type="button" aria-label={'Try ' + gesture.name} onClick={() => demoGesture(index)}>TRY ACTION <ChevronRight size={17} /></button></div>)}</div><div className="panel"><div className="section-heading">LOCAL PLAYLIST <span>{tracks.length} TRACKS</span></div><div className="playlist">{tracks.length === 0 ? <p>No music imported yet. Select audio from your device to get started.</p> : tracks.map((item, index) => <div className={'playlist-row ' + (currentIndex === index ? 'playing-row' : '')} key={item.id}><button type="button" onClick={() => { goTrack(0, index); if (!playing) setPlaying(true) }}><span>{String(index + 1).padStart(2, '0')}</span><b>{item.name}</b><small>{item.artist}</small></button><button type="button" title={'Remove ' + item.name} onClick={() => { URL.revokeObjectURL(item.url); setTracks(old => old.filter(x => x.id !== item.id)); setCurrentIndex(x => Math.max(0, Math.min(x, tracks.length - 2))) }}><X size={17} /></button></div>)}</div><button className="subtle-button" type="button" onClick={() => inputRef.current?.click()}><Plus size={16} /> ADD TRACKS</button></div></div>}
          {tab === 'MORE' && <div className="screen"><div className="eyebrow">05 / DEVICE & SETTINGS <span className="slash">///</span> NO FAKE HARDWARE CONTROL</div><div className="page-title"><h1>NO <em>LIMITS.</em><br />JUST THE TRUTH.</h1><span className="handwritten">Built for your sound.</span></div><div className="more-grid"><section className="panel"><div className="section-heading"><span>01 — CONNECTION</span><Bluetooth size={19} /></div><h2>{ble?.name || 'BLUETOOTH AUDIO'}</h2><p>{hasWebBluetooth() ? 'This browser supports requesting BLE GATT devices. An ordinary Bluetooth audio connection is handled in your operating system.' : 'This browser does not support standard Web Bluetooth BLE discovery. On iPhone, pair headphones in iOS Settings → Bluetooth.'}</p><div className="info-row"><span>WEB BLUETOOTH API</span><strong>{hasWebBluetooth() ? 'AVAILABLE' : 'NOT AVAILABLE'}</strong></div><div className="info-row"><span>BLE GATT SESSION</span><strong>{ble ? 'CONNECTED' : 'DISCONNECTED'}</strong></div><div className="info-row"><span>BATTERY SERVICE</span><strong>{ble?.battery == null ? 'NOT EXPOSED' : ble.battery + '%'}</strong></div><button type="button" className="dark-button" disabled={!ble && (!hasWebBluetooth() || connecting)} onClick={ble ? disconnect : connect}>{ble ? 'DISCONNECT BLE' : connecting ? 'CONNECTING...' : 'REQUEST BLE DEVICE'}</button></section><section className="panel"><div className="section-heading">02 — AUDIO ENGINE <AudioLines size={19} /></div><h2>WEB AUDIO DSP</h2><p>Five-band parametric EQ, low-shelf bass, dynamics compression, and an accurate spectrum analyser.</p><div className="info-row"><span>LOCAL TRACKS</span><strong>{tracks.length}</strong></div><div className="info-row"><span>LOCAL PRESETS</span><strong>{custom.length}</strong></div><div className="info-row"><span>OUTPUT ROUTING</span><strong>SYSTEM CONTROLLED</strong></div><button type="button" className="dark-button" onClick={() => setTab('SOUND')}>OPEN SOUND LAB ↗</button></section><section className="panel"><div className="section-heading">03 — COMPATIBILITY <CircleHelp size={19} /></div><h2>WHAT WORKS?</h2><p><b>Works:</b> local music player, EQ, bass, volume, punch, custom presets, and real visualizer. BLE GATT discovery and battery readings may work on supported Chromium browsers and devices.</p><p><b>Not available:</b> system-wide equalization, manufacturer ANC/transparency modes, Bluetooth Classic pairing, hardware volume/gesture remapping, or control of Spotify/Apple Music/YouTube.</p><button type="button" className="subtle-button" onClick={() => setHelpOpen(!helpOpen)}>{helpOpen ? 'HIDE DETAILS' : 'WHY THESE LIMITS?'} <ChevronRight size={16} /></button>{helpOpen && <p className="help-text">Browsers cannot intercept other apps' audio or access most proprietary headset command channels. iOS Safari does not expose the standard Web Bluetooth API. Your phone's system Bluetooth settings remain responsible for connecting Bluetooth headphones. Any supported BLE battery value is read from a real GATT service, never guessed.</p>}</section><section className="panel"><div className="section-heading">04 — YOUR SETUP <Download size={19} /></div><h2>INSTALL THE EXPERIENCE.</h2><p>Add MOT-RHEAD to your Home Screen from your browser share/menu button. Once installed, the app shell can reopen offline; audio files must be imported again after a reload.</p><p>Custom presets and sound settings are stored in this browser's local storage. Files never upload to a server.</p><button type="button" className="subtle-button" onClick={() => { setSound(DEFAULTS); setActivePreset('custom'); setVolume(0.8); setMuted(false); setNotice('Sound controls reset to defaults; your custom presets remain saved.') }}><RotateCcw size={16} /> RESET SOUND SETTINGS</button></section></div><footer className="brand-footer"><Logo /><span>OWN THE NOISE — ORIGINAL CONCEPT. <br /> CREATED BY AMIR SAEID DEHGHAN.</span></footer></div>}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">{TABS.map((item, i) => { const Icon = ICONS[i]; return <button type="button" key={item} className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => { setTab(item); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Icon size={21}/><span>{item}</span></button> })}</nav>
    </div>
    {notice && <div className="toast" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={18} /></button></div>}
  </div>
}
