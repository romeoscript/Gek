import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TextPlugin } from 'gsap/TextPlugin'
import * as THREE from 'three'
import './style.css'

gsap.registerPlugin(ScrollTrigger, TextPlugin)

// Utility to init hotspot interactions
function initHotspots() {
    const hotspots = document.querySelectorAll('#hotspots .hotspot')
    hotspots.forEach((el) => {
        el.setAttribute('role', 'link')
        el.setAttribute('tabindex', '0')
        const open = () => {
            el.classList.add('active')
            setTimeout(() => el.classList.remove('active'), 900)
            const url = el.getAttribute('data-url')
            if (url) window.open(url, '_blank', 'noopener,noreferrer')
        }
        el.addEventListener('click', open)
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open() })
    })
}

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
        
        console.log(`Loading sequence: ${key} with ${frames.length} frames`)
        console.log(`First frame URL: ${frames[0]}`)
        
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
            }, undefined, (error) => {
                console.error(`Failed to load texture: ${url}`, error)
                reject(error)
            })
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
        this.idleTimer = null
        this.isAwake = false
        this.idleTimeout = 8000 // 8 seconds of inactivity before sleeping
    }

    async init() {
        await this.setupThreeJS()
        await this.loadManifest()
        this.setupAnimations()
        this.setupEventListeners()
        await this.initSequences()
        initHotspots()
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
        
        // Track user interactions to wake up the frog
        const interactionEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
        interactionEvents.forEach(event => {
            document.addEventListener(event, this.handleUserInteraction.bind(this), { passive: true })
        })
    }

    handleUserInteraction() {
        if (!this.isAwake) {
            this.wakeUp()
        }
        this.resetIdleTimer()
    }

    resetIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer)
        }
        this.idleTimer = setTimeout(() => {
            this.goToSleep()
        }, this.idleTimeout)
    }

    async wakeUp() {
        this.isAwake = true
        await this.sequencePlayer.switchTo('wake')
        this.sequencePlayer.play()
        
        // Wait for wake animation to complete, then switch to idle
        const wakeDuration = (this.manifest.sequences.wake.end + 1) / this.manifest.fps * 1000
        setTimeout(async () => {
            await this.sequencePlayer.switchTo('idle')
            this.sequencePlayer.play()
        }, wakeDuration)
    }

    async goToSleep() {
        this.isAwake = false
        await this.sequencePlayer.switchTo('sleepTransition')
        this.sequencePlayer.play()
        
        // Wait for transition to complete, then switch to sleep
        const transitionDuration = (this.manifest.sequences.sleepTransition.end + 1) / this.manifest.fps * 1000
        setTimeout(async () => {
            await this.sequencePlayer.switchTo('sleep')
            this.sequencePlayer.play()
        }, transitionDuration)
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
        
        // Start with the frog asleep
        await this.sequencePlayer.switchTo('sleep')
        this.sequencePlayer.play()
        this.sequencePlayer.alignToBottom(0)
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
