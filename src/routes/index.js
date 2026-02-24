const attachmentRouter = require('./attachment');
const workspaceRouter = require('./workspaces');
const favoritesRouter = require('./favorites');
const activityRouter = require('./activities');
const templateRouter = require('./templates');
const commentRouter = require('./comment');
const uploadRouter = require('./upload');
const boardRouter = require('./boards');
const cardRouter = require('./card');
const listRouter = require('./list');
const authRouter = require('./auth');
const meRouter = require('./users');
const notificationRouter = require('./notifications');

function router(app) {
    // Attachment card routes
    app.use('/api/boards/:boardId/cards/:cardId/attachments', attachmentRouter)

    // Comment card routes
    app.use('/api/boards/:boardId/cards/:cardId/comments', commentRouter)

    // Card list board routes
    app.use('/api/boards/:boardId/lists/:listId/cards', cardRouter)

    // Notification routes
    app.use('/api/notifications', notificationRouter);

    // List board routes
    app.use('/api/boards/:boardId/lists', listRouter);

    // Workspace routes
    app.use('/api/workspaces', workspaceRouter);

    // Activity routes
    app.use('/api/activities', activityRouter);

    // Favorites routes
    app.use('/api/favorites', favoritesRouter);

    // Template routes
    app.use('/api/templates', templateRouter);

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
