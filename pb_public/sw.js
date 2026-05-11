/**
 * SERVICE WORKER - TUNNEL STABILIZER V7.2 (FINAL FIX)
 * Tự động chèn CORS Header để vượt qua rào cản bảo mật của trình duyệt
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
    const isTunnel = TUNNEL_PATTERNS.some(p => url.includes(p));
    
    if (!isTunnel) return;

    // Bỏ qua SSE Realtime để tránh treo
    if (url.includes('/api/realtime')) return;

    // Xử lý Preflight (OPTIONS)
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

    // Xử lý các request khác và TỰ CHÈN CORS
    e.respondWith(
        fetch(e.request).then(response => {
            // Tạo một bản sao của response để có thể sửa đổi header
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
            newHeaders.set('Access-Control-Allow-Headers', '*');

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });
        }).catch(err => {
            return new Response(JSON.stringify({ error: 'Connection Failed', detail: err.message }), {
                status: 502,
                headers: { 
                    'Content-Type': 'application/json', 
                    'Access-Control-Allow-Origin': '*' 
                }
            });
        })
    );
});
