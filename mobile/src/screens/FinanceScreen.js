import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, StatusBar, SafeAreaView, Dimensions, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import { DollarSign, TrendingUp, TrendingDown, Wallet, ShoppingCart, Package, LogOut, ChevronRight } from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function FinanceScreen({ onNavigate = () => {} }) {
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState('month'); // month, week, day, custom
    
    const [finance, setFinance] = useState({
        totalRevenue: 0,
        totalCost: 0,
        totalCommission: 0,
        profit: 0,
        profitMargin: 0,
        orderCount: 0,
        purchaseCount: 0,
        monthRevenue: 0,
        monthCommission: 0,
    });

    useEffect(() => {
        if (!user) return;
        fetchFinanceData();
    }, [user, period]);

    const fetchFinanceData = async () => {
        setLoading(true);
        try {
            const [ordersRes, purchasesRes, commissionRes] = await Promise.all([
                axios.get(`${BASE_URL}/api/orders?stokisId=${user.id}&status=DELIVERED`, { timeout: 10000 }).catch(() => null),
                axios.get(`${BASE_URL}/api/purchases?userId=${user.id}`, { timeout: 10000 }).catch(() => null),
                axios.get(`${BASE_URL}/api/finance/commission-summary?stokisId=${user.id}`, { timeout: 10000 }).catch(() => null),
            ]);

            let totalRevenue = 0;
            let totalCost = 0;
            let totalCommission = 0;
            let orderCount = 0;
            let purchaseCount = 0;
            let monthRevenue = 0;
            let monthCommission = 0;
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            if (ordersRes?.data) {
                const orders = ordersRes.data;
                orderCount = orders.length;
                orders.forEach(order => {
                    totalRevenue += order.total_amount || 0;
                    const orderDate = new Date(order.date);
                    if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
                        monthRevenue += order.total_amount || 0;
                    }
                });
            }

            if (purchasesRes?.data) {
                const purchases = purchasesRes.data;
                purchaseCount = purchases.length;
                purchases.forEach(p => {
                    totalCost += (p.price_buy || 0) * (p.quantity || 0);
                });
            }

            if (commissionRes?.data) {
                totalCommission = commissionRes.data.totalCommission || 0;
                monthCommission = commissionRes.data.monthCommission || 0;
            }

            const profit = totalRevenue - totalCost;
            const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

            setFinance({
                totalRevenue,
                totalCost,
                totalCommission,
                profit,
                profitMargin: profitMargin.toFixed(1),
                orderCount,
                purchaseCount,
                monthRevenue,
                monthCommission,
            });
        } catch (error) {
            console.log('Error fetching finance data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchFinanceData();
    };

    const formatCurrency = (value) => {
        return `Rp ${Math.floor(value).toLocaleString('id-ID')}`;
    };

    const FinanceCard = ({ icon: Icon, title, value, subtitle, color = theme.colors.primary }) => (
        <LinearGradient
            colors={[color, color + '99']}
            style={styles.financeCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <View style={styles.cardTop}>
                <View style={[styles.cardIconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Icon size={20} color="#fff" strokeWidth={2} />
                </View>
                <Text style={styles.cardTitle}>{title}</Text>
            </View>
            <Text style={styles.cardValue}>{value}</Text>
            {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
        </LinearGradient>
    );

    const MenuButton = ({ label, icon: Icon, onPress, color = theme.colors.primary }) => (
        <TouchableOpacity style={styles.menuButton} onPress={onPress} activeOpacity={0.7}>
            <LinearGradient
                colors={[color + '22', color + '11']}
                style={styles.menuButtonContent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={[styles.menuIcon, { backgroundColor: color + '33' }]}>
                    <Icon size={18} color={color} strokeWidth={2.5} />
                </View>
                <View style={styles.menuTextBox}>
                    <Text style={styles.menuLabel}>{label}</Text>
                    <Text style={styles.menuArrow}>
                        <ChevronRight size={14} color={theme.colors.muted} />
                    </Text>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} translucent={false} />
            <ScrollView 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Header */}
                <View style={styles.topHeader}>
                    <View>
                        <Text style={styles.headerTitle}>Keuangan</Text>
                        <Text style={styles.headerSubtitle}>{user?.store_name || user?.name}</Text>
                    </View>
                    <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                        <LogOut size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>

                {/* Period Selector */}
                <View style={styles.periodSelector}>
                    {['day', 'week', 'month', 'custom'].map((p) => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                            onPress={() => setPeriod(p)}
                        >
                            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                                {p === 'day' ? 'Hari' : p === 'week' ? 'Minggu' : p === 'month' ? 'Bulan' : 'Custom'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Main Finance Cards */}
                <View style={styles.cardsGrid}>
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <FinanceCard
                                icon={TrendingUp}
                                title="Revenue"
                                value={formatCurrency(finance.totalRevenue)}
                                color="#10b981"
                            />
                        </View>
                        <View style={styles.col}>
                            <FinanceCard
                                icon={TrendingDown}
                                title="Cost"
                                value={formatCurrency(finance.totalCost)}
                                color="#ef4444"
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.col}>
                            <FinanceCard
                                icon={DollarSign}
                                title="Profit"
                                value={formatCurrency(finance.profit)}
                                subtitle={`Margin: ${finance.profitMargin}%`}
                                color={finance.profit >= 0 ? '#8b5cf6' : '#ef4444'}
                            />
                        </View>
                        <View style={styles.col}>
                            <FinanceCard
                                icon={Wallet}
                                title="Komisi Sales"
                                value={formatCurrency(finance.totalCommission)}
                                color="#f59e0b"
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.col}>
                            <FinanceCard
                                icon={ShoppingCart}
                                title="Bulan Ini"
                                value={formatCurrency(finance.monthRevenue)}
                                subtitle={`${finance.orderCount} orders`}
                                color="#3b82f6"
                            />
                        </View>
                        <View style={styles.col}>
                            <FinanceCard
                                icon={Package}
                                title="Komisi Bulan Ini"
                                value={formatCurrency(finance.monthCommission)}
                                color="#06b6d4"
                            />
                        </View>
                    </View>
                </View>

                {/* Menu Section */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Menu Keuangan</Text>
                    <MenuButton
                        label="Laporan Penjualan"
                        icon={TrendingUp}
                        onPress={() => onNavigate('revenue')}
                        color="#10b981"
                    />
                    <MenuButton
                        label="Laporan Pembelian"
                        icon={ShoppingCart}
                        onPress={() => onNavigate('purchases')}
                        color="#ef4444"
                    />
                    <MenuButton
                        label="Manajemen Komisi"
                        icon={Wallet}
                        onPress={() => onNavigate('commission')}
                        color="#f59e0b"
                    />
                    <MenuButton
                        label="Konsinyasi"
                        icon={Package}
                        onPress={() => onNavigate('consignment')}
                        color="#06b6d4"
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    loadingBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topHeader: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: theme.colors.text,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 12,
        color: theme.colors.muted,
    },
    logoutBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    periodSelector: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 20,
        gap: 8,
    },
    periodBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    periodBtnActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    periodText: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.muted,
    },
    periodTextActive: {
        color: '#fff',
    },
    cardsGrid: {
        paddingHorizontal: 16,
        marginBottom: 24,
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    col: {
        flex: 1,
    },
    financeCard: {
        borderRadius: 14,
        padding: 12,
        minHeight: 100,
        justifyContent: 'space-between',
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    cardIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '600',
        flex: 1,
    },
    cardValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    menuSection: {
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: 12,
    },
    menuButton: {
        marginBottom: 10,
        borderRadius: 12,
        overflow: 'hidden',
    },
    menuButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuTextBox: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    menuLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text,
    },
    menuArrow: {
        color: theme.colors.muted,
    },
});
