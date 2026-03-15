const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: 'contract_farming_system_secret_key',
    resave: false,
    saveUninitialized: false
}));

app.use(flash());

// Global variables for views
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null;
    next();
});

const { isAuthenticated } = require('./middlewares/auth');

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));

app.get('/policy', (req, res) => {
    res.render('policy');
});

app.get('/', isAuthenticated, (req, res) => {
    const stats = { totalFarmers: 0, totalAdvances: 0, totalHarvestQuantity: 0, totalPayout: 0 };
    db.get('SELECT COUNT(*) as count FROM farmers', [], (err, row) => {
        if (!err) stats.totalFarmers = row.count || 0;
        db.get('SELECT SUM(total_debt) as sum FROM advances', [], (err, row) => {
            if (!err) stats.totalAdvances = row.sum || 0;
            db.get('SELECT SUM(quantity) as qty, SUM(final_payout) as payout FROM harvest_settlements', [], (err, row) => {
                if (!err) {
                    stats.totalHarvestQuantity = row.qty || 0;
                    stats.totalPayout = row.payout || 0;
                }
                res.render('dashboard', { stats });
            });
        });
    });
});

// Import route handlers (bỏ comment sau)
app.use('/farmers', require('./routes/farmers'));
app.use('/advances', require('./routes/advances'));
app.use('/settlements', require('./routes/settlements'));
app.use('/', require('./routes/system'));

// Start server
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
