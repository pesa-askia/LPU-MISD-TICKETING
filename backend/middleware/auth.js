import { verifyToken } from "../services/authService.js";

/**
 * Middleware to verify JWT token
 * Token should be in Authorization header: "Bearer <token>"
 */
export const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Missing or invalid authorization header",
            });
        }

        const token = authHeader.substring(7); // Remove "Bearer " prefix
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token",
            });
        }

        // Attach user info to request
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Authentication error",
            error: error.message,
        });
    }
};

/**
 * Middleware to verify JWT token AND require admin role.
 */
export const adminMiddleware = (req, res, next) => {
    authMiddleware(req, res, () => {
        if (req.user?.app_role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required",
            });
        }
        next();
    });
};

/**
 * Middleware to verify JWT AND require root (admin_level === 0).
 */
export const rootMiddleware = (req, res, next) => {
    adminMiddleware(req, res, () => {
        if (req.user?.admin_level !== 0) {
            return res.status(403).json({
                success: false,
                message: "Root access required",
            });
        }
        next();
    });
};

/**
 * Middleware factory — requires admin role AND admin_level <= maxLevel.
 * e.g. requireLevel(1) allows root (0) and level-1 admins but not 2 or 3.
 */
export const requireLevel = (maxLevel) => (req, res, next) => {
    adminMiddleware(req, res, () => {
        if ((req.user?.admin_level ?? 99) > maxLevel) {
            return res.status(403).json({
                success: false,
                message: "Insufficient admin level",
            });
        }
        next();
    });
};

/**
 * Optional middleware - doesn't fail if token is missing
 */
export const optionalAuthMiddleware = (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            if (decoded) {
                req.user = decoded;
            }
        }

        next();
    } catch (error) {
        // Continue without auth
        next();
    }
};
