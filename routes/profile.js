const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { isAuthenticated } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đảm bảo thư mục upload tồn tại
const uploadDir = path.join(__dirname, '../public/uploads/avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình Multer để lưu ảnh
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + req.session.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file ảnh!'));
        }
    }
});

router.use(isAuthenticated);

// Hiển thị trang Hồ sơ
router.get('/', (req, res) => {
    db.get('SELECT id, username, full_name, role, avatar, created_at FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
        if (err || !user) {
            req.flash('error_msg', 'Không thể tải thông tin cá nhân.');
            return res.redirect('/');
        }
        res.render('profile', { profileUser: user });
    });
});

// Cập nhật thông tin cơ bản & Avatar
router.post('/update', (req, res, next) => {
    upload.single('avatar')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                req.flash('error_msg', 'Kích thước ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB.');
            } else {
                req.flash('error_msg', 'Lỗi khi tải ảnh lên.');
            }
            return res.redirect('/profile');
        } else if (err) {
            req.flash('error_msg', err.message || 'Lỗi hệ thống khi tải ảnh lên.');
            return res.redirect('/profile');
        }
        next();
    });
}, (req, res) => {
    const { full_name } = req.body;
    let avatarPath = null;
    
    if (req.file) {
        avatarPath = '/uploads/avatars/' + req.file.filename;
    }

    if (avatarPath) {
        // Cập nhật cả họ tên và ảnh
        db.run('UPDATE users SET full_name = ?, avatar = ? WHERE id = ?', [full_name, avatarPath, req.session.user.id], function(err) {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi khi cập nhật ảnh đại diện.');
            } else {
                req.session.user.full_name = full_name;
                req.session.user.avatar = avatarPath; // Cập nhật lại session
                req.flash('success_msg', 'Cập nhật thông tin thành công!');
            }
            res.redirect('/profile');
        });
    } else {
        // Chỉ cập nhật họ tên
        db.run('UPDATE users SET full_name = ? WHERE id = ?', [full_name, req.session.user.id], function(err) {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Lỗi khi cập nhật thông tin.');
            } else {
                req.session.user.full_name = full_name;
                req.flash('success_msg', 'Cập nhật thông tin thành công!');
            }
            res.redirect('/profile');
        });
    }
});

// Đổi mật khẩu
router.post('/change-password', async (req, res) => {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
        req.flash('error_msg', 'Vui lòng điền đầy đủ thông tin mật khẩu.');
        return res.redirect('/profile');
    }

    if (new_password !== confirm_password) {
        req.flash('error_msg', 'Mật khẩu xác nhận không khớp.');
        return res.redirect('/profile');
    }

    if (new_password.length < 6) {
        req.flash('error_msg', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
        return res.redirect('/profile');
    }

    db.get('SELECT password_hash FROM users WHERE id = ?', [req.session.user.id], async (err, user) => {
        if (err || !user) {
            req.flash('error_msg', 'Lỗi hệ thống khi xác thực.');
            return res.redirect('/profile');
        }

        const isMatch = await bcrypt.compare(current_password, user.password_hash);
        if (!isMatch) {
            req.flash('error_msg', 'Mật khẩu hiện tại không chính xác.');
            return res.redirect('/profile');
        }

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(new_password, salt);

        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.session.user.id], (err) => {
            if (err) {
                console.error(err);
                req.flash('error_msg', 'Không thể cập nhật mật khẩu lúc này.');
                return res.redirect('/profile');
            }
            req.flash('success_msg', 'Đổi mật khẩu thành công!');
            res.redirect('/profile');
        });
    });
});

module.exports = router;
