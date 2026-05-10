/**
 * PREMIUM VIDEO PLAYER LOGIC
 * Handles playback, progress, and custom UI interactions.
 */

class PremiumPlayer {
    constructor(container) {
        this.container = container;
        this.video = container.querySelector('video');
        this.playOverlay = container.querySelector('.premium-play-overlay');
        this.playBtn = container.querySelector('.play-pause-btn');
        this.progress = container.querySelector('.premium-progress-filled');
        this.progressContainer = container.querySelector('.premium-progress-container');
        this.timeDisplay = container.querySelector('.premium-time');
        this.fullscreenBtn = container.querySelector('.premium-fullscreen-btn');

        this.init();
    }

    init() {
        // Toggle play/pause on click
        this.container.onclick = (e) => {
            if (e.target.closest('.premium-controls')) return;
            this.togglePlay();
        };

        this.playBtn.onclick = () => this.togglePlay();

        // Update progress bar
        this.video.ontimeupdate = () => this.updateProgress();

        // Seek on progress bar click
        this.progressContainer.onclick = (e) => {
            const rect = this.progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            this.video.currentTime = pos * this.video.duration;
        };

        // Fullscreen
        this.fullscreenBtn.onclick = () => this.toggleFullscreen();

        // Listen for video events to update UI classes
        this.video.onplay = () => {
            this.container.classList.add('is-playing');
            this.container.classList.remove('is-paused', 'is-buffering');
            this.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        };

        this.video.onpause = () => {
            this.container.classList.remove('is-playing');
            this.container.classList.add('is-paused');
            this.playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        };

        this.video.onwaiting = () => {
            this.container.classList.add('is-buffering');
        };

        this.video.oncanplay = () => {
            this.container.classList.remove('is-buffering');
        };

        this.video.onended = () => {
            this.container.classList.remove('is-playing');
            this.container.classList.add('is-paused');
        };
    }

    togglePlay() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    updateProgress() {
        const percent = (this.video.currentTime / this.video.duration) * 100;
        this.progress.style.width = `${percent}%`;

        // Update time display
        const current = this.formatTime(this.video.currentTime);
        const duration = this.formatTime(this.video.duration || 0);
        this.timeDisplay.textContent = `${current} / ${duration}`;
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        
        const parts = [];
        if (h > 0) parts.push(h);
        parts.push(m.toString().padStart(2, '0'));
        parts.push(s.toString().padStart(2, '0'));
        
        return parts.join(':');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            if (this.container.requestFullscreen) {
                this.container.requestFullscreen();
            } else if (this.container.webkitRequestFullscreen) {
                this.container.webkitRequestFullscreen();
            } else if (this.container.msRequestFullscreen) {
                this.container.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    // Global initialization helper
    static initAll(selector = '.art-content-body video, .premium-target-video') {
        document.querySelectorAll(selector).forEach(video => {
            PremiumPlayer.convert(video);
        });
    }

    static convert(video, options = {}) {
        if (video.closest('.premium-video-wrapper')) return;
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'premium-video-wrapper is-paused';
        
        // Poster handling
        if (video.hasAttribute('poster')) {
            wrapper.style.backgroundImage = `url(${video.getAttribute('poster')})`;
            wrapper.style.backgroundSize = 'cover';
            wrapper.style.backgroundPosition = 'center';
        }

        // Move video into wrapper
        video.parentNode.insertBefore(wrapper, video);
        wrapper.appendChild(video);
        video.controls = false; // Hide native controls
        video.removeAttribute('controls');

        // Add Logo Overlay if provided in options or branding
        const logo = options.logo || (window.SharedUI ? SharedUI.getBranding().logo : null);
        if (logo) {
            const logoOverlay = document.createElement('div');
            logoOverlay.className = 'premium-logo-overlay';
            logoOverlay.innerHTML = `<img src="${logo}" alt="Logo">`;
            wrapper.appendChild(logoOverlay);
        }

        // Add Play Overlay
        const playOverlay = document.createElement('div');
        playOverlay.className = 'premium-play-overlay';
        playOverlay.innerHTML = `<div class="premium-play-btn"><i class="fa-solid fa-play"></i></div>`;
        wrapper.appendChild(playOverlay);

        // Add Controls
        const controls = document.createElement('div');
        controls.className = 'premium-controls';
        controls.innerHTML = `
            <button class="premium-control-btn play-pause-btn"><i class="fa-solid fa-play"></i></button>
            <div class="premium-progress-container"><div class="premium-progress-filled"></div></div>
            <div class="premium-time">00:00 / 00:00</div>
            <button class="premium-control-btn premium-fullscreen-btn"><i class="fa-solid fa-expand"></i></button>
        `;
        wrapper.appendChild(controls);

        const player = new PremiumPlayer(wrapper);
        wrapper.premiumPlayer = player;
        return player;
    }
}

// Auto-run if script is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PremiumPlayer.initAll());
} else {
    setTimeout(() => PremiumPlayer.initAll(), 500);
}

window.initPremiumPlayers = () => PremiumPlayer.initAll();
