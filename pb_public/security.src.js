/**
 * SECURITY SHIELD - ANTI-DEVTOOLS & CODE PROTECTION
 * This script protects the system by disabling common inspection tools.
 */
(function () {
    'use strict';

    // Integrity Flag
    window._ULTRA_SHIELD_ACTIVE = true;

    // 1. Disable Right-click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // 1.5. Anti-Clickjacking (Frame busting)
    if (window.top !== window.self) {
        window.top.location = window.self.location;
    }

    // 1.6. Basic Anti-XSS (Overwrite dangerous functions)
    const _originalEval = window.eval;
    window.eval = function() {
        console.warn("LỖI BẢO MẬT: Chức năng `eval()` đã bị từ chối truy cập (Level 2).");
        return null;
    };

    // 2. Disable Keyboard Shortcuts
    document.addEventListener('keydown', e => {
        // Disable F12
        if (e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        
        // Disable Ctrl+Shift+I (Inspect)
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 105)) {
            e.preventDefault();
            return false;
        }

        // Disable Ctrl+Shift+J (Console)
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 74 || e.keyCode === 106)) {
            e.preventDefault();
            return false;
        }

        // Disable Ctrl+Shift+C (Element Selector)
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 67 || e.keyCode === 99)) {
            e.preventDefault();
            return false;
        }

        // Disable Ctrl+U (View Source)
        if (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 117)) {
            e.preventDefault();
            return false;
        }

        // Disable Ctrl+S (Save Page)
        if (e.ctrlKey && (e.keyCode === 83 || e.keyCode === 115)) {
            e.preventDefault();
            return false;
        }
    });

    // 3. Advanced Multi-Layer DevTools Detection
    let isLocked = false;
    const threshold = 160;

    const getClientIP = async () => {
        try {
            const resp = await fetch('https://api.ipify.org?format=json');
            const data = await resp.json();
            return data.ip || 'N/A';
        } catch (e) {
            return 'N/A';
        }
    };

    const getLogCount = async () => {
        try {
            const currentYear = new Date().getFullYear();
            const pbUrl = 'https://playhouse-platypus-envision.ngrok-free.dev/api/collections/security_logs/records?filter=(timestamp>="' + currentYear + '-01-01")&perPage=1';
            
            const targetUrl = pbUrl.includes('ngrok-skip-browser-warning')
                ? pbUrl
                : pbUrl + (pbUrl.includes('?') ? '&' : '?') + 'ngrok-skip-browser-warning=true';
            const resp = await fetch(targetUrl);
            const data = await resp.json();
            return (data.totalItems || 0) + 1;
        } catch (e) {
            return 1;
        }
    };

    window.logAbnormalAccess = function(reason) {
        console.warn("Attempt to log globally blocked. Internal logAbnormalAccess will be used instead. " + reason);
    };

    const logAbnormalAccess = async (reason, ip, formattedNo) => {
        const pbUrl = window.location.origin + '/api/secure-log';
        const data = {
            reason: reason,
            url: window.location.href,
            agent: navigator.userAgent
        };

        const originalFetch = window._originalFetch || window.fetch;
        originalFetch(pbUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).catch(() => { });
    };

    const renderLockout = async () => {
        if (isLocked) return;
        
        // Ngoại lệ: Cho phép xem trang admin và xem log an ninh
        if (window.location.pathname.includes('admin.html') || window.location.search.includes('view-security-logs')) return;

        isLocked = true;
        
        const ip = await getClientIP();
        const nextNo = await getLogCount();
        const formattedNo = nextNo.toString().padStart(2, '0');
        
        await logAbnormalAccess("Phát hiện can thiệp hệ thống (Developer Tools)", ip, formattedNo);
        
        const now = new Date();
        const padDate = n => n.toString().padStart(2, '0');
        const currentDateStr = `Phường Ba Đình, ngày ${padDate(now.getDate())} tháng ${padDate(now.getMonth() + 1)} năm ${now.getFullYear()}`;

        document.body.innerHTML = '';
        document.head.innerHTML = `
            <title>CẢNH BÁO BẢO MẬT</title>
            <style>
                body { background: #fff; color: #000; font-family: 'Times New Roman', serif; margin:0; padding:40px; }
                .doc { max-width: 800px; margin: 0 auto; border: 1px solid #000; padding: 40px; position: relative; }
                .title { text-align: center; color: #d32f2f; font-size: 24px; font-weight: bold; text-transform: uppercase; margin: 40px 0 20px 0; }
                .info { display: flex; justify-content: space-between; font-size: 15px; margin-bottom: 30px; line-height: 1.4; }
                .content { font-size: 18px; text-align: justify; line-height: 1.6; }
                .stamp-container { display: flex; justify-content: flex-end; margin-top: 30px; margin-bottom: 20px; }
                .stamp { text-align: center; opacity: 0.8; transform: rotate(-10deg); color: #d32f2f; border: 3px double #d32f2f; padding: 15px; font-weight: bold; display: inline-block; }
                .btn { display: block; width: fit-content; margin: 40px auto; padding: 12px 30px; background: #1a73e8; color: #fff; border: none; font-weight: bold; cursor: pointer; text-transform: uppercase; }
            </style>
        `;
        document.body.innerHTML = `
            <div class="doc">
                <div class="info">
                    <div style="text-align:center;"><b>ỦY BAN NHÂN DÂN PHƯỜNG BA ĐÌNH</b><br><b>ĐỊA BÀN DÂN CƯ SỐ 21</b><br>Số: ${formattedNo}/TBBM-ĐBDC21</div>
                    <div style="text-align:center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b><br><span style="border-bottom: 1.5px solid #000; width: 140px; display: inline-block; margin-top:2px; margin-bottom:5px;"></span><br><br><i style="font-size: 16px;">${currentDateStr}</i></div>
                </div>
                <div class="title">THÔNG BÁO SỰ CỐ</div>
                <div class="content">
                    <p style="margin-top: 0; text-align: justify;">Nhằm đảm bảo an toàn thông tin mạng tuyệt đối cho hệ thống dữ liệu của Đảng và Chính quyền cơ sở, <b>Hệ thống giám sát Cổng thông tin ĐBDC Số 21</b> đã được kích hoạt thiết chế bảo vệ tự động. Cùng thời điểm này, hệ thống ghi nhận trình duyệt của thiết bị đầu cuối đang chạy chức năng rà quét, kiểm tra mã nguồn (Developer Tools / Inspect Element) trong quá trình truy cập nền tảng.</p>
                    <h3 style="font-size: 16px; margin-bottom: 5px; text-decoration: underline;">1. Hành vi ghi nhận:</h3>
                    <p style="margin-top: 0; padding-left: 10px;">Thiết bị đã cố gắng truy xuất vào cấu trúc hạ tầng ứng dụng web thông qua chức năng F12. Mặc dù tính năng này không bị cấm hoàn toàn, hệ thống thực hiện tạm thời ngắt kết nối tại thời điểm phát sinh hành vi nhằm bảo toàn tài nguyên máy chủ và phòng tránh rủi ro tự động hóa can thiệp dữ liệu.</p>
                    <h3 style="font-size: 16px; margin-bottom: 5px; text-decoration: underline;">2. Dữ liệu trích xuất do đạc điện tử:</h3>
                    <ul style="margin-top: 5px; margin-bottom: 15px;">
                        <li><b>Thời gian ghi nhận sự cố:</b> ${new Date().toLocaleString('vi-VN')}</li>
                        <li><b>Địa chỉ IP định danh:</b> <span style="color: red;">${ip}</span></li>
                        <li><b>Thiết bị & Nền tảng (User-Agent):</b> ${navigator.userAgent}</li>
                        <li><b>Đường dẫn URL ghi nhận:</b> ${window.location.href}</li>
                    </ul>
                    <h3 style="font-size: 16px; margin-bottom: 5px; text-decoration: underline;">3. Hướng giải quyết:</h3>
                    <p style="margin-top: 0; padding-left: 10px; color: #d32f2f; font-weight: bold;">Yêu cầu dừng ngay công cụ kiểm tra (Developer Tools) trước khi xác nhận tải lại!</p>
                    <p style="margin-top: 5px; padding-left: 10px; font-size: 16px;">Toàn bộ thông tin nhật ký trên đã được sao lưu trạng thái trên Server. Phiên truy cập hiện tại đã bị kiểm duyệt. Người sử dụng cần dừng công cụ dành cho nhà phát triển để có thể tiếp tục sử dụng website theo các điều khoản thông thường.</p>
                </div>
                <div class="stamp-container">
                    <div class="stamp">Hệ Thống Đã Khóa</div>
                </div>
                <button class="btn" onclick="window.location.reload()">Xác nhận & Tải lại</button>
            </div>
        `;

        // Block further execution
        throw new Error("Security Lockout Activated");
    };

    // --- Detection Engines ---

    // Engine B: Active Debugger Trap (Siêu nhạy với mọi phiên bản DevTools)
    // Nếu DevTools mở, lệnh debugger sẽ pause tiến trình. Khi Resume, khoảng nghẽn > 100ms sẽ báo cháy.
    const activeDebuggerCheck = () => {
        if (isLocked) return;
        const start = performance.now();
        (function () { })['constructor']('debugger')();
        const end = performance.now();
        if (end - start > 100) {
            renderLockout();
        }
    };

    // Engine C: Tạm thời vô hiệu hóa do nhúng nền trình duyệt
    // RegExp Trick có thể trả về false-positive trong một số bản cập nhật trình duyệt mới.

    // Engine D: Function source check (Anti-tamper)
    const funcCheck = () => {
        if (console.log.toString().includes('native code') === false) renderLockout();
    };

    // Start Monitoring
    setInterval(activeDebuggerCheck, 1500); // Quét liên tục với Debugger (1.5s)
    
    // Xóa bỏ consoleMonitor quá nhạy gây lỗi khóa vòng lặp

    // 4. Console Protection (Warning UI)
    const logWarning = () => {
        console.log("%cDừng lại!", "color:red; font-size:50px; font-weight:bold;");
        console.log("%cĐây là tính năng dành cho nhà phát triển. Việc can thiệp có thể dẫn đến mất an toàn dữ liệu.", "font-size:18px;");
    };
    logWarning();

})();