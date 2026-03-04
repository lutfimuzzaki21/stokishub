import React, { useState, useEffect } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, FlatList,
    SafeAreaView, Modal, ScrollView, RefreshControl,
    Platform, ActivityIndicator,
} from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import {
    Package, ChevronRight, X, Clock, CheckCircle2,
    Truck, ShoppingBag, AlertCircle, RefreshCw,
} from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const formatRp = (v) => `Rp ${v.toLocaleString('id-ID')}`;

const STATUS_CONFIG = {
    PENDING:    { label: 'Menunggu',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  Icon: Clock },
    PROCESSING: { label: 'Diproses', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', Icon: RefreshCw },
    SHIPPED:    { label: 'Dikirim',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', Icon: Truck },
    DELIVERED:  { label: 'Selesai',  color: '#10b981', bg: 'rgba(16,185,129,0.12)', Icon: CheckCircle2 },
    CANCELLED:  { label: 'Dibatal', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   Icon: AlertCircle },
};

export default function ConsumerOrdersScreen() {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selected, setSelected] = useState(null);

    useEffect(() => { fetchOrders(); }, []);

    const fetchOrders = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/orders?buyerId=${user.id}`, { timeout: 10000 });
            setOrders(res.data);
        } catch (_) {}
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => { setRefreshing(true); fetchOrders(); };

    const renderItem = ({ item }) => {
        const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
        const StatusIcon = cfg.Icon;
        const date = new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => setSelected(item)}
                activeOpacity={0.85}
            >
                <View style={[styles.orderStatusIcon, { backgroundColor: cfg.bg }]}>
                    <StatusIcon size={18} color={cfg.color} />
                </View>
                <View style={styles.orderMid}>
                    <Text numberOfLines={1} style={styles.orderInvoice}>{item.invoice_id}</Text>
                    <Text style={styles.orderDate}>{date}</Text>
                    <Text style={styles.orderItemsCount}>{item.items?.length || 0} produk</Text>
                </View>
                <View style={styles.orderRight}>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.statusBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={styles.orderTotal}>{formatRp(item.total_amount)}</Text>
                    <ChevronRight size={14} color={theme.colors.muted} style={{ marginTop: 4 }} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Pesanan Saya</Text>
                <Text style={styles.headerSub}>{orders.length} total pesanan</Text>
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={theme.colors.primaryLight} size="large" />
                    <Text style={styles.loadingTxt}>Memuat pesanan...</Text>
                </View>
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={i => i.id.toString()}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />}
                    ListEmptyComponent={(
                        <View style={styles.emptyWrap}>
                            <LinearGradient
                                colors={['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.05)']}
                                style={styles.emptyIcon}
                            >
                                <ShoppingBag size={36} color={theme.colors.primaryLight} />
                            </LinearGradient>
                            <Text style={styles.emptyTitle}>Belum Ada Pesanan</Text>
                            <Text style={styles.emptyDesc}>Pesanan kamu akan muncul di sini setelah kamu berbelanja</Text>
                        </View>
                    )}
                    renderItem={renderItem}
                />
            )}

            {/* Order Detail Modal */}
            {selected && (
                <Modal visible animationType="slide" transparent onRequestClose={() => setSelected(null)}>
                    <View style={styles.overlay}>
                        <TouchableOpacity style={styles.overlayDismiss} onPress={() => setSelected(null)} />
                        <View style={styles.sheet}>
                            <View style={styles.sheetHandle} />
                            <View style={styles.sheetHeader}>
                                <View style={styles.sheetHeaderLeft}>
                                    <Text style={styles.sheetTitle}>Detail Pesanan</Text>
                                    <Text style={styles.sheetSub}>{selected.invoice_id}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                                    <X size={18} color={theme.colors.muted} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
                                {/* Status Banner */}
                                {(() => {
                                    const cfg = STATUS_CONFIG[selected.status] || STATUS_CONFIG.PENDING;
                                    const StatusIcon = cfg.Icon;
                                    return (
                                        <LinearGradient
                                            colors={[cfg.bg, 'transparent']}
                                            style={styles.statusBanner}
                                        >
                                            <StatusIcon size={22} color={cfg.color} />
                                            <View>
                                                <Text style={[styles.statusBannerLabel, { color: cfg.color }]}>{cfg.label}</Text>
                                                <Text style={styles.statusBannerDate}>
                                                    {new Date(selected.date).toLocaleString('id-ID')}
                                                </Text>
                                            </View>
                                        </LinearGradient>
                                    );
                                })()}

                                {/* Items */}
                                <Text style={styles.sectionLabel}>Produk yang Dipesan</Text>
                                <View style={styles.itemsBox}>
                                    {(selected.items || []).map((item, idx) => (
                                        <View key={idx} style={[
                                            styles.itemRow,
                                            idx > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }
                                        ]}>
                                            <View style={styles.itemIconWrap}>
                                                <Package size={14} color={theme.colors.muted} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text numberOfLines={2} style={styles.itemName}>{item.product?.name || '-'}</Text>
                                                <Text style={styles.itemFormula}>
                                                    {item.quantity} × {formatRp(item.price)}
                                                </Text>
                                            </View>
                                            <Text style={styles.itemTotal}>{formatRp(item.quantity * item.price)}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Total */}
                                <View style={styles.totalBox}>
                                    <Text style={styles.totalLbl}>Total Pembayaran</Text>
                                    <Text style={styles.totalVal}>{formatRp(selected.total_amount)}</Text>
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
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 44 : 14,
        paddingBottom: 12,
    },
    headerTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.text },
    headerSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingTxt: { fontSize: 13, color: theme.colors.muted },
    listContent: { paddingHorizontal: 20, paddingBottom: 30 },
    emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 14 },
    emptyIcon: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.textSecondary },
    emptyDesc: { color: theme.colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },

    orderCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: theme.colors.card,
        borderRadius: 14, padding: 14, marginBottom: 10,
        borderWidth: 1.5, borderColor: theme.colors.cardBorder,
        gap: 12,
    },
    orderStatusIcon: {
        width: 42, height: 42, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    orderMid: { flex: 1, minWidth: 0 },
    orderInvoice: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryLight },
    orderDate: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
    orderItemsCount: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
    orderRight: { alignItems: 'flex-end', gap: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    statusBadgeTxt: { fontSize: 10, fontWeight: '800' },
    orderTotal: { fontSize: 13, fontWeight: '900', color: theme.colors.text },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    overlayDismiss: { flex: 1 },
    sheet: {
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        maxHeight: '85%',
        borderTopWidth: 1, borderColor: theme.colors.border,
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
        backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    sheetBody: { padding: 20, paddingBottom: 30 },

    statusBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderRadius: 14, padding: 16, marginBottom: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    statusBannerLabel: { fontSize: 15, fontWeight: '900' },
    statusBannerDate: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

    sectionLabel: {
        fontSize: 11, fontWeight: '800', color: theme.colors.muted,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
    },
    itemsBox: {
        backgroundColor: theme.colors.background,
        borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border,
        overflow: 'hidden', marginBottom: 16,
    },
    itemRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    itemIconWrap: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: theme.colors.glass,
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    itemName: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
    itemFormula: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
    itemTotal: { fontSize: 13, fontWeight: '800', color: theme.colors.text, flexShrink: 0 },

    totalBox: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 14,
        padding: 16, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
    },
    totalLbl: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    totalVal: { fontSize: 18, fontWeight: '900', color: theme.colors.primaryLight },
});
