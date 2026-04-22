import express from "express";
import {
    registerUser,
    loginAny,
    loginAdmin,
    changePassword,
    verifyMagicLinkToken,
    getMeProfile,
    updateOwnAccountProfile,
    generateToken,
} from "../services/authService.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/auth/signup
 * Register a new user
 */
router.post("/signup", async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        // Validation
        if (!email || !password) {
            return res
                .status(400)
                .json({ success: false, message: "Email and password are required" });
        }

        if (password.length < 6) {
            return res
                .status(400)
                .json({ success: false, message: "Password must be at least 6 characters" });
        }

        const result = await registerUser(email, password, fullName);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(201).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Signup error",
            error: error.message,
        });
    }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const result = await loginAny(email, password);

        if (!result.success) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Login error",
            error: error.message,
        });
    }
});

/**
 * POST /api/auth/admin-login
 * Login admin (separate pipeline from normal users)
 */
router.post("/admin-login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const result = await loginAdmin(email, password);

        if (!result.success) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Admin login error",
            error: error.message,
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile (requires auth)
 */
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id || req.user.sub;
        const appRole = req.user.app_role || "user";
        const result = await getMeProfile(userId, appRole);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching user",
            error: error.message,
        });
    }
});

/**
 * PUT /api/auth/me
 * Update current user profile (requires auth)
 */
router.put("/me", authMiddleware, async (req, res) => {
    try {
        const { fullName, full_name, email } = req.body;
        const userId = req.user.id || req.user.sub;
        const appRole = req.user.app_role || "user";
        const namePayload = fullName !== undefined ? fullName : full_name;

        const result = await updateOwnAccountProfile(userId, appRole, {
            fullName: namePayload,
            email,
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        const adminLevel = appRole === "admin" ? (req.user.admin_level ?? 1) : null;
        const token = generateToken(result.user.id, result.user.email, appRole, adminLevel);

        return res.status(200).json({
            success: true,
            message: "Profile updated",
            user: result.user,
            token,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating profile",
            error: error.message,
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change password (requires auth)
 */
router.post("/change-password", authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Old and new passwords are required",
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters",
            });
        }

        const userId = req.user.id || req.user.sub;
        const appRole = req.user.app_role || "user";
        const result = await changePassword(userId, oldPassword, newPassword, appRole);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error changing password",
            error: error.message,
        });
    }
});

/**
 * POST /api/auth/magic-verify
 * Exchange a Supabase Auth access_token (from a magic-link session) for our
 * own custom JWT. Auto-registers the user on first login.
 */
router.post("/magic-verify", async (req, res) => {
    try {
        const { access_token } = req.body;

        if (!access_token) {
            return res.status(400).json({
                success: false,
                message: "access_token is required",
            });
        }

        const result = await verifyMagicLinkToken(access_token);

        if (!result.success) {
            return res.status(401).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Magic link verification error",
            error: error.message,
        });
    }
});

export default router;
