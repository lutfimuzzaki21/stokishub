import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { ShoppingBag, ShoppingCart, Package, User } from 'lucide-react-native';
import { theme } from '../theme';
import { CartProvider, useCart } from '../context/CartContext';
import ConsumerShopScreen from '../screens/ConsumerShopScreen';
import ConsumerCartScreen from '../screens/ConsumerCartScreen';
import ConsumerOrdersScreen from '../screens/ConsumerOrdersScreen';
import ConsumerProfileScreen from '../screens/ConsumerProfileScreen';

const TABS = [
    { key: 'shop',    label: 'Toko',     Icon: ShoppingBag },
    { key: 'cart',    label: 'Keranjang', Icon: ShoppingCart },
    { key: 'orders',  label: 'Pesanan',  Icon: Package },
    { key: 'profile', label: 'Profil',   Icon: User },
];

function ConsumerTabs({ navigation }) {
    const [activeTab, setActiveTab] = useState('shop');
    const { totalItems } = useCart();

    const navigateTo = (tab) => setActiveTab(tab);

    const renderScreen = () => {
        switch (activeTab) {
            case 'shop':    return <ConsumerShopScreen />;
            case 'cart':    return <ConsumerCartScreen onNavigate={navigateTo} />;
            case 'orders':  return <ConsumerOrdersScreen />;
            case 'profile': return <ConsumerProfileScreen />;
            default:        return <ConsumerShopScreen />;
        }
    };

    return (
        <View style={styles.root}>
            <View style={styles.screenWrapper}>
                {renderScreen()}
            </View>
            <View style={styles.tabBar}>
                {TABS.map(({ key, label, Icon }) => {
                    const active = activeTab === key;
                    const showBadge = key === 'cart' && totalItems > 0;

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
                                {showBadge && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeTxt}>
                                            {totalItems > 9 ? '9+' : totalItems}
                                        </Text>
                                    </View>
                                )}
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

export default function ConsumerNavigator({ navigation }) {
    return (
        <CartProvider>
            <ConsumerTabs navigation={navigation} />
        </CartProvider>
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
        paddingBottom: Platform.OS === 'ios' ? 20 : 8,
        paddingTop: 8,
        paddingHorizontal: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 4,
        position: 'relative',
    },
    activeIndicator: {
        position: 'absolute',
        top: -8,
        width: 24,
        height: 3,
        borderRadius: 2,
        backgroundColor: theme.colors.primaryLight,
    },
    tabIconBox: {
        width: 40,
        height: 34,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 3,
        position: 'relative',
    },
    tabIconBoxActive: {
        backgroundColor: theme.colors.primary,
    },
    badge: {
        position: 'absolute',
        top: -4, right: -4,
        backgroundColor: '#ef4444',
        borderRadius: 8,
        minWidth: 16, height: 16,
        justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 3,
        borderWidth: 1.5, borderColor: theme.colors.card,
    },
    badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '900' },
    tabLabel: {
        fontSize: 10,
        color: theme.colors.muted,
        fontWeight: '600',
    },
    tabLabelActive: {
        color: theme.colors.primaryLight,
        fontWeight: '800',
    },
});
