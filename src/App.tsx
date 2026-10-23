import { makeId } from "./id";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AudioLines,
  Battery,
  Bluetooth,
  Check,
  ChevronRight,
  Disc3,
  Download,
  Headphones,
  House,
  Info,
  ListMusic,
  LoaderCircle,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat,
  Repeat1,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Waves,
  X,
  Zap,
  Hand,
  ArrowUpRight,
  Pencil,
  Save,
} from "lucide-react";
import {
  DEFAULT_SOUND,
  PRESETS,
  applyPreset,
  readPresets,
  readSound,
  type Preset,
  type Sound,
} from "./audio/presets";
import { usePlayer, type Player } from "./audio/usePlayer";
import { BatteryAdapter, type DeviceStatus } from "./bluetooth/adapter";
import { Range } from "./components/Range";
import { Spectrum } from "./components/Spectrum";

type Page = "home" | "sound" | "presets" | "controls" | "more";
const nav = [
  { id: "home", title: "Home", icon: House },
  { id: "sound", title: "Sound", icon: AudioLines },
  { id: "presets", title: "Presets", icon: SlidersHorizontal },
  { id: "controls", title: "Controls", icon: Hand },
  { id: "more", title: "More", icon: MoreHorizontal },
] as const;
const asset = (file: string) => import.meta.env.BASE_URL + "assets/" + file;
const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function Crown({ className = "" }: { className?: string }) {
  return (
    <svg
      className={"crown " + className}
      viewBox="0 0 60 56"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 41 5 18 23 32 31 5 37 32 55 16 47 45 9 41ZM7 49 51 51M13 45 10 55"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={"toggle " + (checked ? "on" : "")}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
function Heading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}
function MiniTransport({ player }: { player: Player }) {
  return (
    <div className="transport">
      <button
        aria-label="Previous track"
        disabled={!player.current}
        onClick={() => player.next(-1)}
      >
        <SkipBack size={19} />
      </button>
      <button
        className="play-circle"
        aria-label={player.playing ? "Pause" : "Play"}
        onClick={player.toggle}
      >
        {player.playing ? (
          <Pause size={20} fill="currentColor" />
        ) : (
          <Play size={20} fill="currentColor" />
        )}
      </button>
      <button
        aria-label="Next track"
        disabled={!player.current}
        onClick={() => player.next()}
      >
        <SkipForward size={19} />
      </button>
    </div>
  );
}
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function App() {
  const [page, setPage] = useState<Page>(() =>
    nav.some((n) => n.id === location.hash.slice(1))
      ? (location.hash.slice(1) as Page)
      : "home",
  );
  const [sound, setSound] = useState<Sound>(readSound);
  const [custom, setCustom] = useState<Preset[]>(readPresets);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<"factory" | "custom">("factory");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = useCallback((text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6000);
  }, []);
  const player = usePlayer(sound, notify);
  const fileInput = useRef<HTMLInputElement>(null);
  const [device, setDevice] = useState<DeviceStatus>({
    phase: "demo",
    name: "No BLE device",
    battery: null,
    message: "Audio output is managed by your system.",
  });
  const [adapter] = useState(() => new BatteryAdapter(setDevice));
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [modal, setModal] = useState<
    "save" | "rename" | "install" | "restore" | "connection" | null
  >(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [holdAction, setHoldAction] = useState(() => {
    try {
      return localStorage.getItem("motr-hold") || "mute";
    } catch {
      return "mute";
    }
  });
  const [playlistName, setPlaylistName] = useState(() => {
    try {
      return localStorage.getItem("motr-playlist-name") || "My rotation";
    } catch {
      return "My rotation";
    }
  });
  const [reduced, setReduced] = useState(() => {
    try {
      return (
        localStorage.getItem("motr-reduced") === "true" ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch {
      return false;
    }
  });
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [importing, setImporting] = useState(false);
  const patch = (value: Partial<Sound>) => {
    setSound((s) => ({ ...s, ...value }));
  };
  const tune = (value: Partial<Sound>) => {
    patch(value);
    setSelected("");
  };
  const go = (next: Page) => {
    setPage(next);
    location.hash = next;
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const hash = () => {
      const p = location.hash.slice(1);
      if (nav.some((n) => n.id === p)) setPage(p as Page);
    };
    const before = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("hashchange", hash);
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      adapter.disconnect();
      clearTimeout(toastTimer.current);
    };
  }, [adapter]);
  const storageWarning = useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem("motr-sound", JSON.stringify(sound));
      localStorage.setItem("motr-presets", JSON.stringify(custom));
      localStorage.setItem("motr-hold", holdAction);
      localStorage.setItem("motr-playlist-name", playlistName);
      localStorage.setItem("motr-reduced", String(reduced));
    } catch {
      if (!storageWarning.current) {
        notify("Preferences cannot be saved in this browser session.");
        storageWarning.current = true;
      }
    }
  }, [sound, custom, holdAction, playlistName, reduced, notify]);
  const dialog = useRef<HTMLDialogElement>(null);
  const showDialog = !!modal || libraryOpen;
  useEffect(() => {
    if (showDialog) dialog.current?.showModal();
    else dialog.current?.close();
  }, [showDialog]);
  const closeDialog = () => {
    setLibraryOpen(false);
    setModal(null);
  };
  const choose = (preset: Preset) => {
    setSound((s) => applyPreset(s, preset));
    setSelected(preset.id);
    notify(`${preset.name} sound loaded.`);
  };
  const savePreset = () => {
    const title = name.trim();
    if (!title) return;
    const id = editing || "custom-" + makeId();
    if (modal === "rename") {
      setCustom((list) =>
        list.map((p) => (p.id === id ? { ...p, name: title } : p)),
      );
    } else {
      const preset: Preset = {
        id,
        name: title,
        description: "YOUR SOUND. YOUR RULES.",
        eq: [...sound.eq],
        bass: sound.bassOn ? sound.bass : 0,
        punch: sound.punchOn ? sound.punch : 0,
      };
      setCustom((list) =>
        editing
          ? list.map((p) => (p.id === id ? preset : p))
          : [...list, preset],
      );
      setSelected(id);
    }
    setModal(null);
    notify("Preset saved on this device.");
  };
  const saveDialog = () => {
    setEditing(null);
    setName("");
    setModal("save");
  };
  const unsupported = (feature: string) =>
    notify(
      `${feature} needs a supported manufacturer protocol. No hardware command has been sent.`,
    );
  const importAudio = () => fileInput.current?.click();
  const installApp = async () => {
    if (install) {
      await install.prompt();
      const result = await install.userChoice;
      if (result.outcome === "accepted") notify("Installation requested.");
      setInstall(null);
    } else setModal("install");
  };
  const connected = device.phase === "connected";
  const connecting =
    device.phase === "connecting" || device.phase === "selecting";
  const bluetoothAvailable =
    typeof navigator.bluetooth?.requestDevice === "function";
  const connectDevice = () => {
    setModal("connection");
    // Keep the chooser in the click handler so browser user activation is retained.
    if (connected) adapter.disconnect();
    else void adapter.select();
  };
  const performHold = () => {
    if (holdAction === "mute") patch({ muted: !sound.muted });
    else if (holdAction === "bass")
      tune({ bassOn: !sound.bassOn, bass: sound.bass || 4 });
    else if (holdAction === "shuffle") {
      player.setShuffle(!player.shuffle);
      notify(player.shuffle ? "Shuffle off." : "Shuffle on.");
    } else go("sound");
  };
  const presetCards = (compact = false) => (
    <div className={"preset-grid " + (compact ? "compact" : "")}>
      {PRESETS.map((preset, i) => (
        <button
          className={
            "preset-card " + (selected === preset.id ? "selected" : "")
          }
          key={preset.id}
          style={{ "--position": `${(i * 100) / 3}%` } as CSSProperties}
          onClick={() => choose(preset)}
          aria-pressed={selected === preset.id}
        >
          <div className="preset-top">
            <span>0{i + 1}</span>
            <Crown />
          </div>
          <div className="preset-bottom">
            <div>
              <h3>{preset.name}</h3>
              <p>{preset.description}</p>
            </div>
            <span className="radio-dot">
              {selected === preset.id && <Check size={12} />}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
  return (
    <div className={"app " + (reduced ? "reduce-motion" : "")}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <input
        ref={fileInput}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus"
        multiple
        hidden
        aria-label="Import audio files"
        onChange={async (e) => {
          if (e.target.files) {
            setImporting(true);
            try {
              await player.importFiles(e.target.files);
            } finally {
              setImporting(false);
            }
          }
          e.target.value = "";
        }}
      />
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => go("home")}
          aria-label="MOT-RHEAD home"
        >
          MØT-RHEAD
          <Crown />
        </button>
        <div className="side-kicker">SOUND. CULTURE. MOVEMENT.</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              aria-label={item.title}
              className={page === item.id ? "active" : ""}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              <item.icon size={20} />
              <span>{item.title}</span>
              {page === item.id && <span className="nav-dash" />}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="scribble">
            Good sound.
            <br />
            Better moves.
            <Crown />
          </div>
          <button className="side-install" onClick={() => void installApp()}>
            <Download size={16} /> Install the app <ArrowUpRight size={15} />
          </button>
          <span>DESIGNED FOR THE WAY YOU MOVE.</span>
          <small>Created by Amir Saeid Dehghan</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="crumb">
            <span>MOT-RHEAD</span>
            <span>/</span>
            <strong>{page.toUpperCase()}</strong>
          </div>
          <button className="mobile-brand brand" onClick={() => go("home")}>
            MØT-RHEAD
          </button>
          <div className="top-actions">
            <span className="session-badge">
              <span className="status-dot" />
              {offline
                ? "OFFLINE"
                : connected
                  ? "BLE CONNECTED"
                  : "LOCAL AUDIO MODE"}
            </span>
            <button
              className="icon-button"
              aria-label="Open settings"
              onClick={() => go("more")}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={"main " + (page === "home" ? "home-page" : "dark-page")}
        >
          {page === "home" && (
            <>
              <div className="section-intro">
                <span className="eyebrow">YOUR EVERYDAY SOUND SYSTEM</span>
                <span className="issue">VOL. 01 / OWN THE NOISE</span>
              </div>
              <div className="home-grid">
                <section className="hero">
                  <div className="hero-dark" />
                  <div className="hero-copy">
                    <div className="hero-tag">
                      <span /> YOUR SOUND. YOUR RULES.
                    </div>
                    <h1>
                      {connected ? (
                        <>
                          CONNECTED
                          <br />
                          AND READY.
                        </>
                      ) : (
                        <>
                          READY TO
                          <br />
                          MAKE NOISE.
                        </>
                      )}
                    </h1>
                    <div className="scribble">
                      More than
                      <br />
                      music.
                      <Crown />
                    </div>
                  </div>
                  <div className="hero-product">
                    <img
                      src={asset("headphones.webp")}
                      alt="MOT-RHEAD concept headphones, matte black with cushioned earcups"
                      draggable={false}
                    />
                  </div>
                  <div className="hero-foot">
                    <span>BLACK. WHITE. BASS.</span>
                    <span>01 — ∞</span>
                  </div>
                </section>
                <div className="home-side">
                  <section className="device-card">
                    <div className="card-header">
                      <span className="eyebrow">YOUR CONNECTION</span>
                      <Bluetooth size={18} />
                    </div>
                    <div className="device-title">
                      <h2>{connected ? device.name : "MOT-RHEAD X1"}</h2>
                      <span className="mini-label">
                        {connected ? "REAL BLE DEVICE" : "CONCEPT DEVICE"}
                      </span>
                    </div>
                    <div className="device-status">
                      <span>
                        <span className="status-dot" />
                        {connected ? "BLE connected" : "Demo · local audio"}
                      </span>
                      <span>
                        <Battery size={20} />
                        {device.battery !== null ? `${device.battery}%` : "—"}
                      </span>
                    </div>
                    <p>
                      {connected
                        ? "Audio routing stays in your system Bluetooth settings."
                        : "Connect your headphones in system settings. Then make your music your own."}
                    </p>
                    <button
                      className="button white full"
                      disabled={connecting}
                      onClick={connectDevice}
                    >
                      {connecting ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Bluetooth size={16} />
                      )}{" "}
                      {connecting
                        ? "CONNECTING…"
                        : connected
                          ? "DISCONNECT BLE"
                          : bluetoothAvailable
                            ? "CONNECT BLE DEVICE"
                            : "CONNECT HEADPHONES"}{" "}
                      {!connecting && <ArrowUpRight size={17} />}
                    </button>
                    <small>
                      {bluetoothAvailable
                        ? "Optional · compatible BLE devices only"
                        : "Connection guide · pair audio in system settings"}
                    </small>
                  </section>
                  <section className="rotation-card">
                    <div className="card-header">
                      <span className="eyebrow">IN YOUR ROTATION</span>
                      <Disc3 size={18} />
                    </div>
                    <h2>
                      BRING YOUR
                      <br />
                      OWN SOUND.
                    </h2>
                    <p>
                      Your tracks. Your device.
                      <br />
                      No account. No uploads.
                    </p>
                    <button
                      className="button dark"
                      onClick={importAudio}
                      disabled={importing || player.loading}
                    >
                      <Plus size={17} />
                      {importing
                        ? "IMPORTING…"
                        : player.loading
                          ? "LOADING LIBRARY…"
                          : "IMPORT MUSIC"}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => void player.loadDemo()}
                    >
                      <Play size={13} /> Or try our original demo beat{" "}
                      <ChevronRight size={13} />
                    </button>
                  </section>
                </div>
              </div>
              <div className="section-title">
                <h2>MAKE IT YOURS.</h2>
                <button className="text-button" onClick={() => go("sound")}>
                  Open sound lab <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="quick-grid">
                <button
                  className="quick-card"
                  onClick={() => unsupported("Noise cancellation")}
                >
                  <Waves />
                  <div>
                    <strong>Noise cancellation</strong>
                    <span>
                      Hardware required <Info size={11} />
                    </span>
                  </div>
                  <span className="off-label">N/A</span>
                </button>
                <button
                  className="quick-card"
                  onClick={() => unsupported("Transparency")}
                >
                  <Radio />
                  <div>
                    <strong>Transparency</strong>
                    <span>
                      Hardware required <Info size={11} />
                    </span>
                  </div>
                  <span className="off-label">N/A</span>
                </button>
                <button
                  className="quick-card"
                  onClick={() => unsupported("Spatial audio")}
                >
                  <Sparkles />
                  <div>
                    <strong>Spatial audio</strong>
                    <span>
                      Hardware required <Info size={11} />
                    </span>
                  </div>
                  <span className="off-label">N/A</span>
                </button>
                <button
                  className={
                    "quick-card boost " + (sound.bassOn ? "enabled" : "")
                  }
                  aria-pressed={sound.bassOn}
                  onClick={() =>
                    tune({ bassOn: !sound.bassOn, bass: sound.bass || 4 })
                  }
                >
                  <Zap />
                  <div>
                    <strong>Bass boost</strong>
                    <span>In-app audio</span>
                  </div>
                  <span className="off-label">
                    {sound.bassOn ? "ON" : "OFF"}
                  </span>
                </button>
              </div>
              <div className="section-title">
                <h2>FIND YOUR FREQUENCY.</h2>
                <button className="text-button" onClick={() => go("presets")}>
                  All sound modes <ArrowUpRight size={16} />
                </button>
              </div>
              {presetCards(true)}
              <div className="home-caption">
                <ShieldCheck size={14} /> Music and settings stay on this
                device. <span>MOT-RHEAD — OWN THE NOISE.</span>
              </div>
            </>
          )}
          {page === "sound" && (
            <>
              <section className="sound-banner">
                <div>
                  <span className="eyebrow">THE SOUND LAB / LIVE DSP</span>
                  <h1>
                    FEEL
                    <br />
                    THE BEAT.
                  </h1>
                  <span className="scribble">Tune your movement.</span>
                </div>
                <Crown />
                <div className="banner-note">
                  NOT JUST LOUDER.
                  <br />
                  MORE YOU.
                </div>
              </section>
              <div className="sound-grid">
                <div className="sound-stack">
                  <section className="panel volume-panel">
                    <div className="panel-title">
                      <h2>
                        <Volume2 size={17} /> YOUR VOLUME
                      </h2>
                      <button
                        className="icon-button"
                        aria-label={sound.muted ? "Unmute" : "Mute"}
                        onClick={() => patch({ muted: !sound.muted })}
                      >
                        {sound.muted ? (
                          <VolumeX size={18} />
                        ) : (
                          <Volume2 size={18} />
                        )}
                      </button>
                    </div>
                    <Range
                      label="Playback volume"
                      value={sound.volume}
                      unit="%"
                      onChange={(v) => patch({ volume: v })}
                    />
                    <p className="hint">
                      In-app playback only ·{" "}
                      {sound.muted ? "Muted" : "system volume is independent"}
                    </p>
                  </section>
                  <div className="effects-row">
                    <section className="panel effect-panel">
                      <div className="panel-title">
                        <h2>
                          <Zap size={16} /> Bass boost
                        </h2>
                        <Toggle
                          label="Enable bass boost"
                          checked={sound.bassOn}
                          onChange={() =>
                            tune({
                              bassOn: !sound.bassOn,
                              bass: sound.bass || 4,
                            })
                          }
                        />
                      </div>
                      <Range
                        label="Bass intensity"
                        value={sound.bass}
                        max={12}
                        step={0.5}
                        unit="dB"
                        onChange={(v) => tune({ bass: v, bassOn: true })}
                      />
                      <div className="scale-labels">
                        <span>Subtle</span>
                        <span>Heavy</span>
                      </div>
                    </section>
                    <section className="panel effect-panel">
                      <div className="panel-title">
                        <h2>
                          <AudioLines size={16} /> Beat intensity
                        </h2>
                        <Toggle
                          label="Enable beat intensity"
                          checked={sound.punchOn}
                          onChange={() =>
                            tune({
                              punchOn: !sound.punchOn,
                              punch: sound.punch || 40,
                            })
                          }
                        />
                      </div>
                      <Range
                        label="Punch"
                        value={sound.punch}
                        unit="%"
                        onChange={(v) => tune({ punch: v, punchOn: true })}
                      />
                      <div className="scale-labels">
                        <span>Soft</span>
                        <span>Punchy</span>
                      </div>
                    </section>
                  </div>
                  <p className="hint">
                    <ShieldCheck size={13} /> Headroom compensation & output
                    compression help control peaks. Punch shapes dynamics, not
                    tempo.
                  </p>
                </div>
                <section className="panel eq-panel">
                  <div className="panel-title">
                    <h2>5-BAND EQUALIZER</h2>
                    <div className="inline-actions">
                      <button
                        className="text-button"
                        onClick={() => tune({ eq: [0, 0, 0, 0, 0] })}
                      >
                        <RotateCcw size={13} /> Reset
                      </button>
                      <Toggle
                        label="Enable equalizer"
                        checked={sound.eqOn}
                        onChange={() => patch({ eqOn: !sound.eqOn })}
                      />
                    </div>
                  </div>
                  <div
                    className={"eq-controls " + (!sound.eqOn ? "bypassed" : "")}
                  >
                    <div className="eq-markers">
                      <span>+12</span>
                      <span>0</span>
                      <span>−12</span>
                    </div>
                    {["60 Hz", "250 Hz", "1 kHz", "4 kHz", "12 kHz"].map(
                      (label, i) => (
                        <Range
                          key={label}
                          label={label}
                          value={sound.eq[i]}
                          min={-12}
                          max={12}
                          unit="dB"
                          vertical
                          onChange={(value) => {
                            const eq = [...sound.eq];
                            eq[i] = value;
                            tune({ eq, eqOn: true });
                          }}
                        />
                      ),
                    )}
                  </div>
                  <div className="eq-footer">
                    <span>{sound.eqOn ? "EQ ACTIVE" : "EQ BYPASSED"}</span>
                    <button className="text-button" onClick={saveDialog}>
                      <Plus size={14} /> Save preset
                    </button>
                  </div>
                </section>
              </div>
              <section className="panel spectrum-panel">
                <div className="panel-title">
                  <h2>
                    <AudioLines size={16} /> LIVE FREQUENCIES
                  </h2>
                  <span className="mini-label">
                    {player.playing ? "LIVE AUDIO" : "AWAITING YOUR MUSIC"}
                  </span>
                </div>
                <Spectrum
                  engine={player.engine}
                  playing={player.playing}
                  reduced={reduced}
                />
                <div className="scale-labels">
                  <span>LOW / 20 Hz</span>
                  <span>HIGH / 20 kHz</span>
                </div>
              </section>
              <div className="preset-shortcuts">
                <span>QUICK PRESETS</span>
                {PRESETS.map((p) => (
                  <button
                    className={selected === p.id ? "selected" : ""}
                    key={p.id}
                    onClick={() => choose(p)}
                  >
                    {p.name}
                  </button>
                ))}
                <button className="text-button" onClick={() => go("presets")}>
                  View all <ArrowUpRight size={15} />
                </button>
              </div>
            </>
          )}
          {page === "presets" && (
            <>
              <section className="preset-banner">
                <div>
                  <span className="eyebrow">FOUR MODES. ENDLESS MOVEMENT.</span>
                  <h1>
                    DIFFERENT STREETS.
                    <br />
                    SAME SOUND.
                  </h1>
                </div>
                <div className="scribble">
                  Culture shapes
                  <br />
                  better sound.
                  <Crown />
                </div>
              </section>
              <div className="preset-toolbar">
                <div
                  className="segmented"
                  role="group"
                  aria-label="Preset category"
                >
                  <button
                    aria-pressed={tab === "factory"}
                    className={tab === "factory" ? "active" : ""}
                    onClick={() => setTab("factory")}
                  >
                    Sound modes
                  </button>
                  <button
                    aria-pressed={tab === "custom"}
                    className={tab === "custom" ? "active" : ""}
                    onClick={() => setTab("custom")}
                  >
                    Custom <span>{custom.length}</span>
                  </button>
                </div>
                <button className="button outline" onClick={saveDialog}>
                  <Plus size={16} /> CREATE PRESET
                </button>
              </div>
              {tab === "factory" ? (
                presetCards()
              ) : (
                <div className="custom-list">
                  {custom.length ? (
                    custom.map((p) => (
                      <article
                        key={p.id}
                        className={
                          "custom-card " + (selected === p.id ? "selected" : "")
                        }
                      >
                        <button
                          className="custom-select"
                          onClick={() => choose(p)}
                        >
                          <AudioLines size={28} />
                          <div>
                            <h2>{p.name}</h2>
                            <p>
                              {p.eq
                                .map((n) => (n > 0 ? "+" + n : n))
                                .join(" / ")}{" "}
                              dB · Bass {p.bass} dB · Punch {p.punch}%
                            </p>
                          </div>
                          {selected === p.id ? (
                            <Check size={18} />
                          ) : (
                            <Play size={18} />
                          )}
                        </button>
                        <div className="custom-actions">
                          <button
                            onClick={() => {
                              choose(p);
                              go("sound");
                              notify(
                                "Adjust your sound, then return to Custom and choose Update from current sound.",
                              );
                            }}
                          >
                            <SlidersHorizontal size={14} /> Edit sound
                          </button>
                          <button
                            onClick={() => {
                              setEditing(p.id);
                              setName(p.name);
                              setModal("save");
                            }}
                          >
                            <Save size={14} /> Update from current sound
                          </button>
                          <button
                            aria-label={`Rename ${p.name}`}
                            onClick={() => {
                              setEditing(p.id);
                              setName(p.name);
                              setModal("rename");
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            aria-label={`Delete ${p.name}`}
                            onClick={() => {
                              setCustom((list) =>
                                list.filter((x) => x.id !== p.id),
                              );
                              if (selected === p.id) setSelected("");
                              notify("Custom preset deleted.");
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      <SlidersHorizontal size={36} />
                      <h2>YOUR SOUND STARTS HERE.</h2>
                      <p>
                        Fine-tune the sound lab. Save a mix that moves like you.
                      </p>
                      <button
                        className="button white"
                        onClick={() => go("sound")}
                      >
                        OPEN SOUND LAB <ArrowUpRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="presets-bottom">
                <p>
                  <Info size={15} /> Every mode changes the real five-band EQ,
                  bass and dynamics of in-app playback.
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    setSound((s) => ({
                      ...DEFAULT_SOUND,
                      volume: s.volume,
                      muted: s.muted,
                      eq: [0, 0, 0, 0, 0],
                    }));
                    setSelected("");
                    notify(
                      "Default flat sound restored. Your custom presets are unchanged.",
                    );
                  }}
                >
                  <RotateCcw size={14} /> Restore default sound
                </button>
              </div>
              <button className="wide-link" onClick={() => go("controls")}>
                <Hand size={22} />
                <div>
                  <h3>Controls & gestures</h3>
                  <p>Make every move count.</p>
                </div>
                <ChevronRight />
              </button>
            </>
          )}
          {page === "controls" && (
            <>
              <Heading
                eyebrow="EVERY MOVE HAS A MEANING"
                title="CONTROL THE MOMENT."
                subtitle="Try playback actions here. Keep your hands in the rhythm."
              />
              <div className="controls-grid">
                <section className="gesture-art">
                  <img
                    src={asset("headphones.webp")}
                    alt="Headphone earcup detail"
                  />
                  <div>
                    <Crown />
                    <span className="scribble">
                      Small moves.
                      <br />
                      Big energy.
                    </span>
                  </div>
                  <span className="mini-label">INTERACTIVE APP CONTROLS</span>
                </section>
                <section className="panel gestures">
                  <div className="panel-title">
                    <h2>CONTROLS & GESTURES</h2>
                    <Hand size={20} />
                  </div>
                  {[
                    {
                      dots: "•",
                      title: "Single tap",
                      detail: "Play / Pause",
                      action: player.toggle,
                    },
                    {
                      dots: "••",
                      title: "Double tap",
                      detail: "Next track",
                      action: () => player.next(),
                    },
                    {
                      dots: "•••",
                      title: "Triple tap",
                      detail: "Previous track",
                      action: () => player.next(-1),
                    },
                  ].map((g) => (
                    <button
                      className="gesture-row"
                      key={g.title}
                      onClick={g.action}
                      disabled={!player.current}
                    >
                      <span className="gesture-dots">{g.dots}</span>
                      <strong>{g.title}</strong>
                      <span>{g.detail}</span>
                      <Play size={15} />
                    </button>
                  ))}
                  <div className="hold-row">
                    <div>
                      <span className="gesture-dots">━</span>
                      <strong>Press & hold</strong>
                    </div>
                    <label className="sr-only" htmlFor="hold-action">
                      Press and hold action
                    </label>
                    <select
                      id="hold-action"
                      value={holdAction}
                      onChange={(e) => setHoldAction(e.target.value)}
                    >
                      <option value="mute">Mute / Unmute</option>
                      <option value="bass">Toggle bass</option>
                      <option value="shuffle">Toggle shuffle</option>
                      <option value="sound">Open sound lab</option>
                    </select>
                    <button className="button outline" onClick={performHold}>
                      TRY ACTION <Play size={14} />
                    </button>
                  </div>
                  <div className="notice">
                    <Info size={18} />
                    <div>
                      <strong>Browser demo controls</strong>
                      <p>
                        These buttons control this app. Headphone gesture
                        remapping requires a documented manufacturer protocol
                        and is unavailable for generic devices.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
              <div className="wide-link static-link">
                <ShieldCheck size={22} />
                <div>
                  <h3>Your hardware stays in your hands.</h3>
                  <p>
                    No firmware settings are changed. Supported media buttons
                    may control playback through the browser’s Media Session
                    API.
                  </p>
                </div>
              </div>
            </>
          )}
          {page === "more" && (
            <>
              <Heading
                eyebrow="THE DETAILS BEHIND THE SOUND"
                title="MADE TO MOVE WITH YOU."
                subtitle="Your connection, your preferences, and everything worth knowing."
              />
              <div className="more-grid">
                <section className="panel">
                  <div className="panel-title">
                    <h2>
                      <Bluetooth size={19} /> DEVICE CONNECTION
                    </h2>
                    <span className="mini-label">
                      {connected ? "REAL DEVICE" : "LOCAL / DEMO"}
                    </span>
                  </div>
                  <h3>{device.name}</h3>
                  <p className="muted">{device.message}</p>
                  <div className="detail-row">
                    <span>Web Bluetooth</span>
                    <strong>
                      {bluetoothAvailable ? "API available" : "Unavailable"}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>GATT connection</span>
                    <strong>{connected ? "Connected" : "Not connected"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Device battery</span>
                    <strong>
                      {device.battery === null
                        ? "Not reported"
                        : device.battery + "%"}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>ANC / Transparency / Spatial</span>
                    <strong>Unsupported</strong>
                  </div>
                  <button
                    className="button white full"
                    disabled={connecting}
                    onClick={connectDevice}
                  >
                    <Bluetooth size={16} />
                    {connecting
                      ? "CONNECTING…"
                      : connected
                        ? "DISCONNECT BLE"
                        : bluetoothAvailable
                          ? "SELECT BLE DEVICE"
                          : "CONNECTION GUIDE"}
                  </button>
                  <p className="hint">
                    Bluetooth audio pairing and output selection belong to your
                    operating system. BLE connection does not change the audio
                    route.
                  </p>
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <h2>
                      <Settings2 size={19} /> MAKE YOURSELF AT HOME
                    </h2>
                  </div>
                  <div className="preference-row">
                    <div>
                      <strong>Reduce motion</strong>
                      <p>Quieter transitions and a slower visualizer.</p>
                    </div>
                    <Toggle
                      checked={reduced}
                      onChange={() => setReduced(!reduced)}
                      label="Reduce motion"
                    />
                  </div>
                  <button
                    className="setting-button"
                    onClick={() => void installApp()}
                  >
                    <Download size={20} />
                    <div>
                      <strong>Install MOT-RHEAD</strong>
                      <span>A home-screen shortcut to your sound.</span>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                  <button
                    className="setting-button"
                    onClick={() => setLibraryOpen(true)}
                  >
                    <ListMusic size={20} />
                    <div>
                      <strong>Your music library</strong>
                      <span>{player.tracks.length} tracks in this session</span>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                  <button
                    className="setting-button"
                    onClick={() => setModal("restore")}
                  >
                    <RotateCcw size={20} />
                    <div>
                      <strong>Reset preferences</strong>
                      <span>
                        Restore sound settings and clear custom presets.
                      </span>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                </section>
                <section className="panel help-panel">
                  <h2>GOOD TO KNOW.</h2>
                  <details open>
                    <summary>How do I start listening?</summary>
                    <p>
                      Pair your headphones in your phone or computer’s Bluetooth
                      settings. Import music, choose a track, then press Play.
                      Visit Sound to adjust EQ, volume, bass and punch. Or try
                      the original demo beat.
                    </p>
                  </details>
                  <details>
                    <summary>What works on iPhone?</summary>
                    <p>
                      The local player and Web Audio sound tools work in
                      supported Safari versions. Safari on iOS does not expose
                      standard Web Bluetooth. Pair and route headphones through
                      iOS Settings. Add the app with Share → Add to Home Screen.
                      Background playback depends on iOS and may be interrupted.
                    </p>
                  </details>
                  <details>
                    <summary>Can I EQ Spotify, YouTube or Apple Music?</summary>
                    <p>
                      No. These sound controls process only audio imported into
                      MOT-RHEAD and the included demo. Other apps, protected
                      streams and system-wide audio cannot pass through this web
                      audio engine.
                    </p>
                  </details>
                  <details>
                    <summary>Are my files uploaded?</summary>
                    <p>
                      No. Imported files are kept in your browser’s IndexedDB on
                      this device. No account, tracking or remote upload is
                      used. Browser storage may be cleared by the OS, by private
                      browsing, or when you clear site data. Keep your original
                      files.
                    </p>
                  </details>
                  <details>
                    <summary>Does the app work offline?</summary>
                    <p>
                      After the first online visit and service worker
                      installation, the interface works offline. Imported audio
                      is stored locally when space is available. The demo beat
                      is available online. A browser may evict cached site data.
                    </p>
                  </details>
                  <details>
                    <summary>What do the sound controls change?</summary>
                    <p>
                      Five filters shape the 60 Hz, 250 Hz, 1 kHz, 4 kHz and 12
                      kHz regions. Bass adds a low shelf at 110 Hz. Punch uses
                      slower-attack compression to shape dynamics. Conservative
                      gain compensation and a final compressor help control
                      peaks; large boosts may reduce overall loudness.
                    </p>
                  </details>
                </section>
                <section className="credits-card">
                  <Crown />
                  <span className="eyebrow">BLACK. WHITE. BASS. CULTURE.</span>
                  <h2>
                    SOUND PEOPLE
                    <br />
                    MOVE DIFFERENTLY.
                  </h2>
                  <p>
                    An independent sound companion.
                    <br />
                    Created by Amir Saeid Dehghan.
                  </p>
                  <a
                    className="text-button"
                    href="https://github.com/saaeiddev/Mot-rhead-"
                    target="_blank"
                    rel="noreferrer"
                  >
                    SOURCE CODE <ArrowUpRight size={16} />
                  </a>
                  <span className="mini-label">MOT-RHEAD / V1.0.0</span>
                </section>
              </div>
            </>
          )}
        </main>
        <footer className="player-bar">
          <div className="now-playing">
            <div
              className={"album-art " + (player.playing ? "is-playing" : "")}
            >
              <Disc3 size={27} />
            </div>
            <button className="track-info" onClick={() => setLibraryOpen(true)}>
              <strong>
                {player.current?.name || "Your next favorite sound"}
              </strong>
              <span>
                {player.current?.artist || "Import music or try the demo beat"}
              </span>
            </button>
          </div>
          <div className="player-center">
            <div className="player-buttons">
              <button
                className={
                  "icon-button shuffle-button " +
                  (player.shuffle ? "active" : "")
                }
                aria-pressed={player.shuffle}
                aria-label="Shuffle"
                onClick={() => player.setShuffle(!player.shuffle)}
              >
                <Shuffle size={16} />
              </button>
              <MiniTransport player={player} />
              <button
                className={
                  "icon-button repeat-button " +
                  (player.repeat !== "off" ? "active" : "")
                }
                aria-label={`Repeat: ${player.repeat}`}
                onClick={() =>
                  player.setRepeat(
                    player.repeat === "off"
                      ? "all"
                      : player.repeat === "all"
                        ? "one"
                        : "off",
                  )
                }
              >
                {player.repeat === "one" ? (
                  <Repeat1 size={17} />
                ) : (
                  <Repeat size={17} />
                )}
              </button>
            </div>
            <div className="seek">
              <span>{clock(player.time)}</span>
              <input
                aria-label="Playback position"
                type="range"
                min={0}
                max={player.duration || 1}
                step={0.1}
                value={player.time}
                disabled={!player.duration}
                onChange={(e) => player.seek(Number(e.target.value))}
              />
              <span>{clock(player.duration)}</span>
            </div>
          </div>
          <div className="player-end">
            <button
              className="icon-button"
              aria-label="Open music library"
              onClick={() => setLibraryOpen(true)}
            >
              <ListMusic size={20} />
            </button>
            <button
              className="icon-button"
              aria-label={sound.muted ? "Unmute playback" : "Mute playback"}
              onClick={() => patch({ muted: !sound.muted })}
            >
              {sound.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <input
              aria-label="Player volume"
              type="range"
              min={0}
              max={100}
              value={sound.volume}
              onChange={(e) => patch({ volume: Number(e.target.value) })}
            />
            <span>{sound.muted ? "MUTE" : sound.volume + "%"}</span>
          </div>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((item) => (
          <button
            key={item.id}
            aria-label={item.title}
            className={page === item.id ? "active" : ""}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => go(item.id)}
          >
            <item.icon size={21} />
            <span>{item.title}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          <span>{toast}</span>
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        onCancel={closeDialog}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDialog();
        }}
        className="modal"
        aria-labelledby={
          modal === "connection" ? "connection-title" : undefined
        }
      >
        <div className="modal-content">
          <button
            className="modal-close icon-button"
            aria-label="Close dialog"
            onClick={closeDialog}
          >
            <X />
          </button>
          {libraryOpen ? (
            <>
              <span className="eyebrow">YOUR DEVICE. YOUR MUSIC.</span>
              <h2>THE ROTATION.</h2>
              <label className="field-label" htmlFor="playlist-name">
                Playlist name
              </label>
              <input
                id="playlist-name"
                className="text-input"
                value={playlistName}
                maxLength={40}
                onChange={(e) => setPlaylistName(e.target.value)}
              />
              <div className="library-actions">
                <button
                  className="button white"
                  onClick={importAudio}
                  disabled={importing || player.loading}
                >
                  <Plus size={16} />
                  {importing ? "IMPORTING…" : "ADD TRACKS"}
                </button>
                <button
                  className="button outline"
                  onClick={() => void player.loadDemo()}
                >
                  <Play size={14} /> DEMO BEAT
                </button>
              </div>
              {player.current && (
                <div className="library-playback">
                  <MiniTransport player={player} />
                  <Range
                    label="Seek track"
                    value={Math.floor(player.time)}
                    max={Math.max(1, Math.floor(player.duration))}
                    unit="s"
                    disabled={!player.duration}
                    onChange={player.seek}
                  />
                  <div className="scale-labels">
                    <span>{clock(player.time)}</span>
                    <span>{clock(player.duration)}</span>
                  </div>
                </div>
              )}
              <div className="library-modes">
                <button
                  className="button outline"
                  aria-pressed={player.shuffle}
                  onClick={() => player.setShuffle(!player.shuffle)}
                >
                  <Shuffle size={15} />
                  SHUFFLE {player.shuffle ? "ON" : "OFF"}
                </button>
                <button
                  className="button outline"
                  onClick={() =>
                    player.setRepeat(
                      player.repeat === "off"
                        ? "all"
                        : player.repeat === "all"
                          ? "one"
                          : "off",
                    )
                  }
                >
                  <Repeat size={15} />
                  REPEAT {player.repeat.toUpperCase()}
                </button>
              </div>
              <div className="track-list">
                {player.tracks.length ? (
                  player.tracks.map((track, i) => (
                    <div
                      key={track.id}
                      className={
                        "track-row " + (i === player.index ? "active" : "")
                      }
                    >
                      <button onClick={() => player.select(i)}>
                        <span className="track-number">
                          {i === player.index && player.playing ? (
                            <AudioLines size={16} />
                          ) : (
                            String(i + 1).padStart(2, "0")
                          )}
                        </span>
                        <div>
                          <strong>{track.name}</strong>
                          <span>{track.artist}</span>
                        </div>
                        <Play size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${track.name}`}
                        onClick={() => void player.remove(track.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <Music2 size={28} />
                    <p>
                      Your playlist is waiting.
                      <br />
                      Add MP3, AAC, WAV or other browser-supported audio.
                    </p>
                  </div>
                )}
              </div>
              <p className="hint">
                Imported tracks stay on this device when storage is available.
                The demo is an original synthesized composition.
              </p>
            </>
          ) : modal === "save" || modal === "rename" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                savePreset();
              }}
            >
              <span className="eyebrow">YOUR SOUND. YOUR RULES.</span>
              <h2>
                {modal === "rename"
                  ? "NAME YOUR SOUND."
                  : editing
                    ? "UPDATE YOUR MIX."
                    : "SAVE YOUR MIX."}
              </h2>
              <p className="muted">
                {modal === "rename"
                  ? "Give this custom preset a new name."
                  : "Capture the current EQ, bass and punch settings."}
              </p>
              <label className="field-label" htmlFor="preset-name">
                Preset name
              </label>
              <input
                autoFocus
                required
                id="preset-name"
                maxLength={40}
                className="text-input"
                placeholder="Late night drive"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="button white full"
                type="submit"
                disabled={!name.trim() || (custom.length >= 50 && !editing)}
              >
                <Save size={16} /> SAVE PRESET
              </button>
            </form>
          ) : modal === "connection" ? (
            <>
              <span className="eyebrow">YOUR HEADPHONES. YOUR SOUND.</span>
              <h2 id="connection-title">CONNECT YOUR HEADPHONES.</h2>
              <div
                className="connection-notice"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <strong>
                  {connecting
                    ? device.phase === "selecting"
                      ? "Choose a device in your browser"
                      : "Connecting to your device…"
                    : connected
                      ? `BLE connected: ${device.name}`
                      : bluetoothAvailable
                        ? "Device connection"
                        : "Bluetooth device access unavailable"}
                </strong>
                <p>{device.message}</p>
                {connected && device.battery !== null && (
                  <p>Device battery: {device.battery}%</p>
                )}
              </div>
              <h3>FOR MUSIC PLAYBACK</h3>
              <ol className="connection-steps">
                <li>
                  Open your phone or computer’s{" "}
                  <strong>Bluetooth settings</strong>.
                </li>
                <li>
                  Pair your headphones, then choose them as the{" "}
                  <strong>audio output</strong>.
                </li>
                <li>
                  Return here and play an imported track or the demo beat.
                </li>
              </ol>
              <p>
                The website cannot open system Bluetooth settings or pair the
                audio output for you.
              </p>
              {bluetoothAvailable ? (
                <>
                  <p>
                    Optional BLE access can read battery information from
                    compatible devices. It does not route music or enable
                    manufacturer controls.
                  </p>
                  <button
                    className="button outline full"
                    disabled={connecting}
                    onClick={connectDevice}
                  >
                    <Bluetooth size={16} />
                    {connecting
                      ? "WAITING FOR DEVICE…"
                      : connected
                        ? "DISCONNECT BLE"
                        : "TRY BLE CONNECTION AGAIN"}
                  </button>
                </>
              ) : (
                <p>
                  For optional BLE device access, open the site directly in a
                  supported browser such as Chrome on Android, Windows or Mac.
                  iPhone and iPad browsers do not provide standard Web
                  Bluetooth. Music playback still works through your system
                  audio output.
                </p>
              )}
              <button
                className="button white full connection-done"
                onClick={closeDialog}
              >
                BACK TO MY MUSIC
              </button>
            </>
          ) : modal === "install" ? (
            <>
              <Download size={30} />
              <h2>TAKE THE SOUND WITH YOU.</h2>
              <p>
                On iPhone or iPad, open in Safari, tap <strong>Share</strong>,
                then <strong>Add to Home Screen</strong>.
              </p>
              <p>
                On Android or desktop, open your browser menu and choose{" "}
                <strong>Install app</strong> or{" "}
                <strong>Add to Home screen</strong> when available.
              </p>
              <p className="hint">
                Visit online once so the app shell can be cached. Installation
                options depend on your browser.
              </p>
            </>
          ) : modal === "restore" ? (
            <>
              <h2>BACK TO THE START?</h2>
              <p>
                Reset sound, motion and gesture preferences and remove custom
                presets. Imported music will stay on this device.
              </p>
              <button
                className="button white full"
                onClick={() => {
                  setSound({ ...DEFAULT_SOUND, eq: [0, 0, 0, 0, 0] });
                  setCustom([]);
                  setSelected("");
                  setHoldAction("mute");
                  setReduced(
                    matchMedia("(prefers-reduced-motion: reduce)").matches,
                  );
                  setModal(null);
                  notify("Preferences reset. Your music is still here.");
                }}
              >
                RESET PREFERENCES
              </button>
            </>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
