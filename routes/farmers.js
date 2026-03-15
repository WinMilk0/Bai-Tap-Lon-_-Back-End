const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isAuthenticated, isAdmin, logAction } = require('../middlewares/auth');

router.use(isAuthenticated);

// List farmers
router.get('/', (req, res) => {
    const { commune, village } = req.query;
    let query = 'SELECT * FROM farmers';
    let params = [];
    
    if (commune && village) {
        query += ' WHERE commune = ? AND village = ?';
        params.push(commune, village);
    } else if (commune) {
        query += ' WHERE commune = ?';
        params.push(commune);
    } else if (village) {
        query += ' WHERE village = ?';
        params.push(village);
    }
    
    query += ' ORDER BY id DESC';

    db.all(query, params, (err, farmers) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Lỗi tải danh sách nông dân.');
            return res.redirect('/');
        }
        res.render('farmers/index', { farmers, filters: { commune, village } });
    });
});

// Add farmer
router.post('/add', logAction('ADD_FARMER', 'Thêm nông dân mới'), (req, res) => {
    const { full_name, phone, address, village, commune } = req.body;
    db.run(
        'INSERT INTO farmers (full_name, phone, address, village, commune) VALUES (?, ?, ?, ?, ?)',
        [full_name, phone, address, village, commune],
        function(err) {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi thêm nông dân.');
            } else {
                // Mở rộng log details
                if (req.session.user) {
                    db.run('UPDATE audit_logs SET details = ? WHERE id = (SELECT max(id) FROM audit_logs WHERE user_id = ?)', 
                        [`Thêm nông dân: ${full_name} (ID: ${this.lastID})`, req.session.user.id]);
                }
                req.flash('success_msg', 'Thêm nông dân thành công.');
            }
            res.redirect('/farmers');
        }
    );
});

// Edit farmer
router.post('/edit/:id', isAdmin, logAction('EDIT_FARMER', 'Cập nhật thông tin nông dân'), (req, res) => {
    const id = req.params.id;
    const { full_name, phone, address, village, commune } = req.body;
    db.run(
        'UPDATE farmers SET full_name = ?, phone = ?, address = ?, village = ?, commune = ? WHERE id = ?',
        [full_name, phone, address, village, commune, id],
        (err) => {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi cập nhật nông dân.');
            } else {
                if (req.session.user) {
                    db.run('UPDATE audit_logs SET details = ? WHERE id = (SELECT max(id) FROM audit_logs WHERE user_id = ?)', 
                        [`Sửa thông tin nông dân ID: ${id}`, req.session.user.id]);
                }
                req.flash('success_msg', 'Cập nhật nông dân thành công.');
            }
            res.redirect('/farmers');
        }
    );
});

// Delete farmer
router.post('/delete/:id', isAdmin, logAction('DELETE_FARMER', 'Xóa nông dân'), (req, res) => {
    const id = req.params.id;
    // For SQLite, cascade delete is enabled if foreign_keys = ON, meaning advances/settlements will also be deleted.
    db.run('DELETE FROM farmers WHERE id = ?', [id], (err) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Lỗi xóa nông dân.');
        } else {
            if (req.session.user) {
                db.run('UPDATE audit_logs SET details = ? WHERE id = (SELECT max(id) FROM audit_logs WHERE user_id = ?)', 
                    [`Xóa nông dân ID: ${id}`, req.session.user.id]);
            }
            req.flash('success_msg', 'Xóa nông dân thành công.');
        }
        res.redirect('/farmers');
    });
});

module.exports = router;
