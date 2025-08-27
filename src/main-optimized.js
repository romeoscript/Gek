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

// Optimized texture loader with better memory management
class OptimizedTextureLoader {
    constructor() {
        this.cache = new Map()
        this.loadingQueue = new Map()
        this.maxCacheSize = 50 // Limit cache size to prevent memory issues
    }

    async loadTexture(url) {
        if (this.cache.has(url)) {
            return this.cache.get(url)
        }

        if (this.loadingQueue.has(url)) {
            return this.loadingQueue.get(url)
        }

        const loadPromise = new Promise((resolve, reject) => {
            // Use ImageBitmap for better performance if available
            if (window.createImageBitmap) {
                fetch(url)
                    .then(response => response.blob())
                    .then(blob => createImageBitmap(blob))
                    .then(bitmap => {
                        const texture = new THREE.CanvasTexture(bitmap)
                        this._optimizeTexture(texture)
                        this._addToCache(url, texture)
                        resolve(texture)
                    })
                    .catch(reject)
            } else {
                // Fallback to regular texture loader
                const loader = new THREE.TextureLoader()
                loader.load(url, texture => {
                    this._optimizeTexture(texture)
                    this._addToCache(url, texture)
                    resolve(texture)
                }, undefined, reject)
            }
        })

        this.loadingQueue.set(url, loadPromise)
        return loadPromise
    }

    _optimizeTexture(texture) {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = false
        texture.flipY = true
        texture.premultiplyAlpha = false
        texture.needsUpdate = true
    }

    _addToCache(url, texture) {
        this.cache.set(url, texture)
        this.loadingQueue.delete(url)

        // Implement LRU cache eviction
        if (this.cache.size > this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value
            const oldTexture = this.cache.get(firstKey)
            if (oldTexture) {
                oldTexture.dispose()
            }
            this.cache.delete(firstKey)
        }
    }

    dispose() {
        this.cache.forEach(texture => texture.dispose())
        this.cache.clear()
        this.loadingQueue.clear()
    }
}

class OptimizedSequencePlayer {
    constructor(params) {
        this.scene = params.scene
        this.camera = params.camera
        this.renderer = params.renderer
        this.fps = params.fps || 24
        this.manifest = params.manifest
        this.current = null
        this.textureLoader = new OptimizedTextureLoader()
        this.frameTime = 1000 / this.fps
        this.lastFrameTime = 0
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
        this._setupOptimizedTicker()
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

    _setupOptimizedTicker() {
        // Use requestAnimationFrame instead of GSAP ticker for better performance
        let lastTime = 0
        const tick = (currentTime) => {
            if (this.isPlaying && this.current) {
                if (currentTime - this.lastFrameTime >= this.frameTime) {
                    this._advanceFrame()
                    this.lastFrameTime = currentTime
                }
            }
            requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
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
        
        // Load only the first frame immediately
        await this._loadTexture(frames[0])
        this._setFrameTexture(0)
        this.isPlaying = true
        
        // Start background loading with reduced batch size
        this._backgroundLoadFrames(frames.slice(1), 2)
    }

    _frameUrl(cfg, num) {
        if (cfg.frames && cfg.frames[num]) {
            return cfg.frames[num]
        }
        const n = String(num).padStart(cfg.pad, '0')
        return `${cfg.path}${cfg.pattern.replace('%05d', n)}`
    }

    async _loadTexture(url) {
        return this.textureLoader.loadTexture(url)
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
    }

    async _backgroundLoadFrames(frames, batchSize = 2) {
        if (frames.length === 0) return

        console.log(`📥 Loading ${frames.length} frames in background (batch size: ${batchSize})...`)
        
        // Use setTimeout to avoid blocking the main thread
        const loadBatch = async (startIndex) => {
            const batch = frames.slice(startIndex, startIndex + batchSize)
            
            try {
                await Promise.all(batch.map(url => this._loadTexture(url)))
                
                // Schedule next batch with delay
                const nextIndex = startIndex + batchSize
                if (nextIndex < frames.length) {
                    setTimeout(() => loadBatch(nextIndex), 100)
                }
            } catch (error) {
                console.warn('Background loading error:', error)
            }
        }

        // Start loading in background
        setTimeout(() => loadBatch(0), 100)
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

    dispose() {
        this.textureLoader.dispose()
        if (this.targetPlane) {
            this.scene.remove(this.targetPlane)
            this.targetPlane.geometry.dispose()
            this.targetPlane.material.dispose()
        }
    }
}

class GEKLanding {
    constructor() {
        this.init()
        this.idleTimer = null
        this.isAwake = false
        this.idleTimeout = 10000
    }

    async init() {
        await this.setupThreeJS()
        await this.loadManifest()
        this.setupEventListeners()
        await this.initSequences()
        initHotspots()
    }

    async loadManifest() {
        try {
            const res = await fetch('/animations/manifest-optimized.json')
            if (res.ok) {
                this.manifest = await res.json()
                console.log('✅ Loaded optimized manifest')
            } else {
                throw new Error('Optimized manifest not found')
            }
        } catch (error) {
            console.log('📥 Falling back to regular manifest...')
            const res = await fetch('/animations/manifest-cloudinary.json')
            this.manifest = await res.json()
        }
    }

    async setupThreeJS() {
        const canvas = document.getElementById('three-canvas')
        if (!canvas) return

        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
        
        // Optimized renderer settings
        this.renderer = new THREE.WebGLRenderer({ 
            canvas, 
            alpha: true, 
            antialias: false,
            powerPreference: "high-performance",
            stencil: false,
            depth: false
        })
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
        this.renderer.setClearColor(0x000000, 0)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace

        const ambient = new THREE.AmbientLight(0x88ffcc, 0.6)
        this.scene.add(ambient)

        this.camera.position.set(0, 0, 5)

        // Optimized render loop with throttling
        let lastRenderTime = 0
        const renderLoop = (currentTime) => {
            requestAnimationFrame(renderLoop)
            
            // Only render if enough time has passed (throttle to ~30fps)
            if (currentTime - lastRenderTime > 33) {
                this.renderer.render(this.scene, this.camera)
                lastRenderTime = currentTime
            }
        }
        renderLoop()
    }

    setupEventListeners() {
        window.addEventListener('resize', this.handleResize.bind(this))
        
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
        if (this.isAwake) return
        this.isAwake = true
        
        try {
            await this.sequencePlayer.switchTo('wake')
            this.sequencePlayer.play()
            
            const wakeDuration = (this.manifest.sequences.wake.end + 1) / this.manifest.fps * 1000
            setTimeout(async () => {
                if (this.isAwake) {
                    await this.sequencePlayer.switchTo('idle')
                    this.sequencePlayer.play()
                }
            }, wakeDuration)
        } catch (error) {
            console.error('Error during wake up:', error)
            await this.sequencePlayer.switchTo('idle')
            this.sequencePlayer.play()
        }
    }

    async goToSleep() {
        if (!this.isAwake) return
        this.isAwake = false
        
        try {
            await this.sequencePlayer.switchTo('sleepTransition')
            this.sequencePlayer.play()
            
            const transitionDuration = (this.manifest.sequences.sleepTransition.end + 1) / this.manifest.fps * 1000
            setTimeout(async () => {
                if (!this.isAwake) {
                    await this.sequencePlayer.switchTo('sleep')
                    this.sequencePlayer.play()
                }
            }, transitionDuration)
        } catch (error) {
            console.error('Error during sleep transition:', error)
            await this.sequencePlayer.switchTo('sleep')
            this.sequencePlayer.play()
        }
    }

    async initSequences() {
        try {
            const [backgroundPlayer, sequencePlayer] = await Promise.all([
                this._createBackgroundPlayer(),
                this._createSequencePlayer()
            ])
            
            this.backgroundPlayer = backgroundPlayer
            this.sequencePlayer = sequencePlayer
            
            this.backgroundPlayer.play()
            this.sequencePlayer.play()
            this.sequencePlayer.alignToBottom(0)
            
            this.resetIdleTimer()
            this.hideLoadingScreen()
            
        } catch (error) {
            console.error('Error initializing sequences:', error)
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => { 
    new GEKLanding() 
})
