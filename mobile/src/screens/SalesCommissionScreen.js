import React, { useState, useEffect } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Platform, SafeAreaView, ActivityIndicator, Alert,
    FlatList, RefreshControl, Modal
} from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import {
    Wallet, TrendingUp, TrendingDown, CheckCircle2, Package,
    ChevronRight, X, Calendar, BarChart2, Award
} from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

export default function SalesCommissionScreen() {
    const { user } = useAuth();
    const [data, setData] = useState({ orders: [], grandTotalCommission: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        fetchCommissions();
    }, []);

    const fetchCommissions = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/commissions?salesId=${user.id}`, { timeout: 10000 });
            setData(res.data);
        } catch (e) {
            Alert.alert('Gagal', 'Tidak bisa memuat data komisi');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchCommissions();
    };

    const now = new Date();
    const thisMonthOrders = data.orders.filter(o => {
        const d = new Date(o.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const thisMonthCommission = thisMonthOrders.reduce((s, o) => s + o.totalCommission, 0);

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthOrders = data.orders.filter(o => {
        const d = new Date(o.date);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
    });
    const lastMonthCommission = lastMonthOrders.reduce((s, o) => s + o.totalCommission, 0);

    const growth = lastMonthCommission > 0
        ? (((thisMonthCommission - lastMonthCommission) / lastMonthCommission) * 100).toFixed(1)
        : null;
    const isGrowthPositive = growth !== null && parseFloat(growth) >= 0;

    const formatRp = (val) => {
        if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}jt`;
        if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}rb`;
        return `Rp ${val.toLocaleString('id-ID')}`;
    };

    const monthName = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    return (
        <SafeAreaView style={styles.container}>
            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={theme.colors.primaryLight} size="large" />
                    <Text style={styles.loadingTxt}>Memuat komisi...</Text>
                </View>
            ) : (
                <FlatList
                    data={data.orders}
                    keyExtractor={item => item.orderId.toString()}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />
                    }
                    contentContainerStyle={{ paddingBottom: 40 }}
                    ListHeaderComponent={(
                        <>
                            {/* Header */}
                            <View style={styles.header}>
                                <View>
                                    <Text style={styles.headerTitle}>Komisi Saya</Text>
                                    <Text style={styles.headerSub}>{monthName}</Text>
                                </View>
                                <View style={styles.headerBadge}>
                                    <Award size={16} color={theme.colors.primaryLight} />
                                </View>
                            </View>

                            {/* Main Gradient Card */}
                            <LinearGradient
                                colors={['#6366f1', '#4f46e5', '#3730a3']}
                                style={styles.mainCard}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            >
                                <View style={styles.decorCircle1} />
                                <View style={styles.decorCircle2} />

                                <View style={styles.mainCardTop}>
                                    <View style={styles.mainCardIconWrap}>
                                        <Wallet size={22} color="#fff" />
                                    </View>
                                    <Text style={styles.mainCardLbl}>Komisi Bulan Ini</Text>
                                </View>

                                <Text style={styles.mainCardVal}>
                                    Rp {thisMonthCommission.toLocaleString('id-ID')}
                                </Text>

                                <View style={styles.mainCardRow}>
                                    {growth !== null ? (
                                        <View style={[styles.growthChip, isGrowthPositive ? styles.growthPos : styles.growthNeg]}>
                                            {isGrowthPositive
                                                ? <TrendingUp size={12} color="#fff" />
                                                : <TrendingDown size={12} color="#fff" />
                                            }
                                            <Text style={styles.growthTxt}>
                                                {isGrowthPositive ? '+' : ''}{growth}% vs bln lalu
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.growthChip}>
                                            <Text style={styles.growthTxt}>Bulan pertama</Text>
                                        </View>
                                    )}
                                    <Text style={styles.mainCardCount}>{thisMonthOrders.length} order</Text>
                                </View>

                                {lastMonthCommission > 0 && (
                                    <View style={styles.progressWrap}>
                                        <View style={styles.progressTrack}>
                                            <View style={[styles.progressBar, {
                                                width: `${Math.min((thisMonthCommission / lastMonthCommission) * 100, 100)}%`
                                            }]} />
                                        </View>
                                        <Text style={styles.progressLbl}>
                                            {Math.min(Math.round((thisMonthCommission / lastMonthCommission) * 100), 100)}% dari bln lalu
                                        </Text>
                                    </View>
                                )}
                            </LinearGradient>

                            {/* Stats Row */}
                            <View style={styles.statsRow}>
                                <View style={styles.statCard}>
                                    <View style={[styles.statIconWrap, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                                        <BarChart2 size={16} color={theme.colors.primaryLight} />
                                    </View>
                                    <Text numberOfLines={1} style={styles.statLbl}>Total Komisi</Text>
                                    <Text numberOfLines={1} style={styles.statVal}>
                                        {formatRp(data.grandTotalCommission)}
                                    </Text>
                                </View>

                                <View style={styles.statCard}>
                                    <View style={[styles.statIconWrap, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                                        <Calendar size={16} color="#8b5cf6" />
                                    </View>
                                    <Text numberOfLines={1} style={styles.statLbl}>Bln Lalu</Text>
                                    <Text numberOfLines={1} style={styles.statVal}>
                                        {formatRp(lastMonthCommission)}
                                    </Text>
                                </View>

                                <View style={styles.statCard}>
                                    <View style={[styles.statIconWrap, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                                        <CheckCircle2 size={16} color="#10b981" />
                                    </View>
                                    <Text numberOfLines={1} style={styles.statLbl}>Order Selesai</Text>
                                    <Text numberOfLines={1} style={[styles.statVal, { color: '#10b981' }]}>
                                        {data.orders.length}
                                    </Text>
                                </View>
                            </View>

                            {data.orders.length > 0 && (
                                <Text style={styles.sectionTitle}>Riwayat Pesanan</Text>
                            )}
                        </>
                    )}
                    ListEmptyComponent={(
                        <View style={styles.emptyWrap}>
                            <LinearGradient
                                colors={['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.05)']}
                                style={styles.emptyIcon}
                            >
                                <Wallet size={36} color={theme.colors.primaryLight} />
                            </LinearGradient>
                            <Text style={styles.emptyTitle}>Belum Ada Komisi</Text>
                            <Text style={styles.emptyDesc}>
                                Komisi akan muncul setelah pesanan Anda berstatus DELIVERED
                            </Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.orderCard}
                            onPress={() => setSelectedOrder(item)}
                            activeOpacity={0.82}
                        >
                            <View style={styles.orderIconWrap}>
                                <CheckCircle2 size={18} color="#10b981" />
                            </View>
                            <View style={styles.orderMid}>
                                <Text numberOfLines={1} style={styles.orderInvoice}>{item.invoice_id}</Text>
                                <Text numberOfLines={1} style={styles.orderBuyer}>{item.buyerName || '-'}</Text>
                                <Text style={styles.orderDate}>
                                    {new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </Text>
                            </View>
                            <View style={styles.orderRight}>
                                <Text style={styles.orderComm}>+Rp {item.totalCommission.toLocaleString('id-ID')}</Text>
                                <Text style={styles.orderOmzet}>Omzet {(item.totalAmount / 1000).toFixed(0)}k</Text>
                                <ChevronRight size={14} color={theme.colors.muted} style={{ marginTop: 4 }} />
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Detail Modal */}
            {selectedOrder && (
                <Modal visible animationType="slide" transparent onRequestClose={() => setSelectedOrder(null)}>
                    <View style={styles.overlay}>
                        <TouchableOpacity style={styles.overlayDismiss} onPress={() => setSelectedOrder(null)} />
                        <View style={styles.sheet}>
                            <View style={styles.sheetHandle} />

                            <View style={styles.sheetHeader}>
                                <View style={styles.sheetHeaderLeft}>
                                    <Text style={styles.sheetTitle}>Detail Komisi</Text>
                                    <Text style={styles.sheetSub}>{selectedOrder.invoice_id}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeBtn}>
                                    <X size={18} color={theme.colors.muted} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Total Commission Highlight */}
                                <LinearGradient
                                    colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']}
                                    style={styles.commHighlight}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.commHighlightLbl}>Total Komisi Order Ini</Text>
                                    <Text style={styles.commHighlightVal}>
                                        Rp {selectedOrder.totalCommission.toLocaleString('id-ID')}
                                    </Text>
                                </LinearGradient>

                                {/* Summary */}
                                <View style={styles.summaryBox}>
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLbl}>Pembeli</Text>
                                        <Text numberOfLines={1} style={styles.summaryVal}>{selectedOrder.buyerName || '-'}</Text>
                                    </View>
                                    <View style={styles.summaryDivider} />
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLbl}>Tanggal</Text>
                                        <Text style={styles.summaryVal}>
                                            {new Date(selectedOrder.date).toLocaleString('id-ID')}
                                        </Text>
                                    </View>
                                    <View style={styles.summaryDivider} />
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLbl}>Omzet Order</Text>
                                        <Text style={styles.summaryVal}>
                                            Rp {selectedOrder.totalAmount.toLocaleString('id-ID')}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.itemsSectionTitle}>Rincian per Produk</Text>
                                <View style={styles.itemsBox}>
                                    {selectedOrder.items.map((item, idx) => (
                                        <View key={idx} style={[
                                            styles.itemRow,
                                            idx > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }
                                        ]}>
                                            <View style={styles.itemIconWrap}>
                                                <Package size={14} color={theme.colors.muted} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text numberOfLines={2} style={styles.itemName}>{item.productName}</Text>
                                                <Text style={styles.itemFormula}>
                                                    {item.quantity} unit × Rp {item.commissionPerUnit.toLocaleString('id-ID')}
                                                </Text>
                                            </View>
                                            <Text style={styles.itemComm}>
                                                +Rp {item.totalItemCommission.toLocaleString('id-ID')}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },

    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingTxt: { fontSize: 13, color: theme.colors.muted },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 44 : 14,
        paddingBottom: 6,
    },
    headerTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.text },
    headerSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
    headerBadge: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(99,102,241,0.12)',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
    },

    // Main Card
    mainCard: { margin: 20, borderRadius: 22, padding: 22, overflow: 'hidden' },
    decorCircle1: {
        position: 'absolute', width: 140, height: 140, borderRadius: 70,
        backgroundColor: 'rgba(255,255,255,0.06)', top: -40, right: -30,
    },
    decorCircle2: {
        position: 'absolute', width: 90, height: 90, borderRadius: 45,
        backgroundColor: 'rgba(255,255,255,0.04)', bottom: -20, left: 20,
    },
    mainCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    mainCardIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.18)',
        justifyContent: 'center', alignItems: 'center',
    },
    mainCardLbl: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
    mainCardVal: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12 },
    mainCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    growthChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    },
    growthPos: { backgroundColor: 'rgba(16,185,129,0.35)' },
    growthNeg: { backgroundColor: 'rgba(239,68,68,0.35)' },
    growthTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
    mainCardCount: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
    progressWrap: { gap: 6 },
    progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
    progressLbl: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600' },

    // Stats Row
    statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
    statCard: {
        flex: 1, minWidth: 0,
        backgroundColor: theme.colors.card,
        borderRadius: 14, padding: 12,
        borderWidth: 1.5, borderColor: theme.colors.cardBorder,
        gap: 6, alignItems: 'center',
    },
    statIconWrap: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    statLbl: { fontSize: 10, color: theme.colors.muted, fontWeight: '700', textAlign: 'center' },
    statVal: { fontSize: 12, fontWeight: '900', color: theme.colors.text, textAlign: 'center' },

    sectionTitle: {
        fontSize: 12, fontWeight: '800', color: theme.colors.muted,
        letterSpacing: 0.8, textTransform: 'uppercase',
        paddingHorizontal: 20, marginBottom: 10,
    },

    // Order Card
    orderCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.colors.card,
        marginHorizontal: 20, marginBottom: 8,
        borderRadius: 14, padding: 14,
        borderWidth: 1.5, borderColor: theme.colors.cardBorder,
        gap: 12,
    },
    orderIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(16,185,129,0.1)',
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    orderMid: { flex: 1, minWidth: 0 },
    orderInvoice: { fontSize: 11, fontWeight: '700', color: theme.colors.primaryLight },
    orderBuyer: { fontSize: 13, fontWeight: '800', color: theme.colors.text, marginTop: 2 },
    orderDate: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
    orderRight: { alignItems: 'flex-end', flexShrink: 0 },
    orderComm: { fontSize: 14, fontWeight: '900', color: '#10b981' },
    orderOmzet: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },

    // Empty
    emptyWrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40, gap: 14 },
    emptyIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.textSecondary },
    emptyDesc: { color: theme.colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },

    // Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    overlayDismiss: { flex: 1 },
    sheet: {
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        maxHeight: '82%',
        borderTopWidth: 1, borderColor: theme.colors.border,
        paddingBottom: 10,
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: theme.colors.border,
        alignSelf: 'center', marginTop: 10, marginBottom: 4,
    },
    sheetHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    sheetHeaderLeft: { flex: 1 },
    sheetTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.text },
    sheetSub: { fontSize: 11, color: theme.colors.muted, marginTop: 3 },
    closeBtn: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: theme.colors.glass,
        borderWidth: 1, borderColor: theme.colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    commHighlight: {
        borderRadius: 14, padding: 18, alignItems: 'center',
        marginTop: 16, marginBottom: 16,
        borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    },
    commHighlightLbl: { fontSize: 12, color: '#10b981', fontWeight: '700', marginBottom: 6 },
    commHighlightVal: { fontSize: 28, fontWeight: '900', color: '#10b981', letterSpacing: -0.5 },
    summaryBox: {
        backgroundColor: theme.colors.background,
        borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border,
        marginBottom: 20, overflow: 'hidden',
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, gap: 12 },
    summaryLbl: { fontSize: 12, color: theme.colors.muted, fontWeight: '600', flexShrink: 0 },
    summaryVal: { fontSize: 13, fontWeight: '700', color: theme.colors.text, textAlign: 'right', flex: 1 },
    summaryDivider: { height: 1, backgroundColor: theme.colors.border },
    itemsSectionTitle: {
        fontSize: 12, fontWeight: '800', color: theme.colors.muted,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
    },
    itemsBox: {
        backgroundColor: theme.colors.background,
        borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border,
        overflow: 'hidden',
    },
    itemRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    itemIconWrap: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: theme.colors.glass,
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    itemName: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
    itemFormula: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
    itemComm: { fontSize: 14, fontWeight: '800', color: '#10b981', flexShrink: 0 },
});
