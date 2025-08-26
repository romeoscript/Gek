import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TextPlugin } from 'gsap/TextPlugin'
import * as THREE from 'three'
import './style.css'

gsap.registerPlugin(ScrollTrigger, TextPlugin)

class SequencePlayer {
    constructor(params) {
        this.scene = params.scene
        this.camera = params.camera
        this.renderer = params.renderer
        this.fps = params.fps || 24
        this.manifest = params.manifest
        this.current = null
        this.texturesCache = new Map()
        this.clock = 0
        this.targetPlane = null
        this.isPlaying = false
        this.options = {
            width: params.width || 3.2,
            height: params.height || 2.4,
            position: params.position || new THREE.Vector3(1.2, -0.2, 0),
            coverViewport: params.coverViewport || false,
            zIndex: params.zIndex || 0,
            stickBottom: params.stickBottom || false,
            bottomPadding: params.bottomPadding || 0
        }

        this._createPlane()
        gsap.ticker.add(this._tick)
    }

    _createPlane() {
        const geometry = new THREE.PlaneGeometry(this.options.width, this.options.height)
        const material = new THREE.MeshBasicMaterial({ transparent: true })
        this.targetPlane = new THREE.Mesh(geometry, material)
        this.targetPlane.position.copy(this.options.position)
        this.targetPlane.position.z = this.options.zIndex
        this.scene.add(this.targetPlane)

        if (this.options.coverViewport) {
            this.fitToViewport()
        }
        if (this.options.stickBottom) {
            this.alignToBottom(this.options.bottomPadding)
        }
    }

    fitToViewport() {
        const distance = this.camera.position.z - this.targetPlane.position.z
        const vFOV = (this.camera.fov * Math.PI) / 180
        const height = 2 * Math.tan(vFOV / 2) * distance
        const width = height * this.camera.aspect
        this.targetPlane.scale.set(width / this.options.width, height / this.options.height, 1)
        this.targetPlane.position.x = 0
        this.targetPlane.position.y = 0
    }

    alignToBottom(padding = 0) {
        const distance = this.camera.position.z - this.targetPlane.position.z
        const vFOV = (this.camera.fov * Math.PI) / 180
        const viewportHeight = 2 * Math.tan(vFOV / 2) * distance
        const planeHeight = this.options.height * this.targetPlane.scale.y
        const bottomY = -viewportHeight / 2 + (planeHeight / 2) + (padding / 100)
        this.targetPlane.position.y = bottomY
    }

    _tick = (time, deltaTime) => {
        if (!this.isPlaying || !this.current) return
        const dt = deltaTime / 1000
        this.clock += dt
        const frameDuration = 1 / this.fps
        while (this.clock >= frameDuration) {
            this.clock -= frameDuration
            this._advanceFrame()
        }
    }

    async loadSequence(key) {
        if (!this.manifest.sequences[key]) throw new Error(`Unknown sequence: ${key}`)
        const cfg = this.manifest.sequences[key]
        const total = cfg.end - cfg.start + 1
        const frames = new Array(total).fill(0).map((_, i) => this._frameUrl(cfg, cfg.start + i))
        this.current = { key, cfg, index: 0, frames, loop: !!cfg.loop }
        await this._ensureWarmCache(frames.slice(0, 10))
        this._setFrameTexture(0)
    }

    play() { this.isPlaying = true }
    pause() { this.isPlaying = false }

    async switchTo(key) {
        await this.loadSequence(key)
        this.play()
    }

    _advanceFrame() {
        if (!this.current) return
        const next = this.current.index + 1
        const last = this.current.frames.length - 1
        if (next > last) {
            if (this.current.loop) {
                this.current.index = 0
            } else {
                this.pause()
                return
            }
        } else {
            this.current.index = next
        }
        if (this.current.index % 10 === 0) {
            const upcoming = this.current.frames.slice(this.current.index, this.current.index + 20)
            this._ensureWarmCache(upcoming)
        }
        this._setFrameTexture(this.current.index)
    }

    _frameUrl(cfg, num) {
        const n = String(num).padStart(cfg.pad, '0')
        return `${cfg.path}${cfg.pattern.replace('%05d', n)}`
    }

    async _ensureWarmCache(urls) {
        await Promise.all(urls.map(url => this._loadTexture(url)))
    }

    async _loadTexture(url) {
        if (this.texturesCache.has(url)) return this.texturesCache.get(url)
        const loader = new THREE.TextureLoader()
        return new Promise((resolve, reject) => {
            loader.load(url, texture => {
                texture.colorSpace = THREE.SRGBColorSpace
                this.texturesCache.set(url, texture)
                resolve(texture)
            }, undefined, reject)
        })
    }

    async _setFrameTexture(index) {
        const url = this.current.frames[index]
        const texture = await this._loadTexture(url)
        this.targetPlane.material.map = texture
        this.targetPlane.material.needsUpdate = true
    }
}

class GEKLanding {
    constructor() {
        this.init()
    }

    async init() {
        await this.setupThreeJS()
        await this.loadManifest()
        this.setupAnimations()
        this.setupEventListeners()
        await this.initSequences()
    }

    async loadManifest() {
        const res = await fetch('/animations/manifest.json')
        this.manifest = await res.json()
    }

    async setupThreeJS() {
        const canvas = document.getElementById('three-canvas')
        if (!canvas) return

        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

        const ambient = new THREE.AmbientLight(0x88ffcc, 0.6)
        this.scene.add(ambient)

        this.camera.position.set(0, 0, 5)

        const renderLoop = () => {
            requestAnimationFrame(renderLoop)
            this.renderer.render(this.scene, this.camera)
        }
        renderLoop()
    }

    setupAnimations() {}

    setupEventListeners() {
        window.addEventListener('resize', this.handleResize.bind(this))
    }

    async initSequences() {
        this.backgroundPlayer = new SequencePlayer({
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            fps: this.manifest.fps,
            manifest: this.manifest,
            width: 2,
            height: 2,
            position: new THREE.Vector3(0, 0, -1),
            zIndex: -1,
            coverViewport: true
        })
        await this.backgroundPlayer.switchTo('background')
        this.backgroundPlayer.play()

        this.sequencePlayer = new SequencePlayer({
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            fps: this.manifest.fps,
            manifest: this.manifest,
            width: 9.9,
            height: 5.65,
            position: new THREE.Vector3(0.1, -0.1, 0),
            zIndex: 0,
            stickBottom: true,
            bottomPadding: 0
        })
        await this.sequencePlayer.switchTo('idle')
        this.demoStateFlow()
        this.sequencePlayer.alignToBottom(0)
    }

    demoStateFlow() {
        const toSleep = () => this.sequencePlayer.switchTo('sleepTransition').then(() => {
            this.sequencePlayer.play()
            const onDone = () => setTimeout(() => this.sequencePlayer.switchTo('sleep').then(() => {
                this.sequencePlayer.play()
                setTimeout(toWake, 6000)
            }), 0)
            setTimeout(onDone, (this.manifest.sequences.sleepTransition.end + 1) / this.manifest.fps * 1000)
        })
        const toWake = () => this.sequencePlayer.switchTo('wake').then(() => {
            this.sequencePlayer.play()
            setTimeout(() => this.sequencePlayer.switchTo('idle').then(() => {
                this.sequencePlayer.play()
                setTimeout(toSleep, 4000)
            }), (this.manifest.sequences.wake.end + 1) / this.manifest.fps * 1000)
        })
        setTimeout(toSleep, 4000)
    }

    handleResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight
            this.camera.updateProjectionMatrix()
            this.renderer.setSize(window.innerWidth, window.innerHeight)
            if (this.backgroundPlayer) this.backgroundPlayer.fitToViewport()
            if (this.sequencePlayer) this.sequencePlayer.alignToBottom(0)
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { new GEKLanding() })
