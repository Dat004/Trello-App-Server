const workspaceRouter = require('./workspaces');
const commentRouter = require('./comment');
const boardRouter = require('./boards');
const cardRouter = require('./card');
const listRouter = require('./list');
const authRouter = require('./auth');
const meRouter = require('./users');

function router(app) {
    // Comment card routes
    app.use('/api/boards/:boardId/cards/:cardId/comments', commentRouter)

    // Card list board routes
    app.use('/api/boards/:boardId/lists/:listId/cards', cardRouter)

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
