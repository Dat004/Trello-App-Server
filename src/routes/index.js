const attachmentRouter = require('./attachment');
const workspaceRouter = require('./workspaces');
const favoritesRouter = require('./favorites');
const commentRouter = require('./comment');
const uploadRouter = require('./upload');
const boardRouter = require('./boards');
const cardRouter = require('./card');
const listRouter = require('./list');
const authRouter = require('./auth');
const meRouter = require('./users');

function router(app) {
    // Attachment card routes
    app.use('/api/boards/:boardId/cards/:cardId/attachments', attachmentRouter)

    // Comment card routes
    app.use('/api/boards/:boardId/cards/:cardId/comments', commentRouter)

    // Card list board routes
    app.use('/api/boards/:boardId/lists/:listId/cards', cardRouter)

    // List board routes
    app.use('/api/boards/:boardId/lists', listRouter);

    // Workspace routes
    app.use('/api/workspaces', workspaceRouter);

    // Favorites routes
    app.use('/api/favorites', favoritesRouter);

    // Board routes
    app.use('/api/boards', boardRouter);

    // Upload routes
    app.use('/api/upload', uploadRouter);

    // Auth routes
    app.use('/api/auth', authRouter);

    // User routes
    app.use('/api/users', meRouter);
}

module.exports = router;
