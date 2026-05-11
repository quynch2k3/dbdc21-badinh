/**
 * SERVICE WORKER - TUNNEL STABILIZER V7.0
 * 
 * Nhiệm vụ: Xử lý CORS và ổn định kết nối cho Tunnel (Localhost.run / ngrok).
 */

const TUNNEL_PATTERNS = ['lhr.life', 'lhr.rocks', 'ngrok-free.dev', 'ngrok.io'];

self.addEventListener('install', (e) => {
    console.log('[SW V7] Installing Tunnel Stabilizer...');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[SW V7] Activated.');
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;
    const isTunnel = TUNNEL_PATTERNS.some(p => url.includes(p));
    if (!isTunnel) return;

    // Don't intercept SSE/EventSource
    const accept = e.request.headers.get('Accept') || '';
    if (accept.includes('text/event-stream')) return;

    e.respondWith(stabilizeTunnelRequest(e.request));
});

async function stabilizeTunnelRequest(originalRequest) {
    // Tự động trả lời OPTIONS preflight để tăng tốc độ và tránh lỗi CORS browser
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

    try {
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

        return await fetch(originalRequest.url, fetchOptions);
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 503,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
    }
}
