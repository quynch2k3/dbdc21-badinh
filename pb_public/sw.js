/**
 * SERVICE WORKER - TUNNEL STABILIZER V7.1
 * Tối ưu hóa cho Localhost.run và tránh lỗi EMPTY_RESPONSE
 */

const TUNNEL_PATTERNS = ['lhr.life', 'lhr.rocks', 'ngrok'];

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;
    
    // Chỉ xử lý các yêu cầu tới Tunnel
    const isTunnel = TUNNEL_PATTERNS.some(p => url.includes(p));
    if (!isTunnel) return;

    // Bỏ qua các yêu cầu Realtime (SSE) để tránh treo Tunnel
    const accept = e.request.headers.get('Accept') || '';
    if (accept.includes('text/event-stream') || url.includes('/api/realtime')) return;

    // Tự động xử lý Preflight (OPTIONS) để tránh lỗi CORS
    if (e.request.method === 'OPTIONS') {
        e.respondWith(new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Max-Age': '86400'
            }
        }));
        return;
    }

    // Chuyển tiếp các yêu cầu khác
    e.respondWith(
        fetch(e.request).catch(err => {
            return new Response(JSON.stringify({ error: 'Tunnel Connection Error', detail: err.message }), {
                status: 502,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        })
    );
});
