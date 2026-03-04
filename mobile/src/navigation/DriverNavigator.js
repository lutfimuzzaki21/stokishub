import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Truck, MapPin } from 'lucide-react-native';
import { theme } from '../theme';
import { DriverProvider } from '../context/DriverContext';
import DriverHomeScreen from '../screens/DriverHomeScreen';
import DriverDeliveryScreen from '../screens/DriverDeliveryScreen';

const TABS = [
    { key: 'home', label: 'Dashboard', Icon: Truck, Screen: DriverHomeScreen },
    { key: 'delivery', label: 'Pengantaran', Icon: MapPin, Screen: DriverDeliveryScreen },
];

export default function DriverNavigator({ navigation }) {
    const [activeTab, setActiveTab] = useState('home');
    const ActiveScreen = TABS.find(t => t.key === activeTab).Screen;

    return (
        <DriverProvider>
        <View style={styles.root}>
            <View style={styles.screenWrapper}>
                <ActiveScreen navigation={navigation} />
            </View>
            <View style={styles.tabBar}>
                {TABS.map(({ key, label, Icon }) => {
                    const active = activeTab === key;
                    return (
                        <TouchableOpacity
                            key={key}
                            style={styles.tabItem}
                            onPress={() => setActiveTab(key)}
                            activeOpacity={0.8}
                        >
                            {active && <View style={styles.activeIndicator} />}
                            <View style={[styles.tabIconBox, active && styles.tabIconBoxActive]}>
                                <Icon
                                    size={20}
                                    color={active ? '#fff' : theme.colors.muted}
                                    strokeWidth={active ? 2.5 : 1.8}
                                />
                            </View>
                            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
        </DriverProvider>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    screenWrapper: { flex: 1 },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: theme.colors.card,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        paddingTop: 8,
        paddingHorizontal: 16,
    },
    tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, position: 'relative' },
    activeIndicator: {
        position: 'absolute',
        top: -9,
        width: 32,
        height: 3,
        backgroundColor: theme.colors.primary,
        borderRadius: 2,
    },
    tabIconBox: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabIconBoxActive: {
        backgroundColor: theme.colors.primary,
    },
    tabLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
    tabLabelActive: { color: theme.colors.primary, fontWeight: '800' },
});
