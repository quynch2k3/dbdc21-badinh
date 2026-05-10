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

async function addNgrokHeader(originalRequest) {
    const urlObj = new URL(originalRequest.url);
    if (!urlObj.searchParams.has('ngrok-skip-browser-warning')) {
        urlObj.searchParams.set('ngrok-skip-browser-warning', 'true');
    }

    const headers = new Headers(originalRequest.headers);
    // headers.set('ngrok-skip-browser-warning', 'true'); // Đã có query param, bỏ header để tránh preflight

    try {
        const fetchOptions = {
            method: originalRequest.method,
            headers: headers,
            mode: 'cors',
            credentials: 'omit',
            redirect: 'follow'
        };

        if (originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD') {
            fetchOptions.body = await originalRequest.clone().arrayBuffer();
        }

        const response = await fetch(urlObj.toString(), fetchOptions);
        return response;
    } catch (err) {
        console.error('[SW V6] Fetch critical error:', err);
        
        // TRẢ VỀ PHẢN HỒI CÓ CORS HEADER ĐỂ TRÌNH DUYỆT KHÔNG BÁO LỖI CORS GIẢ
        return new Response(JSON.stringify({ 
            code: 503, 
            message: 'Service Worker Bridge Error: ' + err.message,
            tip: 'Vui lòng kiểm tra ngrok và server đang chạy.'
        }), {
            status: 503,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }
}
