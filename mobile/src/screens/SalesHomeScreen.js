import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ScrollView, StatusBar, SafeAreaView, Dimensions, Platform, Modal, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import { ShoppingBag, Users, DollarSign, TrendingUp, LogOut, Search, Plus, MapPin, ChevronRight, Wallet, Package, X } from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function SalesHomeScreen({ onNavigate = () => {} }) {
    const { user, logout } = useAuth();
    const [commission, setCommission] = useState({ total: 0, monthTotal: 0, orders: [] });
    const [visitStats, setVisitStats] = useState({ total: 0, done: 0 });
    const [consumerCount, setConsumerCount] = useState(0);
    const [stockModal, setStockModal] = useState(false);
    const [products, setProducts] = useState([]);
    const [loadingStock, setLoadingStock] = useState(false);

    useEffect(() => {
        if (!user) return;
        const fetchAll = async () => {
            try {
                const [commRes, visitRes, conRes] = await Promise.all([
                    axios.get(`${BASE_URL}/api/commissions?salesId=${user.id}`).catch(() => null),
                    axios.get(`${BASE_URL}/api/visits?salesId=${user.id}`).catch(() => null),
                    axios.get(`${BASE_URL}/api/consumers?parentId=${user.id}`).catch(() => null),
                ]);
                if (commRes) {
                    const now = new Date();
                    const monthOrders = (commRes.data.orders || []).filter(o => {
                        const d = new Date(o.date);
                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    });
                    setCommission({
                        total: commRes.data.grandTotalCommission || 0,
                        monthTotal: monthOrders.reduce((s, o) => s + o.totalCommission, 0),
                        orders: commRes.data.orders || [],
                    });
                }
                if (visitRes) {
                    const visits = visitRes.data || [];
                    setVisitStats({ total: visits.length, done: visits.filter(v => v.status === 'REGISTERED').length });
                }
                if (conRes) {
                    setConsumerCount((conRes.data || []).length);
                }
            } catch (_) {}
        };
        fetchAll();
    }, [user]);

    const openStockModal = async () => {
        setStockModal(true);
        if (products.length > 0) return;
        setLoadingStock(true);
        try {
            const parentId = user.parent_id || user.id;
            const res = await axios.get(`${BASE_URL}/api/products?userId=${parentId}`, { timeout: 10000 });
            setProducts(res.data || []);
        } catch (_) {}
        finally { setLoadingStock(false); }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} translucent={false} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Header Profile Section */}
                <View style={styles.topHeader}>
                    <View style={styles.headerLeft}>
                        <View style={styles.avatarWrap}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarTxt}>{user?.name?.charAt(0)?.toUpperCase()}</Text>
                            </View>
                            <View style={styles.onlineDot} />
                        </View>
                        <View>
                            <Text style={styles.helloTxt}>Halo, {user?.name?.split(' ')[0]} 👋</Text>
                            <Text style={styles.roleTxt}>SALES</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                        <LogOut size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>

                {/* Main Stats Card */}
                <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primaryDark]}
                    style={styles.mainStatsCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.statsHeader}>
                        <View style={styles.statsIconCircle}>
                            <Wallet size={20} color="#fff" />
                        </View>
                        <Text style={styles.statsTitle} numberOfLines={2}>Estimasi Penghitungan Komisi</Text>
                    </View>
                    <Text style={styles.statsMainValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>Rp {commission.monthTotal.toLocaleString('id-ID')}</Text>
                    <View style={styles.statsFooter}>
                        <View style={styles.statsBadge}>
                            <TrendingUp size={12} color={theme.colors.success} />
                            <Text style={styles.statsBadgeText}>Komisi Bulan Ini</Text>
                        </View>
                        <Text style={styles.statsTargetText}>{commission.orders.length} Order Selesai</Text>
                    </View>
                    {/* Progress Bar */}
                    <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: '100%' }]} />
                    </View>
                </LinearGradient>

                {/* Sub Stats Grid */}
                <View style={styles.subStatsGrid}>
                    <View style={styles.subStatItem}>
                        <Text style={styles.subStatLabel}>Total Komisi</Text>
                        <Text style={styles.subStatValue}>Rp {(commission.total / 1000).toFixed(0)}k</Text>
                    </View>
                    <View style={styles.vDivider} />
                    <View style={styles.subStatItem}>
                        <Text style={styles.subStatLabel}>Konsumen</Text>
                        <Text style={styles.subStatValue}>{consumerCount} Orang</Text>
                    </View>
                    <View style={styles.vDivider} />
                    <View style={styles.subStatItem}>
                        <Text style={styles.subStatLabel}>Kunjungan</Text>
                        <Text style={styles.subStatValue}>{visitStats.done}/{visitStats.total}</Text>
                    </View>
                </View>

                {/* Action Menu Grid */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Operasional Lapangan</Text>
                </View>

                <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => onNavigate('consumers')}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                            <Plus size={24} color={theme.colors.primaryLight} />
                        </View>
                        <Text style={styles.actionText} numberOfLines={2}>Input Order</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => onNavigate('consumers')}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                            <Users size={24} color={theme.colors.success} />
                        </View>
                        <Text style={styles.actionText} numberOfLines={2}>Pelanggan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={openStockModal}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                            <Search size={24} color={theme.colors.warning} />
                        </View>
                        <Text style={styles.actionText} numberOfLines={2}>Cek Stok</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => onNavigate('visit')}>
                        <View style={[styles.actionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                            <MapPin size={24} color="#a78bfa" />
                        </View>
                        <Text style={styles.actionText} numberOfLines={2}>Kunjungan</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Activities */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Penjualan Terakhir</Text>
                    <TouchableOpacity onPress={() => onNavigate('commission')}>
                        <Text style={styles.seeAllBtn}>Lihat Semua</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.activityList}>
                    {commission.orders.slice(0, 5).length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                            <ShoppingBag size={32} color={theme.colors.muted} />
                            <Text style={{ color: theme.colors.muted, marginTop: 8, fontSize: 13 }}>Belum ada pesanan selesai</Text>
                        </View>
                    ) : commission.orders.slice(0, 5).map((order, i) => (
                        <TouchableOpacity key={order.orderId} style={styles.activityCard} activeOpacity={0.8}>
                            <View style={styles.activityIconCircle}>
                                <ShoppingBag size={18} color={theme.colors.primaryLight} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.activityName}>{order.buyerName || 'Pembeli'}</Text>
                                <Text style={styles.activityInfo}>{order.invoice_id} • {order.items?.length || 0} Produk</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.activityValue, { color: '#10b981' }]}>+Rp {order.totalCommission.toLocaleString('id-ID')}</Text>
                                <Text style={styles.activityTime}>{new Date(order.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</Text>
                            </View>
                            <ChevronRight size={16} color={theme.colors.muted} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Create New Order Fab Placeholder */}
                <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => onNavigate('consumers')}>
                    <LinearGradient
                        colors={[theme.colors.primary, theme.colors.primaryDark]}
                        style={styles.fabGradient}
                    >
                        <Plus size={28} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>

            {/* Cek Stok Modal */}
            <Modal visible={stockModal} animationType="slide" transparent onRequestClose={() => setStockModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.modalHeadRow}>
                            <Text style={styles.modalTitle}>Stok Produk</Text>
                            <TouchableOpacity onPress={() => setStockModal(false)} style={styles.closeBtn}>
                                <X size={20} color={theme.colors.muted} />
                            </TouchableOpacity>
                        </View>
                        {loadingStock ? (
                            <ActivityIndicator color={theme.colors.primaryLight} style={{ marginTop: 40, marginBottom: 40 }} />
                        ) : products.length === 0 ? (
                            <View style={{ alignItems: 'center', padding: 40 }}>
                                <Package size={36} color={theme.colors.muted} />
                                <Text style={{ color: theme.colors.muted, marginTop: 12, fontSize: 13 }}>Tidak ada data produk</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={products}
                                keyExtractor={item => item.id.toString()}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
                                renderItem={({ item }) => (
                                    <View style={styles.stockRow}>
                                        <View style={styles.stockIcon}>
                                            <Package size={16} color={theme.colors.primaryLight} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.stockName}>{item.name}</Text>
                                            <Text style={styles.stockBrand}>{item.brand} • {item.code}</Text>
                                        </View>
                                        <View style={[styles.stockBadge, { backgroundColor: item.stock > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
                                            <Text style={[styles.stockQty, { color: item.stock > 0 ? '#10b981' : '#ef4444' }]}>{item.stock} Unit</Text>
                                        </View>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 20,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarWrap: { position: 'relative', width: 46, height: 46 },
    avatar: {
        width: 46, height: 46, borderRadius: 15,
        backgroundColor: 'rgba(99,102,241,0.18)',
        borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.4)',
        justifyContent: 'center', alignItems: 'center',
    },
    avatarTxt: { color: '#818cf8', fontSize: 18, fontWeight: '900' },
    onlineDot: {
        position: 'absolute', bottom: 0, right: 0,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: '#10b981',
        borderWidth: 2, borderColor: theme.colors.background,
    },
    helloTxt: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
    roleTxt: { fontSize: 10, color: theme.colors.muted, fontWeight: '700', letterSpacing: 1, marginTop: 1 },
    logoutBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)',
        justifyContent: 'center', alignItems: 'center',
    },
    mainStatsCard: {
        marginHorizontal: 20,
        borderRadius: theme.radius.lg,
        padding: 24,
        ...theme.shadows.primary,
    },
    statsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    statsIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statsTitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
        flexWrap: 'wrap',
    },
    statsMainValue: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '900',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    statsFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    statsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statsBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    statsTargetText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
    },
    progressBg: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 3,
    },
    subStatsGrid: {
        flexDirection: 'row',
        backgroundColor: theme.colors.card,
        marginHorizontal: 20,
        marginTop: 20,
        borderRadius: theme.radius.md,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
    },
    subStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    subStatLabel: {
        fontSize: 10,
        color: theme.colors.muted,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    subStatValue: {
        fontSize: 15,
        color: theme.colors.text,
        fontWeight: '800',
        marginTop: 4,
    },
    vDivider: {
        width: 1,
        height: '60%',
        backgroundColor: theme.colors.border,
        alignSelf: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: 32,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: theme.colors.text,
    },
    seeAllBtn: {
        fontSize: 12,
        color: theme.colors.primaryLight,
        fontWeight: '700',
    },
    actionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 20,
        gap: 12,
    },
    actionItem: {
        width: (width - 40 - 12) / 2,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.md,
        paddingVertical: 20,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
    },
    actionIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '800',
        color: theme.colors.text,
        textAlign: 'center',
        lineHeight: 18,
    },
    activityList: {
        paddingHorizontal: 20,
        gap: 12,
    },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        padding: 16,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
    },
    activityIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: theme.colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    activityName: {
        fontSize: 14,
        fontWeight: '800',
        color: theme.colors.text,
    },
    activityInfo: {
        fontSize: 11,
        color: theme.colors.muted,
        marginTop: 2,
    },
    activityValue: {
        fontSize: 14,
        fontWeight: '900',
        color: theme.colors.primaryLight,
    },
    activityTime: {
        fontSize: 10,
        color: theme.colors.muted,
        marginTop: 2,
    },
    fab: {
        position: 'absolute',
        bottom: 0,
        right: 20,
        borderRadius: 28,
        ...theme.shadows.primary,
    },
    fabGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Stock Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%', borderTopWidth: 1, borderColor: theme.colors.border },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: 10 },
    modalHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
    modalTitle: { fontSize: 19, fontWeight: '900', color: theme.colors.text },
    closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
    stockRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
    stockIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.primaryGlow, justifyContent: 'center', alignItems: 'center' },
    stockName: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
    stockBrand: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
    stockBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    stockQty: { fontSize: 12, fontWeight: '800' },
});
