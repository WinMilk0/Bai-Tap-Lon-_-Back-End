const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isAuthenticated, isAdmin, logAction } = require('../middlewares/auth');
const exceljs = require('exceljs');

router.use(isAuthenticated);

// Trang Audit Logs
router.get('/audit-logs', isAdmin, (req, res) => {
    const query = `
        SELECT audit_logs.*, users.username, users.full_name 
        FROM audit_logs 
        LEFT JOIN users ON audit_logs.user_id = users.id 
        ORDER BY audit_logs.id DESC 
        LIMIT 100
    `;
    db.all(query, [], (err, logs) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Không thể tải lịch sử thao tác.');
            return res.redirect('/');
        }
        res.render('audit_logs', { logs });
    });
});

// Xuất file Excel Nông Dân
router.get('/export/farmers', isAdmin, logAction('EXPORT_FARMERS', 'Xuất Excel Danh sách nông dân'), async (req, res) => {
    db.all('SELECT * FROM farmers ORDER BY id DESC', [], async (err, farmers) => {
        if (err) return res.redirect('/farmers');

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Danh Sách Nông Dân');

        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Họ và Tên', key: 'full_name', width: 30 },
            { header: 'Số Điện Thoại', key: 'phone', width: 20 },
            { header: 'Địa Chỉ', key: 'address', width: 40 },
            { header: 'Thôn', key: 'village', width: 20 },
            { header: 'Xã', key: 'commune', width: 20 },
            { header: 'Ngày Tạo', key: 'created_at', width: 20 }
        ];

        farmers.forEach(farmer => {
            worksheet.addRow(farmer);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'DanhSachNongDan.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    });
});

// Xuất file Excel Công nợ
router.get('/export/advances', isAdmin, logAction('EXPORT_ADVANCES', 'Xuất Excel Danh sách công nợ'), async (req, res) => {
    const query = `
        SELECT a.*, f.full_name, f.phone 
        FROM advances a 
        JOIN farmers f ON a.farmer_id = f.id 
        ORDER BY a.id DESC
    `;
    db.all(query, [], async (err, advances) => {
        if (err) return res.redirect('/advances');

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Báo Cáo Công Nợ');

        worksheet.columns = [
            { header: 'Mã Phiếu', key: 'code', width: 15 },
            { header: 'Nông Dân', key: 'full_name', width: 30 },
            { header: 'SĐT', key: 'phone', width: 20 },
            { header: 'Loại Vật Tư', key: 'item_type', width: 20 },
            { header: 'Số Lượng', key: 'quantity', width: 15 },
            { header: 'Đơn Giá', key: 'unit_price', width: 15 },
            { header: 'Tổng Tiền (VNĐ)', key: 'total_debt', width: 20 },
            { header: 'Trạng Thái', key: 'status', width: 20 },
            { header: 'Ngày Ghi Nhận', key: 'debt_date', width: 20 }
        ];

        advances.forEach(adv => {
            worksheet.addRow({
                ...adv,
                code: `ADV-${String(adv.id).padStart(4, '0')}`,
                item_type: adv.item_type === 'Seed' ? 'Giống' : 'Phân bón',
                status: adv.status === 'Settled' ? 'Đã Quyết Toán' : 'Chưa Thanh Toán'
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'BaoCaoCongNo.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    });
});

// Trang in phiếu quyết toán
router.get('/print/settlement/:id', (req, res) => {
    const id = req.params.id;
    const query = `
        SELECT s.*, f.full_name, f.phone, f.address, f.village, f.commune 
        FROM harvest_settlements s 
        JOIN farmers f ON s.farmer_id = f.id 
        WHERE s.id = ?
    `;
    db.get(query, [id], (err, settlement) => {
        if (err || !settlement) {
            req.flash('error_msg', 'Không tìm thấy phiếu quyết toán.');
            return res.redirect('/settlements');
        }
        res.render('settlements/print', { settlement, layout: false });
    });
});

module.exports = router;
