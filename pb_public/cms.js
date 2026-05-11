/** 
 * CMS CLIENT SCRIPT - POCKETBASE VERSION 
 * LAST UPDATED: V1.12
 */

// ----- AUTO HTML URL ENFORCER -----
(function enforceHtmlExtension() {
    const p = window.location.pathname;
    if (p !== '/' && !p.endsWith('.html') && !p.endsWith('/')) {
        const newUrl = p + '.html' + window.location.search + window.location.hash;
        window.history.replaceState(null, '', newUrl);
    }
})();

// ----- CONFIG -----
const PB_PORT = '8090';
const TUNNEL_URL = 'https://e9a8c7177c3eca.lhr.life';
const API_BASE_URL = (typeof MediaSystem !== 'undefined')
    ? MediaSystem.BACKEND_URL + '/api/collections'
    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'))
        ? `http://${window.location.hostname}:${PB_PORT}/api/collections`
        : TUNNEL_URL + '/api/collections';

function getPbFileUrl(record, filename) {
    if (!filename) return '';
    if (filename.startsWith('http')) return filename;
    if (typeof MediaSystem !== 'undefined') return MediaSystem.getFileUrl(record, filename);
    const base = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? `http://${window.location.hostname}:${PB_PORT}` : REMOTE_URL;
    const collection = record.collectionId || record.collectionName || 'articles';
    return `${base}/api/files/${collection}/${record.id}/${filename}`;
}

const map = { 
    'MT': 'mat-tran-to-quoc.html', 
    'PHU_NU': 'hoi-phu-nu.html', 
    'CCB': 'hoi-cuu-chien-binh.html', 
    'TN': 'doan-thanh-nien.html', 
    'NCT': 'hoi-nguoi-cao-tuoi.html', 
    'CB': 'chi-bo.html', 
    'KH': 'ban-khuyen-hoc.html',
    'TIN_TUC': 'tin-tuc.html'
};

function getCategoryPage(catCode) {
    return 'bai-viet.html?';
}

// ----- HELPERS -----
function formatDateDisplay(dateVal, showTime = false) {
    if (!dateVal) return '';
    try {
        const date = new Date(dateVal);
        if (isNaN(date.getTime())) return dateVal;
        const datePart = date.toLocaleDateString('vi-VN');
        if (showTime) {
            const timePart = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
            return `${timePart} - ${datePart}`;
        }
        return datePart;
    } catch (e) { return dateVal; }
}

function slugify(text) {
    if (!text) return "";
    return text.toString().toLowerCase()
        .replace(/á|à|ả|ạ|ã|ă|ắ|ằ|ẳ|ặ|ẵ|â|ấ|ầ|ẩ|ậ|ẫ/g, "a")
        .replace(/é|è|ẻ|ẹ|ẽ|ê|ế|ề|ể|ệ|ễ/g, "e")
        .replace(/i|í|ì|ỉ|ị|ĩ/g, "i")
        .replace(/ó|ò|ỏ|ọ|õ|ô|ố|ồ|ổ|ộ|ỗ|ơ|ớ|ờ|ở|ợ|ỡ/g, "o")
        .replace(/ú|ù|ủ|ụ|ũ|ư|ứ|ừ|ử|ự|ữ/g, "u")
        .replace(/ý|ỳ|ỷ|ỵ|ỹ/g, "y")
        .replace(/đ/g, "d")
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// ----- RENDERING -----
function renderNewsItemHTML(item, index, forceFeatured = false) {
    const pageUrl = getCategoryPage(item.category);
    const imgId = `img-${item.id}-${Math.floor(Math.random()*1000)}`;
    const displayDate = formatDateDisplay(item.publish_date || item.created, true);
    
    const cat = item.category || 'TIN_TUC';
    const slug = slugify(item.title);
    let link = `${pageUrl}id=${item.id}&cat=${cat}`;
    if (typeof GovSecure !== 'undefined') {
        const token = GovSecure.encodeToken(item.id, cat);
        const dummy = `trace=sys_${Math.floor(Math.random()*1000)}`;
        link = `${pageUrl}token=${token}&${dummy}&slug=${slug}`;
    }
    
    return `
        <div class="news-item-horizontal">
            <div class="news-item-img">
                <img id="${imgId}" src="https://placehold.co/600x400/f1f5f9/64748b?text=..." alt="${item.title}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div class="news-item-content">
                <a href="${link}" class="news-item-title">${item.title}</a>
                <p class="news-item-summary">${item.summary || ''}</p>
                <div class="news-item-meta">
                    <i class="fa-regular fa-calendar-days"></i> ${displayDate}
                </div>
            </div>
        </div>
    `;
}

// ----- CORE FUNCTIONS -----
async function loadNews(category, containerId, limit = 10) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        let url = `${API_BASE_URL}/articles/records?perPage=${limit}&sort=-publish_date,-created`;
        if (category && category !== 'ALL' && category !== 'TRANG_CHU') {
            url += `&filter=(category='${category}')`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error("Lỗi tải tin tức");
        const data = await response.json();
        const records = data.items || [];
        if (records.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px;">Chưa có dữ liệu.</div>';
            return;
        }
        container.innerHTML = records.map((item, idx) => renderNewsItemHTML(item, idx, false)).join('');
        
        // Post-render: load images securely
        records.forEach(item => {
            const imgEl = document.querySelector(`[id^="img-${item.id}"]`);
            if (imgEl && window.pb && pb.loadSecureImage) {
                pb.loadSecureImage(imgEl, item, item.image);
            }
        });
    } catch (e) {
        console.error("Load News Error:", e);
        container.innerHTML = '<div class="text-center">Lỗi kết nối dữ liệu.</div>';
    }
}

// Auto-init for common views
document.addEventListener('DOMContentLoaded', () => {
    startClock();
    fetchWeather();
    initBackToTop();
    
    const runLoadNews = () => {
        if (document.getElementById('qt-homepage-news') && !window.loadNewsDefinedLocally) {
            loadNews('TRANG_CHU', 'qt-homepage-news', 6);
        }
    };

    if (typeof pb !== 'undefined') {
        runLoadNews();
    } else {
        window.addEventListener('PBReady', runLoadNews, { once: true });
    }
});

function startClock() {
    function update() {
        const now = new Date();
        const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
        if (document.getElementById('current-time')) document.getElementById('current-time').innerText = now.toLocaleTimeString('vi-VN', { hour12: false });
        if (document.getElementById('current-date')) document.getElementById('current-date').innerText = `${days[now.getDay()]}, ${now.toLocaleDateString('vi-VN')}`;
    }
    setInterval(update, 1000);
    update();
}

async function fetchWeather() {
    const el = document.getElementById('current-weather');
    if (!el) return;
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current_weather=true');
        const data = await res.json();
        if (data.current_weather) el.innerText = `Hà Nội: ${Math.round(data.current_weather.temperature)}°C`;
    } catch (e) {}
}

function initBackToTop() {
    const btn = document.getElementById('btn-back-to-top');
    if (!btn) return;
    window.onscroll = () => {
        btn.style.display = (window.scrollY > 300) ? 'block' : 'none';
    };
    btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}