import { makeId } from "../id";
import { useEffect, useRef, useState } from "react";
import { AudioEngine } from "./engine";
import type { Sound } from "./presets";
import { readLibrary, saveTrack, deleteTrack } from "./library";
export interface Track {
  id: string;
  name: string;
  artist: string;
  url: string;
}
export function usePlayer(sound: Sound, notify: (text: string) => void) {
  const [audio] = useState(() => new Audio());
  const [engine] = useState(() => new AudioEngine(audio));
  const [tracks, setTracks] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const [loading, setLoading] = useState(true);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const urls = useRef(new Set<string>());
  const generation = useRef(0);
  const current = tracks[index];
  useEffect(() => {
    audio.preload = "metadata";
    let disposed = false;
    readLibrary()
      .then((saved) => {
        if (disposed) return;
        const restored = saved.map((t) => {
          const url = URL.createObjectURL(t.file);
          urls.current.add(url);
          return { id: t.id, name: t.name, artist: t.artist, url };
        });
        setTracks(restored);
        if (restored.length) {
          setIndex(0);
          audio.src = restored[0].url;
        }
      })
      .catch(() =>
        notify(
          "Local storage is unavailable. You can still import music for this session.",
        ),
      )
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      audio.pause();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      void engine.context?.close();
    };
  }, [audio, engine]);
  useEffect(() => {
    engine.update(sound);
  }, [sound, engine]);
  const start = async () => {
    try {
      await engine.activate(soundRef.current);
      await audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify(
        "Playback could not start. Try Play again, or import a supported MP3, AAC, WAV or OGG file.",
      );
    }
  };
  const select = (i: number, autoplay = true) => {
    if (!tracks[i]) return;
    generation.current++;
    audio.pause();
    audio.src = tracks[i].url;
    setIndex(i);
    setTime(0);
    setDuration(0);
    if (autoplay) void start();
  };
  const next = (direction = 1, ended = false) => {
    if (!tracks.length) return;
    if (ended && repeat === "one") {
      audio.currentTime = 0;
      void start();
      return;
    }
    let target = index + direction;
    if (shuffle && tracks.length > 1) {
      do {
        target = Math.floor(Math.random() * tracks.length);
      } while (target === index);
    }
    if (ended && target >= tracks.length && repeat === "off") {
      audio.pause();
      return;
    }
    select((target + tracks.length) % tracks.length);
  };
  const toggle = () => {
    if (!current) {
      notify("Import a track or load the demo beat to start listening.");
      return;
    }
    if (audio.paused) void start();
    else audio.pause();
  };
  useEffect(() => {
    const update = () => {
      setTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    const ended = () => next(1, true);
    const error = () =>
      notify("This file cannot be decoded by your browser. Try MP3 or WAV.");
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", update);
    audio.addEventListener("durationchange", update);
    audio.addEventListener("play", play);
    audio.addEventListener("pause", pause);
    audio.addEventListener("ended", ended);
    audio.addEventListener("error", error);
    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("loadedmetadata", update);
      audio.removeEventListener("durationchange", update);
      audio.removeEventListener("play", play);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("error", error);
    };
  });
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (current)
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.name,
        artist: current.artist,
        album: "MOT-RHEAD",
      });
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    const handlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: () => void start(),
      pause: () => audio.pause(),
      nexttrack: () => next(),
      previoustrack: () => next(-1),
      seekto: (d) => {
        if (d.seekTime !== undefined && Number.isFinite(audio.duration))
          audio.currentTime = Math.min(audio.duration, Math.max(0, d.seekTime));
      },
    };
    Object.entries(handlers).forEach(([key, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(
          key as MediaSessionAction,
          handler!,
        );
      } catch {
        /* Browser does not expose every transport action. */
      }
    });
    return () =>
      Object.keys(handlers).forEach((key) => {
        try {
          navigator.mediaSession.setActionHandler(
            key as MediaSessionAction,
            null,
          );
        } catch {}
      });
  });
  const importFiles = async (files: FileList | File[]) => {
    const added: Track[] = [];
    let storageFailed = false;
    for (const file of Array.from(files)) {
      if (
        !file.type.startsWith("audio/") &&
        !/\.(mp3|wav|m4a|aac|ogg|flac|opus|aiff)$/i.test(file.name)
      ) {
        notify(`Skipped ${file.name}: choose an audio file.`);
        continue;
      }
      const id = makeId();
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      const track = {
        id,
        name: file.name.replace(/\.[^.]+$/, ""),
        artist: "Local audio",
        url,
      };
      added.push(track);
      try {
        await saveTrack({ id, name: track.name, artist: track.artist, file });
      } catch {
        storageFailed = true;
      }
    }
    if (added.length) {
      setTracks((previous) => [...previous, ...added]);
      if (index < 0) {
        setIndex(tracks.length);
        audio.src = added[0].url;
      }
      notify(
        storageFailed
          ? "Music added for this session. Storage is full or unavailable."
          : `${added.length} track${added.length > 1 ? "s" : ""} added. Your files stay on this device.`,
      );
    }
  };
  const loadDemo = async () => {
    const existing = tracks.findIndex((t) => t.id === "demo");
    if (existing >= 0) {
      select(existing);
      return;
    }
    const track = {
      id: "demo",
      name: "Concrete Frequency",
      artist: "MOT-RHEAD · original demo beat",
      url: import.meta.env.BASE_URL + "assets/demo-beat.wav",
    };
    setTracks((previous) => [...previous, track]);
    setIndex(tracks.length);
    audio.src = track.url;
    setTime(0);
    setDuration(0);
    await start();
  };
  const remove = async (id: string) => {
    const removed = tracks.find((t) => t.id === id);
    const list = tracks.filter((t) => t.id !== id);
    const oldIndex = tracks.findIndex((t) => t.id === id);
    if (oldIndex === index) {
      audio.pause();
      if (list.length) {
        const newIndex = Math.min(index, list.length - 1);
        audio.src = list[newIndex].url;
        setIndex(newIndex);
      } else {
        audio.removeAttribute("src");
        audio.load();
        setIndex(-1);
      }
      setTime(0);
      setDuration(0);
    } else if (oldIndex < index) setIndex(index - 1);
    setTracks(list);
    if (removed && urls.current.has(removed.url)) {
      URL.revokeObjectURL(removed.url);
      urls.current.delete(removed.url);
    }
    try {
      await deleteTrack(id);
    } catch {
      notify(
        "Track removed from this session; stored copy could not be deleted.",
      );
    }
  };
  const seek = (value: number) => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Math.max(0, Math.min(audio.duration, value));
      setTime(audio.currentTime);
    }
  };
  return {
    tracks,
    index,
    current,
    playing,
    time,
    duration,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    loading,
    engine,
    toggle,
    next,
    select,
    seek,
    importFiles,
    loadDemo,
    remove,
  };
}
export type Player = ReturnType<typeof usePlayer>;
