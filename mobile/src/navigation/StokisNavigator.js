import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BarChart3, TrendingUp, ShoppingCart, Wallet, Package } from 'lucide-react-native';
import { theme } from '../theme';
import FinanceScreen from '../screens/FinanceScreen';
import SalesRevenueScreen from '../screens/SalesRevenueScreen';
import PurchasesScreen from '../screens/PurchasesScreen';
import CommissionManagementScreen from '../screens/CommissionManagementScreen';

const TABS = [
    { key: 'finance', label: 'Dashboard', Icon: BarChart3, Screen: FinanceScreen },
    { key: 'revenue', label: 'Penjualan', Icon: TrendingUp, Screen: SalesRevenueScreen },
    { key: 'purchases', label: 'Pembelian', Icon: ShoppingCart, Screen: PurchasesScreen },
    { key: 'commission', label: 'Komisi', Icon: Wallet, Screen: CommissionManagementScreen },
];

export default function StokisNavigator({ navigation }) {
    const [activeTab, setActiveTab] = useState('finance');
    const ActiveScreen = TABS.find(t => t.key === activeTab).Screen;

    return (
        <View style={styles.root}>
            <View style={styles.screenWrapper}>
                <ActiveScreen navigation={navigation} onNavigate={setActiveTab} />
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
                                    size={18}
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
        paddingHorizontal: 8,
    },
    tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative' },
    activeIndicator: {
        position: 'absolute',
        top: -9,
        width: 28,
        height: 3,
        backgroundColor: theme.colors.primary,
        borderRadius: 2,
    },
    tabIconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabIconBoxActive: {
        backgroundColor: theme.colors.primary,
    },
    tabLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600' },
    tabLabelActive: { color: theme.colors.primary, fontWeight: '800' },
});
