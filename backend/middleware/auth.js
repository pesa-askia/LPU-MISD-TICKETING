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
