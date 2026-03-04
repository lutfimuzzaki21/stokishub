import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import { BASE_URL, useAuth } from './AuthContext';

const DriverContext = createContext(null);

export function DriverProvider({ children }) {
    const { user } = useAuth();
    const [isOnline, setIsOnline] = useState(false);
    const socketRef = useRef(null);
    const locationSubRef = useRef(null);

    // Restore persisted online state on mount
    useEffect(() => {
        AsyncStorage.getItem('driver_online').then(val => {
            if (val === 'true') setIsOnline(true);
        });
    }, []);

    // Socket connection (persistent, created once)
    useEffect(() => {
        const s = io(BASE_URL, { autoConnect: true });
        socketRef.current = s;
        return () => { s.disconnect(); socketRef.current = null; };
    }, []);

    // Location tracking — starts/stops based on isOnline
    useEffect(() => {
        // Persist to AsyncStorage
        AsyncStorage.setItem('driver_online', isOnline ? 'true' : 'false');

        if (isOnline) {
            startTracking();
        } else {
            stopTracking();
        }

        async function startTracking() {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setIsOnline(false);
                return;
            }
            // Cancel any previous sub
            locationSubRef.current?.remove();
            locationSubRef.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
                (loc) => {
                    socketRef.current?.emit('updateLocation', {
                        driverId: user?.id,
                        name: user?.name,
                        lat: loc.coords.latitude,
                        lng: loc.coords.longitude,
                    });
                }
            );
        }

        function stopTracking() {
            locationSubRef.current?.remove();
            locationSubRef.current = null;
        }

        return () => { /* cleanup only on unmount */ };
    }, [isOnline]);

    const toggleOnline = () => setIsOnline(v => !v);

    return (
        <DriverContext.Provider value={{ isOnline, toggleOnline, socket: socketRef.current }}>
            {children}
        </DriverContext.Provider>
    );
}

export function useDriver() {
    const ctx = useContext(DriverContext);
    if (!ctx) throw new Error('useDriver must be used inside DriverProvider');
    return ctx;
}
