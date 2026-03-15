const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.flash('error_msg', 'Vui lòng đăng nhập để tiếp tục.');
    res.redirect('/auth/login');
};

const isGuest = (req, res, next) => {
    if (!req.session.user) {
        return next();
    }
    res.redirect('/');
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error_msg', 'Bạn không có quyền truy cập chức năng này.');
    res.redirect('back');
};

const db = require('../database/db');
const logAction = (action, details) => {
    return (req, res, next) => {
        const userId = req.session.user ? req.session.user.id : null;
        if (userId) {
            db.run('INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)', [userId, action, details]);
        }
        next();
    };
};

module.exports = {
    isAuthenticated,
    isGuest,
    isAdmin,
    logAction
};
