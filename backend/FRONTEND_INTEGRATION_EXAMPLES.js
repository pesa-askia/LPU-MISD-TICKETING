// Example usage of the backend API in your React frontend

// ============================================================
// 1. LOGIN - Get Authentication Token
// ============================================================

const handleLogin = async (email, password) => {
    const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
        // Store token for future requests
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userId', data.user.id);
        return { success: true, user: data.user };
    } else {
        return { success: false, error: data.message };
    }
};

// ============================================================
// 2. GET CURRENT USER PROFILE
// ============================================================

const getCurrentUserProfile = async () => {
    const token = localStorage.getItem('authToken');

    const response = await fetch('http://localhost:5000/api/auth/me', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    return data.user;
};

// ============================================================
// 3. LOGOUT - Clear Authentication
// ============================================================

const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    // Redirect to login page
};

// ============================================================
// 4. SIGNUP - Register New User
// ============================================================

const handleSignup = async (email, password, fullName) => {
    const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName })
    });

    const data = await response.json();
    return data;
};

// ============================================================
// 5. GET ALL USERS (Admin Only)
// ============================================================

const getAllUsers = async (limit = 100, offset = 0) => {
    const token = localStorage.getItem('authToken');

    const response = await fetch(
        `http://localhost:5000/api/admin/users?limit=${limit}&offset=${offset}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );

    const data = await response.json();
    return { users: data.data, total: data.pagination.total };
};

// ============================================================
// 6. GET STATISTICS (Admin Only)
// ============================================================

const getAuthStats = async () => {
    const token = localStorage.getItem('authToken');

    const response = await fetch('http://localhost:5000/api/admin/stats', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await response.json();
    return data.stats; // { totalUsers, activeUsers, inactiveUsers, createdToday }
};

// ============================================================
// 7. UPDATE USER PROFILE
// ============================================================

const updateProfile = async (fullName) => {
    const token = localStorage.getItem('authToken');

    const response = await fetch('http://localhost:5000/api/auth/me', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fullName })
    });

    const data = await response.json();
    return data;
};

// ============================================================
// 8. CHANGE PASSWORD
// ============================================================

const changePassword = async (oldPassword, newPassword) => {
    const token = localStorage.getItem('authToken');

    const response = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
    });

    const data = await response.json();
    return data;
};

// ============================================================
// REACT HOOK EXAMPLE - useAuth
// ============================================================

import { useState, useEffect } from 'react';

export function useAuth() {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('authToken'));
    const [isLoading, setIsLoading] = useState(false);

    // Fetch user on mount or token change
    useEffect(() => {
        if (token) {
            fetchCurrentUser();
        }
    }, [token]);

    const fetchCurrentUser = async () => {
        const response = await fetch('http://localhost:5000/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) setUser(data.user);
    };

    const login = async (email, password) => {
        setIsLoading(true);
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (data.success) {
            setToken(data.token);
            setUser(data.user);
            localStorage.setItem('authToken', data.token);
        }

        setIsLoading(false);
        return data;
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('authToken');
    };

    return { user, token, isLoading, login, logout, fetchCurrentUser };
}

// ============================================================
// USAGE IN COMPONENT
// ============================================================

import { useAuth } from './hooks/useAuth';

export function LoginPage() {
    const { login, isLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(email, password);
        if (result.success) {
            // Navigate to dashboard
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
            />
            <button disabled={isLoading} type="submit">
                {isLoading ? 'Logging in...' : 'Login'}
            </button>
        </form>
    );
}
