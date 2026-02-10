import type { GameRuntime, HudSnapshot, ResourceId } from '../game/runtime'

type AudioSnapshot = {
  runId: number
  status: HudSnapshot['status']
  docked: boolean
  grabbedAsteroidId: number | null
  asteroidDepletionSerial: number
  pirateState: HudSnapshot['pirateState']
  hull: number
  cargoUsed: number
}

type ResourceCounts = Record<ResourceId, number>

const RESOURCE_IDS: ResourceId[] = ['scrapIron', 'waterIce', 'cobaltDust', 'xenoCrystal', 'fringeRelic']

function createEmptyResourceCounts(): ResourceCounts {
  return {
    scrapIron: 0,
    waterIce: 0,
    cobaltDust: 0,
    xenoCrystal: 0,
    fringeRelic: 0,
  }
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

export class GameAudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  private flightBedGain: GainNode | null = null
  private dockBedGain: GainNode | null = null
  private grabberBedGain: GainNode | null = null
  private drillBedGain: GainNode | null = null
  private engineToneGain: GainNode | null = null
  private klaxonGain: GainNode | null = null

  private engineToneOsc: OscillatorNode | null = null
  private engineSubOsc: OscillatorNode | null = null
  private drillOsc: OscillatorNode | null = null

  private trackedSources: AudioScheduledSourceNode[] = []
  private trackedNodes: AudioNode[] = []

  private unlockHandler: (() => void) | null = null
  private unlocked = false
  private disposed = false

  private previous: AudioSnapshot | null = null
  private previousCargoCounts: ResourceCounts = createEmptyResourceCounts()
  private lastCountdownSecond = Number.POSITIVE_INFINITY

  private nextRepairPulseAt = 0
  private nextUnloadPulseAt = 0
  private nextDrillPulseAt = 0
  private nextHullStressPulseAt = 0

  constructor() {
    this.initContext()
    this.installUnlockHooks()
  }

  update(runtime: GameRuntime, hud: HudSnapshot) {
    if (this.disposed) return

    const context = this.context
    const now = context?.currentTime ?? 0

    if (!this.previous || this.previous.runId !== runtime.runId) {
      this.previous = this.makeSnapshot(runtime, hud)
      this.previousCargoCounts = this.readCargoCounts(runtime)
      this.lastCountdownSecond = Number.POSITIVE_INFINITY
      this.nextRepairPulseAt = now
      this.nextUnloadPulseAt = now
      this.nextDrillPulseAt = now
      this.nextHullStressPulseAt = now
      return
    }

    this.updateBeds(runtime, hud, now)
    this.emitTransitions(runtime, hud, now)
    this.emitScheduledEffects(hud, now)

    this.previous = this.makeSnapshot(runtime, hud)
  }

  dispose() {
    this.disposed = true
    this.removeUnlockHooks()

    for (const source of this.trackedSources) {
      try {
        source.stop()
      } catch {
        // no-op
      }
      source.disconnect()
    }
    this.trackedSources = []

    for (const node of this.trackedNodes) {
      node.disconnect()
    }
    this.trackedNodes = []

    if (this.master) {
      this.master.disconnect()
    }
    this.master = null

    if (this.context) {
      void this.context.close()
    }
    this.context = null
  }

  private initContext() {
    const AudioCtor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
    if (!AudioCtor) return

    const context = new AudioCtor()
    const master = context.createGain()
    master.gain.value = 0.62
    master.connect(context.destination)

    this.context = context
    this.master = master
    this.noiseBuffer = this.createNoiseBuffer(context, 2.2)

    this.initContinuousBeds(context, master)
  }

  private initContinuousBeds(context: AudioContext, master: GainNode) {
    const flightGain = context.createGain()
    flightGain.gain.value = 0
    this.trackNode(flightGain)
    this.flightBedGain = flightGain

    const flightNoise = this.createLoopedNoiseSource(context)
    const flightBand = context.createBiquadFilter()
    flightBand.type = 'bandpass'
    flightBand.frequency.value = 190
    flightBand.Q.value = 0.7
    this.trackNode(flightBand)

    flightNoise.connect(flightBand)
    flightBand.connect(flightGain)
    flightGain.connect(master)
    this.startSource(flightNoise)

    const dockGain = context.createGain()
    dockGain.gain.value = 0
    this.trackNode(dockGain)
    this.dockBedGain = dockGain

    const dockNoise = this.createLoopedNoiseSource(context)
    const dockLow = context.createBiquadFilter()
    dockLow.type = 'lowpass'
    dockLow.frequency.value = 360
    this.trackNode(dockLow)
    dockNoise.connect(dockLow)
    dockLow.connect(dockGain)
    this.startSource(dockNoise)

    const dockHum = context.createOscillator()
    dockHum.type = 'triangle'
    dockHum.frequency.value = 46
    this.startSource(dockHum)
    const dockHumGain = context.createGain()
    dockHumGain.gain.value = 0.55
    this.trackNode(dockHumGain)
    dockHum.connect(dockHumGain)
    dockHumGain.connect(dockGain)
    dockGain.connect(master)

    const grabberGain = context.createGain()
    grabberGain.gain.value = 0
    this.trackNode(grabberGain)
    this.grabberBedGain = grabberGain

    const grabberOscA = context.createOscillator()
    grabberOscA.type = 'sawtooth'
    grabberOscA.frequency.value = 228
    this.startSource(grabberOscA)
    const grabberOscB = context.createOscillator()
    grabberOscB.type = 'square'
    grabberOscB.frequency.value = 456
    this.startSource(grabberOscB)
    const grabberMix = context.createGain()
    grabberMix.gain.value = 0.22
    this.trackNode(grabberMix)
    grabberOscA.connect(grabberMix)
    grabberOscB.connect(grabberMix)
    grabberMix.connect(grabberGain)
    grabberGain.connect(master)

    const drillGain = context.createGain()
    drillGain.gain.value = 0
    this.trackNode(drillGain)
    this.drillBedGain = drillGain

    const drillOsc = context.createOscillator()
    drillOsc.type = 'sawtooth'
    drillOsc.frequency.value = 172
    this.startSource(drillOsc)
    this.drillOsc = drillOsc

    const drillBand = context.createBiquadFilter()
    drillBand.type = 'bandpass'
    drillBand.frequency.value = 1120
    drillBand.Q.value = 1.8
    this.trackNode(drillBand)
    drillOsc.connect(drillBand)
    drillBand.connect(drillGain)

    const drillNoise = this.createLoopedNoiseSource(context)
    const drillNoiseBand = context.createBiquadFilter()
    drillNoiseBand.type = 'bandpass'
    drillNoiseBand.frequency.value = 1800
    drillNoiseBand.Q.value = 3.4
    this.trackNode(drillNoiseBand)
    const drillNoiseGain = context.createGain()
    drillNoiseGain.gain.value = 0.28
    this.trackNode(drillNoiseGain)
    drillNoise.connect(drillNoiseBand)
    drillNoiseBand.connect(drillNoiseGain)
    drillNoiseGain.connect(drillGain)
    this.startSource(drillNoise)

    drillGain.connect(master)

    const engineToneGain = context.createGain()
    engineToneGain.gain.value = 0
    this.trackNode(engineToneGain)
    this.engineToneGain = engineToneGain

    const engineToneOsc = context.createOscillator()
    engineToneOsc.type = 'sawtooth'
    engineToneOsc.frequency.value = 36
    this.startSource(engineToneOsc)
    this.engineToneOsc = engineToneOsc

    const engineSubOsc = context.createOscillator()
    engineSubOsc.type = 'triangle'
    engineSubOsc.frequency.value = 18
    this.startSource(engineSubOsc)
    this.engineSubOsc = engineSubOsc

    const engineFilter = context.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 240
    this.trackNode(engineFilter)

    engineToneOsc.connect(engineFilter)
    engineSubOsc.connect(engineFilter)
    engineFilter.connect(engineToneGain)
    engineToneGain.connect(master)

    const klaxonGain = context.createGain()
    klaxonGain.gain.value = 0
    this.trackNode(klaxonGain)
    this.klaxonGain = klaxonGain

    const klaxonA = context.createOscillator()
    klaxonA.type = 'square'
    klaxonA.frequency.value = 410
    this.startSource(klaxonA)
    const klaxonB = context.createOscillator()
    klaxonB.type = 'sawtooth'
    klaxonB.frequency.value = 612
    this.startSource(klaxonB)

    const klaxonSweep = context.createOscillator()
    klaxonSweep.type = 'sine'
    klaxonSweep.frequency.value = 1.1
    this.startSource(klaxonSweep)
    const klaxonSweepGain = context.createGain()
    klaxonSweepGain.gain.value = 82
    this.trackNode(klaxonSweepGain)
    klaxonSweep.connect(klaxonSweepGain)
    klaxonSweepGain.connect(klaxonA.frequency)
    klaxonSweepGain.connect(klaxonB.frequency)

    const klaxonMixGain = context.createGain()
    klaxonMixGain.gain.value = 0.2
    this.trackNode(klaxonMixGain)
    klaxonA.connect(klaxonMixGain)
    klaxonB.connect(klaxonMixGain)
    klaxonMixGain.connect(klaxonGain)
    klaxonGain.connect(master)
  }

  private installUnlockHooks() {
    if (!this.context) return
    const unlock = () => {
      void this.resumeFromUserGesture()
    }
    this.unlockHandler = unlock
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock, { passive: true })
  }

  private removeUnlockHooks() {
    if (!this.unlockHandler) return
    window.removeEventListener('pointerdown', this.unlockHandler)
    window.removeEventListener('keydown', this.unlockHandler)
    this.unlockHandler = null
  }

  private async resumeFromUserGesture() {
    if (!this.context || this.disposed) return
    if (this.context.state !== 'running') {
      await this.context.resume().catch(() => undefined)
    }
    if (this.context.state === 'running' && !this.unlocked) {
      this.unlocked = true
      this.removeUnlockHooks()
      this.playTone({
        frequency: 510,
        duration: 0.09,
        volume: 0.06,
        type: 'triangle',
      })
    }
  }

  private updateBeds(runtime: GameRuntime, hud: HudSnapshot, now: number) {
    const activeRun = hud.status === 'active'
    const flightActive = activeRun && !hud.docked
    const dockActive = activeRun && hud.docked
    const grabberActive = activeRun && !hud.docked && hud.grabbedAsteroidId !== null
    const drillActive = activeRun && !hud.docked && hud.drillActive
    const pirateThreat = activeRun && hud.pirateState === 'incoming' && hud.pirateHull > 0

    this.setGain(this.flightBedGain, flightActive ? 0.045 + runtime.throttleLevel * 0.07 : 0, now, 0.14)
    this.setGain(this.dockBedGain, dockActive ? 0.14 : 0, now, 0.14)
    this.setGain(this.grabberBedGain, grabberActive ? 0.08 : 0, now, 0.08)
    this.setGain(this.drillBedGain, drillActive ? 0.13 : 0, now, 0.05)
    this.setGain(this.engineToneGain, flightActive ? 0.03 + runtime.throttleLevel * 0.2 : 0, now, 0.06)
    this.setGain(this.klaxonGain, pirateThreat ? 0.12 : 0, now, 0.18)

    if (this.engineToneOsc) {
      this.engineToneOsc.frequency.setTargetAtTime(34 + runtime.throttleLevel * 106, now, 0.08)
    }
    if (this.engineSubOsc) {
      this.engineSubOsc.frequency.setTargetAtTime(17 + runtime.throttleLevel * 53, now, 0.08)
    }
    if (this.drillOsc) {
      this.drillOsc.frequency.setTargetAtTime(164 + Math.abs(Math.sin(runtime.elapsed * 15.8)) * 26, now, 0.03)
    }
  }

  private emitTransitions(runtime: GameRuntime, hud: HudSnapshot, now: number) {
    const previous = this.previous
    if (!previous) return

    if (runtime.hull < previous.hull - 0.45) {
      const severity = Math.min(1, (previous.hull - runtime.hull) / 14)
      this.playHullImpact(now, severity)
    }

    if (previous.grabbedAsteroidId === null && hud.grabbedAsteroidId !== null) {
      this.playGrabberLatch(now)
    } else if (previous.grabbedAsteroidId !== null && hud.grabbedAsteroidId === null) {
      this.playGrabberRelease(now)
    }
    if (runtime.asteroidDepletionSerial > previous.asteroidDepletionSerial) {
      const depletionCount = Math.min(2, runtime.asteroidDepletionSerial - previous.asteroidDepletionSerial)
      for (let i = 0; i < depletionCount; i += 1) {
        this.playAsteroidExhausted(now + i * 0.09)
      }
    }

    if (previous.pirateState === 'quiet' && hud.pirateState === 'incoming') {
      this.playPirateAlertStinger(now)
    }
    if (previous.pirateState !== 'disabled' && hud.pirateState === 'disabled') {
      this.playPirateDisabledJingle(now)
    }

    if (previous.docked && previous.cargoUsed > 0 && hud.docked && hud.cargoUsed <= 0) {
      this.playUnloadComplete(now)
    }
    if (previous.cargoUsed < hud.cargoCapacity && hud.cargoUsed >= hud.cargoCapacity) {
      this.playCargoFullAlert(now)
    }
    if (previous.docked && previous.hull < hud.maxHull - 0.2 && hud.docked && hud.hull >= hud.maxHull - 0.05) {
      this.playRepairComplete(now)
    }

    if (previous.status === 'active' && hud.status !== 'active') {
      if (hud.status === 'won' && hud.docked) {
        this.playRunComplete(now)
      } else {
        this.playRunFailed(now)
      }
    }

    for (const resourceId of RESOURCE_IDS) {
      const count = runtime.cargoBins[resourceId].units
      const prevCount = this.previousCargoCounts[resourceId]
      const delta = count - prevCount
      if (delta > 0) {
        const burstCount = Math.min(3, delta)
        for (let i = 0; i < burstCount; i += 1) {
          this.playResourcePickup(resourceId, now + i * 0.045)
        }
      }
      this.previousCargoCounts[resourceId] = count
    }
  }

  private emitScheduledEffects(hud: HudSnapshot, now: number) {
    const activeRun = hud.status === 'active'

    if (activeRun && hud.docked && hud.hull < hud.maxHull - 0.15) {
      if (now >= this.nextRepairPulseAt) {
        this.playRepairPulse(now)
        this.nextRepairPulseAt = now + 0.22
      }
    } else {
      this.nextRepairPulseAt = now
    }

    if (activeRun && hud.docked && hud.cargoUsed > 0) {
      if (now >= this.nextUnloadPulseAt) {
        this.playUnloadPulse(now)
        this.nextUnloadPulseAt = now + 0.27
      }
    } else {
      this.nextUnloadPulseAt = now
    }

    if (activeRun && !hud.docked && hud.drillActive) {
      if (now >= this.nextDrillPulseAt) {
        this.playDrillChatterPulse(now)
        this.nextDrillPulseAt = now + 0.082
      }
    } else {
      this.nextDrillPulseAt = now
    }

    const hullRatio = hud.maxHull <= 0 ? 1 : Math.max(0, Math.min(1, hud.hull / hud.maxHull))
    if (activeRun && !hud.docked && hullRatio < 0.72) {
      if (now >= this.nextHullStressPulseAt) {
        const severity = Math.max(0, Math.min(1, (0.72 - hullRatio) / 0.72))
        this.playHullStressCreak(now, severity)
        this.nextHullStressPulseAt = now + (1.55 - severity * 0.82 + Math.random() * 0.35)
      }
    } else {
      this.nextHullStressPulseAt = now
    }

    const criticalCountdown = this.getCriticalCountdownSeconds(hud)
    if (activeRun && criticalCountdown > 0 && criticalCountdown <= 15) {
      const wholeSeconds = Math.ceil(criticalCountdown)
      if (wholeSeconds !== this.lastCountdownSecond) {
        this.playCountdownTick(now, wholeSeconds <= 5)
        this.lastCountdownSecond = wholeSeconds
      }
    } else {
      this.lastCountdownSecond = Number.POSITIVE_INFINITY
    }
  }

  private getCriticalCountdownSeconds(hud: HudSnapshot) {
    if (hud.pirateState === 'boarding') return 0
    if (hud.pirateState === 'incoming') return hud.pirateBoardEta
    return hud.missionSeconds
  }

  private playResourcePickup(resourceId: ResourceId, when: number) {
    if (!this.context || !this.master || this.context.state !== 'running') return
    switch (resourceId) {
      case 'scrapIron':
        this.playTone({ frequency: 188, duration: 0.08, volume: 0.075, type: 'square', when })
        break
      case 'waterIce':
        this.playTone({ frequency: 640, duration: 0.09, volume: 0.06, type: 'triangle', when })
        break
      case 'cobaltDust':
        this.playTone({ frequency: 318, duration: 0.1, volume: 0.065, type: 'sawtooth', when })
        break
      case 'xenoCrystal':
        this.playTone({ frequency: 470, duration: 0.08, volume: 0.062, type: 'triangle', when })
        this.playTone({ frequency: 724, duration: 0.07, volume: 0.05, type: 'triangle', when: when + 0.05 })
        break
      case 'fringeRelic':
        this.playTone({ frequency: 392, duration: 0.1, volume: 0.075, type: 'sine', when })
        this.playTone({ frequency: 584, duration: 0.13, volume: 0.06, type: 'sine', when: when + 0.06 })
        break
    }
  }

  private playAsteroidExhausted(when: number) {
    this.playNoiseBurst({
      when,
      duration: 0.13,
      volume: 0.08,
      highpass: 240,
      lowpass: 2600,
    })
    this.playTone({ when, frequency: 218, duration: 0.08, volume: 0.065, type: 'sawtooth' })
    this.playTone({ when: when + 0.06, frequency: 168, duration: 0.11, volume: 0.07, type: 'triangle' })
  }

  private playHullImpact(when: number, severity: number) {
    this.playNoiseBurst({
      when,
      duration: 0.16 + severity * 0.18,
      volume: 0.09 + severity * 0.18,
      highpass: 90,
      lowpass: 1800,
    })
    this.playTone({
      when,
      frequency: 120 - severity * 34,
      duration: 0.18,
      volume: 0.08 + severity * 0.08,
      type: 'triangle',
    })
  }

  private playGrabberLatch(when: number) {
    this.playTone({ when, frequency: 290, duration: 0.09, volume: 0.06, type: 'square' })
    this.playTone({ when: when + 0.06, frequency: 402, duration: 0.11, volume: 0.065, type: 'sawtooth' })
  }

  private playGrabberRelease(when: number) {
    this.playTone({ when, frequency: 252, duration: 0.08, volume: 0.045, type: 'triangle' })
  }

  private playPirateAlertStinger(when: number) {
    this.playTone({ when, frequency: 420, duration: 0.16, volume: 0.09, type: 'square' })
    this.playTone({ when: when + 0.12, frequency: 330, duration: 0.18, volume: 0.08, type: 'square' })
  }

  private playPirateDisabledJingle(when: number) {
    const sequence = [680, 760, 840, 1010, 920]
    sequence.forEach((frequency, i) => {
      this.playTone({
        when: when + i * 0.085,
        frequency,
        duration: 0.08,
        volume: 0.07,
        type: 'triangle',
      })
    })
  }

  private playRepairPulse(when: number) {
    this.playTone({ when, frequency: 780, duration: 0.07, volume: 0.05, type: 'triangle' })
    this.playTone({ when: when + 0.03, frequency: 930, duration: 0.06, volume: 0.035, type: 'triangle' })
  }

  private playUnloadPulse(when: number) {
    this.playTone({ when, frequency: 170, duration: 0.06, volume: 0.045, type: 'square' })
    this.playNoiseBurst({
      when: when + 0.02,
      duration: 0.05,
      volume: 0.03,
      highpass: 220,
      lowpass: 2200,
    })
  }

  private playUnloadComplete(when: number) {
    this.playTone({ when, frequency: 360, duration: 0.1, volume: 0.08, type: 'triangle' })
    this.playTone({ when: when + 0.08, frequency: 520, duration: 0.13, volume: 0.075, type: 'triangle' })
  }

  private playRepairComplete(when: number) {
    this.playTone({ when, frequency: 560, duration: 0.08, volume: 0.06, type: 'sine' })
  }

  private playCargoFullAlert(when: number) {
    this.playTone({ when, frequency: 420, duration: 0.09, volume: 0.08, type: 'square' })
    this.playTone({ when: when + 0.1, frequency: 365, duration: 0.11, volume: 0.085, type: 'square' })
    this.playTone({ when: when + 0.22, frequency: 320, duration: 0.13, volume: 0.09, type: 'sawtooth' })
  }

  private playDrillChatterPulse(when: number) {
    this.playTone({ when, frequency: 136, duration: 0.03, volume: 0.03, type: 'square' })
    this.playNoiseBurst({
      when: when + 0.004,
      duration: 0.028,
      volume: 0.028,
      highpass: 700,
      lowpass: 3200,
    })
  }

  private playHullStressCreak(when: number, severity: number) {
    const bend = (Math.random() - 0.5) * 28
    this.playNoiseBurst({
      when,
      duration: 0.09 + severity * 0.13,
      volume: 0.035 + severity * 0.05,
      highpass: 150,
      lowpass: 1700,
    })
    this.playTone({
      when,
      frequency: 182 + bend - severity * 38,
      duration: 0.08 + severity * 0.07,
      volume: 0.03 + severity * 0.03,
      type: 'sawtooth',
    })
    this.playTone({
      when: when + 0.05,
      frequency: 136 + bend * 0.5 - severity * 22,
      duration: 0.09 + severity * 0.05,
      volume: 0.022 + severity * 0.025,
      type: 'triangle',
    })
  }

  private playCountdownTick(when: number, urgent: boolean) {
    this.playTone({
      when,
      frequency: urgent ? 900 : 680,
      duration: urgent ? 0.06 : 0.05,
      volume: urgent ? 0.08 : 0.06,
      type: 'square',
    })
  }

  private playRunComplete(when: number) {
    this.playTone({ when, frequency: 420, duration: 0.12, volume: 0.09, type: 'triangle' })
    this.playTone({ when: when + 0.1, frequency: 620, duration: 0.14, volume: 0.085, type: 'triangle' })
    this.playTone({ when: when + 0.22, frequency: 780, duration: 0.2, volume: 0.08, type: 'triangle' })
  }

  private playRunFailed(when: number) {
    this.playTone({ when, frequency: 300, duration: 0.18, volume: 0.08, type: 'sawtooth' })
    this.playTone({ when: when + 0.12, frequency: 208, duration: 0.22, volume: 0.09, type: 'sawtooth' })
  }

  private playTone({
    frequency,
    duration,
    volume,
    type,
    when = 0,
  }: {
    frequency: number
    duration: number
    volume: number
    type: OscillatorType
    when?: number
  }) {
    const context = this.context
    const master = this.master
    if (!context || !master || context.state !== 'running') return

    const startAt = Math.max(context.currentTime, when)
    const stopAt = startAt + duration + 0.04

    const osc = context.createOscillator()
    const gain = context.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(frequency, startAt)

    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

    osc.connect(gain)
    gain.connect(master)

    osc.start(startAt)
    osc.stop(stopAt)
  }

  private playNoiseBurst({
    when = 0,
    duration,
    volume,
    highpass,
    lowpass,
  }: {
    when?: number
    duration: number
    volume: number
    highpass: number
    lowpass: number
  }) {
    const context = this.context
    const master = this.master
    const noiseBuffer = this.noiseBuffer
    if (!context || !master || !noiseBuffer || context.state !== 'running') return

    const startAt = Math.max(context.currentTime, when)
    const stopAt = startAt + duration + 0.04

    const source = context.createBufferSource()
    source.buffer = noiseBuffer

    const hp = context.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = highpass

    const lp = context.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = lowpass

    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

    source.connect(hp)
    hp.connect(lp)
    lp.connect(gain)
    gain.connect(master)

    source.start(startAt)
    source.stop(stopAt)
  }

  private setGain(node: GainNode | null, target: number, now: number, timeConstant: number) {
    if (!node || !this.context) return
    node.gain.setTargetAtTime(target, now, timeConstant)
  }

  private makeSnapshot(runtime: GameRuntime, hud: HudSnapshot): AudioSnapshot {
    return {
      runId: runtime.runId,
      status: hud.status,
      docked: hud.docked,
      grabbedAsteroidId: hud.grabbedAsteroidId,
      asteroidDepletionSerial: runtime.asteroidDepletionSerial,
      pirateState: hud.pirateState,
      hull: hud.hull,
      cargoUsed: hud.cargoUsed,
    }
  }

  private readCargoCounts(runtime: GameRuntime): ResourceCounts {
    return {
      scrapIron: runtime.cargoBins.scrapIron.units,
      waterIce: runtime.cargoBins.waterIce.units,
      cobaltDust: runtime.cargoBins.cobaltDust.units,
      xenoCrystal: runtime.cargoBins.xenoCrystal.units,
      fringeRelic: runtime.cargoBins.fringeRelic.units,
    }
  }

  private createNoiseBuffer(context: AudioContext, seconds: number) {
    const length = Math.floor(context.sampleRate * seconds)
    const buffer = context.createBuffer(1, length, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (0.5 + Math.random() * 0.5)
    }
    return buffer
  }

  private createLoopedNoiseSource(context: AudioContext) {
    const source = context.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true
    return source
  }

  private startSource<T extends AudioScheduledSourceNode>(source: T) {
    source.start()
    this.trackSource(source)
  }

  private trackSource<T extends AudioScheduledSourceNode>(source: T) {
    this.trackedSources.push(source)
    return source
  }

  private trackNode<T extends AudioNode>(node: T) {
    this.trackedNodes.push(node)
    return node
  }
}
