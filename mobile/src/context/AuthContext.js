import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const BASE_URL = 'http://192.168.18.78:5000';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
                setUser(JSON.parse(userData));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const res = await axios.post(`${BASE_URL}/api/auth/login`,
                { email, password },
                { timeout: 10000 } // 10 seconds timeout
            );
            const userWithToken = res.data;
            await AsyncStorage.setItem('user', JSON.stringify(userWithToken));
            setUser(userWithToken);
            return { success: true };
        } catch (err) {
            console.error('Login Error:', err);
            let msg = 'Login Gagal';
            if (err.code === 'ECONNABORTED') msg = 'Server tidak merespon (Timeout)';
            if (!err.response && !err.code) msg = 'Koneksi gagal. Cek WiFi & IP Server.';
            return { success: false, message: err.response?.data?.message || msg };
        }
    };

    const logout = async () => {
        await AsyncStorage.removeItem('user');
        setUser(null);
    };

    const updateUser = async (updatedFields) => {
        const merged = { ...user, ...updatedFields };
        await AsyncStorage.setItem('user', JSON.stringify(merged));
        setUser(merged);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
