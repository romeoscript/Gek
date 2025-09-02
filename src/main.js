import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TextPlugin } from 'gsap/TextPlugin'
import * as THREE from 'three'
import './style.css'

gsap.registerPlugin(ScrollTrigger, TextPlugin)

// Audio Manager Class
class AudioManager {
    constructor() {
        this.sounds = new Map()
        this.currentBackgroundSound = null
        this.isMuted = false
        this.volume = 0.3
        this.pendingAudio = null
        this.userHasInteracted = false
        this.init()
        this.initAudioContext()
    }

    initAudioContext() {
        // Try to unlock audio context for better autoplay support
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext
            if (AudioContext) {
                this.audioContext = new AudioContext()
                
                // Try to resume audio context on various events
                const resumeAudioContext = () => {
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume()
                        console.log('🎵 Audio context resumed')
                    }
                }
                
                ['click', 'touchstart', 'keydown', 'mousedown'].forEach(event => {
                    document.addEventListener(event, resumeAudioContext, { once: true })
                })
            }
        } catch (error) {
            console.warn('Audio context not supported:', error)
        }
    }

    async init() {
        try {
            // Load all audio files
            await Promise.all([
                this.loadSound('alan', '/audio/alan.mp3', { loop: true, volume: 0.2 }),
                this.loadSound('snoring', '/audio/snoring-long-78149.mp3', { loop: true, volume: 1.0 }),
                this.loadSound('gasp', '/audio/gasp-82819.mp3', { loop: false, volume: 0.8 }),
                this.loadSound('typing', '/audio/keyboard-typing-sound-effect-379112.mp3', { loop: true, volume: 0.6 })
            ])
            console.log('✅ Audio files loaded successfully')
            
            // Don't try autoplay strategies - wait for user to click overlay
            console.log('🎵 Audio loaded - waiting for user interaction via overlay')
            
        } catch (error) {
            console.warn('⚠️ Some audio files failed to load:', error)
        }
    }

    setupAutoplayStrategies() {
        // Try autoplay on various page events
        const events = ['load', 'DOMContentLoaded', 'focus', 'visibilitychange', 'pageshow']
        
        events.forEach(event => {
            window.addEventListener(event, () => {
                setTimeout(() => {
                    const snoring = this.sounds.get('snoring')
                    if (snoring && !snoring.playing) {
                        console.log(`🔄 Trying autoplay on ${event} event`)
                        this.tryAutoplay(snoring)
                    }
                }, 100)
            }, { once: true })
        })
        
        // Try autoplay periodically
        let attempts = 0
        const maxAttempts = 10
        const interval = setInterval(() => {
            attempts++
            const snoring = this.sounds.get('snoring')
            if (snoring && !snoring.playing && attempts < maxAttempts) {
                console.log(`🔄 Autoplay attempt ${attempts}/${maxAttempts}`)
                this.tryAutoplay(snoring)
            } else if (attempts >= maxAttempts) {
                clearInterval(interval)
                console.log('⏸️ Max autoplay attempts reached - waiting for user interaction')
            }
        }, 2000)
    }

    async loadSound(name, url, options = {}) {
        return new Promise((resolve, reject) => {
            const audio = new Audio()
            audio.preload = 'auto'
            audio.volume = (options.volume || 0.5) * this.volume
            audio.muted = false
            
            if (options.loop) {
                audio.loop = true
            }

            // Try to enable autoplay
            audio.setAttribute('autoplay', '')
            audio.setAttribute('playsinline', '')
            audio.setAttribute('webkit-playsinline', '')

            audio.addEventListener('canplaythrough', () => {
                audio.playing = false // Track playing state
                this.sounds.set(name, audio)
                console.log(`✅ Audio loaded: ${name}`)
                
                // Try to play immediately if it's snoring
                if (name === 'snoring') {
                    this.tryAutoplay(audio)
                }
                
                resolve(audio)
            }, { once: true })

            audio.addEventListener('error', (error) => {
                console.warn(`Failed to load audio ${name}:`, error)
                reject(error)
            })

            audio.src = url
        })
    }

    tryAutoplay(audio) {
        // Try multiple autoplay strategies
        const playPromise = audio.play()
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                audio.playing = true
                console.log('🎵 Autoplay successful!')
            }).catch(error => {
                if (error.name === 'NotAllowedError') {
                    console.log('⏸️ Autoplay blocked - will try again on user interaction')
                    this.pendingAudio = 'snoring'
                } else {
                    console.warn('Autoplay failed:', error)
                }
            })
        }
    }

    play(name) {
        if (this.isMuted) return
        
        const sound = this.sounds.get(name)
        if (sound) {
            // Stop any currently playing background sound if this is a background sound
            if (name === 'snoring' && this.currentBackgroundSound) {
                this.stop(this.currentBackgroundSound)
            }
            
            sound.currentTime = 0
            sound.play().then(() => {
                sound.playing = true
                console.log(`🎵 Playing: ${name}`)
            }).catch(error => {
                if (error.name === 'NotAllowedError') {
                    console.log(`⏸️ Audio ${name} blocked by browser - waiting for user interaction`)
                    // Store this sound to play when user interacts
                    this.pendingAudio = name
                } else {
                    console.warn(`Failed to play ${name}:`, error)
                }
            })
            
            if (name === 'snoring') {
                this.currentBackgroundSound = name
            }
        } else {
            console.warn(`Audio ${name} not found in sounds map`)
        }
    }

    stop(name) {
        const sound = this.sounds.get(name)
        if (sound) {
            sound.pause()
            sound.currentTime = 0
            sound.playing = false
            if (name === this.currentBackgroundSound) {
                this.currentBackgroundSound = null
            }
            console.log(`🔇 Stopped: ${name}`)
        }
    }

    stopAll() {
        this.sounds.forEach((sound, name) => {
            this.stop(name)
        })
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume))
        this.sounds.forEach(sound => {
            sound.volume = sound.volume * this.volume
        })
    }

    toggleMute() {
        this.isMuted = !this.isMuted
        if (this.isMuted) {
            this.stopAll()
        }
        return this.isMuted
    }

    onUserInteraction() {
        if (!this.userHasInteracted) {
            this.userHasInteracted = true
            console.log('👆 User interaction detected - audio can now play')
            
            // Play any pending audio
            if (this.pendingAudio) {
                console.log(`🎵 Playing pending audio: ${this.pendingAudio}`)
                this.play(this.pendingAudio)
                this.pendingAudio = null
            }
        }
    }
}

// Utility to init hotspot interactions
function initHotspots() {
    // Check if we're on mobile to use appropriate hotspots container ID
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const hotspotsId = isMobile ? 'mobile-hotspots' : 'hotspots'
    const hotspots = document.querySelectorAll(`#${hotspotsId} .hotspot`)
    
    hotspots.forEach((el) => {
        el.setAttribute('role', 'link')
        el.setAttribute('tabindex', '0')
        const open = () => {
            el.classList.add('active')
            setTimeout(() => el.classList.remove('active'), 900)
            
            // Check if it's a contract address hotspot
            const contractAddress = el.getAttribute('data-contract')
            if (contractAddress) {
                // Copy contract address to clipboard
                navigator.clipboard.writeText(contractAddress).then(() => {
                    // Show a temporary tooltip or notification
                    showCopyNotification('Contract address copied!')
                }).catch(err => {
                    console.error('Failed to copy contract address:', err)
                    showCopyNotification('Failed to copy address')
                })
            } else {
                // Regular URL opening
                const url = el.getAttribute('data-url')
                if (url) window.open(url, '_blank', 'noopener,noreferrer')
            }
        }
        el.addEventListener('click', open)
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open() })
    })
}

// Initialize mobile experience
function initMobileExperience() {
    console.log('📱 Initializing mobile experience with full functionality...')
    
    // Initialize hotspots first
    initHotspots()
    
    // Then initialize the full GEKLanding class with mobile manifest
    const gekLanding = new GEKLanding()
    console.log('📱 Mobile experience initialized with full functionality')
}





// Function to show copy notification
function showCopyNotification(message) {
    // Create notification element
    const notification = document.createElement('div')
    notification.textContent = message
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #00ff88;
        color: #000;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 600;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `
    
    document.body.appendChild(notification)
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)'
    }, 100)
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)'
        setTimeout(() => {
            document.body.removeChild(notification)
        }, 300)
    }, 3000)
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
            try {
                this._advanceFrame()
                this.lastFrameTime = currentTime
            } catch (error) {
                console.error('Error in animation tick:', error)
                // Reset timing to prevent rapid error loops
                this.lastFrameTime = currentTime
            }
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
        
        // Ensure sleep animations always loop
        const shouldLoop = (key === 'sleep' || key === 'background') ? true : !!cfg.loop
        this.current = { key, cfg, index: 0, frames, loop: shouldLoop }
        
        console.log(`🎬 Loading sequence: ${key} with ${frames.length} frames, loop: ${shouldLoop}, cfg.loop: ${cfg.loop}`)
        
        // Load first few frames immediately to prevent freezing
        const initialFrames = frames.slice(0, Math.min(5, frames.length))
        await Promise.all(initialFrames.map(url => this._loadTexture(url)))
        
        this._setFrameTexture(0)
        this.isPlaying = true
        
        // Get loading strategy from manifest or use defaults
        const loadingStrategy = cfg.loadingStrategy || 'lazy'
        const preloadCount = cfg.preloadFrames || 10 // Increased from 5 to 10
        const batchSize = cfg.batchSize || 5 // Increased from 3 to 5
        
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
                console.log(`🔄 Looping animation: ${this.current.key}`)
            } else {
                console.log(`⏸️ Animation ended (no loop): ${this.current.key}`)
                this.pause()
                return
            }
        } else {
            this.current.index = next
        }
        
        // Check if the next frame texture is loaded before advancing
        const nextFrameUrl = this.current.frames[this.current.index]
        if (this.texturesCache.has(nextFrameUrl)) {
            this._setFrameTexture(this.current.index)
        } else {
            // If texture isn't loaded, try to load it and retry
            this._loadTexture(nextFrameUrl).then(() => {
                this._setFrameTexture(this.current.index)
            }).catch(error => {
                console.warn(`Failed to load frame ${this.current.index}, continuing anyway...`, error)
                // Continue to next frame even if this one fails to load
                // This prevents the animation from getting stuck
                setTimeout(() => this._advanceFrame(), 50)
                return
            })
        }
        
        // Smart preloading: only preload if we're close to unloaded frames
        if (this.current.index % 3 === 0) {
            const upcomingFrames = this.current.frames.slice(this.current.index + 1, this.current.index + 5)
            this._preloadFrames(upcomingFrames)
        }
        
        // Fallback: if we haven't advanced in a while, force advance
        if (this.current.lastAdvanceTime) {
            const timeSinceLastAdvance = performance.now() - this.current.lastAdvanceTime
            if (timeSinceLastAdvance > 5000) { // 5 seconds
                console.warn('Animation stuck, forcing advance...')
                this.current.index = (this.current.index + 1) % this.current.frames.length
                this._setFrameTexture(this.current.index)
            }
        }
        this.current.lastAdvanceTime = performance.now()
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
            
            // Add timeout to prevent infinite loading
            const timeout = setTimeout(() => {
                console.warn(`Texture loading timeout for: ${url}`)
                this.loadingQueue.delete(url)
                resolve(null)
            }, 10000) // 10 second timeout
            
            loader.load(url, texture => {
                clearTimeout(timeout)
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
                clearTimeout(timeout)
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
        try {
            const texture = await this._loadTexture(url)
            
            if (texture && this.targetPlane && this.targetPlane.material) {
                this.targetPlane.material.map = texture
                this.targetPlane.material.needsUpdate = true
            } else {
                console.warn(`Failed to set texture for frame ${index}: texture or plane not available`)
                // Continue to next frame even if this one fails
                if (this.isPlaying) {
                    setTimeout(() => this._advanceFrame(), 50)
                }
            }
        } catch (error) {
            console.error(`Error setting frame texture ${index}:`, error)
            // If we can't load this frame, try to continue with the next one
            if (this.isPlaying) {
                setTimeout(() => this._advanceFrame(), 50)
            }
        }
    }

    play() { 
        this.isPlaying = true 
        this.lastFrameTime = performance.now()
        if (this.current?.key === 'sleep') {
            console.log('😴 Sleep animation started playing')
        }
    }
    
    pause() { 
        this.isPlaying = false 
        if (this.current?.key === 'sleep') {
            console.log('😴 Sleep animation paused')
        }
    }

    async switchTo(key) {
        await this.loadSequence(key)
        this.play()
        
        // Add safeguard for sleep animation to ensure it keeps playing
        if (key === 'sleep') {
            this._ensureSleepAnimationContinues()
        }
    }
    
    _ensureSleepAnimationContinues() {
        // Check every 5 seconds if sleep animation is still playing
        const checkInterval = setInterval(() => {
            if (this.current?.key === 'sleep' && !this.isPlaying) {
                console.log('😴 Sleep animation stopped - restarting...')
                this.play()
            } else if (this.current?.key !== 'sleep') {
                // Stop checking if we're no longer in sleep state
                clearInterval(checkInterval)
            }
        }, 5000)
    }
}

class GEKLanding {
    constructor() {
        this.init()
        this.idleTimer = null
        this.isAwake = false
        this.idleTimeout = 30000 // 30 seconds of inactivity before sleeping
        this.audioManager = new AudioManager()
    }

    async init() {
        await this.setupThreeJS()
        await this.loadManifest()
        this.setupAnimations()
        this.setupEventListeners()
        await this.initSequences()
        initHotspots()
        this.setupAudioControls()
        
        // Make audio manager globally accessible
        window.audioManager = this.audioManager
        
        // Audio will be started when user clicks the overlay
        console.log('🎵 Audio ready - waiting for user interaction')
    }

    async loadManifest() {
        // Check if we're on mobile to load appropriate manifest
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        
        if (isMobile) {
            // Always load mobile manifest for mobile devices
            try {
                const res = await fetch('/animations/manifest-mobile.json')
                if (res.ok) {
                    this.manifest = await res.json()
                    console.log('📱 Loaded mobile manifest with optimized frame counts')
                    console.log(`   Background: ${this.manifest.sequences.background?.fileCount || 0} frames`)
                    console.log(`   Idle Loop: ${this.manifest.sequences.idle?.fileCount || 0} frames`)
                    console.log(`   Sleep Cycle: ${this.manifest.sequences.sleep?.fileCount || 0} frames`)
                } else {
                    throw new Error('Mobile manifest not found')
                }
            } catch (error) {
                console.error('❌ Failed to load mobile manifest:', error)
                throw error // Don't fall back to desktop manifest on mobile
            }
        } else {
            // Load desktop manifest for desktop devices
            await this.loadDesktopManifest()
        }
    }

    async loadDesktopManifest() {
        // Try to load 50% manifest first for optimal performance
        try {
            // const res = await fetch('/animations/manifest-new-bg.json')
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
        // Check if we're on mobile to use appropriate canvas ID
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        const canvasId = isMobile ? 'mobile-three-canvas' : 'three-canvas'
        const canvas = document.getElementById(canvasId)
        
        if (!canvas) {
            console.error(`❌ Canvas element with ID '${canvasId}' not found`)
            return
        }

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
        
        // Check if we're on mobile to use appropriate element IDs
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        const overlayId = isMobile ? 'mobile-click-to-enter-overlay' : 'click-to-enter-overlay'
        const audioControlId = isMobile ? 'mobile-audio-control' : 'audio-control'
        const hotspotsId = isMobile ? 'mobile-hotspots' : 'hotspots'
        const loadingScreenId = isMobile ? 'mobile-loading-screen' : 'loading-screen'
        
        // Handle click to enter overlay
        const overlay = document.getElementById(overlayId)
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                e.preventDefault()
                this.handleEnterClick()
            })
        }
        
        // Only clicks and touches on the main canvas area wake up the frog
        const wakeEvents = ['click', 'touchstart']
        wakeEvents.forEach(event => {
            document.addEventListener(event, (e) => {
                // Don't wake up if clicking on UI elements
                if (e.target.closest(`#${audioControlId}`) || 
                    e.target.closest(`#${hotspotsId}`) || 
                    e.target.closest('.hotspot') ||
                    e.target.closest(`#${loadingScreenId}`) ||
                    e.target.closest(`#${overlayId}`)) {
                    return
                }
                this.handleUserInteraction()
            }, { passive: true })
        })
    }
    
    handleEnterClick() {
        console.log('🚀 User clicked to enter - enabling audio and starting experience')
        
        // Hide the overlay
        this.hideClickToEnterOverlay()
        
        // Enable audio
        if (this.audioManager) {
            this.audioManager.onUserInteraction()
            // Start background music and snoring immediately since frog is already sleeping
            this.audioManager.play('alan')
            this.audioManager.play('snoring')
        }
        
        // Don't start the idle timer yet - frog should stay asleep until user interacts
        // The frog starts in sleep state and will wake up on first interaction
        console.log('😴 Frog is sleeping - click anywhere to wake it up')
    }

    handleUserInteraction() {
        console.log('👆 User interaction detected')
        
        // Enable audio on first interaction
        if (this.audioManager) {
            this.audioManager.onUserInteraction()
        }
        
        if (!this.isAwake) {
            console.log('😴 Waking up from sleep...')
            this.wakeUp()
        }
        
        // Start/reset the idle timer
        this.resetIdleTimer()
    }

    resetIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer)
        }
        this.idleTimer = setTimeout(() => {
            console.log('⏰ Idle timer triggered - going to sleep...')
            this.goToSleep()
        }, this.idleTimeout)
    }

    async wakeUp() {
        if (this.isAwake) return // Prevent multiple wake calls
        this.isAwake = true
        
        // Stop snoring and play gasp sound
        this.audioManager.stop('snoring')
        this.audioManager.play('gasp')
        
        try {
            await this.sequencePlayer.switchTo('wake')
            this.sequencePlayer.play()
            
            // Wait for gasp sound to finish, then start typing sound
            setTimeout(() => {
                this.audioManager.play('typing')
            }, 2000) // Wait 2 seconds for gasp to finish
            
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
        
        // Stop typing sound when going to sleep
        this.audioManager.stop('typing')
        
        try {
            // Play sleep transition first
            await this.sequencePlayer.switchTo('sleepTransition')
            this.sequencePlayer.play()
            
            // Calculate transition duration more accurately
            const transitionFrames = this.manifest.sequences.sleepTransition.end - this.manifest.sequences.sleepTransition.start + 1
            const transitionDuration = (transitionFrames / this.manifest.fps) * 1000
            
            console.log(`😴 Sleep transition: ${transitionFrames} frames, ${transitionDuration}ms`)
            
            // Wait for transition to complete, then switch to sleep and start snoring
            setTimeout(async () => {
                if (!this.isAwake) { // Only switch to sleep if still asleep
                    console.log('😴 Transition complete, switching to sleep...')
                    await this.sequencePlayer.switchTo('sleep')
                    this.sequencePlayer.play()
                    // Start snoring sound
                    this.audioManager.play('snoring')
                    // Resume background music on mobile for better audibility cycles
                    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                    if (isMobile) {
                        this.audioManager.play('alan')
                    }
                }
            }, transitionDuration)
            
            // Fallback: if transition takes too long, force switch to sleep
            setTimeout(async () => {
                if (!this.isAwake && this.sequencePlayer.current?.key === 'sleepTransition') {
                    console.log('😴 Fallback: forcing switch to sleep...')
                    await this.sequencePlayer.switchTo('sleep')
                    this.sequencePlayer.play()
                    this.audioManager.play('snoring')
                    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                    if (isMobile) {
                        this.audioManager.play('alan')
                    }
                }
            }, transitionDuration + 2000) // Add 2 seconds buffer
        } catch (error) {
            console.error('Error during sleep transition:', error)
            // Fallback to sleep if transition fails
            console.log('😴 Fallback: switching directly to sleep...')
            await this.sequencePlayer.switchTo('sleep')
            this.sequencePlayer.play()
            this.audioManager.play('snoring')
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
            
            // Don't start snoring automatically - wait for user to click overlay
            console.log('🎬 Experience loaded - waiting for user to click to enter')
            
        } catch (error) {
            console.error('Error initializing sequences:', error)
            // Hide loading screen even if there's an error
            this.hideLoadingScreen()
            // Still try to start snoring even if there's an error, but only if user has interacted
            if (this.audioManager && this.audioManager.userHasInteracted) {
                this.startSnoring()
            }
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
        // Check if we're on mobile to use different dimensions
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        
        // Use different dimensions for mobile vs desktop
        const width = isMobile ? 3.0 : 9.9      
        const height = 5.65    
        
        // Use different position for mobile vs desktop
        const position = isMobile ? 
            new THREE.Vector3(0.1, -0.1, 0) :    // Mobile: centered, slightly lower
            new THREE.Vector3(0.1, -0.1, 0)    // Desktop: original position
        
        const player = new OptimizedSequencePlayer({
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            fps: this.manifest.fps,
            manifest: this.manifest,
            width: width,
            height: height,
            position: position,
            zIndex: 0,
            stickBottom: true,
            bottomPadding: 0
        })
        await player.switchTo('sleep')
        return player
    }

    hideLoadingScreen() {
        // Check if we're on mobile to use appropriate element ID
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        const loadingScreenId = isMobile ? 'mobile-loading-screen' : 'loading-screen'
        const loadingScreen = document.getElementById(loadingScreenId)
        
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out')
            setTimeout(() => {
                loadingScreen.style.display = 'none'
                // Show click to enter overlay after loading screen is hidden
                this.showClickToEnterOverlay()
            }, 500)
        }
    }
    
    showClickToEnterOverlay() {
        // Check if we're on mobile to use appropriate element ID
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        const overlayId = isMobile ? 'mobile-click-to-enter-overlay' : 'click-to-enter-overlay'
        const overlay = document.getElementById(overlayId)
        
        if (overlay) {
            overlay.classList.add('show')
            console.log('🎬 Click to enter overlay shown')
        }
    }
    
    hideClickToEnterOverlay() {
        // Check if we're on mobile to use appropriate element ID
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        const overlayId = isMobile ? 'mobile-click-to-enter-overlay' : 'click-to-enter-overlay'
        const overlay = document.getElementById(overlayId)
        
        if (overlay) {
            overlay.classList.remove('show')
            console.log('🎬 Click to enter overlay hidden')
        }
    }

    startSnoring() {
        // Try to start snoring with retry logic
        const tryStartSnoring = () => {
            if (this.audioManager && this.audioManager.sounds.has('snoring')) {
                console.log('🎵 Starting snoring sound...')
                this.audioManager.play('snoring')
            } else {
                console.log('⏳ Audio not ready yet, retrying in 500ms...')
                setTimeout(tryStartSnoring, 500)
            }
        }
        
        // Start trying immediately
        tryStartSnoring()
    }

    setupAudioControls() {
        // Check if we're on mobile to use appropriate element ID
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        const audioControlId = isMobile ? 'mobile-audio-control' : 'audio-control'
        const audioControl = document.getElementById(audioControlId)
        
        if (audioControl) {
            audioControl.addEventListener('click', () => {
                const isMuted = this.audioManager.toggleMute()
                audioControl.classList.toggle('muted', isMuted)
                audioControl.innerHTML = isMuted ? '🔇' : '🔊'
                audioControl.title = isMuted ? 'Unmute Audio' : 'Mute Audio'
            })
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

document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on mobile - use more reliable detection
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    console.log('🔍 Device detection:', {
        width: window.innerWidth,
        userAgent: navigator.userAgent,
        isMobile: isMobile
    })
    
    if (isMobile) {
        // Initialize mobile experience
        initMobileExperience()
        console.log('📱 Mobile experience initialized')
    } else {
        // Initialize desktop experience
        initHotspots()
        const gekLanding = new GEKLanding()
        console.log('🖥️ Desktop experience initialized')
        
        // Force start snoring after a short delay to ensure it plays
        setTimeout(() => {
            if (gekLanding.audioManager) {
                console.log('🚀 Force starting snoring...')
                gekLanding.startSnoring()
            }
        }, 1000)
    }
})
