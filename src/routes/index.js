const workspaceRouter = require('./workspaces');
const boardRouter = require('./boards');
const listRouter = require('./list');
const authRouter = require('./auth');
const meRouter = require('./users');

function router(app) {
    // List board routes
    app.use('/api/boards/:boardId/lists', listRouter);

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
