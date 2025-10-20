module.exports = errorHandler;

function errorHandler(err, req, res, next) {
    // Enhanced logging
    console.error('[GlobalErrorHandler] Error:', err);
    if (err && err.stack) {
        console.error('[GlobalErrorHandler] Stack:', err.stack);
    }
    console.error('[GlobalErrorHandler] Request:', {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
        user: req.user
    });
    switch (true) {
        case typeof err === 'string':
            // custom application error
            const is404 = err.toLowerCase().endsWith('not found');
            const statusCode = is404 ? 404 : 400;
            return res.status(statusCode).json({ message: err });
        case err.name === 'ValidationError':
            // mongoose validation error
            return res.status(400).json({ message: err.message });
        case err.name === 'UnauthorizedError':
            // jwt authentication error
            return res.status(401).json({ message: 'Unauthorized' });
        default:
            return res.status(500).json({ message: err.message });
    }
} 