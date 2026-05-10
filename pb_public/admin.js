/**
 * ADMIN LOGIC - RETRO EDITION (V2)
 * Fully functional editor and persistence logic.
 */

// --- GLOBAL STATE ---
window.allArticles = [];
window.allPages = [];
window.allUsers = null;
let editorInstance = null;

// Pagination & Filter State
let articleCurrentPage = 1;
let articlePerPage = 10;
let articleSearchQuery = "";
let articleCategoryFilter = "ALL";
let articleSelectedIds = new Set();
let accountSelectedIds = new Set();
let currentOrgContext = ""; // Tracks the currently viewed organization
let articleTotalPages = 1;
let accountRefreshTimer = null; // Timer for debouncing real-time updates

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin System Initializing... [Version V1.38 - ADDED VERSION LOG]");
    initEditor();

    // FIX V1.51: pb may be set async — wait for PBReady if not yet available
    const startAdminAuth = () => {
        if (typeof pb === 'undefined') return; // Safety guard

        const checkAuth = () => {
            if (pb.authStore.isValid) {
                const user = pb.authStore.model;

                // --- BẢO VỆ CẤP CAO: Chặn nếu chưa duyệt ---
                // (Admin của PocketBase không có trường .approved nên sẽ bỏ qua)
                if (user && user.collectionName === 'users' && !user.approved) {
                    console.error("Access Denied: Account not approved.");
                    pb.authStore.clear();
                    window.location.href = 'dang-nhap.html?status=pending';
                    return;
                }

                const loadingScreen = document.getElementById('loading-screen');
                const adminLayout = document.getElementById('admin-layout');
                if (loadingScreen) loadingScreen.style.display = 'none';
                if (adminLayout) adminLayout.style.display = 'flex';
                onLoginSuccess(user);
            } else {
                window.location.href = 'dang-nhap.html';
            }
        };
        checkAuth();
        pb.authStore.onChange(() => checkAuth());
    };

    // If pb is already available (adapter loaded synchronously), start immediately
    // Otherwise wait for the PBReady event dispatched by pocketbase-adapter.js
    if (typeof pb !== 'undefined') {
        startAdminAuth();
    } else {
        window.addEventListener('PBReady', startAdminAuth, { once: true });
    }
});

function onLoginSuccess(user) {
    const welcomeEl = document.getElementById('admin-welcome');
    if (welcomeEl) {
        // Safe identity detection (V1.26)
        const identity = user ? (user.name || user.email || 'Quản trị viên') : 'Quản trị viên';
        welcomeEl.innerText = `Xin chào, ${identity.toUpperCase()}`;
    }
    loadAllData();
    loadAccounts();

    // --- REAL-TIME UPDATES (ENABLED V1.40) ---
    if (typeof pb !== 'undefined') {
        console.log("Real-time updates active.");
        
        // Theo dõi thay đổi tài khoản
        pb.collection('users').subscribe('*', (e) => {
            console.log("Real-time update: users", e.action);
            
            // Chống nháy trang và lỗi autocancel khi tạo hàng loạt
            if (accountRefreshTimer) clearTimeout(accountRefreshTimer);
            accountRefreshTimer = setTimeout(() => {
                loadAccounts();
            }, 500); // Đợi 0.5s sau thay đổi cuối cùng mới load lại
        });

        // Theo dõi bài viết
        pb.collection('articles').subscribe('*', (e) => {
            console.log("Real-time update: articles", e.action);
            loadAllData();
        });

        // Theo dõi ý kiến phản hồi
        pb.collection('feedback').subscribe('*', (e) => {
            console.log("Real-time update: feedback", e.action);
            loadFeedback();
        });
    }

    // Listen for changes from other tabs
    window.addEventListener('storage', (e) => {
        if (e.key === 'pb_emulator_data_v1') {
            console.log("Storage Change Detected: Syncing UI...");
            loadAllData();
        }
    });
}

function logout() {
    if (confirm("Xác nhận đăng xuất khỏi hệ thống?")) {
        // Unsubscribe before logout
        try { pb.collection('articles').unsubscribe(); } catch (e) { }
        try { pb.collection('pages').unsubscribe(); } catch (e) { }
        try { pb.collection('feedback').unsubscribe(); } catch (e) { }
        try { pb.collection('users').unsubscribe(); } catch (e) { }

        try {
            pb.authStore.clear(); // Call the standard PB clear
        } catch (e) { }

        pb.auth().signOut().then(() => {
            // Xóa local storage thủ công để chắc chắn
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "dang-nhap.html";
        }).catch(() => {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "dang-nhap.html";
        });
    }
}

// --- DATA LOADING ---
async function loadAllData() {
    // Run initial loads and wait for them
    await Promise.all([
        loadArticles(),
        loadPages(),
        loadSettings(),
        loadFeedback()
    ]);
    updateDashboardStats();

    // Initial route
    initHashRoute();

    // Reactive routing: When URL changes, update UI
    window.addEventListener('hashchange', () => {
        initHashRoute();
    });
}

function initHashRoute() {
    const hash = window.location.hash.substring(1) || 'dashboard';

    // Close editor if not in an edit route
    if (!hash.startsWith('articles-edit') && !hash.startsWith('articles-new')) {
        const modal = document.getElementById('article-modal');
        if (modal) modal.style.display = 'none';
    }

    if (hash === 'articles-new') {
        switchView('view-articles');
        openEditor();
        return;
    }

    if (hash.startsWith('articles-edit-')) {
        const id = hash.replace('articles-edit-', '');
        switchView('view-articles');
        openEditor(id);
        return;
    }

    // Handle accounts root view (show folder view)
    if (hash === 'accounts') {
        switchView('view-accounts');
        if (window.allUsers && window.allUsers.length > 0) {
            renderFolderView(window.allUsers);
        } else {
            loadAccounts(); // Load if missing
        }
        return;
    }

    // Handle accounts folder navigation
    if (hash.startsWith('accounts-folder-')) {
        const folderName = decodeURIComponent(hash.replace('accounts-folder-', ''));
        switchView('view-accounts');
        renderEmployeeList(folderName);
        return;
    }

    const viewId = `view-${hash}`;
    const viewEl = document.getElementById(viewId);
    if (viewEl) {
        switchView(viewId);
    } else {
        switchView('view-dashboard');
    }
}



async function loadPages() {
    try {
        const records = await pb.collection('pages').getFullList({ sort: 'order' });
        window.allPages = records;
        renderPages(records);
    } catch (e) {
        console.error("Load Pages Error:", e);
    }
}

async function loadFeedback() {
    try {
        const records = await pb.collection('feedback').getFullList({ sort: '-created' });
        const tbody = document.getElementById('feedback-list');
        const info = document.getElementById('feedback-pagination-info');
        if (!tbody) return;

        if (info) info.innerText = `Tổng số: ${records.length} ý kiến`;

        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Chưa có ý kiến phản hồi nào.</td></tr>';
            return;
        }

        tbody.innerHTML = records.map(item => {
            const isDone = item.status === 'DONE' || item.status === 'COMPLETED';
            const statusClass = isDone ? 'badge-success' : 'badge-warning';
            const statusText = isDone ? 'Đã phản hồi' : 'Chờ xử lý';

            return `
                <tr>
                    <td style="white-space: nowrap; font-size: 13px; color: #64748b;">${new Date(item.created).toLocaleDateString('vi-VN')}</td>
                    <td style="min-width: 150px;">
                        <strong style="color: #1e3a8a;">${item.name}</strong><br>
                        <small style="color: #64748b;"><i class="fa-solid fa-phone"></i> ${item.contact || item.email || ''}</small>
                    </td>
                    <td style="text-align: justify; padding: 12px; font-size: 14px;">
                        ${item.content || item.message || ''}
                        ${item.response ? `<div style="margin-top: 10px; padding: 8px; background: #f0fdf4; border-left: 3px solid #22c55e; font-size: 13px; color: #166534;"><b>BQT:</b> ${item.response}</div>` : ''}
                        ${item.citizen_reply ? `<div style="margin-top: 5px; padding: 8px; background: #fffbeb; border-left: 3px solid #f59e0b; font-size: 13px; color: #92400e;"><b>Dân:</b> ${item.citizen_reply}</div>` : ''}
                    </td>
                    <td style="text-align: center;"><span class="badge ${statusClass}" style="padding: 5px 10px;">${statusText}</span></td>
                    <td style="text-align:right; white-space: nowrap;">
                        <button class="btn btn-primary btn-sm" onclick="openFeedbackResponse('${item.id}')" title="Phản hồi ý kiến" style="margin-right:5px;"><i class="fa-solid fa-reply"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="deleteItem('feedback', '${item.id}')" title="Xóa"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error("Load Feedback Error:", e);
    }
}

async function openFeedbackResponse(id) {
    const item = (await pb.collection('feedback').getFullList()).find(i => i.id === id);
    if (!item) return;

    document.getElementById('fb-res-id').value = id;
    document.getElementById('fb-original-content').innerText = item.content || item.message || '';
    document.getElementById('fb-res-content').value = item.response || '';
    document.getElementById('feedback-modal').style.display = 'block';
}

async function submitFeedbackResponse() {
    const id = document.getElementById('fb-res-id').value;
    const response = document.getElementById('fb-res-content').value.trim();

    if (!response) {
        showStatusModal("Lưu ý", "Vui lòng nhập nội dung phản hồi!", "error");
        return;
    }

    try {
        await pb.collection('feedback').update(id, {
            response: response,
            status: 'DONE'
        });
        showStatusModal("Thành công", "Đã gửi phản hồi chính thức tới công dân!", "success");
        closeModal('feedback-modal');
        loadFeedback();
    } catch (e) {
        showStatusModal("Lỗi", "Không thể gửi phản hồi: " + e.message, "error");
    }
}

// --- RENDERERS ---
function renderArticles(data) {
    const tbody = document.getElementById('article-list');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #64748b;">Không tìm thấy bài viết nào phù hợp.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(item => {
        const date = new Date(item.publish_date || item.created).toLocaleDateString('vi-VN');
        const statusClass = item.status === 'draft' ? 'status-draft' : 'status-active';
        const statusText = item.status === 'draft' ? 'Bản nháp' : 'Công khai';
        const isChecked = articleSelectedIds.has(item.id);
        const imgId = `img-thumb-${item.id}`;

        // TẢI ẢNH BẢO MẬT (FIX TRIỆT ĐỂ)
        setTimeout(async () => {
            const imgEl = document.getElementById(imgId);
            if (!imgEl) return;

            if (item.image && item.image.startsWith('http')) {
                imgEl.src = item.image;
            } else if (item.image) {
                // Sử dụng hàm đặc biệt để vượt qua Ngrok
                try {
                    const url = pb.getFileUrlCustom(item, item.image);
                    const response = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                    if (response.ok) {
                        const blob = await response.blob();
                        imgEl.src = URL.createObjectURL(blob);
                    } else {
                        imgEl.src = url;
                    }
                } catch (e) {
                    imgEl.src = pb.getFileUrlCustom(item, item.image);
                }
            } else {
                imgEl.src = 'https://placehold.co/120x80?text=No+Image';
            }
        }, 50);

        return `
            <tr class="${isChecked ? 'row-selected' : ''}" onclick="if(event.target.type !== 'checkbox' && !event.target.closest('.btn-action')) toggleRowSelection('${item.id}')">
                <td><input type="checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''} onchange="toggleRowSelection('${item.id}')"></td>
                <td>
                    <div class="article-info">
                        <img id="${imgId}" class="article-thumb" src="https://placehold.co/120x80?text=..." alt="thumb">
                        <div class="article-title">${item.title}</div>
                    </div>
                </td>
                <td style="color: #64748b; font-size: 13px;">${date}</td>
                <td><span style="color: #475569; font-weight: 600; font-size: 12px;">${item.category || 'TIN_TUC'}</span></td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="action-cell" style="text-align: right;">
                    <button class="btn-action btn-edit" title="Chỉnh sửa" onclick="window.location.hash='articles-edit-${item.id}'">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-action btn-delete" title="Xóa" onclick="deleteItem('articles', '${item.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    updateBulkBar();
}

function renderPages(data) {
    const tbody = document.getElementById('page-list');
    if (!tbody) return;
    tbody.innerHTML = data.map(item => `
        <tr>
            <td><code>/${item.slug}</code></td>
            <td><strong>${item.title}</strong></td>
            <td>${item.order || 0}</td>
            <td>${item.menu ? 'Có' : 'Không'}</td>
            <td style="text-align:right;">
                <button class="btn btn-secondary btn-sm" onclick="openPageEditor('${item.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem('pages', '${item.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderDashboardNews(data) {
    const tbody = document.getElementById('dashboard-recent-news');
    if (!tbody) return;
    const recent = data.slice(0, 8);
    tbody.innerHTML = recent.map(item => `
        <tr>
            <td style="padding: 12px 15px;">
                <div style="font-weight: bold; color: #1e3a8a; font-size: 13.5px;">${item.title}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;"><i class="fa-solid fa-user"></i> ${item.author || 'Quản trị viên'}</div>
            </td>
            <td style="color: #64748b; font-size: 13px;">${new Date(item.publish_date || item.created).toLocaleDateString('vi-VN')}</td>
            <td><span class="badge badge-primary" style="font-size: 10px;">${item.category || 'Tin tức'}</span></td>
            <td><span class="status-badge ${item.status === 'draft' ? 'status-draft' : 'status-active'}">${item.status === 'draft' ? 'Bản nháp' : 'Công khai'}</span></td>
        </tr>
    `).join('');
}

function renderDashboardFeedback(data) {
    const container = document.getElementById('dashboard-recent-feedback');
    if (!container) return;

    const recent = data.slice(0, 4);
    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748b;">Chưa có phản hồi nào.</div>';
        return;
    }

    container.innerHTML = recent.map(item => {
        const isDone = item.status === 'DONE' || item.status === 'COMPLETED';
        return `
            <div style="padding: 15px; border-bottom: 1px solid #f1f5f9; position: relative; transition: 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong style="color: #1e3a8a; font-size: 13px;">${item.name}</strong>
                    <span style="font-size: 11px; color: #94a3b8;">${new Date(item.created).toLocaleDateString('vi-VN')}</span>
                </div>
                <div style="font-size: 12.5px; color: #475569; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; font-style: italic;">
                    "${item.content || item.message || ''}"
                </div>
                <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
                    <span class="badge ${isDone ? 'badge-success' : 'badge-warning'}" style="font-size: 9px; padding: 2px 8px;">
                        ${isDone ? 'Đã phản hồi' : 'Chờ xử lý'}
                    </span>
                    <button class="btn btn-sm btn-outline-primary" style="padding: 2px 8px; font-size: 10px;" onclick="switchView('view-feedback'); setTimeout(() => openFeedbackResponse('${item.id}'), 100)">
                        Phản hồi
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function updateDashboardStats() {
    // Lấy tổng số bài viết toàn hệ thống (không bị giới hạn phân trang)
    try {
        const articlesResult = await pb.collection('articles').getList(1, 1, { requestKey: null });
        console.log("Dashboard Stats - Total Articles:", articlesResult.totalItems);
        if (document.getElementById('stat-articles-new')) {
            document.getElementById('stat-articles-new').innerText = articlesResult.totalItems;
        }
    } catch (e) {
        console.warn("Failed to load articles count:", e.message);
    }

    // Fetch total profiles count (from users collection)
    try {
        const usersResult = await pb.collection('users').getList(1, 1, { requestKey: null });
        if (document.getElementById('stat-members-new')) {
            document.getElementById('stat-members-new').innerText = usersResult.totalItems;
        }
    } catch (e) {
        console.warn("Failed to load members count:", e.message);
    }

    // Fetch Feedback pending count
    try {
        const feedback = await pb.collection('feedback').getFullList({
            filter: 'status != "DONE" && status != "COMPLETED"',
            requestKey: null
        });
        if (document.getElementById('stat-feedback-new')) {
            document.getElementById('stat-feedback-new').innerText = feedback.length;
        }

        // Also load recent feedback for the dashboard
        const allFeedback = await pb.collection('feedback').getList(1, 10, { sort: '-created', requestKey: null });
        renderDashboardFeedback(allFeedback.items);
    } catch (e) {
        console.warn("Failed to load feedback:", e.message);
        const fbContainer = document.getElementById('dashboard-recent-feedback');
        if (fbContainer) fbContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc2626;">Lỗi tải dữ liệu phản hồi.</div>';
    }

    // Fetch Pending Accounts count
    try {
        const pendingUsers = await pb.collection('users').getList(1, 1, {
            filter: 'approved = false',
            requestKey: null
        });
        if (document.getElementById('stat-pending-accounts')) {
            document.getElementById('stat-pending-accounts').innerText = pendingUsers.totalItems;
        }
    } catch (e) {
        console.warn("Failed to load pending accounts:", e.message);
    }

    // Update Date/Time
    updateDashboardDateTime();
}

function updateDashboardDateTime() {
    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dateStr = `${days[now.getDay()]}, ${now.toLocaleDateString('vi-VN')}`;
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const dateEl = document.getElementById('current-date-vn');
    const timeEl = document.getElementById('current-time-vn');

    if (dateEl) dateEl.innerText = dateStr;
    if (timeEl) timeEl.innerText = timeStr;
}

// Update time every minute
setInterval(updateDashboardDateTime, 60000);

// --- SETTINGS ---
async function loadSettings() {
    try {
        const data = await pb.collection('settings').getOne('general');
        if (data) {
            if (document.getElementById('set-website_title')) document.getElementById('set-website_title').value = data.website_title || '';
            if (document.getElementById('set-website_desc')) document.getElementById('set-website_desc').value = data.website_desc || '';
            if (document.getElementById('set-logo_url')) document.getElementById('set-logo_url').value = data.logo_url || '';
            if (document.getElementById('set-hotline')) document.getElementById('set-hotline').value = data.hotline || '';
            if (document.getElementById('set-email')) document.getElementById('set-email').value = data.email || '';
            if (document.getElementById('set-address')) document.getElementById('set-address').value = data.address || '';
            if (document.getElementById('set-google_client_id')) document.getElementById('set-google_client_id').value = data.google_client_id || '';
            if (document.getElementById('set-google_client_secret')) document.getElementById('set-google_client_secret').value = data.google_client_secret || '';
            if (document.getElementById('set-google_api_key')) document.getElementById('set-google_api_key').value = data.google_api_key || '';
        }
    } catch (e) {
        console.warn("Settings not found, using defaults.");
        if (document.getElementById('set-google_client_id')) document.getElementById('set-google_client_id').value = '';
        if (document.getElementById('set-google_client_secret')) document.getElementById('set-google_client_secret').value = '';
        if (document.getElementById('set-google_api_key')) document.getElementById('set-google_api_key').value = '';
    }
}

async function saveAllSettings() {
    const data = {
        website_title: document.getElementById('set-website_title').value,
        website_desc: document.getElementById('set-website_desc').value,
        logo_url: document.getElementById('set-logo_url').value,
        hotline: document.getElementById('set-hotline').value,
        email: document.getElementById('set-email').value,
        address: document.getElementById('set-address').value,
        google_client_id: document.getElementById('set-google_client_id').value,
        google_client_secret: document.getElementById('set-google_client_secret').value,
        google_api_key: document.getElementById('set-google_api_key').value
    };
    try {
        // PocketBase doesn't have .doc().set(), use update with the specific record ID
        await pb.collection('settings').update('general', data);
        showStatusModal("Thành công", "Đã lưu cấu hình hệ thống thành công!", "success");
    } catch (e) {
        // If 'general' doesn't exist, try creating it
        try {
            await pb.collection('settings').create({ id: 'general', ...data });
            showStatusModal("Thành công", "Đã khởi tạo và lưu cấu hình hệ thống!", "success");
        } catch (err) {
            showStatusModal("Lỗi cấu hình", "Không thể lưu cài đặt: " + e.message, "error");
        }
    }
}

// --- GOOGLE PHOTOS INTEGRATION (V3 - HYBRID: Server + Client fallback) ---
// Ưu tiên 1: Go server (nếu đã build)
// Ưu tiên 2: Client-side với nhiều CORS proxy backup
// KHÔNG CẦN build lại Go server để chạy được

// Hàm trích xuất link ảnh + video từ HTML Google Photos
function _extractGooglePhotoData(html) {
    if (!html) return { imageUrl: null, videoUrl: null, isVideo: false };

    let imageUrl = null;
    let videoUrl = null;
    let isVideo = false;

    // --- TRÍCH XUẤT ẢNH ---
    const ogImg = html.match(/property="og:image"\s+content="([^"]+)"/);
    if (ogImg && ogImg[1]) imageUrl = ogImg[1];
    if (!imageUrl) {
        const ogImg2 = html.match(/content="(https:\/\/lh3\.googleusercontent\.com[^"]+)"\s+property="og:image"/);
        if (ogImg2 && ogImg2[1]) imageUrl = ogImg2[1];
    }
    if (!imageUrl) {
        const pw = html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9\-_\/=]+/);
        if (pw) imageUrl = pw[0];
    }
    if (!imageUrl) {
        const all = html.match(/https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9\-_\/=]{20,}/g);
        if (all && all.length > 0) imageUrl = all[all.length - 1];
    }

    // --- TRÍCH XUẤT VIDEO ---
    // og:video meta tag (URL video trực tiếp từ Google)
    const ogVid = html.match(/property="og:video"\s+content="([^"]+)"/);
    if (ogVid && ogVid[1]) videoUrl = ogVid[1];
    if (!videoUrl) {
        const ogVid2 = html.match(/content="([^"]+)"\s+property="og:video"/);
        if (ogVid2 && ogVid2[1]) videoUrl = ogVid2[1];
    }
    // Tìm video URL trong dữ liệu nhúng (dạng Google sử dụng)
    if (!videoUrl) {
        const vidDl = html.match(/https:\/\/video-downloads\.googleusercontent\.com\/[^"\s]+/);
        if (vidDl) videoUrl = vidDl[0];
    }
    // Tìm link lh3 có tham số video (=dv hoặc =m18, =m22, =m37)
    if (!videoUrl) {
        const lh3Vid = html.match(/https:\/\/lh3\.googleusercontent\.com\/[^"\s]+=[a-z]*[dm]v[^"\s]*/i);
        if (lh3Vid) videoUrl = lh3Vid[0];
    }

    // Kiểm tra xem nội dung có phải video không
    isVideo = !!(videoUrl || html.includes('og:video') || html.includes('"video"') || html.includes('video_url') || html.includes('og:video:type'));

    return { imageUrl, videoUrl, isVideo };
}

// Hàm fetch qua CORS proxy với nhiều fallback
async function _fetchGooglePhotosHtml(url) {
    // Danh sách các proxy sẽ thử lần lượt
    const strategies = [
        // 1. Go server local (nhanh nhất, ổn định nhất - nếu đã build)
        async () => {
            const baseUrl = typeof pb !== 'undefined' ? pb.baseUrl : '';
            const resp = await fetch(baseUrl + '/api/google-photos-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });
            if (!resp.ok) throw new Error('Server route not available');
            const data = await resp.json();
            if (data.url || data.video_url) {
                if (data.url && data.url.startsWith('/api/')) data.url = baseUrl + data.url;
                if (data.video_url && data.video_url.startsWith('/api/')) data.video_url = baseUrl + data.video_url;
                return { directResult: data }; // Server đã xử lý xong
            }
            throw new Error('No URL in response');
        },
        // 2. corsproxy.io (đáng tin cậy)
        async () => {
            const resp = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
            if (!resp.ok) throw new Error('corsproxy failed');
            return { html: await resp.text() };
        },
        // 3. allorigins (backup)
        async () => {
            const resp = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            if (!resp.ok) throw new Error('allorigins failed');
            const data = await resp.json();
            if (!data.contents) throw new Error('No contents');
            return { html: data.contents };
        },
        // 4. codetabs (backup thứ 2)  
        async () => {
            const resp = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`);
            if (!resp.ok) throw new Error('codetabs failed');
            return { html: await resp.text() };
        }
    ];

    for (let i = 0; i < strategies.length; i++) {
        try {
            console.log(`[Google Photos] Thử phương thức ${i + 1}/${strategies.length}...`);
            const result = await Promise.race([
                strategies[i](),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
            ]);
            console.log(`[Google Photos] Phương thức ${i + 1} thành công!`);
            return result;
        } catch (e) {
            console.warn(`[Google Photos] Phương thức ${i + 1} thất bại:`, e.message);
        }
    }
    return null;
}

async function insertGooglePhotoFromUrl(url) {
    if (!url || !url.trim()) return;
    url = url.trim();

    // Nếu là link trực tiếp đến ảnh (không phải Google Photos share link)
    if (!url.includes('photos.app.goo.gl') &&
        !url.includes('photos.google.com') &&
        !url.includes('lh3.googleusercontent.com')) {
        if (editorInstance) {
            editorInstance.insertContent(`<img src="${url}" style="max-width:100%; height:auto; border-radius:8px; margin: 10px 0;">`);
            showToast("Đã chèn ảnh thành công!", "success");
        }
        return;
    }

    // Nếu đã là link lh3 trực tiếp, chèn luôn
    if (url.includes('lh3.googleusercontent.com') && !url.includes('photos.google.com')) {
        // Thêm tham số kích thước nếu chưa có
        let imgUrl = url;
        if (!imgUrl.includes('=w') && !imgUrl.includes('=s')) imgUrl += '=w1200';
        if (editorInstance) {
            editorInstance.insertContent(`<img src="${imgUrl}" style="max-width:100%; height:auto; border-radius:8px; margin: 10px 0;">`);
            showToast("Đã chèn ảnh Google Photos!", "success");
        }
        return;
    }

    // === XỬ LÝ LINK GOOGLE PHOTOS ===
    showToast("⏳ Đang xử lý link Google Photos...", "info");

    try {
        const fetchResult = await _fetchGooglePhotosHtml(url);

        if (!fetchResult) {
            throw new Error("Không thể kết nối tới Google Photos qua bất kỳ kênh nào");
        }

        // Nếu Go server đã trả kết quả trực tiếp
        if (fetchResult.directResult) {
            const result = fetchResult.directResult;
            if (result.url && editorInstance) {
                if (result.is_video && result.video_url) {
                    // Server đã tải video về local → HTML5 player hoạt động
                    _insertHTML5Video(result.video_url, result.url);
                    showToast("✅ Đã chèn video phát trực tiếp!", "success");
                } else if (result.is_video) {
                    // Video nhưng chỉ có thumbnail → hướng dẫn upload
                    _handleGooglePhotosVideo(result.url, url, null);
                } else {
                    editorInstance.insertContent(`<img src="${result.url}" style="max-width:100%; height:auto; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin: 10px 0;" alt="Google Photos">`);
                    showToast("✅ Đã chèn ảnh!", "success");
                }
                return;
            }
        }

        // Xử lý HTML từ CORS proxy
        const html = fetchResult.html;
        const gpData = _extractGooglePhotoData(html);

        if (!gpData.imageUrl && !gpData.videoUrl) {
            throw new Error("Không tìm thấy nội dung. Hãy đảm bảo link đã được chia sẻ công khai.");
        }

        if (editorInstance) {
            if (gpData.isVideo) {
                // Google Photos video → chỉ có thumbnail, KHÔNG có file video thực
                let thumbUrl = gpData.imageUrl || '';
                if (thumbUrl && !thumbUrl.includes('=w') && !thumbUrl.includes('=s')) thumbUrl += '=w800';
                _handleGooglePhotosVideo(thumbUrl, url, null);
            } else if (gpData.imageUrl) {
                let imgUrl = gpData.imageUrl;
                if (!imgUrl.includes('=w') && !imgUrl.includes('=s')) imgUrl += '=w1600';
                editorInstance.insertContent(`<img src="${imgUrl}" style="max-width:100%; height:auto; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin: 10px 0;" alt="Google Photos">`);
                showToast("✅ Đã chèn ảnh Google Photos!", "success");
            }
        }
    } catch (error) {
        console.error("[Google Photos Import Error]", error);
        showToast("❌ " + (error.message || "Lỗi khi xử lý link"), "error");
        alert(
            "Không thể xử lý link Google Photos.\n\n" +
            "Nguyên nhân có thể:\n" +
            "1. Link chưa được chia sẻ công khai\n" +
            "2. Link không hợp lệ\n\n" +
            "Mẹo: Dùng nút 'TẢI VIDEO LÊN' để upload video trực tiếp từ máy tính"
        );
    }
}

// Xử lý video Google Photos
function _handleGooglePhotosVideo(thumbnailUrl, shareUrl, localVideoUrl) {
    if (!editorInstance) return;

    if (localVideoUrl) {
        // Video đã được server tải về → phát trực tiếp bằng HTML5
        _insertHTML5Video(localVideoUrl, thumbnailUrl);
        showToast("✅ Video phát trực tiếp trên bài viết!", "success");
    } else {
        // Chưa có video local → hiển thị thumbnail + link
        editorInstance.insertContent(`
            <div style="margin: 20px auto; max-width: 640px; text-align: center;">
                <div style="border-radius:12px; overflow:hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.15);">
                    <div style="position:relative; background:#000;">
                        <img src="${thumbnailUrl}" style="width:100%; height:auto; display:block;" alt="Video">
                        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(255,255,255,0.9); width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">▶</div>
                    </div>
                    <a href="${shareUrl}" target="_blank" rel="noopener" style="display:block; background:#1a73e8; color:white; padding:10px; font-weight:600; font-size:13px; text-decoration:none;">
                        📹 Xem video gốc
                    </a>
                </div>
            </div><p>&nbsp;</p>
        `);
        showToast("📹 Đã chèn thumbnail. Build lại server (Build_Go.bat) để video phát trực tiếp!", "info");
    }
}

// HTML5 Video Player
function _insertHTML5Video(url, poster = '') {
    if (!editorInstance) return;

    // Cấu trúc Wrapper sạch sẽ cho video - Full Width
    const videoHtml = `
        <div class="video-wrapper" contenteditable="false" style="margin: 15px 0; width: 100%; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
            <video controls preload="auto" playsinline style="width: 100%; height: auto; display: block; max-height: 80vh;">
                <source src="${url}">
                Trình duyệt không hỗ trợ phát video.
            </video>
        </div>
        <p>&nbsp;</p>
    `;

    editorInstance.insertContent(videoHtml);
}

function _hideUploadOverlay() {
    const overlay = document.getElementById('upload-overlay');
    if (overlay) overlay.style.display = 'none';
}

// Xóa bỏ hàm cũ bị thừa hoặc sai ID
if (typeof _showUploadOverlay === 'undefined') {
    window._showUploadOverlay = function (title, filename) {
        const overlay = document.getElementById('upload-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.getElementById('overlay-title').textContent = title;
            document.getElementById('overlay-msg').textContent = filename;
        }
    };
}

function initEditor() {
    tinymce.init({
        selector: '#article-editor',
        height: 500,
        plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime table code help wordcount',
        toolbar: 'googlephotos_text upload_video_btn mux_video_btn | undo redo | blocks | bold italic | alignleft aligncenter alignright | bullist numlist | image link | code',
        content_style: `
            body { font-family:Helvetica,Arial,sans-serif; font-size:16px; padding: 20px; }
            img { width: 100%; max-width: 100%; height: auto; border: none; display: block; margin: 15px 0; }
            .video-wrapper { margin: 15px 0; width: 100% !important; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); background: #000; position: relative; }
            iframe { width: 100% !important; height: auto; min-height: 400px; border-radius: 12px; }
        `,
        setup: function (ed) {
            editorInstance = ed;

            // 1. NÚT GOOGLE PHOTOS (UI CHUYÊN NGHIỆP)
            ed.ui.registry.addButton('googlephotos_text', {
                text: 'CHÈN GOOGLE PHOTOS',
                tooltip: 'Dán link chia sẻ từ Google Photos',
                onAction: function () {
                    ed.windowManager.open({
                        title: 'Tích hợp Google Photos',
                        size: 'normal',
                        body: {
                            type: 'panel',
                            items: [
                                {
                                    type: 'htmlpanel',
                                    html: '<div style="margin-bottom:15px; background:#f0f9ff; padding:12px; border-radius:8px; border:1px solid #bae6fd; display:flex; gap:12px; align-items:center;"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Google_Photos_icon_%282020%29.svg/512px-Google_Photos_icon_%282020%29.svg.png" style="width:32px;height:32px;"> <span style="font-size:14px; color:#0369a1;">Dán liên kết chia sẻ từ Google Photos vào ô bên dưới. Hệ thống sẽ tự động trích xuất và tối ưu hình ảnh/video tốc độ cao.</span></div>'
                                },
                                {
                                    type: 'input',
                                    name: 'url',
                                    label: 'Đường dẫn liên kết (Link Share)',
                                    placeholder: 'https://photos.app.goo.gl/...'
                                }
                            ]
                        },
                        buttons: [
                            { type: 'cancel', text: 'Hủy bỏ' },
                            { type: 'submit', text: 'Tải & Chèn Dữ Liệu', primary: true }
                        ],
                        onSubmit: function (api) {
                            const data = api.getData();
                            if (data.url) insertGooglePhotoFromUrl(data.url);
                            api.close();
                        }
                    });
                }
            });

            // 2. NÚT CHÈN VIDEO LỒNG TIẾNG (MUXING)
            ed.ui.registry.addButton('mux_video_btn', {
                text: '🎬 CHÈN VIDEO LỒNG TIẾNG',
                tooltip: 'Chèn video từ link mở rộng, hỗ trợ phát âm thanh song song (Muxing)',
                onAction: function () {
                    ed.windowManager.open({
                        title: 'Trình Quản Lý Video & Muxing',
                        size: 'normal',
                        body: {
                            type: 'panel',
                            items: [
                                {
                                    type: 'htmlpanel',
                                    html: '<div style="margin-bottom:15px; background:#fffbeb; padding:12px; border-radius:8px; border:1px solid #fde68a; font-size:14px; color:#b45309;"><i class="fa-solid fa-bolt"></i> <b>Tính năng Chuyên Môn:</b> Nhập trực tiếp đường dẫn Video (.mp4). Nếu video bị tắt tiếng, bạn có thể nhập thêm đường dẫn file Âm thanh (.mp3) để hệ thống tự động lồng tiếng đồng bộ khi phát.</div>'
                                },
                                {
                                    type: 'input',
                                    name: 'videoUrl',
                                    label: 'Đường dẫn Video (Bắt buộc)',
                                    placeholder: 'https://domain.com/video.mp4'
                                },
                                {
                                    type: 'input',
                                    name: 'audioUrl',
                                    label: 'Đường dẫn Âm thanh phụ (Tuỳ chọn Muxing)',
                                    placeholder: 'https://domain.com/audio.mp3'
                                }
                            ]
                        },
                        buttons: [
                            { type: 'cancel', text: 'Hủy' },
                            { type: 'submit', text: 'Chèn Vào Bài Viết', primary: true }
                        ],
                        onSubmit: function (api) {
                            const data = api.getData();
                            if (!data.videoUrl) {
                                ed.windowManager.alert("Vui lòng nhập đường dẫn video!");
                                return;
                            }
                            const audioAttr = data.audioUrl ? ` data-audio="${data.audioUrl}"` : '';
                            const html = `
                                <div class="video-wrapper" contenteditable="false" style="margin: 15px 0; width: 100%; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                                    <video controls preload="metadata" playsinline style="width: 100%; height: auto; display: block; max-height: 80vh;"${audioAttr}>
                                        <source src="${data.videoUrl}">
                                    </video>
                                </div>
                                <p>&nbsp;</p>
                            `;
                            ed.insertContent(html);
                            api.close();
                        }
                    });
                }
            });

            // 3. NÚT TẢI VIDEO LÊN NỘI DUNG BÀI VIẾT
            ed.ui.registry.addButton('upload_video_btn', {
                text: '📹 TẢI VIDEO TỪ MÁY',
                tooltip: 'Tải video từ máy tính và chèn vào nội dung (không giới hạn dung lượng)',
                onAction: function () {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'video/mp4,video/webm,video/ogg,video/*';
                    input.onchange = async function () {
                        if (!input.files || !input.files[0]) return;
                        const file = input.files[0];
                        _showUploadOverlay('Đang tải video lên server...', file.name);
                        try {
                            const videoUrl = await uploadVideoChunked(file);
                            _insertHTML5Video(videoUrl, '');
                            showToast('✅ Đã chèn video vào nội dung!', 'success');
                        } catch (err) {
                            console.error('Video upload error:', err);
                            showToast('❌ Lỗi tải video: ' + err.message, 'error');
                        } finally {
                            _hideUploadOverlay();
                        }
                    };
                    input.click();
                }
            });
        }
    });
}

async function updateImagePreview(url, record = null) {
    const previewContainer = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const inputField = document.getElementById('edit-image');
    const editPreview = document.getElementById('edit-image-preview');
    const editIcon = document.getElementById('edit-image-icon');

    if (!url) {
        if (previewContainer) previewContainer.style.display = 'none';
        if (editPreview) editPreview.style.display = 'none';
        if (editIcon) editIcon.style.display = 'block';
        return;
    }

    // --- AUTO-CONVERT GOOGLE PHOTOS LINKS (for featured image field) ---
    if (url.includes('photos.app.goo.gl') || (url.includes('photos.google.com/share') && !url.includes('lh3.googleusercontent.com'))) {
        showToast("⏳ Đang xử lý ảnh Google Photos...", "info");
        try {
            const fetchResult = await _fetchGooglePhotosHtml(url);
            if (fetchResult) {
                let newUrl = null;
                if (fetchResult.directResult && fetchResult.directResult.url) {
                    newUrl = fetchResult.directResult.url;
                } else if (fetchResult.html) {
                    newUrl = _extractGooglePhotoUrl(fetchResult.html);
                    if (newUrl && !newUrl.includes('=w') && !newUrl.includes('=s')) {
                        newUrl += '=w1000';
                    }
                }
                if (newUrl) {
                    url = newUrl;
                    if (inputField) inputField.value = url;
                    showToast("✅ Đã chuyển đổi ảnh thành công!", "success");
                }
            }
        } catch (e) {
            console.error("Error converting Google Photos link:", e);
            showToast("❌ Lỗi chuyển đổi link Google Photos", "error");
        }
    }

    // Determine final URL (for PocketBase files)
    let finalUrl = url;
    if (record && !url.startsWith('http') && !url.startsWith('data:')) {
        finalUrl = pb.getFileUrlCustom(record, url);
    }

    // Update UI elements if they exist
    if (previewImg) {
        previewImg.src = finalUrl;
        if (previewContainer) previewContainer.style.display = 'block';
    }

    if (editPreview) {
        if (editPreview.tagName === 'IMG') {
            editPreview.src = finalUrl;
        } else {
            editPreview.style.backgroundImage = `url('${finalUrl}')`;
        }
        editPreview.style.display = 'block';
    }

    if (editIcon) editIcon.style.display = 'none';
}

function previewLocalFile(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            updateImagePreview(e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// === VIDEO PREVIEW & MANAGEMENT FUNCTIONS ===

function updateVideoPreview(url) {
    const videoEl = document.getElementById('edit-video-preview');
    const iconEl = document.getElementById('edit-video-icon');
    const playBtn = document.getElementById('video-play-btn');
    const removeBtn = document.getElementById('video-remove-btn');

    if (!url || !url.trim()) {
        if (videoEl) { videoEl.style.display = 'none'; videoEl.src = ''; }
        if (iconEl) iconEl.style.display = 'block';
        if (playBtn) playBtn.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'none';
        return;
    }

    if (videoEl) {
        videoEl.src = url;
        videoEl.style.display = 'block';
        videoEl.load();
    }
    if (iconEl) iconEl.style.display = 'none';
    if (playBtn) playBtn.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'block';
}

function previewLocalVideoFile(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const url = URL.createObjectURL(file);
        updateVideoPreview(url);
        const urlInput = document.getElementById('edit-video-url');
        if (urlInput) urlInput.value = '';
        showToast('📹 Video ' + _formatFileSize(file.size) + ' đã sẵn sàng. Nhấn Lưu để upload.', 'info');
    }
}

function toggleVideoPreview() {
    const videoEl = document.getElementById('edit-video-preview');
    const playBtn = document.getElementById('video-play-btn');
    if (!videoEl) return;

    if (videoEl.paused) {
        videoEl.play();
        if (playBtn) playBtn.innerHTML = '⏸';
    } else {
        videoEl.pause();
        if (playBtn) playBtn.innerHTML = '▶';
    }
}

function removeVideo() {
    const videoEl = document.getElementById('edit-video-preview');
    const urlInput = document.getElementById('edit-video-url');
    const fileInput = document.getElementById('edit-video-file');

    if (videoEl) { videoEl.pause(); videoEl.src = ''; }
    if (urlInput) urlInput.value = '';
    if (fileInput) fileInput.value = '';
    updateVideoPreview('');
    showToast('Đã xóa video.', 'info');
}

function openEditor(id = null) {
    const modal = document.getElementById('article-modal');
    const titleEl = document.getElementById('article-modal-title');
    const idInput = document.getElementById('edit-id');
    const titleInput = document.getElementById('edit-title');
    const categoryInput = document.getElementById('edit-category');
    const imageInput = document.getElementById('edit-image');
    const summaryInput = document.getElementById('edit-summary');
    const authorInput = document.getElementById('edit-author');
    const publishDateInput = document.getElementById('edit-publish-date');
    const tagsInput = document.getElementById('edit-tags');
    const fileInput = document.getElementById('edit-image-file');
    const videoUrlInput = document.getElementById('edit-video-url');
    const videoFileInput = document.getElementById('edit-video-file');

    // Reset UI
    if (fileInput) fileInput.value = '';
    if (videoFileInput) videoFileInput.value = '';
    updateImagePreview('');
    updateVideoPreview('');

    if (id) {
        const article = window.allArticles.find(a => a.id === id);
        if (article) {
            titleEl.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> CHỈNH SỬA BÀI VIẾT';
            idInput.value = article.id;
            titleInput.value = article.title || '';
            categoryInput.value = article.category || 'TIN_TUC';
            imageInput.value = article.image || '';
            summaryInput.value = article.summary || '';
            authorInput.value = article.author || '';
            tagsInput.value = article.tags || '';

            // Format date for datetime-local (YYYY-MM-DDThh:mm)
            if (article.publish_date) {
                const d = new Date(article.publish_date);
                const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                publishDateInput.value = localDate;
            } else if (article.created) {
                const d = new Date(article.created);
                const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                publishDateInput.value = localDate;
            } else {
                publishDateInput.value = '';
            }

            // Cập nhật preview ảnh hiện tại
            updateImagePreview(article.image, article);

            // Cập nhật preview video hiện tại
            if (article.video) {
                const videoSrc = article.video.startsWith('/') ? article.video : (article.video.startsWith('http') ? article.video : pb.getFileUrlCustom(article, article.video));
                if (videoUrlInput) videoUrlInput.value = article.video;
                updateVideoPreview(videoSrc);
            } else {
                if (videoUrlInput) videoUrlInput.value = '';
                updateVideoPreview('');
            }

            if (editorInstance) {
                editorInstance.setContent(article.content || '');
                loadAutosave(id);
            }
            window.history.pushState(null, null, '#articles-edit-' + id);
        }
    } else {
        titleEl.innerHTML = '<i class="fa-solid fa-plus"></i> SOẠN THẢO BÀI VIẾT MỚI';
        idInput.value = '';
        titleInput.value = '';
        categoryInput.value = 'TIN_TUC';
        imageInput.value = '';
        summaryInput.value = '';
        authorInput.value = 'Ban biên tập';
        tagsInput.value = '';
        if (videoUrlInput) videoUrlInput.value = '';

        // Set default to now
        const now = new Date();
        const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        publishDateInput.value = localNow;

        if (editorInstance) {
            editorInstance.setContent('');
            loadAutosave('new');
        }
    }
    modal.style.display = 'block';
}

async function urlToFile(url) {
    if (!url || !url.startsWith('http')) return null;

    // List of reliable CORS proxies
    const proxies = [
        "", // Try direct first
        "https://api.allorigins.win/raw?url=",
        "https://corsproxy.io/?"
    ];

    for (const proxy of proxies) {
        try {
            const targetUrl = proxy ? proxy + encodeURIComponent(url) : url;
            console.log(`Attempting to fetch image (proxy: ${proxy || 'none'}):`, url);

            const response = await fetch(targetUrl);
            if (!response.ok) continue;

            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) {
                console.warn("Fetched content is not an image:", blob.type);
                continue;
            }

            const filename = url.split('/').pop().split('?')[0] || 'image.jpg';
            const file = new File([blob], filename, { type: blob.type });
            console.log("Successfully converted URL to File object:", filename);
            return file;
        } catch (e) {
            console.warn(`Fetch failed with proxy ${proxy || 'none'}:`, e.message);
        }
    }

    console.error("All attempts to convert URL to File failed due to CORS or Network issues.");
    return null;
}

async function saveArticle() {
    const idInput = document.getElementById('edit-id');
    const id = idInput ? idInput.value : '';
    const fileInput = document.getElementById('edit-image-file');
    const urlInput = document.getElementById('edit-image');
    const videoFileInput = document.getElementById('edit-video-file');
    const videoUrlInput = document.getElementById('edit-video-url');

    let content = '';
    if (typeof tinymce !== 'undefined' && tinymce.get('article-editor')) {
        content = tinymce.get('article-editor').getContent();
    } else if (editorInstance) {
        content = editorInstance.getContent();
    }

    // 1. Thu thập dữ liệu cơ bản
    const baseData = {
        title: document.getElementById('edit-title').value,
        category: document.getElementById('edit-category').value,
        summary: document.getElementById('edit-summary').value,
        author: document.getElementById('edit-author').value,
        publish_date: document.getElementById('edit-publish-date').value ? new Date(document.getElementById('edit-publish-date').value).toISOString() : new Date().toISOString(),
        tags: document.getElementById('edit-tags').value,
        content: content,
        status: 'Công khai'
    };

    if (!baseData.title) {
        showToast("Vui lòng nhập tiêu đề bài viết!", "error");
        return;
    }

    try {
        const formData = new FormData();
        for (let key in baseData) {
            formData.append(key, baseData[key]);
        }

        // 2. Xử lý ảnh (Cực kỳ quan trọng)
        const hasFile = fileInput && fileInput.files.length > 0;
        const imageUrl = urlInput.value.trim();

        if (hasFile) {
            // Trường hợp 1: Có file chọn từ máy -> Upload file mới
            formData.append('image', fileInput.files[0]);
            console.log("Saving: Using uploaded file");
        } else if (imageUrl && imageUrl.startsWith('http')) {
            // Trường hợp 2: Có link URL -> Cố gắng chuyển thành file thông qua proxy
            const fileFromUrl = await urlToFile(imageUrl);
            if (fileFromUrl) {
                formData.append('image', fileFromUrl);
                console.log("Saving: Successfully converted URL to File for upload");
            } else {
                // Nếu lỗi CORS dù đã thử qua proxy
                const confirmSave = confirm("Không thể tự động tải ảnh từ URL này do chính sách bảo mật (CORS). Bạn có muốn tiếp tục lưu bài viết mà KHÔNG CÓ ảnh đại diện không?\n\nLưu ý: Bạn nên tải ảnh về máy và upload trực tiếp để đảm bảo hiển thị.");
                if (!confirmSave) return;
                // Không append 'image' để bài viết không có ảnh hoặc giữ ảnh cũ nếu có
                console.log("Saving: Skipping image field due to CORS error");
            }
        } else if (!imageUrl && id) {
            // Trường hợp 3: Người dùng xóa ảnh (input trống)
            formData.append('image', '');
            console.log("Saving: Clearing image field");
        } else if (imageUrl && !imageUrl.startsWith('http')) {
            // Trường hợp 4: Giữ nguyên ảnh cũ (imageUrl là filename)
            // Trong PocketBase, nếu không gửi trường này trong FormData, nó sẽ giữ nguyên file cũ.
            // Nếu gửi string vào File field sẽ bị lỗi 400.
            console.log("Saving: Keeping existing image file:", imageUrl);
        }

        // 3. Xử lý VIDEO qua Chunked Upload (KHÔNG GIỚI HẠN DUNG LƯỢNG)
        const hasVideoFile = videoFileInput && videoFileInput.files.length > 0;
        const videoUrl = videoUrlInput ? videoUrlInput.value.trim() : '';

        if (hasVideoFile) {
            _showUploadOverlay('Đang tải video...', videoFileInput.files[0].name);
            try {
                const uploadedUrl = await uploadVideoChunked(videoFileInput.files[0]);
                formData.append('video', uploadedUrl);
            } catch (uploadErr) {
                throw new Error('Lỗi tải video: ' + uploadErr.message);
            } finally {
                _hideUploadOverlay();
            }
        } else if (videoUrl) {
            // Giữ nguyên URL video hiện tại (đã lưu từ trước)
            formData.append('video', videoUrl);
            console.log("Saving: Keeping existing video URL:", videoUrl);
        } else if (!videoUrl && id) {
            // Xóa video
            formData.append('video', '');
            console.log("Saving: Clearing video field");
        }

        if (id) {
            if (tinymce.get('article-editor')) tinymce.get('article-editor').save();
            console.log("Updating article:", id);
            await pb.collection('articles').update(id, formData);
            showStatusModal("Cập nhật thành công", "Bài viết đã được lưu thay đổi vào hệ thống.", "success");
            clearAutosave(id);
        } else {
            console.log("Creating new article");
            await pb.collection('articles').create(formData);
            showStatusModal("Đăng bài thành công", "Bài viết mới đã được đăng công khai trên hệ thống.", "success");
            clearAutosave('new');
        }

        document.getElementById('article-modal').style.display = 'none';
        window.location.hash = 'articles';
        await loadArticles(true);
        await updateDashboardStats();
    } catch (e) {
        console.error("Save Article Error:", e);

        const imageUrl = urlInput.value.trim();
        let errorMsg = e.message || "Kiểm tra dữ liệu";
        if (e.data && e.data.data) {
            const fieldErrors = e.data.data;
            if (fieldErrors.image) errorMsg = "Lỗi trường ảnh: " + fieldErrors.image.message;
        }

        // Nếu lỗi 400 và có liên quan đến ảnh, thử cứu dữ liệu
        if (e.status === 400 && imageUrl.startsWith('http')) {
            console.warn("Retrying without image field due to type mismatch...");
            try {
                if (id) {
                    await pb.collection('articles').update(id, baseData);
                } else {
                    await pb.collection('articles').create(baseData);
                }
                showToast("Đã lưu nội dung bài viết thành công (Ảnh đại diện bị từ chối)", "warning");
                document.getElementById('article-modal').style.display = 'none';
                loadArticles(true);
                return;
            } catch (retryErr) {
                console.error("Retry failed:", retryErr);
            }
        }

        showStatusModal("Lỗi hệ thống", "Không thể lưu bài viết: " + errorMsg, "error");
    }
}

async function loadArticles(forceRefresh = false) {
    try {
        const query = document.getElementById('article-search') ? document.getElementById('article-search').value.trim() : "";
        const cat = document.getElementById('article-filter-cat') ? document.getElementById('article-filter-cat').value : "ALL";

        let filter = "";
        const parts = [];
        if (query) parts.push(`title ~ "${query}"`);
        if (cat !== "ALL") parts.push(`category = "${cat}"`);
        if (parts.length > 0) filter = parts.join(" && ");

        const result = await pb.collection('articles').getList(articleCurrentPage, articlePerPage, {
            sort: '-publish_date,-created',
            filter: filter,
            requestKey: null // Disable auto-cancellation
        });

        window.allArticles = result.items;
        articleTotalPages = result.totalPages;

        renderArticles(result.items);
        updatePaginationUI(result);

        // Always try to update dashboard news if element exists
        const dashboardNewsTbody = document.getElementById('dashboard-recent-news');
        if (dashboardNewsTbody) {
            // Fetch top 8 latest for dashboard
            pb.collection('articles').getList(1, 8, { sort: '-publish_date,-created', requestKey: null }).then(latest => {
                renderDashboardNews(latest.items);
            });
        }

        if (forceRefresh) {
            updateDashboardStats();
        }
    } catch (e) {
        console.error("Load Articles Error:", e);
        showToast("Lỗi tải bài viết: " + e.message, "error");
    }
}

function applyFilters() {
    articleCurrentPage = 1; // Reset to page 1 on search
    loadArticles();
}

function updatePaginationUI(result) {
    const container = document.getElementById('article-pagination');
    const info = document.getElementById('pagination-info');
    if (!container || !info) return;

    console.log(`Pagination Info: Page ${result.page}/${result.totalPages}, Total: ${result.totalItems}`);
    info.innerText = `Trang ${result.page} / ${result.totalPages} (Tổng ${result.totalItems} bài viết)`;

    let html = "";
    // Prev button
    html += `<button class="btn btn-sm" ${result.page <= 1 ? 'disabled' : ''} onclick="changePage(${result.page - 1})" style="border: 1px solid #ccc;"><i class="fa-solid fa-chevron-left"></i></button>`;

    // Page numbers
    const start = Math.max(1, result.page - 2);
    const end = Math.min(result.totalPages, start + 4);

    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-sm ${i === result.page ? 'btn-primary' : ''}" style="min-width: 35px; border: 1px solid #ccc;" onclick="changePage(${i})">${i}</button>`;
    }

    // Next button
    html += `<button class="btn btn-sm" ${result.page >= result.totalPages ? 'disabled' : ''} onclick="changePage(${result.page + 1})" style="border: 1px solid #ccc;"><i class="fa-solid fa-chevron-right"></i></button>`;

    container.innerHTML = html;
}

function changePage(page) {
    articleCurrentPage = page;
    articleSelectedIds.clear(); // Clear selection on page change
    loadArticles();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Bulk Action Helpers
function toggleRowSelection(id) {
    if (articleSelectedIds.has(id)) {
        articleSelectedIds.delete(id);
    } else {
        articleSelectedIds.add(id);
    }
    renderArticles(window.allArticles);
}

function toggleSelectAll(checkbox) {
    if (checkbox.checked) {
        window.allArticles.forEach(item => articleSelectedIds.add(item.id));
    } else {
        articleSelectedIds.clear();
    }
    renderArticles(window.allArticles);
}

function updateBulkBar() {
    const bar = document.getElementById('bulk-actions-bar');
    const countEl = document.getElementById('selected-count');
    if (!bar || !countEl) return;

    if (articleSelectedIds.size > 0) {
        bar.style.display = 'flex';
        countEl.innerText = `${articleSelectedIds.size} mục đã chọn`;
    } else {
        bar.style.display = 'none';
    }
}

async function deleteBulk() {
    const count = articleSelectedIds.size;
    if (count === 0) return;

    if (confirm(`Bạn có chắc chắn muốn xóa ${count} bài viết đã chọn? Hành động này không thể hoàn tác.`)) {
        showToast(`Đang xóa ${count} mục...`, "info");
        try {
            const promises = Array.from(articleSelectedIds).map(id => pb.collection('articles').delete(id));
            await Promise.all(promises);
            showStatusModal("Thành công", `Đã xóa thành công ${count} bài viết khỏi hệ thống!`, "success");
            articleSelectedIds.clear();
            loadArticles(true);
        } catch (e) {
            showStatusModal("Lỗi xóa", "Không thể xóa hàng loạt: " + e.message, "error");
            loadArticles(); // Refresh anyway
        }
    }
}

async function deleteItem(coll, id) {
    if (confirm("Bạn có chắc chắn muốn xóa mục này? Thao tác không thể hoàn tác.")) {
        try {
            await pb.collection(coll).delete(id);
            showStatusModal("Thành công", "Mục dữ liệu đã được xóa vĩnh viễn.", "success");
            if (coll === 'articles') loadArticles();
            if (coll === 'pages') loadPages();
            if (coll === 'feedback') loadFeedback();
            updateDashboardStats();
        } catch (e) {
            showStatusModal("Lỗi", "Không thể xóa mục này: " + e.message, "error");
        }
    }
}

// --- UI UTILS ---
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2b579a'};
        color: white;
        padding: 12px 25px;
        border-radius: 4px;
        margin-top: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-weight: bold;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease-out;
    `;

    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-info-circle';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function showStatusModal(title, msg, type = 'success') {
    const overlay = document.getElementById('status-modal-overlay');
    const titleEl = document.getElementById('modal-status-title');
    const msgEl = document.getElementById('modal-status-text');
    const iconEl = document.getElementById('modal-status-icon');

    if (!overlay || !titleEl || !msgEl) return;

    titleEl.innerText = title.toUpperCase();
    msgEl.innerText = msg;

    // Reset classes for icon
    if (iconEl) {
        iconEl.className = 'fa-solid';
        if (type === 'success') {
            iconEl.classList.add('fa-circle-check');
            iconEl.style.color = '#16a34a';
            titleEl.style.color = '#16a34a';
        } else if (type === 'error') {
            iconEl.classList.add('fa-circle-xmark');
            iconEl.style.color = '#dc2626';
            titleEl.style.color = '#dc2626';
        } else {
            iconEl.classList.add('fa-circle-info');
            iconEl.style.color = '#1e3a8a';
            titleEl.style.color = '#1e3a8a';
        }
    }

    overlay.style.display = 'flex';

    // Auto focus on close button
    const closeBtn = overlay.querySelector('.btn-modal-close');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 100);
}

// Add animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .row-selected { background-color: #fff9e6 !important; }
`;
document.head.appendChild(style);

function toggleSidebar() {
    const layout = document.getElementById('admin-layout');
    if (layout) {
        layout.classList.toggle('collapsed');
        // Save preference
        localStorage.setItem('admin_sidebar_collapsed', layout.classList.contains('collapsed'));
    }
}

// Restore sidebar state on load
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('admin_sidebar_collapsed') === 'true') {
        const layout = document.getElementById('admin-layout');
        if (layout) layout.classList.add('collapsed');
    }
});

// --- NEW BULK ACTIONS LOGIC ---
async function bulkUpdateStatus(newStatus) {
    const ids = Array.from(articleSelectedIds);
    if (ids.length === 0) return;

    if (confirm(`Bạn có chắc chắn muốn cập nhật trạng thái của ${ids.length} bài viết thành [${newStatus === 'draft' ? 'Bản nháp' : 'Công khai'}]?`)) {
        showToast(`Đang cập nhật ${ids.length} mục...`, "info");
        try {
            const promises = ids.map(id => pb.collection('articles').update(id, { status: newStatus }));
            await Promise.all(promises);
            showToast(`Đã cập nhật trạng thái thành công cho ${ids.length} bài viết!`, "success");
            articleSelectedIds.clear();
            loadArticles();
        } catch (e) {
            showToast("Lỗi cập nhật hàng loạt: " + e.message, "error");
        }
    }
}

async function bulkChangeCategory() {
    const ids = Array.from(articleSelectedIds);
    const newCat = document.getElementById('bulk-cat-select').value;
    if (ids.length === 0) return;
    if (!newCat) {
        showToast("Vui lòng chọn chuyên mục mới!", "warning");
        return;
    }

    if (confirm(`Bạn có chắc chắn muốn chuyển ${ids.length} bài viết sang chuyên mục [${newCat}]?`)) {
        showToast(`Đang chuyển chuyên mục cho ${ids.length} mục...`, "info");
        try {
            const promises = ids.map(id => pb.collection('articles').update(id, { category: newCat }));
            await Promise.all(promises);
            showToast(`Đã chuyển chuyên mục thành công cho ${ids.length} bài viết!`, "success");
            articleSelectedIds.clear();
            loadArticles();
        } catch (e) {
            showToast("Lỗi chuyển chuyên mục: " + e.message, "error");
        }
    }
}

// --- IMPROVED NAVIGATION ---
function switchView(viewId, element = null) {
    // 1. Hide all views and show target
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');

    // 2. Update Sidebar Active State
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

    // Find menu item if not provided
    if (!element) {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            const oc = item.getAttribute('onclick') || '';
            if (oc.includes(viewId)) element = item;
        });
    }
    if (element) element.classList.add('active');

    // 3. Update URL Hash (Reactive change)
    const hash = viewId.replace('view-', '');
    if (window.location.hash !== '#' + hash && !window.location.hash.startsWith('#' + hash + '-')) {
        window.location.hash = hash;
    }
}

// AUTOSAVE FEATURE
setInterval(() => {
    if (editorInstance && document.getElementById('article-modal').style.display === 'block') {
        const content = editorInstance.getContent();
        const id = document.getElementById('edit-id').value || 'new';
        if (content) {
            localStorage.setItem('autosave_article_' + id, content);
        }
    }
}, 5000);

function loadAutosave(id = 'new') {
    const saved = localStorage.getItem('autosave_article_' + id);
    if (saved && confirm("Tìm thấy bản nháp được lưu tự động. Bạn có muốn khôi phục không?")) {
        if (editorInstance) editorInstance.setContent(saved);
    }
}

function clearAutosave(id = 'new') {
    localStorage.removeItem('autosave_article_' + id);
}

function setPublishDateNow() {
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const el = document.getElementById('edit-publish-date');
    if (el) el.value = localNow;
}

// === HỆ THỐNG CHUNKED VIDEO UPLOAD (KHÔNG GIỚI HẠN DUNG LƯỢNG) ===
const VIDEO_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB mỗi chunk

async function uploadVideoChunked(file, onProgress) {
    const totalChunks = Math.ceil(file.size / VIDEO_CHUNK_SIZE);
    const safeName = `vid_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    _showUploadOverlay('Bắt đầu tải lên...', file.name);

    // Bước 1: Khởi tạo phiên upload
    const baseUrl = typeof pb !== 'undefined' ? pb.baseUrl : '';
    const initResp = await fetch(baseUrl + '/api/video/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filename: safeName,
            total_size: file.size,
            total_chunks: totalChunks,
            chunk_size: VIDEO_CHUNK_SIZE
        })
    });
    if (!initResp.ok) {
        const errText = await initResp.text();
        throw new Error('Không thể khởi tạo upload: ' + errText);
    }
    const initData = await initResp.json();
    const uploadId = initData.upload_id;

    // Bước 2: Gửi từng chunk
    for (let i = 0; i < totalChunks; i++) {
        const start = i * VIDEO_CHUNK_SIZE;
        const end = Math.min(start + VIDEO_CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        let retries = 5;
        let success = false;

        while (retries > 0 && !success) {
            try {
                const formData = new FormData();
                formData.append('upload_id', uploadId);
                formData.append('chunk_index', i.toString());
                formData.append('data', chunk);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);

                const resp = await fetch(baseUrl + '/api/video/chunk', {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                success = true;
            } catch (e) {
                retries--;
                if (retries === 0) throw new Error(`Lỗi mạng tại chunk ${i + 1}/${totalChunks}: ${e.message}`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        const pct = ((i + 1) / totalChunks) * 100;
        _updateUploadOverlay(pct, file.size, file.name);
        if (onProgress) onProgress(pct);
    }

    // Bước 3: Hoàn thành
    const finishResp = await fetch(baseUrl + '/api/video/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id: uploadId })
    });
    if (!finishResp.ok) throw new Error('Lỗi khi ghép file trên server');
    const finishData = await finishResp.json();

    const finalVideoUrl = finishData.video_url.startsWith('http') ? finishData.video_url : (baseUrl + finishData.video_url);
    return finalVideoUrl;
}

// === OVERLAY HELPER FUNCTIONS ===
function _showUploadOverlay(title, filename) {
    const overlay = document.getElementById('upload-overlay');
    const titleEl = document.getElementById('overlay-title');
    const msgEl = document.getElementById('overlay-msg');
    const bar = document.getElementById('overlay-bar');
    const pctEl = document.getElementById('overlay-pct');

    if (overlay) {
        overlay.style.display = 'flex';
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = 'Đang tải: ' + filename;
        if (bar) bar.style.width = '0%';
        if (pctEl) pctEl.textContent = '0%';
    }
}

function _updateUploadOverlay(pct, totalSize, filename) {
    const bar = document.getElementById('overlay-bar');
    const pctEl = document.getElementById('overlay-pct');
    const msgEl = document.getElementById('overlay-msg');

    if (bar) bar.style.width = pct.toFixed(1) + '%';
    if (pctEl) pctEl.textContent = pct.toFixed(0) + '%';
    if (msgEl) {
        const uploaded = (totalSize * pct / 100);
        msgEl.textContent = `Tải lên: ${_formatFileSize(uploaded)} / ${_formatFileSize(totalSize)}`;
    }
}

function _hideUploadOverlay() {
    const overlay = document.getElementById('upload-overlay');
    if (overlay) overlay.style.display = 'none';
}

// Hiển thị / ẩn progress bar
function _updateVideoProgress(pct, totalSize) {
    const container = document.getElementById('video-upload-progress');
    const bar = document.getElementById('video-progress-bar');
    const text = document.getElementById('video-progress-text');
    if (container) container.style.display = 'block';
    if (bar) bar.style.width = pct.toFixed(1) + '%';
    if (text) text.textContent = `Đang tải lên: ${pct.toFixed(0)}% (${_formatFileSize(totalSize * pct / 100)} / ${_formatFileSize(totalSize)})`;
}

function _hideVideoProgress() {
    const container = document.getElementById('video-upload-progress');
    if (container) container.style.display = 'none';
}

function _formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

// --- ACCOUNTS MANAGEMENT (NEW) ---
async function loadAccounts() {
    const listEl = document.getElementById('account-list');
    if (!listEl) return;

    try {
        const users = await pb.collection('users').getFullList({
            sort: '-created'
        });
        console.log("Accounts Loaded:", users);
        renderAccounts(users);
    } catch (e) {
        // Bỏ qua lỗi "autocancelled" - Đây là tính năng của PB SDK để tối ưu hiệu năng
        if (e.isAbort || e.status === 0) {
            return; 
        }
        console.error("Load Accounts Error:", e);
        if (listEl) {
            listEl.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:red;">Lỗi tải dữ liệu: ${e.message}</td></tr>`;
        }
    }
}

function renderAccounts(data) {
    // Store all users globally for folder navigation
    window.allUsers = data;
    
    // Determine which view to render based on current hash
    const hash = window.location.hash.substring(1);
    if (hash.startsWith('accounts-folder-')) {
        const folderName = decodeURIComponent(hash.replace('accounts-folder-', ''));
        renderEmployeeList(folderName);
    } else if (hash === 'accounts') {
        renderFolderView(data);
    }
}

function renderFolderView(data) {
    const folderView = document.getElementById('account-folder-view');
    const tableView = document.getElementById('account-table-view');
    const breadcrumb = document.getElementById('accounts-breadcrumb');
    
    if (!folderView) return;

    // Group users by organization
    const groupedByOrg = {};
    const pendingUsers = data.filter(u => !u.approved && !u.verified);
    const lockedUsers = data.filter(u => u.verified === true);

    data.forEach(u => {
        const org = u.organization || u.org || 'Chưa cập nhật';
        if (!groupedByOrg[org]) {
            groupedByOrg[org] = [];
        }
        groupedByOrg[org].push(u);
    });

    // Sort organizations by name
    const sortedOrgs = Object.keys(groupedByOrg).sort();
    
    let folderHtml = '';

    // 1. Render Special Folders (Pinned to top if they have users)
    if (pendingUsers.length > 0) {
        folderHtml += `
            <div class="account-dir-item folder-pending" onclick="navigateToFolder('__PENDING__')">
                <i class="fa-solid fa-user-clock"></i>
                <div class="account-dir-info">
                    <div class="account-dir-name">CHỜ PHÊ DUYỆT</div>
                    <div class="account-dir-count">${pendingUsers.length} hồ sơ mới</div>
                </div>
            </div>
        `;
    }

    if (lockedUsers.length > 0) {
        folderHtml += `
            <div class="account-dir-item folder-locked" onclick="navigateToFolder('__LOCKED__')">
                <i class="fa-solid fa-user-lock"></i>
                <div class="account-dir-info">
                    <div class="account-dir-name">TÀI KHOẢN BỊ KHÓA</div>
                    <div class="account-dir-count">${lockedUsers.length} hồ sơ</div>
                </div>
            </div>
        `;
    }

    // 2. Render Organization Folders
    folderHtml += sortedOrgs.map(org => {
        const count = groupedByOrg[org].length;
        return `
            <div class="account-dir-item" onclick="navigateToFolder('${org}')">
                <i class="fa-solid fa-folder"></i>
                <div class="account-dir-info">
                    <div class="account-dir-name">${org}</div>
                    <div class="account-dir-count">${count} cán bộ</div>
                </div>
            </div>
        `;
    }).join('');

    folderView.innerHTML = folderHtml;

    folderView.style.display = 'grid'; // Ensure folder view is visible
    tableView.style.display = 'none';
    const backBtn = document.getElementById('account-back-btn');
    if (backBtn) backBtn.style.display = 'none';
    breadcrumb.style.display = 'flex';
    document.getElementById('breadcrumb-path').innerHTML = '';
}

function renderEmployeeList(organizationName) {
    const folderView = document.getElementById('account-folder-view');
    const tableView = document.getElementById('account-table-view');
    const breadcrumb = document.getElementById('accounts-breadcrumb');
    const accountList = document.getElementById('account-list');
    
    if (!folderView || !tableView || !accountList) return;

    // Fix: If users aren't loaded yet (null), load them first
    if (window.allUsers === null) {
        loadAccounts();
        return;
    }

    // Clear previous selection
    accountSelectedIds.clear();
    updateAccountBulkBar();
    currentOrgContext = organizationName;

    // Filter users by organization OR status
    let employees = [];
    let displayTitle = organizationName;

    if (organizationName === '__PENDING__') {
        employees = (window.allUsers || []).filter(u => !u.approved && !u.verified);
        displayTitle = "DANH SÁCH CHỜ PHÊ DUYỆT";
    } else if (organizationName === '__LOCKED__') {
        employees = (window.allUsers || []).filter(u => u.verified === true);
        displayTitle = "TÀI KHOẢN ĐANG BỊ KHÓA";
    } else {
        employees = (window.allUsers || []).filter(u => {
            const org = u.organization || u.org || 'Chưa cập nhật';
            return org === organizationName;
        });
    }

    if (employees.length === 0) {
        accountList.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px;">Không có cán bộ trong mục này.</td></tr>`;
    } else {
        accountList.innerHTML = employees.map(u => {
            const isApproved = u.approved === true;
            const isLocked = u.verified === true;
            const isChecked = accountSelectedIds.has(u.id);

            let currentStatus = 'pending';
            if (isLocked) currentStatus = 'locked';
            else if (isApproved) currentStatus = 'approved';

            const statusStyles = {
                'pending': 'background:#fffbeb; color:#854d0e; border-color:#fde68a;',
                'approved': 'background:#f0fdf4; color:#166534; border-color:#bbf7d0;',
                'locked': 'background:#fef2f2; color:#991b1b; border-color:#fecaca;'
            };
            const currentStyle = statusStyles[currentStatus];
            const role = u.role || 'member';

            return `
                <tr class="${isChecked ? 'row-selected' : ''}" onclick="if(event.target.type !== 'checkbox' && !event.target.closest('.action-group') && !event.target.closest('select')) toggleAccountSelection('${u.id}')">
                    <td style="width: 40px; text-align: center;">
                        <input type="checkbox" onchange="toggleAccountSelection('${u.id}')" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation()">
                    </td>
                    <td>
                        <div class="user-info-cell">
                            <img src="${u.avatar ? pb.getFileUrlCustom(u, u.avatar) : 'https://ui-avatars.com/api/?name=' + (u.name || u.username) + '&background=random'}" class="user-avatar-sm" onerror="this.src='https://ui-avatars.com/api/?name=User&background=ccc'">
                            <div>
                                <div class="user-name-bold">${u.name || u.username}</div>
                                <div class="user-email-dim">${u.email || u.username}</div>
                            </div>
                        </div>
                    </td>
                    <td style="font-size:12px;">
                        <div style="font-weight:700; color:#334155;">${u.position || 'Chưa cập nhật'}</div>
                        <div style="font-size:11px; color:#64748b;">${u.organization || u.org || '---'}</div>
                    </td>
                    <td>
                        <select onchange="changeRole('${u.id}', this.value)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; background:#f8fafc; outline:none; width: 100%;">
                            <option value="member" ${role === 'member' ? 'selected' : ''}>Thành viên</option>
                            <option value="editor" ${role === 'editor' ? 'selected' : ''}>Biên tập viên</option>
                            <option value="admin" ${role === 'admin' ? 'selected' : ''}>Quản trị viên</option>
                        </select>
                    </td>
                    <td>
                        <select onchange="changeAccountStatus('${u.id}', this.value)" style="padding:6px 10px; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid transparent; outline:none; cursor:pointer; text-transform:uppercase; width: 100%; text-align: center; ${currentStyle}">
                            <option value="pending" style="background:#fff; color:#333;" ${currentStatus === 'pending' ? 'selected' : ''}>CHỜ DUYỆT</option>
                            <option value="approved" style="background:#fff; color:#333;" ${currentStatus === 'approved' ? 'selected' : ''}>ĐÃ DUYỆT</option>
                            <option value="locked" style="background:#fff; color:#333;" ${currentStatus === 'locked' ? 'selected' : ''}>KHÓA</option>
                        </select>
                    </td>
                    <td>
                        <div class="action-group">
                            <button class="btn-round-action edit" title="Sửa hồ sơ chuyên sâu" onclick="editDossier('${u.id}')">
                                <i class="fa-solid fa-user-pen"></i>
                            </button>
                            <button class="btn-round-action print" title="In hồ sơ" onclick="printDossier('${u.id}')">
                                <i class="fa-solid fa-print"></i>
                            </button>
                            <button class="btn-action btn-delete" title="Xóa tài khoản" onclick="deleteUser('${u.id}')">
                                <i class="fa-solid fa-user-minus"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Update breadcrumb
    document.getElementById('breadcrumb-path').innerHTML = ` <i class="fa-solid fa-chevron-right"></i> <span style="color: #2b579a; font-weight: bold;">${displayTitle}</span>`;

    // Switch views
    folderView.style.display = 'none';
    tableView.style.display = 'block';
    
    // Show back button
    const backBtn = document.getElementById('account-back-btn');
    if (backBtn) {
        backBtn.style.display = 'inline-flex';
    }

    // Update header to include checkbox
    const tableHead = tableView.querySelector('thead tr');
    if (tableHead && !tableHead.querySelector('.select-all-cell')) {
        const th = document.createElement('th');
        th.className = 'select-all-cell';
        th.style.width = '40px';
        th.style.textAlign = 'center';
        th.innerHTML = '<input type="checkbox" onchange="toggleAllAccounts(this)">';
        tableHead.prepend(th);
    }
}

function navigateToFolder(organizationName) {
    const newHash = `accounts-folder-${encodeURIComponent(organizationName)}`;
    if (window.location.hash === '#' + newHash) {
        // If hash is same, manually trigger render to fix "no response"
        renderEmployeeList(organizationName);
    } else {
        window.location.hash = newHash;
    }
}

function navigateToAccountsRoot() {
    window.location.hash = 'accounts';
}

function editDossier(id) {
    const sid = pb.createSecureId(id);
    window.open(`nhap-lieu-ho-so.html?id=${sid}&session=${Date.now()}`, '_blank');
}

function printDossier(id) {
    const sid = pb.createSecureId(id);
    window.open(`chi-tiet-thanh-vien.html?v=${sid}&sys=SECURE`, '_blank');
}

async function changeAccountStatus(id, newStatus) {
    if (!confirm(`Xác nhận cập nhật trạng thái tài khoản thành: ${newStatus.toUpperCase()}?`)) {
        loadAccounts(); // Revert select
        return;
    }
    try {
        let data = {};
        if (newStatus === 'pending') {
            data = { approved: false, verified: false };
        } else if (newStatus === 'approved') {
            data = { approved: true, verified: false };
        } else if (newStatus === 'locked') {
            data = { approved: false, verified: true };
        }
        await pb.collection('users').update(id, data);
        showStatusModal("THÀNH CÔNG", "Trạng thái tài khoản đã được cập nhật.", "success");
        loadAccounts();
    } catch (e) {
        showStatusModal("LỖI", "Không thể cập nhật: " + e.message, "error");
        loadAccounts(); // Revert select
    }
}

async function changeRole(id, newRole) {
    try {
        await pb.collection('users').update(id, { role: newRole });
        showToast("Đã cập nhật vai trò: " + newRole, "success");
    } catch (e) {
        showToast("Lỗi phân quyền: " + e.message, "error");
    }
}

async function deleteUser(id) {
    if (!confirm("Xoá vĩnh viễn tài khoản cán bộ này? Thao tác không thể hoàn tác!")) return;
    try {
        await pb.collection('users').delete(id);
        showStatusModal("ĐÃ XOÁ", "Tài khoản đã được gỡ bỏ khỏi hệ thống.", "success");
        loadAccounts();
    } catch (e) {
        showStatusModal("LỖI", "Không thể xoá: " + e.message, "error");
    }
}

// --- ACCOUNT ENHANCEMENTS (NEW) ---

function toggleAccountSelection(id) {
    if (accountSelectedIds.has(id)) {
        accountSelectedIds.delete(id);
    } else {
        accountSelectedIds.add(id);
    }
    updateAccountBulkBar();
    renderEmployeeList(currentOrgContext);
}

function toggleAllAccounts(masterCheckbox) {
    const employees = (window.allUsers || []).filter(u => {
        const org = u.organization || u.org || 'Chưa cập nhật';
        return org === currentOrgContext;
    });

    if (masterCheckbox.checked) {
        employees.forEach(u => accountSelectedIds.add(u.id));
    } else {
        employees.forEach(u => accountSelectedIds.delete(u.id));
    }
    updateAccountBulkBar();
    renderEmployeeList(currentOrgContext);
}

function updateAccountBulkBar() {
    const bar = document.getElementById('account-bulk-actions');
    const countEl = document.getElementById('account-selected-count');
    if (!bar || !countEl) return;

    if (accountSelectedIds.size > 0) {
        bar.style.display = 'flex';
        countEl.innerText = `${accountSelectedIds.size} cán bộ đã chọn`;
    } else {
        bar.style.display = 'none';
    }
}

async function renameCurrentOrg() {
    const newName = prompt(`Nhập tên mới cho đơn vị "${currentOrgContext}":`, currentOrgContext);
    if (!newName || newName === currentOrgContext) return;

    const employees = (window.allUsers || []).filter(u => {
        const org = u.organization || u.org || 'Chưa cập nhật';
        return org === currentOrgContext;
    });

    if (employees.length === 0) return;

    showToast(`Đang đổi tên ${employees.length} hồ sơ...`, "info");
    try {
        for (const u of employees) {
            await pb.collection('users').update(u.id, { organization: newName });
        }
        showStatusModal("THÀNH CÔNG", `Đã đổi tên đơn vị thành "${newName}" cho ${employees.length} cán bộ.`, "success");
        currentOrgContext = newName;
        window.location.hash = `accounts-folder-${encodeURIComponent(newName)}`;
        loadAccounts();
    } catch (e) {
        showStatusModal("LỖI", "Không thể đổi tên: " + e.message, "error");
    }
}

function addSingleUserToCurrentOrg() {
    const modal = document.getElementById('add-user-modal');
    if (!modal) return;

    // Reset fields
    document.getElementById('add-user-name').value = '';
    document.getElementById('add-user-email').value = '';
    document.getElementById('add-user-position').value = '';
    document.getElementById('add-user-password').value = '';
    document.getElementById('add-user-org').value = currentOrgContext;

    modal.style.display = 'flex';
}

async function submitNewUser() {
    const name = document.getElementById('add-user-name').value.trim();
    const email = document.getElementById('add-user-email').value.trim();
    const position = document.getElementById('add-user-position').value.trim();
    const password = document.getElementById('add-user-password').value.trim();
    const org = currentOrgContext;

    if (!name || !email || !password) {
        showToast("Vui lòng nhập đầy đủ các trường bắt buộc (*)", "warning");
        return;
    }

    if (password.length < 8) {
        showToast("Mật khẩu phải có ít nhất 8 ký tự", "warning");
        return;
    }

    showToast("Đang khởi tạo tài khoản...", "info");
    try {
        const data = {
            name: name,
            email: email,
            username: email.split('@')[0] + '_' + Math.floor(Math.random() * 1000),
            password: password,
            passwordConfirm: password,
            position: position,
            organization: org,
            approved: true
        };

        await pb.collection('users').create(data);
        showStatusModal("THÀNH CÔNG", `Đã thêm cán bộ "${name}" vào hệ thống thành công.`, "success");
        closeModal('add-user-modal');
        loadAccounts();
    } catch (e) {
        showStatusModal("LỖI KHỞI TẠO", "Không thể tạo tài khoản: " + e.message, "error");
    }
}

function triggerCSVImport() {
    document.getElementById('account-csv-import').click();
}

async function handleCSVImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const rows = text.split('\n').filter(r => r.trim() !== '');
        
        let startIdx = 0;
        if (rows[0].toLowerCase().includes('tên') || rows[0].toLowerCase().includes('name')) {
            startIdx = 1;
        }

        showToast(`Đang nhập ${rows.length - startIdx} cán bộ...`, "info");
        let count = 0;

        for (let i = startIdx; i < rows.length; i++) {
            const cols = rows[i].split(',').map(c => c.trim());
            if (cols.length < 2) continue;

            try {
                await pb.collection('users').create({
                    name: cols[0],
                    email: cols[1],
                    position: cols[2] || '',
                    organization: currentOrgContext,
                    username: cols[1].split('@')[0] + '_' + Math.floor(Math.random() * 1000),
                    password: 'password123',
                    passwordConfirm: 'password123',
                    approved: true
                });
                count++;
            } catch (err) {
                console.warn(`Bỏ qua dòng ${i}:`, err.message);
            }
        }

        showStatusModal("HOÀN TẤT", `Đã nhập thành công ${count} cán bộ vào đơn vị.`, "success");
        input.value = '';
        loadAccounts();
    };
    reader.readAsText(file);
}

async function bulkApproveAccounts() {
    const ids = Array.from(accountSelectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Duyệt hàng loạt ${ids.length} cán bộ đã chọn?`)) return;

    try {
        for (const id of ids) {
            await pb.collection('users').update(id, { approved: true, verified: false });
        }
        showToast("Đã duyệt thành công!", "success");
        accountSelectedIds.clear();
        loadAccounts();
    } catch (e) {
        showToast("Lỗi duyệt hàng loạt: " + e.message, "error");
    }
}

async function bulkLockAccounts() {
    const ids = Array.from(accountSelectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Khóa hàng loạt ${ids.length} cán bộ đã chọn?`)) return;

    try {
        for (const id of ids) {
            await pb.collection('users').update(id, { approved: false, verified: true });
        }
        showToast("Đã khóa tài khoản thành công!", "success");
        accountSelectedIds.clear();
        loadAccounts();
    } catch (e) {
        showToast("Lỗi khóa hàng loạt: " + e.message, "error");
    }
}

async function bulkDeleteAccounts() {
    const ids = Array.from(accountSelectedIds);
    if (ids.length === 0) return;
    if (!confirm(`XÓA VĨNH VIỄN ${ids.length} cán bộ đã chọn?\nHành động này không thể hoàn tác!`)) return;

    try {
        for (const id of ids) {
            await pb.collection('users').delete(id);
        }
        showStatusModal("THÀNH CÔNG", `Đã xóa ${ids.length} hồ sơ khỏi hệ thống.`, "success");
        accountSelectedIds.clear();
        loadAccounts();
    } catch (e) {
        showToast("Lỗi xóa hàng loạt: " + e.message, "error");
    }
}