// admin_accounts.js - Folder-based logic for account management
// Implements drill-down navigation (Folders -> User List)

let allUsers = [];
let currentOrgView = null; // null means show folder grid

const ORG_CONFIG = {
    'CB': { name: 'Chi bộ Đảng số 21', icon: 'fa-dharmachakra' },
    'MT': { name: 'Ban công tác Mặt trận', icon: 'fa-handshake' },
    'PHU_NU': { name: 'Chi hội Phụ nữ', icon: 'fa-venus' },
    'CCB': { name: 'Chi hội Cựu chiến binh', icon: 'fa-medal' },
    'TN': { name: 'Chi đoàn Thanh niên', icon: 'fa-users' },
    'NCT': { name: 'Chi hội Người cao tuổi', icon: 'fa-person-cane' },
    'KH': { name: 'Ban Khuyến học', icon: 'fa-graduation-cap' },
    'OTHER': { name: 'Nhân sự chưa phân loại', icon: 'fa-folder-minus' }
};

async function loadAccounts() {
    const container = document.getElementById('account-folder-view');
    if (!container) return;

    try {
        // Only fetch if we don't have data
        if (allUsers.length === 0) {
            allUsers = await pb.collection('users').getFullList({
                sort: 'organization,-created',
                requestKey: null
            });
        }

        if (currentOrgView) {
            renderUserList(container, currentOrgView);
        } else {
            renderFolderGrid(container);
        }
    } catch (e) {
        console.error("Load accounts error:", e);
        container.innerHTML = '<div style="color:red; padding:20px; text-align:center;">Lỗi hệ thống khi tải danh sách cán bộ.</div>';
    }
}

function renderFolderGrid(container) {
    const grouped = {};
    allUsers.forEach(u => {
        let org = u.organization || 'OTHER';
        if (org === 'DOAN_TN') org = 'TN'; // Merge
        if (!grouped[org]) grouped[org] = [];
        grouped[org].push(u);
    });

    const orgKeys = Object.keys(ORG_CONFIG);
    
    let html = `
        <div class="folder-breadcrumb" style="margin-bottom: 20px;">
            <span style="color: var(--text-muted); font-weight: bold;">HỆ THỐNG QUẢN TRỊ</span>
            <i class="fa-solid fa-chevron-right" style="margin: 0 10px; font-size: 10px; color: #ccc;"></i>
            <span style="color: var(--gov-blue); font-weight: 800;">NHÂN SỰ & PHÂN QUYỀN</span>
        </div>
        
        <div class="folder-grid">
    `;

    orgKeys.forEach(key => {
        const config = ORG_CONFIG[key];
        const count = (grouped[key] || []).length;
        
        html += `
            <div class="folder-item" onclick="viewOrg('${key}')">
                <div class="folder-icon">
                    <i class="fa-solid fa-folder"></i>
                </div>
                <div class="folder-name">${config.name}</div>
                <div class="folder-count">${count} Cán bộ</div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function viewOrg(key) {
    currentOrgView = key;
    loadAccounts();
}

function backToFolders() {
    currentOrgView = null;
    loadAccounts();
}

function renderUserList(container, orgKey) {
    const users = allUsers.filter(u => {
        let org = u.organization || 'OTHER';
        if (org === 'DOAN_TN') org = 'TN';
        return org === orgKey;
    });

    const config = ORG_CONFIG[orgKey];

    let html = `
        <div class="folder-breadcrumb" style="margin-bottom: 20px;">
            <a onclick="backToFolders()">NHÂN SỰ & PHÂN QUYỀN</a>
            <i class="fa-solid fa-chevron-right" style="margin: 0 10px; font-size: 10px; color: #ccc;"></i>
            <span style="color: var(--gov-blue); font-weight: 800;">${config.name.toUpperCase()}</span>
        </div>

        <div class="folder-detail-view">
            <div class="folder-view-header">
                <div class="folder-view-title">
                    <i class="fa-solid fa-folder-open" style="color: #fcd34d;"></i>
                    ${config.name}
                </div>
                <button class="btn btn-sm btn-secondary" onclick="backToFolders()" style="padding: 5px 15px; font-weight: bold; font-size: 11px;">
                    <i class="fa-solid fa-arrow-left"></i> QUAY LẠI
                </button>
            </div>
            <div style="padding: 0; overflow-x: auto;">
                <table class="admin-table" style="margin:0; border:none; width: 100%;">
                    <thead>
                        <tr>
                            <th style="width: 50px; text-align:center;">STT</th>
                            <th>CÁN BỘ</th>
                            <th>CHỨC VỤ / ĐƠN VỊ</th>
                            <th style="width: 150px;">VAI TRÒ</th>
                            <th style="width: 180px;">TRẠNG THÁI</th>
                            <th style="width: 120px; text-align:right;">THAO TÁC</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (users.length === 0) {
        html += `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #64748b;">Chưa có cán bộ nào trong đơn vị này.</td></tr>`;
    } else {
        users.forEach((u, idx) => {
            const isApproved = u.approved === true;
            const isLocked = u.verified === true; 
            
            let statusText = 'CHỜ PHÊ DUYỆT';
            let statusClass = 'pending';
            if (isLocked) {
                statusText = 'ĐÃ KHÓA';
                statusClass = 'locked';
            } else if (isApproved) {
                statusText = 'ĐÃ PHÊ DUYỆT';
                statusClass = 'approved';
            }

            const avatarUrl = u.avatar 
                ? pb.files.getUrl(u, u.avatar) 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.username)}&background=random&color=fff`;

            html += `
                <tr>
                    <td style="text-align:center; font-weight:bold; color:#64748b;">${idx + 1}</td>
                    <td>
                        <div class="user-info-cell">
                            <img src="${avatarUrl}" class="user-avatar-sm" onerror="this.src='https://ui-avatars.com/api/?name=User&background=ccc'">
                            <div>
                                <div class="user-name-bold">${(u.name || u.username).toUpperCase()}</div>
                                <div class="user-email-dim">${u.email || u.username}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: #334155; font-size: 13px;">${u.position || 'Chưa cập nhật'}</div>
                        <div style="font-size: 10px; color: #94a3b8; font-weight: bold;">${u.organization || '---'}</div>
                    </td>
                    <td>
                        <select class="form-control" style="height: 30px; font-size: 11px; padding: 0 10px; font-weight: bold;" onchange="updateUserRole('${u.id}', this.value)">
                            <option value="user" ${u.role !== 'admin' ? 'selected' : ''}>Cán bộ viên</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Quản trị viên</option>
                        </select>
                    </td>
                    <td>
                        <select class="form-control status-pill ${statusClass}" style="height: 32px; font-size: 11px; font-weight: 800; width: 100%; text-align: center;" onchange="changeAccountStatus('${u.id}', this.value)">
                            <option value="pending" ${!isApproved && !isLocked ? 'selected' : ''} style="background: #fffbeb; color: #854d0e;">CHỜ PHÊ DUYỆT</option>
                            <option value="approved" ${isApproved && !isLocked ? 'selected' : ''} style="background: #f0fdf4; color: #166534;">ĐÃ PHÊ DUYỆT</option>
                            <option value="locked" ${isLocked ? 'selected' : ''} style="background: #fef2f2; color: #991b1b;">KHÓA TÀI KHOẢN</option>
                        </select>
                    </td>
                    <td style="text-align:right;">
                        <div class="action-group">
                            <button class="btn-round-action edit" onclick="window.open('chi-tiet-thanh-vien.html?id=${u.id}', '_blank')" title="Xem chi tiết">
                                <i class="fa-solid fa-user-gear"></i>
                            </button>
                            <button class="btn-round-action print" onclick="alert('Tính năng in đang được cập nhật')" title="In thẻ cán bộ">
                                <i class="fa-solid fa-print"></i>
                            </button>
                            <button class="btn-round-action delete" onclick="deleteUser('${u.id}')" title="Xóa tài khoản">
                                <i class="fa-solid fa-user-minus"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

async function changeAccountStatus(id, newStatus) {
    if (!confirm(`Xác nhận thay đổi trạng thái tài khoản?`)) {
        loadAccounts();
        return;
    }
    try {
        let data = {};
        if (newStatus === 'approved') {
            data = { approved: true, verified: false };
        } else if (newStatus === 'locked') {
            data = { approved: false, verified: true };
        } else {
            data = { approved: false, verified: false };
        }

        await pb.collection('users').update(id, data);
        
        // Refresh local data
        const idx = allUsers.findIndex(u => u.id === id);
        if (idx !== -1) {
            allUsers[idx].approved = data.approved;
            allUsers[idx].verified = data.verified;
        }

        if (typeof showStatusModal === 'function') {
            showStatusModal('THÀNH CÔNG', 'Đã cập nhật trạng thái cán bộ.', 'success');
        }
        
        loadAccounts();
    } catch (e) {
        console.error("Update status error:", e);
        alert("Lỗi: " + e.message);
        loadAccounts();
    }
}

async function updateUserRole(id, role) {
    try {
        await pb.collection('users').update(id, { role: role });
        
        // Update local data
        const idx = allUsers.findIndex(u => u.id === id);
        if (idx !== -1) allUsers[idx].role = role;

        if (typeof showStatusModal === 'function') {
            showStatusModal('THÀNH CÔNG', 'Đã phân quyền cán bộ thành công.', 'success');
        }
    } catch (e) {
        console.error("Update role error:", e);
        alert("Lỗi: " + e.message);
    }
}

function deleteUser(id) {
    if (confirm('BẠN CÓ CHẮC CHẮN MUỐN XÓA TÀI KHOẢN NÀY?\nHành động này không thể hoàn tác.')) {
        pb.collection('users').delete(id).then(() => {
            allUsers = allUsers.filter(u => u.id !== id);
            loadAccounts();
        }).catch(e => alert("Lỗi xóa: " + e.message));
    }
}

// Auto-load when view becomes active
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.id === 'view-accounts' && target.classList.contains('active')) {
                    loadAccounts();
                }
            }
        });
    });

    const viewAccounts = document.getElementById('view-accounts');
    if (viewAccounts) {
        observer.observe(viewAccounts, { attributes: true });
        // Also check if it's already active (e.g. on direct link/refresh)
        if (viewAccounts.classList.contains('active')) {
            loadAccounts();
        }
    }
});

