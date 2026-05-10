/**
 * MEDIA SYSTEM V2.2 - URL NGROK CỐ ĐỊNH
 */

window.MediaSystem = (function() {

    const NGROK_URL = 'https://playhouse-platypus-envision.ngrok-free.dev';
    const LOCAL_DOMAINS = ['localhost', '127.0.0.1'];

    function detectBackendUrl() {
        const h = window.location.hostname;
        if (LOCAL_DOMAINS.includes(h) || h.startsWith('192.168.') || h.startsWith('10.')) {
            return 'http://' + h + ':8090';
        }
        return NGROK_URL;
    }

    const BACKEND_URL = detectBackendUrl();

    function getFileUrl(record, filename) {
        if (!filename) return '';
        if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
        if (filename.startsWith('/api/')) return BACKEND_URL + filename;
        const collection = record?.collectionId || record?.collectionName || 'articles';
        const id = record?.id || '';
        return `${BACKEND_URL}/api/files/${collection}/${id}/${filename}`;
    }

    function getVideoUrl(record, videoField) {
        if (!videoField) return '';
        if (videoField.startsWith('http://') || videoField.startsWith('https://')) return videoField;
        if (videoField.startsWith('/api/video/serve/')) return BACKEND_URL + videoField;
        if (videoField.startsWith('/api/')) return BACKEND_URL + videoField;
        return `${BACKEND_URL}/api/video/serve/${videoField}`;
    }

    async function loadImage(imgEl, record, filename) {
        if (!imgEl || !filename) return;
        const url = getFileUrl(record, filename);
        try {
            const resp = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' }, mode: 'cors' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            imgEl.src = URL.createObjectURL(await resp.blob());
        } catch (e) {
            imgEl.src = url;
        }
    }

    function createVideoPlayer(record, videoField, posterField) {
        if (!videoField) return '';
        
        // Hỗ trợ lồng tiếng: "link_video.mp4 | link_audio.mp3"
        let vField = videoField;
        let aField = null;
        if (typeof videoField === 'string' && videoField.includes('|')) {
            const parts = videoField.split('|');
            vField = parts[0].trim();
            aField = parts[1].trim();
        }

        const videoUrl = getVideoUrl(record, vField);
        const audioUrl = aField ? getVideoUrl(record, aField) : null;
        
        let posterAttr = '';
        if (posterField) {
            const p = getFileUrl(record, posterField);
            if (p) posterAttr = ` poster="${p}"`;
        }
        let mime = 'video/mp4';
        if (videoUrl.includes('.webm')) mime = 'video/webm';
        else if (videoUrl.includes('.ogg')) mime = 'video/ogg';

        return `
            <div class="featured-video-section" style="position:relative;">
                <video controls preload="metadata"${posterAttr} playsinline
                    data-has-sync-audio="${audioUrl ? 'true' : 'false'}"
                    style="width:100%; max-height:480px; display:block; background:#000;"
                    crossorigin="anonymous"
                    onerror="MediaSystem.handleVideoError(this)">
                    <source src="${videoUrl}" type="${mime}">
                    <p style="color:#fff;padding:20px;text-align:center;">
                        Trình duyệt không hỗ trợ phát video.
                        <a href="${videoUrl}" target="_blank" style="color:#ffcc00;">Tải xuống để xem</a>
                    </p>
                </video>
                ${audioUrl ? `<audio class="sync-audio" src="${audioUrl}" preload="auto" crossorigin="anonymous" style="display:none;"></audio>` : ''}
                <div class="featured-video-label">
                    <i class="fa-solid fa-circle"></i> VIDEO ĐÍNH KÈM ${audioUrl ? '(ĐÃ LỒNG TIẾNG)' : ''}
                    <a href="${videoUrl}" download target="_blank"
                       style="margin-left:auto; color:#94a3b8; font-size:11px; text-decoration:none;">
                        <i class="fa-solid fa-download"></i> Tải xuống
                    </a>
                </div>
            </div>`;
    }

    // --- HỆ THỐNG ĐỒNG BỘ VIDEO VÀ AUDIO (MUXING) ---
    function initVideoAudioSync() {
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'VIDEO' && e.target.dataset.hasSyncAudio === 'true') {
                const audio = e.target.parentElement.querySelector('.sync-audio');
                if (audio) { audio.currentTime = e.target.currentTime; audio.play().catch(()=>{}); }
            }
        }, true);
        document.addEventListener('pause', (e) => {
            if (e.target.tagName === 'VIDEO' && e.target.dataset.hasSyncAudio === 'true') {
                const audio = e.target.parentElement.querySelector('.sync-audio');
                if (audio) audio.pause();
            }
        }, true);
        document.addEventListener('seeking', (e) => {
            if (e.target.tagName === 'VIDEO' && e.target.dataset.hasSyncAudio === 'true') {
                const audio = e.target.parentElement.querySelector('.sync-audio');
                if (audio) audio.currentTime = e.target.currentTime;
            }
        }, true);
        document.addEventListener('volumechange', (e) => {
            if (e.target.tagName === 'VIDEO' && e.target.dataset.hasSyncAudio === 'true') {
                const audio = e.target.parentElement.querySelector('.sync-audio');
                if (audio) { audio.volume = e.target.volume; audio.muted = e.target.muted; }
            }
        }, true);
        document.addEventListener('ratechange', (e) => {
            if (e.target.tagName === 'VIDEO' && e.target.dataset.hasSyncAudio === 'true') {
                const audio = e.target.parentElement.querySelector('.sync-audio');
                if (audio) audio.playbackRate = e.target.playbackRate;
            }
        }, true);
    }
    initVideoAudioSync();

    function handleVideoError(videoEl) {
        const src = videoEl.querySelector('source')?.src || videoEl.src;
        if (!src || src.startsWith('blob:')) return;
        fetch(src, { headers: { 'ngrok-skip-browser-warning': 'true' }, mode: 'cors' })
            .then(r => r.blob())
            .then(blob => { videoEl.src = URL.createObjectURL(blob); videoEl.load(); })
            .catch(() => {
                const p = videoEl.closest('.featured-video-section');
                if (p) p.innerHTML = `<div style="padding:20px;background:#1e293b;color:#94a3b8;text-align:center;border-radius:8px;">
                    <i class="fa-solid fa-video-slash" style="font-size:32px;display:block;margin-bottom:10px;"></i>
                    <p>Không thể phát video.</p>
                    <a href="${src}" target="_blank" download style="display:inline-block;margin-top:10px;padding:8px 20px;background:#ffcc00;color:#000;font-weight:bold;border-radius:4px;text-decoration:none;">
                        <i class="fa-solid fa-download"></i> Tải xuống để xem
                    </a></div>`;
            });
    }

    function handleImageError(imgEl) {
        const src = imgEl.src;
        if (!src || src.startsWith('blob:') || imgEl.dataset.retried) return;
        imgEl.dataset.retried = 'true';
        fetch(src, { headers: { 'ngrok-skip-browser-warning': 'true' }, mode: 'cors' })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.blob();
            })
            .then(blob => { imgEl.src = URL.createObjectURL(blob); })
            .catch(() => console.error('[MediaSystem] Không thể tải ảnh:', src));
    }

    function fixContentMedia(containerEl) {
        if (!containerEl) return;
        containerEl.querySelectorAll('video').forEach(video => {
            const srcEl = video.querySelector('source');
            const v = srcEl ? srcEl.getAttribute('src') : video.getAttribute('src');
            if (v && !v.startsWith('blob:') && !v.startsWith('http')) {
                const fixed = getVideoUrl(null, v);
                if (srcEl) srcEl.setAttribute('src', fixed);
                else video.setAttribute('src', fixed);
                video.load();
            }

            // Hỗ trợ lồng tiếng cho video nhúng trực tiếp trong bài
            const a = video.getAttribute('data-audio');
            if (a && !video.dataset.hasSyncAudio) {
                video.dataset.hasSyncAudio = 'true';
                const audioEl = document.createElement('audio');
                audioEl.className = 'sync-audio';
                audioEl.src = getVideoUrl(null, a);
                audioEl.style.display = 'none';
                audioEl.crossOrigin = 'anonymous';
                video.parentElement.insertBefore(audioEl, video.nextSibling);
            }
        });
        containerEl.querySelectorAll('img').forEach(img => {
            const s = img.getAttribute('src');
            if (s && s.startsWith('/api/')) img.src = BACKEND_URL + s;
            if (!img.hasAttribute('onerror')) img.setAttribute('onerror', 'MediaSystem.handleImageError(this)');
        });
    }

    console.log('[MediaSystem V2.2] Backend:', BACKEND_URL);

    return { BACKEND_URL, getFileUrl, getVideoUrl, loadImage, createVideoPlayer, handleVideoError, handleImageError, fixContentMedia };
})();

window.getMediaUrl = MediaSystem.getFileUrl.bind(MediaSystem);
window.getVideoUrl = MediaSystem.getVideoUrl.bind(MediaSystem);
