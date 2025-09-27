const { expressjwt: jwt } = require('express-jwt');
const { secret } = require('../secrets/config.json');
const db = require('../_helpers/db');
const Role = require('../_helpers/role');

module.exports = authorize;

function authorize(requiredRole) {
    return [
        // authenticate JWT token and attach decoded token to request as req.user
        (req, res, next) => {
            console.log('[Authenticate] Middleware called for', req.originalUrl);
            return jwt({ secret, algorithms: ['HS256'] })(req, res, (err) => {
                if (err) {
                    console.error('[Authenticate] JWT error:', err);
                    return next(err);
                }
                next();
            });
        },
        // attach full user record to request object and check role
        async (req, res, next) => {
            try {
                // get user with id from token 'sub' (subject) property
                const user = await db.Account.findById(req.auth.sub);
                // check user still exists
                if (!user) {
                    console.error('[Authenticate] No user found for sub:', req.auth.sub);
                    return res.status(401).json({ message: 'Unauthorized' });
                }
                // role-based authorization
                if (requiredRole) {
                    if (requiredRole === Role.Admin) {
                        if (user.role !== Role.Admin && user.role !== Role.SuperAdmin) {
                            console.error('[Authenticate] User does not have required admin role:', user.role);
                            return res.status(401).json({ message: 'Unauthorized' });
                        }
                    } else if (user.role !== requiredRole) {
                        console.error('[Authenticate] User does not have required role:', requiredRole, 'Actual:', user.role);
                        return res.status(401).json({ message: 'Unauthorized' });
                    }
                }
                // authorization successful
                req.user = user.toJSON();
                next();
            } catch (err) {
                console.error('[Authenticate] Error in user lookup/role check:', err);
                next(err);
            }
        }
    ];
} 