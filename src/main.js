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

class OptimizedSequencePlayer {
    constructor(params) {
        this.scene = params.scene
        this.camera = params.camera
        this.renderer = params.renderer
        this.fps = params.fps || 24
        this.manifest = params.manifest
        this.current = null
        this.texturesCache = new Map()
        this.frameTime = 1000 / this.fps
        this.lastFrameTime = 0
        this.targetPlane = null
        this.isPlaying = false
        this.loadingQueue = new Map()
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
        
        const currentTime = performance.now()
        if (currentTime - this.lastFrameTime >= this.frameTime) {
            this._advanceFrame()
            this.lastFrameTime = currentTime
        }
    }

    async loadSequence(key) {
        if (!this.manifest.sequences[key]) throw new Error(`Unknown sequence: ${key}`)
        const cfg = this.manifest.sequences[key]
        
        // Use actual frame URLs if available, otherwise construct them
        let frames
        if (cfg.frames && cfg.frames.length > 0) {
            frames = cfg.frames
        } else {
            const total = cfg.end - cfg.start + 1
            frames = new Array(total).fill(0).map((_, i) => this._frameUrl(cfg, cfg.start + i))
        }
        
        this.current = { key, cfg, index: 0, frames, loop: !!cfg.loop }
        
        console.log(`🎬 Loading sequence: ${key} with ${frames.length} frames`)
        
        // Load only the first frame immediately to start playing
        await this._loadTexture(frames[0])
        this._setFrameTexture(0)
        this.isPlaying = true
        
        // Get loading strategy from manifest or use defaults
        const loadingStrategy = cfg.loadingStrategy || 'lazy'
        const preloadCount = cfg.preloadFrames || 5
        const batchSize = cfg.batchSize || 3
        
        // Preload frames based on strategy
        if (loadingStrategy === 'test') {
            // For testing, only preload next 2 frames
            this._preloadNextFrames(frames, 2)
        } else {
            // For production, use optimized preloading
            this._preloadNextFrames(frames, preloadCount)
            this._smartBackgroundLoad(frames, batchSize)
        }
    }

    async _preloadNextFrames(frames, count) {
        const nextFrames = frames.slice(1, count + 1)
        await Promise.all(nextFrames.map(url => this._loadTexture(url)))
    }

    async _smartBackgroundLoad(frames, batchSize = 3) {
        // Only load frames that aren't already cached
        const uncachedFrames = frames.filter(url => !this.texturesCache.has(url))
        
        if (uncachedFrames.length === 0) {
            console.log('✅ All frames already cached!')
            return
        }
        
        console.log(`📥 Loading ${uncachedFrames.length} uncached frames in background (batch size: ${batchSize})...`)
        
        let loadedCount = 0
        
        for (let i = 0; i < uncachedFrames.length; i += batchSize) {
            const batch = uncachedFrames.slice(i, i + batchSize)
            
            // Load batch in background without blocking
            Promise.all(batch.map(url => this._loadTexture(url)))
                .then(() => {
                    loadedCount += batch.length
                    const progress = Math.round((loadedCount / uncachedFrames.length) * 100)
                    this._updateLoadingProgress(progress)
                })
                .catch(error => {
                    console.warn('Background loading error:', error)
                })
            
            // Adaptive delay based on batch size
            const delay = batchSize <= 2 ? 30 : 50
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    _updateLoadingProgress(progress) {
        const loadingText = document.querySelector('.loading-text')
        if (loadingText) {
            loadingText.textContent = `Loading animations... ${Math.min(progress, 100)}%`
        }
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
        this._setFrameTexture(this.current.index)
        
        // Smart preloading: only preload if we're close to unloaded frames
        if (this.current.index % 3 === 0) {
            const upcomingFrames = this.current.frames.slice(this.current.index + 1, this.current.index + 5)
            this._preloadFrames(upcomingFrames)
        }
    }

    async _preloadFrames(frames) {
        frames.forEach(url => {
            if (!this.texturesCache.has(url)) {
                this._loadTexture(url)
            }
        })
    }

    _frameUrl(cfg, num) {
        // If we have actual frame URLs, use them directly
        if (cfg.frames && cfg.frames[num]) {
            return cfg.frames[num];
        }
        
        // Fallback to pattern-based URL construction
        const n = String(num).padStart(cfg.pad, '0')
        return `${cfg.path}${cfg.pattern.replace('%05d', n)}`
    }

    async _loadTexture(url) {
        if (this.texturesCache.has(url)) return this.texturesCache.get(url)
        
        // Check if already loading
        if (this.loadingQueue.has(url)) {
            return this.loadingQueue.get(url)
        }
        
        const loadPromise = new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader()
            loader.load(url, texture => {
                // Optimize texture settings
                texture.colorSpace = THREE.SRGBColorSpace
                texture.minFilter = THREE.LinearFilter
                texture.magFilter = THREE.LinearFilter
                texture.generateMipmaps = false
                texture.flipY = true
                texture.premultiplyAlpha = false
                
                this.texturesCache.set(url, texture)
                this.loadingQueue.delete(url)
                resolve(texture)
            }, undefined, (error) => {
                console.error(`Failed to load texture: ${url}`, error)
                this.loadingQueue.delete(url)
                resolve(null)
            })
        })
        
        this.loadingQueue.set(url, loadPromise)
        return loadPromise
    }

    async _setFrameTexture(index) {
        if (!this.current || !this.current.frames[index]) return
        
        const url = this.current.frames[index]
        const texture = await this._loadTexture(url)
        
        if (texture && this.targetPlane && this.targetPlane.material) {
            this.targetPlane.material.map = texture
            this.targetPlane.material.needsUpdate = true
        }
    }

    play() { 
        this.isPlaying = true 
        this.lastFrameTime = performance.now()
    }
    
    pause() { this.isPlaying = false }

    async switchTo(key) {
        await this.loadSequence(key)
        this.play()
    }
}

class GEKLanding {
    constructor() {
        this.init()
        this.idleTimer = null
        this.isAwake = false
        this.idleTimeout = 10000 // 8 seconds of inactivity before sleeping
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
        // Try to load 50% manifest first for optimal performance
        try {
            const res = await fetch('/animations/manifest-50percent.json')
            if (res.ok) {
                this.manifest = await res.json()
                console.log('✅ Loaded 50% manifest (363 frames instead of 724)')
            } else {
                throw new Error('50% manifest not found')
            }
        } catch (error) {
            console.log('📥 Falling back to 70% manifest...')
            try {
                const res = await fetch('/animations/manifest-70percent.json')
                if (res.ok) {
                    this.manifest = await res.json()
                    console.log('✅ Loaded 70% manifest (506 frames instead of 724)')
                } else {
                    throw new Error('70% manifest not found')
                }
            } catch (error2) {
                console.log('📥 Falling back to reduced manifest...')
                try {
                    const res = await fetch('/animations/manifest-reduced.json')
                    if (res.ok) {
                        this.manifest = await res.json()
                        console.log('✅ Loaded reduced manifest (169 frames instead of 724)')
                    } else {
                        throw new Error('Reduced manifest not found')
                    }
                } catch (error3) {
                    console.log('📥 Falling back to optimized manifest...')
                    try {
                        const res = await fetch('/animations/manifest-optimized.json')
                        if (res.ok) {
                            this.manifest = await res.json()
                            console.log('✅ Loaded optimized manifest')
                        } else {
                            throw new Error('Optimized manifest not found')
                        }
                    } catch (error4) {
                        console.log('📥 Falling back to regular manifest...')
                        const res = await fetch('/animations/manifest-cloudinary.json')
                        this.manifest = await res.json()
                    }
                }
            }
        }
    }

    async setupThreeJS() {
        const canvas = document.getElementById('three-canvas')
        if (!canvas) return

        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
        
        // Optimize renderer for performance
        this.renderer = new THREE.WebGLRenderer({ 
            canvas, 
            alpha: true, 
            antialias: false, // Disable antialiasing for better performance
            powerPreference: "high-performance",
            stencil: false,
            depth: false // We don't need depth buffer for 2D sprites
        })
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)) // Limit pixel ratio for better performance
        this.renderer.setClearColor(0x000000, 0)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace

        const ambient = new THREE.AmbientLight(0x88ffcc, 0.6)
        this.scene.add(ambient)

        this.camera.position.set(0, 0, 5)

        // Optimized render loop
        let lastTime = 0
        const renderLoop = (currentTime) => {
            requestAnimationFrame(renderLoop)
            
            // Only render if something changed or at regular intervals
            if (currentTime - lastTime > 16) { // ~60fps max
                this.renderer.render(this.scene, this.camera)
                lastTime = currentTime
            }
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
        if (this.isAwake) return // Prevent multiple wake calls
        this.isAwake = true
        
        try {
            await this.sequencePlayer.switchTo('wake')
            this.sequencePlayer.play()
            
            // Wait for wake animation to complete, then switch to idle
            const wakeDuration = (this.manifest.sequences.wake.end + 1) / this.manifest.fps * 1000
            setTimeout(async () => {
                if (this.isAwake) { // Only switch to idle if still awake
                    await this.sequencePlayer.switchTo('idle')
                    this.sequencePlayer.play()
                }
            }, wakeDuration)
        } catch (error) {
            console.error('Error during wake up:', error)
            // Fallback to idle if wake animation fails
            await this.sequencePlayer.switchTo('idle')
            this.sequencePlayer.play()
        }
    }

    async goToSleep() {
        if (!this.isAwake) return // Prevent multiple sleep calls
        this.isAwake = false
        
        try {
            await this.sequencePlayer.switchTo('sleepTransition')
            this.sequencePlayer.play()
            
            // Wait for transition to complete, then switch to sleep
            const transitionDuration = (this.manifest.sequences.sleepTransition.end + 1) / this.manifest.fps * 1000
            setTimeout(async () => {
                if (!this.isAwake) { // Only switch to sleep if still asleep
                    await this.sequencePlayer.switchTo('sleep')
                    this.sequencePlayer.play()
                }
            }, transitionDuration)
        } catch (error) {
            console.error('Error during sleep transition:', error)
            // Fallback to sleep if transition fails
            await this.sequencePlayer.switchTo('sleep')
            this.sequencePlayer.play()
        }
    }

    async initSequences() {
        try {
            // Initialize both players in parallel for faster loading
            const [backgroundPlayer, sequencePlayer] = await Promise.all([
                this._createBackgroundPlayer(),
                this._createSequencePlayer()
            ])
            
            this.backgroundPlayer = backgroundPlayer
            this.sequencePlayer = sequencePlayer
            
            // Start both animations
            this.backgroundPlayer.play()
            this.sequencePlayer.play()
            this.sequencePlayer.alignToBottom(0)
            
            // Start the idle timer
            this.resetIdleTimer()
            
            // Hide loading screen
            this.hideLoadingScreen()
            
        } catch (error) {
            console.error('Error initializing sequences:', error)
            // Hide loading screen even if there's an error
            this.hideLoadingScreen()
        }
    }

    async _createBackgroundPlayer() {
        const player = new OptimizedSequencePlayer({
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
        await player.switchTo('background')
        return player
    }

    async _createSequencePlayer() {
        const player = new OptimizedSequencePlayer({
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
        await player.switchTo('sleep')
        return player
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen')
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out')
            setTimeout(() => {
                loadingScreen.style.display = 'none'
            }, 500)
        }
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
