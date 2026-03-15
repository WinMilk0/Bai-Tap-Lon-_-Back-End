const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { isGuest } = require('../middlewares/auth');

// Trang đăng nhập
router.get('/login', isGuest, (req, res) => {
    res.render('login');
});

// Xử lý đăng nhập
router.post('/login', isGuest, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin.');
        return res.redirect('/auth/login');
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error_msg', 'Lỗi máy chủ.');
            return res.redirect('/auth/login');
        }
        
        if (!user) {
            req.flash('error_msg', 'Tên đăng nhập không tồn tại.');
            return res.redirect('/auth/login');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (isMatch) {
            req.session.user = { id: user.id, username: user.username, role: user.role, full_name: user.full_name, avatar: user.avatar };
            req.flash('success_msg', 'Đăng nhập thành công!');
            res.redirect('/');
        } else {
            req.flash('error_msg', 'Mật khẩu không chính xác.');
            res.redirect('/auth/login');
        }
    });
});

// Trang đăng ký
router.get('/register', isGuest, (req, res) => {
    res.render('register');
});

// Xử lý đăng ký
router.post('/register', isGuest, async (req, res) => {
    const { username, password, confirm_password, full_name } = req.body;

    if (!username || !password || !confirm_password) {
        req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin.');
        return res.redirect('/auth/register');
    }

    if (password !== confirm_password) {
        req.flash('error_msg', 'Mật khẩu xác nhận không khớp.');
        return res.redirect('/auth/register');
    }

    if (password.length < 6) {
        req.flash('error_msg', 'Mật khẩu phải có ít nhất 6 ký tự.');
        return res.redirect('/auth/register');
    }

    db.get('SELECT username FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error(err);
            req.flash('error_msg', 'Lỗi kiểm tra cơ sở dữ liệu.');
            return res.redirect('/auth/register');
        }

        if (user) {
            req.flash('error_msg', 'Tên đăng nhập này đã tồn tại.');
            return res.redirect('/auth/register');
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        db.run('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)', [username, hash, full_name, 'admin'], (err) => {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi khi lưu người dùng mới.');
                return res.redirect('/auth/register');
            }
            req.flash('success_msg', 'Đăng ký thành công, tài khoản Admin đã được tạo.');
            res.redirect('/auth/login');
        });
    });
});

// Đăng xuất
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
});

module.exports = router;
