import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TextPlugin } from 'gsap/TextPlugin'
import * as THREE from 'three'
import './style.css'

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, TextPlugin)

class GEKLanding {
    constructor() {
        this.init()
    }

    init() {
        this.setupThreeJS()
        this.setupAnimations()
        this.setupEventListeners()
        this.initMonitors()
    }

    setupThreeJS() {
        // Three.js setup for background effects
        const canvas = document.getElementById('three-canvas')
        if (!canvas) return

        this.scene = new THREE.Scene()
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
        
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

        // Create animated background
        this.createBackground()
        
        // Position camera
        this.camera.position.z = 5

        // Animation loop
        this.animate()
    }

    createBackground() {
        // Create particles for background effect
        const particlesGeometry = new THREE.BufferGeometry()
        const particlesCount = 1000
        const posArray = new Float32Array(particlesCount * 3)

        for (let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 20
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3))

        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.005,
            color: '#00ff88',
            transparent: true,
            opacity: 0.8
        })

        this.particles = new THREE.Points(particlesGeometry, particlesMaterial)
        this.scene.add(this.particles)
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this))

        if (this.particles) {
            this.particles.rotation.x += 0.001
            this.particles.rotation.y += 0.001
        }

        this.renderer.render(this.scene, this.camera)
    }

    setupAnimations() {
        // Hero section animations
        gsap.from('.hero-title .title-line', {
            duration: 1,
            y: 50,
            opacity: 0,
            ease: 'power3.out',
            delay: 0.5
        })

        gsap.from('.hero-title .title-main', {
            duration: 1.5,
            y: 100,
            opacity: 0,
            ease: 'power3.out',
            delay: 0.8
        })

        gsap.from('.hero-title .title-subtitle', {
            duration: 1,
            y: 50,
            opacity: 0,
            ease: 'power3.out',
            delay: 1.2
        })

        gsap.from('.hero-description', {
            duration: 1,
            y: 30,
            opacity: 0,
            ease: 'power3.out',
            delay: 1.5
        })

        gsap.from('.hero-buttons', {
            duration: 1,
            y: 30,
            opacity: 0,
            ease: 'power3.out',
            delay: 1.8
        })

        // Monitor animations
        gsap.from('.monitor', {
            duration: 1,
            scale: 0.8,
            opacity: 0,
            ease: 'power3.out',
            stagger: 0.1,
            scrollTrigger: {
                trigger: '.monitors-section',
                start: 'top 80%',
                end: 'bottom 20%',
                toggleActions: 'play none none reverse'
            }
        })

        // Contract section animation
        gsap.from('.contract-container', {
            duration: 1,
            y: 50,
            opacity: 0,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.contract-section',
                start: 'top 80%',
                end: 'bottom 20%',
                toggleActions: 'play none none reverse'
            }
        })
    }

    setupEventListeners() {
        // Monitor hover effects
        document.querySelectorAll('.monitor').forEach(monitor => {
            monitor.addEventListener('mouseenter', this.handleMonitorHover.bind(this))
            monitor.addEventListener('mouseleave', this.handleMonitorLeave.bind(this))
        })

        // Copy contract address
        const copyBtn = document.querySelector('.copy-btn')
        if (copyBtn) {
            copyBtn.addEventListener('click', this.copyContractAddress.bind(this))
        }

        // Window resize
        window.addEventListener('resize', this.handleResize.bind(this))
    }

    handleMonitorHover(e) {
        const monitor = e.currentTarget
        gsap.to(monitor, {
            duration: 0.3,
            scale: 1.05,
            ease: 'power2.out'
        })

        // Add glow effect
        monitor.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.5)'
    }

    handleMonitorLeave(e) {
        const monitor = e.currentTarget
        gsap.to(monitor, {
            duration: 0.3,
            scale: 1,
            ease: 'power2.out'
        })

        // Remove glow effect
        monitor.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.3)'
    }

    copyContractAddress() {
        const address = 'HodiZE88VH3SvRYYX2fE6zYE6SsxPn9xJUMUKW1Dg6A'
        navigator.clipboard.writeText(address).then(() => {
            const copyBtn = document.querySelector('.copy-btn')
            copyBtn.textContent = 'Copied!'
            setTimeout(() => {
                copyBtn.textContent = 'Copy'
            }, 2000)
        })
    }

    handleResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight
            this.camera.updateProjectionMatrix()
            this.renderer.setSize(window.innerWidth, window.innerHeight)
        }
    }

    initMonitors() {
        // Add initial glow effect to monitors
        document.querySelectorAll('.monitor').forEach(monitor => {
            monitor.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.3)'
        })

        // Animate dino characters
        gsap.to('.dino', {
            duration: 2,
            y: -10,
            ease: 'power2.inOut',
            stagger: 0.2,
            repeat: -1,
            yoyo: true
        })
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new GEKLanding()
})
