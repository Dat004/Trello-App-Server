const authRouter = require('./auth');

function router(app) {
    // Auth routes
    app.use('/api/auth', authRouter);
}

module.exports = router;
