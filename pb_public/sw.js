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

    // Chỉ thêm bypass query param
    if (!urlObj.searchParams.has('ngrok-skip-browser-warning')) {
        urlObj.searchParams.set('ngrok-skip-browser-warning', 'true');
    }

    try {
        // KỸ THUẬT PHÁ BĂNG: Nếu chưa "warm up" origin này, thực hiện một fetch no-cors để lấy cookie
        if (!warmedUpUrls.has(originUrl)) {
            console.log('[SW V6] Warming up ngrok tunnel:', originUrl);
            await fetch(urlObj.toString(), { mode: 'no-cors', cache: 'no-cache' });
            warmedUpUrls.add(originUrl);
        }

        // Thực hiện request thật
        const fetchOptions = {
            method: originalRequest.method,
            headers: new Headers(originalRequest.headers),
            mode: 'cors',
            credentials: 'omit', // Ngrok free không hỗ trợ credentials
            redirect: 'follow'
        };

        if (originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD') {
            fetchOptions.body = await originalRequest.clone().arrayBuffer();
        }

        const response = await fetch(urlObj.toString(), fetchOptions);
        
        // Nếu vẫn gặp 503 hoặc 403 từ ngrok, thử lại một lần nữa với chế độ xóa cache
        if (response.status === 503 || response.status === 403) {
            console.warn('[SW V6] Ngrok blocked (503/403), retrying with bypass...');
            return await fetch(urlObj.toString(), fetchOptions);
        }

        return response;
    } catch (err) {
        console.error('[SW V6] Critical Fetch Error:', err);
        return new Response(JSON.stringify({ 
            code: 503, 
            message: 'Bridge Error: ' + err.message 
        }), {
            status: 503,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': '*'
            }
        });
    }
}
