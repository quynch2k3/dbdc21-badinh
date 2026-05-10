/**
 * SHARED UI SYSTEM V1.12
 * Centralized Header and Footer for all TDP21 Ba Dinh pages.
 * Supports dynamic branding (logos/titles) per organization.
 */

(function () {
    // Dynamic branding configuration
    const SharedUI = {
        PAGE_CONFIG: {
            'index.html': {
                logo: 'https://lh3.googleusercontent.com/pw/AP1GczPU69TVpCvfr9Sc8Q-xfiPOKQkYoKffYiJ0rHZNcrP699bqiWJWNpR1MD7_Byewp7lIKZY_0epoQXz-k9PNj3sdk7fRgNSVwfT2tkVurGGgVYrpYSk7IYsiyksyBKqUBPJTTZbHG8tf7fgbES8MYm6m5g=w848-h859-s-no-gm?authuser=0',
                org: 'ĐẢNG ỦY - HĐND - UBND - UBMTTQVN PHƯỜNG BA ĐÌNH',
                unit: 'ĐỊA BÀN DÂN CƯ SỐ 21'
            },
            'chi-bo.html': {
                logo: 'https://lh3.googleusercontent.com/pw/AP1GczPH0X3_YBwletnvUl_QMLnGhtW8hwUjHEzexN9TwPwvc59LHxvVtr1upMwnz2ZNX0eSHkUJt_QFBerGb1_cc78MvwojSs59EGaWGhIlnYK3DX1oAwO9uXGlEGeMf3Eq8iJoanI9sYGKSLjMqtLgUXyNSg=w1234-h823-s-no-gm?authuser=0',
                org: 'ĐẢNG BỘ PHƯỜNG BA ĐÌNH',
                unit: 'CHI BỘ ĐẢNG SỐ 21'
            },
            'hoi-phu-nu.html': {
                logo: 'https://lh3.googleusercontent.com/pw/AP1GczOMYOxeIrmCkfOM3dOi5KHZLtsoB39cyCtV0eNa0CAO3SrLP31lR4H-Ogy8GRufAHF18gIztPw2kQBNqWcVQfyDJJlKEeDhH618gZGU9DHARKrw4vODe_EOdAhG6QcBkTF98byhl-eb_JduHENv-VoDnQ=w1011-h859-s-no-gm?authuser=0',
                org: 'HỘI LHPN PHƯỜNG BA ĐÌNH',
                unit: 'CHI HỘI PHỤ NỮ SỐ 21'
            },
            'mat-tran-to-quoc.html': {
                logo: 'https://lh3.googleusercontent.com/pw/AP1GczPbFrlL0BLv9jM8lZ5dUUr3zcHz94WcVnZrTXs-V4Jf-sUI49KmPnnkovGtcvovcLqzadLYAkJBWcnxcJm3GN0b2t1DIK_nVLSXSc_AZOZEgch4gt5kuKxaRLCLKU_n8e4dZR0PfORdBWGoXEgPgkgIjw=w496-h496-s-no-gm?authuser=0',
                org: 'ỦY BAN MTTQVN PHƯỜNG BA ĐÌNH',
                unit: 'BAN CÔNG TÁC MẶT TRẬN SỐ 21'
            },
            'doan-thanh-nien.html': {
                logo: 'https://lh3.googleusercontent.com/pw/AP1GczM4Og5b8naEs0GoP8C2o_vUqxhZAMSlT3k1eNNNMm8B8JYrKZS6Q0HID9Jg4ZEBN4XiUKIVW98CccTegVlhc2cqK1WWR0kNZ0hf3XLGtNuQjCT7noZ6lm9nYvTVde4Q2r38l_gKhHfHoeZ-SpZDHmZmxQ=w825-h859-s-no-gm?authuser=0',
                org: 'ĐOÀN PHƯỜNG BA ĐÌNH',
                unit: 'CHI ĐOÀN THANH NIÊN SỐ 21'
            },
            'hoi-cuu-chien-binh.html': {
                logo: 'https://lh3.googleusercontent.com/pw/AP1GczOTM0ai5M50gFS-81O5jZFlYEnkAsjaaF9PswSeLsqc-eSPQQRxwC4WVq_QsxABkd_e4yVOvOxHKp-EjPrXPJlUydFKBSZHB2tPtOwfodDHKT8El0z7z4atT_MwVr7msFHEhLYvdIPaDAQSz9gPtt31RQ=w769-h859-s-no-gm?authuser=0',
                org: 'HỘI CỰU CHIẾN BINH PHƯỜNG BA ĐÌNH',
                unit: 'CHI HỘI CỰU CHIẾN BINH SỐ 21'
            },
            'hoi-nguoi-cao-tuoi.html': {
                logo: 'https://upload.wikimedia.org/wikipedia/vi/a/af/Huy_hi%E1%BB%87u_H%E1%BB%99i_NCT.jpg',
                org: 'HỘI NGƯỜI CAO TUỔI PHƯỜNG BA ĐÌNH',
                unit: 'CHI HỘI NGƯỜI CAO TUỔI SỐ 21'
            },
            'ban-khuyen-hoc.html': {
                logo: 'https://lh3.googleusercontent.com/pw/AP1GczPU69TVpCvfr9Sc8Q-xfiPOKQkYoKffYiJ0rHZNcrP699bqiWJWNpR1MD7_Byewp7lIKZY_0epoQXz-k9PNj3sdk7fRgNSVwfT2tkVurGGgVYrpYSk7IYsiyksyBKqUBPJTTZbHG8tf7fgbES8MYm6m5g=w848-h859-s-no-gm?authuser=0',
                org: 'HỘI KHUYẾN HỌC PHƯỜNG BA ĐÌNH',
                unit: 'CHI HỘI KHUYẾN HỌC SỐ 21'
            }
        },

        UNIT_MAP: {
            'CB': 'chi-bo.html',
            'MTTQ': 'mat-tran-to-quoc.html',
            'MT': 'mat-tran-to-quoc.html',
            'PN': 'hoi-phu-nu.html',
            'PHU_NU': 'hoi-phu-nu.html',
            'DTN': 'doan-thanh-nien.html',
            'TN': 'doan-thanh-nien.html',
            'CCB': 'hoi-cuu-chien-binh.html',
            'NCT': 'hoi-nguoi-cao-tuoi.html',
            'KH': 'ban-khuyen-hoc.html'
        },

        getBrandingByCat: function (cat) {
            const page = this.UNIT_MAP[cat];
            return this.PAGE_CONFIG[page] || this.getDefaultConfig();
        },
        getDefaultConfig: function () {
            return {
                logo: 'https://lh3.googleusercontent.com/pw/AP1GczPU69TVpCvfr9Sc8Q-xfiPOKQkYoKffYiJ0rHZNcrP699bqiWJWNpR1MD7_Byewp7lIKZY_0epoQXz-k9PNj3sdk7fRgNSVwfT2tkVurGGgVYrpYSk7IYsiyksyBKqUBPJTTZbHG8tf7fgbES8MYm6m5g=w848-h859-s-no-gm?authuser=0',
                org: 'ĐẢNG ỦY - HĐND - UBND - UBMTTQVN PHƯỜNG BA ĐÌNH',
                unit: 'ĐỊA BÀN DÂN CƯ SỐ 21'
            };
        },

        getHeaderHTML: function () {
            const currentPath = window.location.pathname;
            const params = new URLSearchParams(window.location.search);
            const cat = params.get('cat');

            const fileName = (currentPath.split('/').pop() || 'index.html').split('?')[0];

            const isHome = fileName === 'index.html' || fileName === '';
            const isNews = fileName.includes('tin-tuc.html');
            const isContact = fileName.includes('lien-he.html');

            let config = this.getDefaultConfig();
            if (this.PAGE_CONFIG[fileName]) config = this.PAGE_CONFIG[fileName];

            // --- ABSOLUTE OVERRIDE VIA URL ---
            if (cat && this.UNIT_MAP[cat]) {
                const targetPage = this.UNIT_MAP[cat];
                config = this.PAGE_CONFIG[targetPage] || config;
            }

            const isAdminPage = fileName.includes('admin') || fileName.includes('quan-ly') || fileName.includes('editor') || fileName.includes('dang-nhap');
            const isArticlePage = fileName.includes('bai-viet.html');
            const showBanner = !isAdminPage && !isArticlePage;

            let bannerHtml = '';
            if (showBanner) {
                bannerHtml = `
                    <div class="global-banner" style="width: 100%; margin: 0; padding: 0; display: block; line-height: 0;">
                        <img src="https://datafiles.hanoi.gov.vn/gov-hni/1/vannt/20260506_chao%20mungDai%20hoi%20dai%20bieu%20toan%20quoc%202026.png" style="width: 100%; height: auto; display: block;">
                    </div>
                `;
            }

            return `
                <div class="gov-header">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <img src="${config.logo}" alt="Logo" class="header-logo-img" style="height: 60px;">
                        <div class="gov-header-title">
                            <p class="header-subtitle">${config.org}</p>
                            <h1 class="header-title-main">${config.unit}</h1>
                        </div>
                    </div>
                </div>

                <nav class="gov-nav">
                    <style>
                        /* Nav Flexbox Layout */
                        .nav-container-flex { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; width: 100%; position: relative; }
                        #desktop-nav-links { display: flex; flex-direction: row; }
                        
                        /* Mobile Menu Fixes */
                        @media (max-width: 768px) {
                            #desktop-nav-links { width: 100%; clear: both; background: #003366; flex-direction: column; order: 3; display: none; }
                            #desktop-nav-links > a, #desktop-nav-links > .dropdown { display: block; border-top: 1px solid rgba(255,255,255,0.1); width: 100%; box-sizing: border-box; }
                            .dropdown-content { position: static !important; width: 100%; display: none !important; background: #002244 !important; }
                            .dropdown.open .dropdown-content { display: block !important; }
                            .dropdown.open .nav-item { background: rgba(0,0,0,0.1); }
                            #mobile-menu-btn { background: transparent; border: none; color: #fff; font-size: 24px; padding: 5px 15px; cursor: pointer; display: block !important; }
                            
                            /* Hide desktop search and properly align auth menu */
                            .header-search-nav { display: none !important; }
                            #auth-menu-container { position: relative !important; right: auto !important; top: auto !important; margin-left: auto; }
                            #mobile-search-row { display: flex !important; padding: 10px 15px; gap: 10px; background: #002244; }
                            #mobile-search-row input { flex: 1; padding: 8px 12px; border: none; border-radius: 4px; font-size: 13px; }
                            #mobile-search-row button { padding: 8px 15px; background: #ffcc00; border: none; font-weight: bold; border-radius: 4px; color: #003366; cursor: pointer; }
                        }
                    </style>
                    <div class="container nav-container-flex">
                        <!-- Hamburger for mobile (hidden by default, shown via JS on mobile) -->
                        <button id="mobile-menu-btn" style="display:none;" aria-label="Menu"
                            onclick="(function(){
                                var menu=document.getElementById('desktop-nav-links');
                                var isOpen = menu.classList.toggle('open');
                                menu.style.display = isOpen ? 'flex' : 'none';
                                document.getElementById('mobile-menu-btn').innerHTML = isOpen
                                    ? '<i class=\\'fa-solid fa-xmark\\'></i>'
                                    : '<i class=\\'fa-solid fa-bars\\'></i>';
                            })()">
                            <i class="fa-solid fa-bars"></i>
                        </button>

                        <!-- Nav links -->
                        <div id="desktop-nav-links">
                            <!-- Mobile search row (hidden on desktop via CSS) -->
                            <div id="mobile-search-row" style="display:none;">
                                <input type="text" id="global-search-input-mobile" placeholder="Tìm kiếm bài viết..."
                                    onkeypress="if(event.key==='Enter') SharedUI.executeSearch(this.value)">
                                <button onclick="SharedUI.executeSearch(document.getElementById('global-search-input-mobile').value)">TÌM</button>
                            </div>
                            <a href="index.html" class="${isHome ? 'active' : ''}">TRANG CHỦ</a>
                            <div class="dropdown" onclick="(function(e){
                                if(window.innerWidth<=768){
                                    e.stopPropagation();
                                    e.currentTarget.classList.toggle('open');
                                }
                            })(event)">
                                <div class="nav-item" style="cursor:pointer; display: flex; justify-content: space-between; align-items: center;">CÁC ĐOÀN THỂ <i class="fa-solid fa-chevron-down" style="font-size:10px; margin-left: 5px;"></i></div>
                                <div class="dropdown-content">
                                    <a href="chi-bo.html">CHI BỘ ĐẢNG SỐ 21</a>
                                    <a href="mat-tran-to-quoc.html">MẶT TRẬN TỔ QUỐC</a>
                                    <a href="hoi-phu-nu.html">HỘI PHỤ NỮ</a>
                                    <a href="doan-thanh-nien.html">ĐOÀN THANH NIÊN</a>
                                    <a href="hoi-cuu-chien-binh.html">HỘI CỰU CHIẾN BINH</a>
                                    <a href="hoi-nguoi-cao-tuoi.html">HỘI NGƯỜI CAO TUỔI</a>
                                </div>
                            </div>
                            <a href="tin-tuc.html" class="${isNews ? 'active' : ''}">TIN TỨC</a>
                            <a href="lien-he.html" class="${isContact ? 'active' : ''}">LIÊN HỆ</a>
                        </div>

                        <div id="auth-menu-container" style="height: 40px; display: flex; align-items: center;">
                            <a href="admin.html" class="nav-item" style="background: #1e40af; color: #fff; line-height: 40px; padding: 0 15px; font-weight: bold; border-left: 1px solid rgba(255,255,255,0.1);">ĐĂNG NHẬP</a>
                        </div>
                    </div>
                </nav>
                ${bannerHtml}
            `;
        },

        getFooterHTML: function () {
            return `
                <footer class="gov-footer">
                    <div class="footer-grid">
                        <div class="footer-col">
                            <h4>VỀ CHÚNG TÔI</h4>
                            <p style="font-size: 12px; line-height: 1.6;">Địa bàn dân cư số 21, Phường Ba Đình, Thành phố Hà Nội. Cổng thông tin điện tử hành chính công phục vụ cư dân.</p>
                        </div>
                        <div class="footer-col">
                            <h4>LIÊN HỆ</h4>
                            <p style="font-size: 12px;">Địa chỉ: Nhà Văn Hóa Số 21, Ba Đình</p>
                            <p style="font-size: 12px;">Điện thoại: 024.3xxx.xxxx</p>
                        </div>
                        <div class="footer-col">
                            <h4>LIÊN KẾT</h4>
                            <a href="admin.html" style="color: #64748b; font-size: 12px; text-decoration: none;">Hệ thống quản trị</a>
                        </div>
                    </div>
                </footer>
                <div class="footer-bottom">
                    &copy; 2026 Bản quyền thuộc về Địa Bàn Dân Cư Số 21 - Phường Ba Đình
                </div>
            `;
        },

        init: function () {
            const currentPath = window.location.pathname;
            const fileName = (currentPath.split('/').pop() || 'index.html').split('?')[0];
            const isAdminPage = fileName.includes('admin') || fileName.includes('quan-ly') || fileName.includes('editor');

            // === AUTO MOBILE PARAM: Thêm ?mobile=1 nếu đang dùng điện thoại ===
            // Dùng query param thay vì /mobile/ path để tương thích GitHub Pages (static hosting)
            if (!isAdminPage) {
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                    || window.innerWidth <= 768;
                const urlParams = new URLSearchParams(window.location.search);
                const isMobileParam = urlParams.get('mobile') === '1';

                if (isMobile && !isMobileParam) {
                    // Thêm mobile=1 vào URL hiện tại, giữ nguyên các query params và hash
                    const sep = window.location.search ? '&' : '?';
                    const hash = window.location.hash || '';
                    const newUrl = window.location.pathname + window.location.search + sep + 'mobile=1' + hash;
                    window.location.replace(newUrl);
                    return; // Dừng init cho đến khi redirect hoàn tất
                }
            }

            // --- PAGE TITLE & META ---
            let config = this.getDefaultConfig();
            if (this.PAGE_CONFIG[fileName]) config = this.PAGE_CONFIG[fileName];

            const params = new URLSearchParams(window.location.search);
            const cat = params.get('cat');
            if (cat && this.UNIT_MAP[cat]) {
                const targetPage = this.UNIT_MAP[cat];
                config = this.PAGE_CONFIG[targetPage] || config;
            }
            document.title = `${config.unit} - ${config.org}`;

            if (!isAdminPage && !document.querySelector('.page-wrapper')) {
                // Remove any existing hardcoded headers to prevent duplicates
                const oldHeaders = document.querySelectorAll('.gov-header, .top-header, header');
                oldHeaders.forEach(h => {
                    if (!h.closest('#shared-header')) h.remove();
                });

                const bodyChildren = Array.from(document.body.children).filter(c => c.tagName !== 'SCRIPT' && c.id !== 'shared-header' && c.id !== 'shared-footer');
                const wrapper = document.createElement('div');
                wrapper.className = 'page-wrapper';

                const header = document.createElement('div');
                header.id = 'shared-header';
                wrapper.appendChild(header);

                const content = document.createElement('div');
                content.className = 'main-content-area';
                bodyChildren.forEach(child => content.appendChild(child));
                wrapper.appendChild(content);

                const footer = document.createElement('div');
                footer.id = 'shared-footer';
                wrapper.appendChild(footer);

                document.body.prepend(wrapper);
            }

            const headerTarget = document.getElementById('shared-header');
            const footerTarget = document.getElementById('shared-footer');
            if (headerTarget) headerTarget.innerHTML = this.getHeaderHTML();
            if (footerTarget) footerTarget.innerHTML = this.getFooterHTML();

            // --- INIT MOBILE NAV ---
            this.initMobileNav();

            // --- DYNAMIC BRANDING OBSERVER ---
            window.dispatchEvent(new CustomEvent('SharedUIReady', { detail: config }));

            const updateAuth = () => {
                if (window.pb && window.pb.authStore) {
                    this.updateAuthMenu(window.pb.authStore.model);
                }
            };

            if (window.pb) {
                updateAuth();
            } else {
                window.addEventListener('PBReady', updateAuth, { once: true });
            }
        },

        getBranding: function () {
            const currentPath = window.location.pathname;
            const fileName = (currentPath.split('/').pop() || 'index.html').split('?')[0];
            const params = new URLSearchParams(window.location.search);
            const cat = params.get('cat');

            let config = this.getDefaultConfig();
            if (this.PAGE_CONFIG[fileName]) config = this.PAGE_CONFIG[fileName];
            if (cat && this.UNIT_MAP[cat]) {
                const targetPage = this.UNIT_MAP[cat];
                config = this.PAGE_CONFIG[targetPage] || config;
            }
            return config;
        },

        updateAuthMenu: function (user) {
            const container = document.getElementById('auth-menu-container');
            if (!container) return;

            const searchHTML = `
                <div class="header-search-nav" style="display: inline-flex; align-items: center; margin-right: 15px; height: 40px; vertical-align: top;">
                    <div style="display: flex; align-items: center; background: #fff; border: 1px solid #1e3a8a; height: 26px;">
                        <input type="text" id="global-search-input" placeholder="Tìm kiếm bài viết..." 
                            style="height: 24px; border: none; background: transparent; color: #333; padding: 0 8px; font-size: 12px; width: 160px; outline: none; font-family: Tahoma, Arial;"
                            onkeypress="if(event.key === 'Enter') SharedUI.executeSearch(this.value)">
                        <button onclick="SharedUI.executeSearch(document.getElementById('global-search-input').value)"
                            style="height: 24px; background: #ffcc00; border: none; border-left: 1px solid #1e3a8a; color: #1e3a8a; padding: 0 10px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 5px; font-weight: bold;">
                            <i class="fa-solid fa-magnifying-glass"></i> TÌM
                        </button>
                    </div>
                </div>
            `;

            if (user) {
                const displayName = user.name || user.username || 'CÁN BỘ';
                container.innerHTML = `
                    <div style="display: flex; align-items: center;">
                        ${searchHTML}
                        <div class="dropdown">
                            <div class="nav-item" style="border-right:none; background: #1e3a8a; color: #ffcc00; cursor: pointer; height: 40px; line-height: 40px; padding: 0 15px;">
                                <i class="fa-solid fa-user"></i> ${displayName.toUpperCase()} <i class="fa-solid fa-chevron-down" style="font-size:10px"></i>
                            </div>
                            <div class="dropdown-content force-left">
                                <a href="admin.html">Quản trị hệ thống</a>
                                <a href="trang-ca-nhan.html">Trang cá nhân</a>
                                <a href="#" onclick="pb.authStore.clear(); location.reload();" style="color: #cc0000 !important;">Đăng xuất</a>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div style="display: flex; align-items: center;">
                        ${searchHTML}
                        <a href="dang-nhap.html" class="nav-item" style="border-right:none; background: #1e40af; color: #fff; line-height: 40px; height: 40px;">ĐĂNG NHẬP</a>
                    </div>
                `;
            }
        },

        initMobileNav: function () {
            var setupNav = function () {
                var btn = document.getElementById('mobile-menu-btn');
                var nav = document.getElementById('desktop-nav-links');
                if (!btn || !nav) return;

                if (window.innerWidth <= 768) {
                    btn.style.display = 'block';
                    // Only hide nav if not already toggled open
                    if (!nav.classList.contains('open')) {
                        nav.style.display = 'none';
                    }
                } else {
                    btn.style.display = 'none';
                    nav.style.display = '';
                    nav.classList.remove('open');
                }
            };
            setupNav();
            window.addEventListener('resize', setupNav);
        },

        executeSearch: function (query) {
            // Accept query from either desktop or mobile input if not passed directly
            if (!query || query.trim() === '') {
                const di = document.getElementById('global-search-input');
                const mi = document.getElementById('global-search-input-mobile');
                if (di && di.value.trim()) query = di.value.trim();
                else if (mi && mi.value.trim()) query = mi.value.trim();
            }
            if (!query || query.trim().length < 2) return;
            window.location.href = `tin-tuc.html?q=${encodeURIComponent(query.trim())}`;
        }
    };

    window.SharedUI = SharedUI;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => SharedUI.init());
    } else {
        SharedUI.init();
    }
})();
