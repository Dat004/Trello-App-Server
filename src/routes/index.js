const authRouter = require('./auth');
const meRouter = require('./users');
const errorHandler = require('../middlewares/errorMiddleware');

function router(app) {
    // Auth routes
    app.use('/api/auth', authRouter);

    // User routes
    app.use('/api/users', meRouter)
}

module.exports = router;
