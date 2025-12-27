const workspaceRouter = require('./workspaces');
const boardRouter = require('./boards');
const authRouter = require('./auth');
const meRouter = require('./users');

function router(app) {
    // Workspace routes
    app.use('/api/workspaces', workspaceRouter);

    // Board routes
    app.use('/api/boards', boardRouter);

    // Auth routes
    app.use('/api/auth', authRouter);

    // User routes
    app.use('/api/users', meRouter);
}

module.exports = router;
