const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isAuthenticated, isAdmin, logAction } = require('../middlewares/auth');

router.use(isAuthenticated);

// List settlements
router.get('/', (req, res) => {
    const { farmer_id } = req.query;
    
    let query = `
        SELECT harvest_settlements.*, farmers.full_name, farmers.village, farmers.commune
        FROM harvest_settlements
        JOIN farmers ON harvest_settlements.farmer_id = farmers.id
        WHERE 1=1
    `;
    let params = [];
    
    if (farmer_id) {
        query += ` AND harvest_settlements.farmer_id = ?`;
        params.push(farmer_id);
    }
    
    query += ` ORDER BY harvest_settlements.id DESC`;
    
    db.all(query, params, (err, settlements) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Lỗi tải danh sách quyết toán.');
            return res.redirect('/');
        }
        
        db.all('SELECT id, full_name, phone, village, commune FROM farmers ORDER BY full_name ASC', [], (err, farmers) => {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi tải danh sách nông dân.');
                return res.redirect('/');
            }
            res.render('settlements/index', { settlements, farmers, filters: { farmer_id } });
        });
    });
});

// API: Get outstanding debts of a farmer
router.get('/api/debt/:farmer_id', (req, res) => {
    const farmer_id = req.params.farmer_id;
    const query = `
        SELECT SUM(total_debt) as totalUnpaid 
        FROM advances 
        WHERE farmer_id = ? AND status = 'Unpaid'
    `;
    db.get(query, [farmer_id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ totalUnpaid: row.totalUnpaid || 0 });
    });
});

// Create harvest settlement
router.post('/add', logAction('ADD_SETTLEMENT', 'Tạo phiếu quyết toán mùa vụ'), (req, res) => {
    let { farmer_id, product_type, quantity, unit_purchase_price, settlement_date } = req.body;
    
    quantity = parseFloat(quantity);
    unit_purchase_price = parseFloat(unit_purchase_price);
    const total_purchase_amount = quantity * unit_purchase_price;

    // Lấy tổng nợ chưa thanh toán
    db.get(`SELECT SUM(total_debt) as totalUnpaid FROM advances WHERE farmer_id = ? AND status = 'Unpaid'`, [farmer_id], (err, row) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Lỗi kiểm tra công nợ.');
            return res.redirect('/settlements');
        }

        const total_debt_deducted = row.totalUnpaid || 0;
        const final_payout = total_purchase_amount - total_debt_deducted;

        db.run(
            `INSERT INTO harvest_settlements 
            (farmer_id, product_type, quantity, unit_purchase_price, total_purchase_amount, total_debt_deducted, final_payout, settlement_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [farmer_id, product_type, quantity, unit_purchase_price, total_purchase_amount, total_debt_deducted, final_payout, settlement_date],
            function(err) {
                if (err) {
                    console.error(err);
                    req.flash('error_msg', 'Lỗi tạo phiếu quyết toán.');
                    return res.redirect('/settlements');
                }
                
                const settlementId = this.lastID;

                // Cập nhật trạng thái nợ -> Settled
                db.run(`UPDATE advances SET status = 'Settled' WHERE farmer_id = ? AND status = 'Unpaid'`, [farmer_id], (err) => {
                    if (req.session.user) {
                        db.run('UPDATE audit_logs SET details = ? WHERE id = (SELECT max(id) FROM audit_logs WHERE user_id = ?)', 
                            [`Tạo quyết toán QT-${settlementId} cho nông dân ${farmer_id}`, req.session.user.id]);
                    }
                    // Flash message template Zalo/SMS
                    const smsMessage = `[ZALO/SMS NHÁP]: GĐ Nông dân ID ${farmer_id} đã quyết toán ${quantity}kg ${product_type}. Trừ nợ: ${total_debt_deducted.toLocaleString()}đ. Thực nhận: ${final_payout.toLocaleString()}đ.`;
                    req.flash('success_msg', `Đã lưu quyết toán mùa vụ. ${smsMessage}`);
                    res.redirect('/settlements');
                });
            }
        );
    });
});

// Delete settlement 
router.post('/delete/:id', isAdmin, logAction('DELETE_SETTLEMENT', 'Hủy phiếu quyết toán'), (req, res) => {
    const id = req.params.id;
    db.get('SELECT farmer_id FROM harvest_settlements WHERE id = ?', [id], (err, settlement) => {
        if (err || !settlement) {
            req.flash('error_msg', 'Không tìm thấy phiếu.');
            return res.redirect('/settlements');
        }
        
        db.run('DELETE FROM harvest_settlements WHERE id = ?', [id], (err) => {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi xóa phiếu quyết toán.');
            } else {
                // Rollback status
                db.run(`UPDATE advances SET status = 'Unpaid' WHERE farmer_id = ?`, [settlement.farmer_id], (err) => {
                    if (req.session.user) {
                        db.run('UPDATE audit_logs SET details = ? WHERE id = (SELECT max(id) FROM audit_logs WHERE user_id = ?)', 
                            [`Hủy quyết toán QT-${id} (Nông dân ${settlement.farmer_id})`, req.session.user.id]);
                    }
                    req.flash('success_msg', 'Đã hủy phiếu quyết toán và khôi phục trạng thái nợ vật tư.');
                    res.redirect('/settlements');
                });
            }
        });
    });
});

module.exports = router;
