/**
 * SERVICE WORKER - NGROK BYPASS V6.0 (SIMPLIFIED)
 * 
 * Nhiệm vụ: Thêm header 'ngrok-skip-browser-warning' vào tất cả
 * requests tới ngrok để tránh trang interstitial.
 * 
 * CORS đã được xử lý từ phía ngrok (response-header-add trong ngrok.yml).
 * SW chỉ cần thêm header ngrok bypass vào request — không cần inject CORS nữa.
 */

const NGROK_PATTERNS = ['ngrok-free.app', 'ngrok-free.dev', 'ngrok.io', 'ngrok.app'];

self.addEventListener('install', (e) => {
    console.log('[SW V6] Installing Ngrok Bypass...');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[SW V6] Activated.');
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;
    const isNgrok = NGROK_PATTERNS.some(p => url.includes(p));
    if (!isNgrok) return;

    // Don't intercept SSE/EventSource
    const accept = e.request.headers.get('Accept') || '';
    if (accept.includes('text/event-stream')) return;

    e.respondWith(addNgrokHeader(e.request));
});

// Bộ nhớ tạm để tránh "phá băng" quá nhiều lần
const warmedUpUrls = new Set();

async function addNgrokHeader(originalRequest) {
    const urlObj = new URL(originalRequest.url);
    const originUrl = urlObj.origin;

    // --- VŨ KHÍ CUỐI CÙNG: GIẢ LẬP OPTIONS ---
    // Nếu trình duyệt hỏi "Mày có cho phép truy cập không?" (OPTIONS), 
    // Service Worker tự trả lời "CÓ" luôn mà không cần gửi tới Ngrok.
    if (originalRequest.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    // Chỉ thêm bypass query param cho các request thật
    if (!urlObj.searchParams.has('ngrok-skip-browser-warning')) {
        urlObj.searchParams.set('ngrok-skip-browser-warning', 'true');
    }

    try {
        // Khởi tạo kết nối ban đầu để lấy Cookie (no-cors)
        if (!warmedUpUrls.has(originUrl)) {
            await fetch(urlObj.toString(), { mode: 'no-cors', cache: 'no-cache' }).catch(() => {});
            warmedUpUrls.add(originUrl);
        }

        const fetchOptions = {
            method: originalRequest.method,
            headers: new Headers(originalRequest.headers),
            mode: 'cors',
            credentials: 'omit',
            redirect: 'follow'
        };

        if (originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD') {
            fetchOptions.body = await originalRequest.clone().arrayBuffer();
        }

        return await fetch(urlObj.toString(), fetchOptions);
    } catch (err) {
        // Fallback CORS response
        return new Response(JSON.stringify({ error: err.message }), {
            status: 503,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
    }
}
