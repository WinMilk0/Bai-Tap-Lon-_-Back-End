const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isAuthenticated, isAdmin, logAction } = require('../middlewares/auth');

router.use(isAuthenticated);

// List advances with farmer info
router.get('/', (req, res) => {
    const { farmer_id, status } = req.query;
    
    let query = `
        SELECT advances.*, farmers.full_name, farmers.village, farmers.commune 
        FROM advances 
        JOIN farmers ON advances.farmer_id = farmers.id 
        WHERE 1=1
    `;
    let params = [];
    
    if (farmer_id) {
        query += ` AND advances.farmer_id = ?`;
        params.push(farmer_id);
    }
    if (status) {
        query += ` AND advances.status = ?`;
        params.push(status);
    }
    
    query += ` ORDER BY advances.id DESC`;

    db.all(query, params, (err, advances) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Lỗi tải danh sách công nợ.');
            return res.redirect('/');
        }
        
        db.all('SELECT id, full_name, village, commune FROM farmers ORDER BY full_name ASC', [], (err, farmers) => {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi dữ liệu nông dân.');
                return res.redirect('/');
            }
            res.render('advances/index', { advances, farmers, filters: { farmer_id, status } });
        });
    });
});

// Add advance
router.post('/add', logAction('ADD_ADVANCE', 'Tạo phiếu nợ vật tư'), (req, res) => {
    let { farmer_id, item_type, quantity, unit_price, debt_date, interest_rate } = req.body;
    
    quantity = parseFloat(quantity);
    unit_price = parseFloat(unit_price);
    const total_debt = quantity * unit_price;
    interest_rate = parseFloat(interest_rate) || 0; 

    db.run(
        'INSERT INTO advances (farmer_id, item_type, quantity, unit_price, total_debt, interest_rate, debt_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [farmer_id, item_type, quantity, unit_price, total_debt, interest_rate, debt_date],
        function(err) {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi ghi nhận công nợ.');
            } else {
                if (req.session.user) {
                    db.run('UPDATE audit_logs SET details = ? WHERE id = (SELECT max(id) FROM audit_logs WHERE user_id = ?)', 
                        [`Tạo phiếu nợ ADV-${this.lastID} cho nông dân ${farmer_id}`, req.session.user.id]);
                }
                req.flash('success_msg', 'Ghi nhận cấp phát vật tư thành công.');
            }
            res.redirect('/advances');
        }
    );
});

// Edit advance
router.post('/edit/:id', isAdmin, logAction('EDIT_ADVANCE', 'Cập nhật phiếu nợ vật tư'), (req, res) => {
    const id = req.params.id;
    let { item_type, quantity, unit_price, debt_date, interest_rate } = req.body;
    
    quantity = parseFloat(quantity);
    unit_price = parseFloat(unit_price);
    const total_debt = quantity * unit_price;
    interest_rate = parseFloat(interest_rate) || 0;

    // Check if status is Settled, shouldn't edit
    db.get('SELECT status FROM advances WHERE id = ?', [id], (err, advance) => {
        if (err || !advance) return res.redirect('/advances');
        if (advance.status === 'Settled') {
            req.flash('error_msg', 'Không thể sửa phiếu công nợ đã quyết toán.');
            return res.redirect('/advances');
        }

        db.run(
            'UPDATE advances SET item_type = ?, quantity = ?, unit_price = ?, total_debt = ?, interest_rate = ?, debt_date = ? WHERE id = ?',
            [item_type, quantity, unit_price, total_debt, interest_rate, debt_date, id],
            (err) => {
                if (err) {
                    req.flash('error_msg', 'Lỗi cập nhật phiếu.');
                } else {
                    if (req.session.user) {
                        db.run('UPDATE audit_logs SET details = ? WHERE id = (SELECT max(id) FROM audit_logs WHERE user_id = ?)', 
                            [`Sửa chi tiết phiếu ADV-${id}`, req.session.user.id]);
                    }
                    req.flash('success_msg', 'Cập nhật thành công.');
                }
                res.redirect('/advances');
            }
        );
    });
});

// Delete advance
router.post('/delete/:id', isAdmin, logAction('DELETE_ADVANCE', 'Xóa phiếu nợ vật tư'), (req, res) => {
    const id = req.params.id;
    db.get('SELECT status FROM advances WHERE id = ?', [id], (err, advance) => {
        if (err || !advance) {
            req.flash('error_msg', 'Không tìm thấy phiếu.');
            return res.redirect('/advances');
        }
        if (advance.status === 'Settled') {
            req.flash('error_msg', 'Không thể xóa phiếu công nợ đã quyết toán.');
            return res.redirect('/advances');
        }
        db.run('DELETE FROM advances WHERE id = ?', [id], (err) => {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi xóa phiếu.');
            } else {
                if (req.session.user) {
                    db.run('UPDATE audit_logs SET details = ? WHERE id = (SELECT max(id) FROM audit_logs WHERE user_id = ?)', 
                        [`Xóa phiếu ADV-${id}`, req.session.user.id]);
                }
                req.flash('success_msg', 'Đã xóa phiếu công nợ.');
            }
            res.redirect('/advances');
        });
    });
});

module.exports = router;
