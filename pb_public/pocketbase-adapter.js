/**
 * POCKETBASE REAL ADAPTER V1.53
 * - pb được khởi tạo NGAY LẬP TỨC (không chờ SW)
 * - SW đăng ký song song ở background
 * - PBReady được dispatch ngay sau khi pb sẵn sàng
 */

window.GovSecure = {
    _rand: () => Math.random().toString(36).substring(2, 6).toUpperCase(),
    encodeToken: function(id, cat) {
        return btoa(`${this._rand()}${id}${this._rand()}${cat}${this._rand()}`).replace(/=/g, '');
    },
    decodeToken: function(token) {
        try {
            let b64 = token;
            while (b64.length % 4 !== 0) b64 += '=';
            const s = atob(b64);
            return { id: s.substring(4, 19), cat: s.substring(23, s.length - 4), valid: true };
        } catch(e) { return null; }
    }
};

// ============================================================
// BƯỚC 1: Khởi tạo PocketBase NGAY (synchronous)
// Không chờ SW — trang public cần pb ngay khi DOMContentLoaded
// ============================================================
(function initPBNow() {
    if (typeof PocketBase === 'undefined') {
        console.error('[PB Adapter] PocketBase SDK MISSING!');
        return;
    }

    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const backendUrl = (typeof MediaSystem !== 'undefined' && MediaSystem.BACKEND_URL)
        ? MediaSystem.BACKEND_URL
        : (isLocal ? 'http://localhost:8090' : 'https://dbb3aa4084068b.lhr.life');

    window.pb = new PocketBase(backendUrl);

    window.pb.beforeSend = function(url, options) {
        return { url, options };
    };

    window.pb.createSecureId  = id => "SECURE_" + id;
    window.pb.parseSecureId   = id => id ? id.replace("SECURE_", "") : id;
    window.pb.normalizeMember = r  => r;

    window.pb.getFileUrlCustom = function(record, filename) {
        if (!filename) return "";
        if (filename.startsWith('http')) return filename;
        const col = record.collectionId || record.collectionName || 'articles';
        let url = `${backendUrl}/api/files/${col}/${record.id}/${filename}`;
        return url;
    };

    window.pb.loadSecureImage = async function(imgEl, record, filename) {
        if (!filename || !imgEl) return;
        if (filename.startsWith('http')) { imgEl.src = filename; return; }
        const url = window.pb.getFileUrlCustom(record, filename);
        try {
            // KHÔNG dùng custom header ở đây để tránh preflight
            const r = await fetch(url);
            imgEl.src = r.ok ? URL.createObjectURL(await r.blob()) : url;
        } catch(e) { imgEl.src = url; }
    };

    window.pb.auth = function() {
        return {
            onAuthStateChanged: function(cb) {
                setTimeout(() => cb(pb.authStore.isValid ? pb.authStore.model : null), 50);
                pb.authStore.onChange((t, m) => cb(m));
            },
            signInWithEmailAndPassword: async function(email, pass) {
                try { return await pb.admins.authWithPassword(email, pass); }
                catch(e) { return await pb.collection('users').authWithPassword(email, pass); }
            },
            signOut: async function() { pb.authStore.clear(); }
        };
    };

    console.log('[PB Adapter] Connected to PocketBase at:', backendUrl);

    // pb sẵn sàng — dispatch PBReady ngay
    // --- CHỐT CHẶN SERVICE WORKER ---
    async function waitForServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.active && navigator.serviceWorker.controller) {
            return; // Đã sẵn sàng
        }

        console.log('[PB Adapter] Waiting for Service Worker to take control...');
        return new Promise((resolve) => {
            let resolved = false;
            const done = () => { if(!resolved) { resolved = true; resolve(); } };

            navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
            
            // Timeout sau 1.5 giây để tránh treo trang nếu SW không thể chiếm quyền ngay
            setTimeout(done, 1500);
        });
    }

    // Middleware xử lý request
    pb.beforeSend = async (url, options) => {
        // Đợi SW sẵn sàng để xử lý CORS
        await waitForServiceWorker();
        return { url, options };
    };

    // Khởi động SW
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js?v=V7')
                .then(reg => {
                    console.log('[PB Adapter] SW Registered.');
                    // Ép SW chiếm quyền kiểm tra ngay lập tức
                    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                });
        });
    }
    
    window.dispatchEvent(new Event('PBReady'));
})();

// ============================================================
// BƯỚC 3: Real-time subscriptions
// ============================================================
window.addEventListener('load', () => {
    if (typeof pb === 'undefined') return;
    try {
        pb.collection('articles').subscribe('*', () => {
            if (typeof loadNews !== 'function') return;
            const p = parseInt(new URLSearchParams(location.search).get('page')) || 1;
            if (document.getElementById('qt-homepage-news')) loadNews('TRANG_CHU', 'qt-homepage-news', 8, p);
            ['news-cb','news-mt','news-phunu','news-tn','news-ccb','news-nct'].forEach(id => {
                if (!document.getElementById(id)) return;
                const m = {'news-cb':'CB','news-mt':'MT','news-phunu':'PHU_NU','news-tn':'TN','news-ccb':'CCB','news-nct':'NCT'};
                loadNews(m[id], id, 4, 1, true);
            });
        });
        pb.collection('feedback').subscribe('*', () => {
            if (typeof loadFeedback === 'function') loadFeedback();
        });
    } catch(e) { /* silent */ }
});
