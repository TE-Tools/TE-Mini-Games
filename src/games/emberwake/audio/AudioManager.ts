/**
 * Prozeduraler Klang über die Web Audio API — keine Audiodateien,
 * keine Lizenzfragen (§62). Startet erst nach der ersten Berührung.
 * Musik in Schichten folgt in Phase 2; hier: Effekte und Nacht-Drone.
 */
export type Sfx =
  | 'ui'
  | 'gather'
  | 'deposit'
  | 'hit'
  | 'hurt'
  | 'coreLow'
  | 'refuel'
  | 'night'
  | 'dawn'
  | 'wave'
  | 'death'
  | 'complete'
  | 'build'
  | 'secret'
  | 'swing'

export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxGain: GainNode | null = null
  private drone: { osc: OscillatorNode; gain: GainNode } | null = null
  private noise: AudioBuffer | null = null
  sfxVolume = 0.8
  musicVolume = 0.6
  muted = false

  /** Muss aus einer Nutzergeste heraus aufgerufen werden. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 1
      this.master.connect(this.ctx.destination)
      this.sfxGain = this.ctx.createGain()
      this.sfxGain.gain.value = this.sfxVolume
      this.sfxGain.connect(this.master)
      this.noise = this.makeNoise()
      this.startDrone()
    } catch {
      this.ctx = null
    }
  }

  suspend(): void {
    void this.ctx?.suspend()
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume()
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVolume = sfx
    this.musicVolume = music
    if (this.sfxGain) this.sfxGain.gain.value = sfx
  }

  /** Nacht-Drone: hörbar, wenn die Sonne weg ist und der Kern schwach wird. */
  setAtmosphere(sun: number, coreCharge01: number): void {
    if (!this.drone || !this.ctx) return
    const night = 1 - sun
    const target = night * this.musicVolume * 0.18 * (0.6 + (1 - coreCharge01) * 0.8)
    this.drone.gain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.8)
    this.drone.osc.frequency.setTargetAtTime(
      48 + (1 - coreCharge01) * 10,
      this.ctx.currentTime,
      1.5,
    )
  }

  play(sfx: Sfx): void {
    if (!this.ctx || !this.sfxGain || this.muted) return
    const t = this.ctx.currentTime
    switch (sfx) {
      case 'ui':
        this.tone(880, 0.05, 'square', 0.08, t)
        break
      case 'gather':
        this.tone(520 + Math.random() * 80, 0.09, 'triangle', 0.25, t)
        this.burst(0.06, 0.12, t)
        break
      case 'deposit':
        this.tone(440, 0.12, 'triangle', 0.25, t)
        this.tone(660, 0.14, 'triangle', 0.2, t + 0.08)
        this.tone(880, 0.18, 'triangle', 0.18, t + 0.16)
        break
      case 'refuel':
        this.tone(220, 0.25, 'sine', 0.3, t)
        this.tone(330, 0.3, 'sine', 0.2, t + 0.05)
        this.burst(0.2, 0.08, t)
        break
      case 'swing':
        this.burst(0.08, 0.1, t)
        break
      case 'hit':
        this.tone(160, 0.08, 'square', 0.3, t)
        this.burst(0.07, 0.25, t)
        break
      case 'hurt':
        this.tone(110, 0.25, 'sawtooth', 0.35, t)
        this.burst(0.15, 0.3, t)
        break
      case 'coreLow':
        this.tone(196, 0.4, 'sine', 0.3, t)
        this.tone(185, 0.5, 'sine', 0.3, t + 0.45)
        break
      case 'night':
        this.tone(98, 1.2, 'sine', 0.35, t)
        this.tone(73, 1.6, 'sine', 0.3, t + 0.3)
        break
      case 'dawn':
        this.tone(392, 0.5, 'sine', 0.2, t)
        this.tone(494, 0.6, 'sine', 0.2, t + 0.25)
        this.tone(587, 0.9, 'sine', 0.22, t + 0.5)
        break
      case 'wave':
        this.tone(65, 0.5, 'sawtooth', 0.25, t)
        this.tone(65, 0.5, 'sawtooth', 0.25, t + 0.6)
        this.tone(65, 0.7, 'sawtooth', 0.3, t + 1.2)
        break
      case 'death':
        this.tone(220, 0.6, 'sawtooth', 0.3, t)
        this.tone(165, 0.8, 'sawtooth', 0.3, t + 0.3)
        this.tone(110, 1.4, 'sawtooth', 0.35, t + 0.6)
        break
      case 'complete':
        ;[523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.22, t + i * 0.14))
        break
      case 'build':
        this.burst(0.12, 0.3, t)
        this.tone(330, 0.15, 'square', 0.15, t + 0.1)
        this.tone(440, 0.2, 'square', 0.15, t + 0.25)
        break
      case 'secret':
        ;[659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.7, 'sine', 0.18, t + i * 0.1))
        break
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    at: number,
  ): void {
    if (!this.ctx || !this.sfxGain) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(volume, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
    osc.connect(gain).connect(this.sfxGain)
    osc.start(at)
    osc.stop(at + duration + 0.05)
  }

  private burst(duration: number, volume: number, at: number): void {
    if (!this.ctx || !this.sfxGain || !this.noise) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1200
    src.connect(filter).connect(gain).connect(this.sfxGain)
    src.start(at)
    src.stop(at + duration + 0.02)
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    // Rein akustisch, kein Einfluss auf die Simulation — Math.random ist hier erlaubt.
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private startDrone(): void {
    if (!this.ctx || !this.master) return
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 48
    const gain = this.ctx.createGain()
    gain.gain.value = 0
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 160
    osc.connect(filter).connect(gain).connect(this.master)
    osc.start()
    this.drone = { osc, gain }
  }
}
