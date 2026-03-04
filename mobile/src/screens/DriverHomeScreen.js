import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet, View, Text, FlatList, TouchableOpacity,
    Platform, Dimensions, StatusBar, SafeAreaView, Modal,
    ActivityIndicator, Alert, ScrollView, Animated,
} from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import { useDriver } from '../context/DriverContext';
import {
    Truck, MapPin, Package, LogOut, ChevronRight,
    CheckCircle2, User, Phone, X, Clock,
    Wifi, WifiOff, AlertCircle, RotateCcw,
} from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const STATUS_CONFIG = {
    PENDING:   { label: 'Menunggu',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: Clock },
    SHIPPED:   { label: 'Dikirim',    color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  icon: Truck },
    DELIVERED: { label: 'Sampai',     color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle2 },
    CANCELLED: { label: 'Dibatalkan', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: AlertCircle },
};

export default function DriverHomeScreen() {
    const { user, logout } = useAuth();
    const { isOnline, toggleOnline } = useDriver();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Pulse animation for online indicator
    useEffect(() => {
        if (!isOnline) { pulseAnim.setValue(1); return; }
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [isOnline]);

    useEffect(() => { fetchOrders(); }, []);

    const fetchOrders = async (pull = false) => {
        if (pull) setRefreshing(true); else setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/orders?driverId=${user.id}`);
            setOrders(res.data);
        } catch { /* silent */ }
        finally { setLoading(false); setRefreshing(false); }
    };

    const handleUpdateStatus = async (orderId, newStatus) => {
        try {
            setLoading(true);
            await axios.put(`${BASE_URL}/api/orders/${orderId}/status`, { status: newStatus });
            await fetchOrders();
            setModalVisible(false);
            Alert.alert('Berhasil ✓', 'Status pesanan berhasil diperbarui');
        } catch {
            Alert.alert('Gagal', 'Gagal memperbarui status pesanan');
        } finally { setLoading(false); }
    };

    // Derived stats
    const shipped   = orders.filter(o => o.status === 'SHIPPED').length;
    const delivered = orders.filter(o => o.status === 'DELIVERED').length;
    const pending   = orders.filter(o => o.status === 'PENDING').length;

    const renderOrderItem = ({ item }) => {
        const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
        const StatusIcon = cfg.icon;
        return (
            <TouchableOpacity
                style={styles.orderCard}
                activeOpacity={0.85}
                onPress={() => { setSelectedOrder(item); setModalVisible(true); }}
            >
                <View style={styles.cardLeft}>
                    <View style={[styles.cardIconBox, { backgroundColor: cfg.bg }]}>
                        <StatusIcon size={18} color={cfg.color} strokeWidth={2} />
                    </View>
                </View>
                <View style={styles.cardMid}>
                    <View style={styles.cardTopRow}>
                        <Text style={styles.cardInvoice}>{item.invoice_id}</Text>
                        <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                            <Text style={[styles.statusPillTxt, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                    </View>
                    <Text style={styles.cardBuyer} numberOfLines={1}>
                        {item.buyer?.name || 'Pelanggan'}
                    </Text>
                    <View style={styles.cardAddressRow}>
                        <MapPin size={11} color={theme.colors.muted} />
                        <Text style={styles.cardAddress} numberOfLines={1}>
                            {item.buyer?.address || 'Alamat tidak tersedia'}
                        </Text>
                    </View>
                </View>
                <View style={styles.cardRight}>
                    <View style={styles.cardItemsBadge}>
                        <Package size={11} color={theme.colors.muted} />
                        <Text style={styles.cardItemsTxt}>{item.items?.length || 0}</Text>
                    </View>
                    <ChevronRight size={16} color={theme.colors.muted} style={{ marginTop: 8 }} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <FlatList
                data={orders}
                keyExtractor={item => item.id.toString()}
                renderItem={renderOrderItem}
                onRefresh={() => fetchOrders(true)}
                refreshing={refreshing}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={(
                    <>
                        {/* ── Header ── */}
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                <View style={styles.avatarWrap}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarTxt}>{user?.name?.charAt(0)?.toUpperCase()}</Text>
                                    </View>
                                    {isOnline && (
                                        <Animated.View style={[styles.onlinePulse, { transform: [{ scale: pulseAnim }] }]} />
                                    )}
                                    <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#10b981' : '#4b5563' }]} />
                                </View>
                                <View>
                                    <Text style={styles.helloTxt}>Halo, {user?.name?.split(' ')[0]} 👋</Text>
                                    <Text style={styles.roleTxt}>DRIVER · {isOnline ? 'Online' : 'Offline'}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                                <LogOut size={18} color="#ef4444" />
                            </TouchableOpacity>
                        </View>

                        {/* ── Online Toggle Card ── */}
                        <TouchableOpacity
                            activeOpacity={0.88}
                            onPress={toggleOnline}
                            style={{ marginHorizontal: 20, marginBottom: 14 }}
                        >
                            <LinearGradient
                                colors={isOnline ? ['#1e1b4b', '#312e81', '#4f46e5'] : ['#111018', '#17161f']}
                                style={styles.toggleCard}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            >
                                {/* decorative rings always rendered, opacity shifts */}
                                <View style={[styles.radarRing1, { borderColor: isOnline ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)' }]} />
                                <View style={[styles.radarRing2, { borderColor: isOnline ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)' }]} />

                                <View style={styles.toggleRow}>
                                    {/* Left: icon + text */}
                                    <View style={{ flex: 1, gap: 4 }}>
                                        <View style={styles.toggleStatusRow}>
                                            <View style={[styles.toggleDot, { backgroundColor: isOnline ? '#10b981' : '#374151' }]} />
                                            <Text style={[styles.toggleBadge, { color: isOnline ? '#6ee7b7' : '#4b5563' }]}>
                                                {isOnline ? 'AKTIF' : 'NONAKTIF'}
                                            </Text>
                                        </View>
                                        <Text style={[styles.toggleTitle, { color: isOnline ? '#fff' : '#6b7280' }]}>
                                            {isOnline ? 'Sinyal Radar Menyala' : 'Sinyal Radar Mati'}
                                        </Text>
                                        <Text style={[styles.toggleSub, { color: isOnline ? 'rgba(255,255,255,0.5)' : '#374151' }]}>
                                            {isOnline ? 'Lokasi Anda sedang dipantau stokis' : 'Ketuk untuk mengaktifkan radar'}
                                        </Text>
                                    </View>

                                    {/* Right: custom power button */}
                                    <View style={[styles.powerBtn, {
                                        backgroundColor: isOnline ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)',
                                        borderColor: isOnline ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)',
                                        shadowColor: isOnline ? '#6366f1' : 'transparent',
                                        shadowOpacity: isOnline ? 0.6 : 0,
                                        shadowRadius: isOnline ? 12 : 0,
                                        elevation: isOnline ? 8 : 0,
                                    }]}>
                                        {isOnline
                                            ? <Wifi size={24} color="#818cf8" strokeWidth={2} />
                                            : <WifiOff size={24} color="#374151" strokeWidth={2} />}
                                    </View>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* ── Stats Row ── */}
                        <View style={styles.statsRow}>
                            {[
                                { label: 'Dikirim',   value: shipped,   color: '#6366f1' },
                                { label: 'Selesai',   value: delivered, color: '#10b981' },
                                { label: 'Menunggu',  value: pending,   color: '#f59e0b' },
                            ].map(({ label, value, color }) => (
                                <View key={label} style={styles.statBox}>
                                    <Text style={[styles.statVal, { color }]}>{value}</Text>
                                    <Text style={styles.statLbl}>{label}</Text>
                                </View>
                            ))}
                        </View>

                        {/* ── Section Title ── */}
                        <View style={styles.sectionRow}>
                            <Text style={styles.sectionTitle}>Manifest Pengiriman</Text>
                            <TouchableOpacity onPress={() => fetchOrders()} style={styles.refreshBtn}>
                                <RotateCcw size={14} color={theme.colors.primaryLight} />
                            </TouchableOpacity>
                        </View>
                    </>
                )}
                ListEmptyComponent={!loading && (
                    <View style={styles.emptyBox}>
                        <View style={styles.emptyIcon}>
                            <Truck size={40} color={theme.colors.muted} />
                        </View>
                        <Text style={styles.emptyTitle}>Tidak Ada Pesanan</Text>
                        <Text style={styles.emptyDesc}>Belum ada manifest pengiriman hari ini</Text>
                    </View>
                )}
            />

            {/* ── Order Detail Modal ── */}
            <Modal
                animationType="slide"
                transparent
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.sheetHandle} />

                        {selectedOrder && (() => {
                            const cfg = STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.PENDING;
                            return (
                                <>
                                    {/* Modal Header */}
                                    <LinearGradient
                                        colors={[cfg.bg.replace('0.12', '0.18'), 'transparent']}
                                        style={styles.modalHeadGrad}
                                    >
                                        <View style={styles.modalHeadRow}>
                                            <View>
                                                <Text style={styles.modalInvoice}>{selectedOrder.invoice_id}</Text>
                                                <View style={[styles.statusPill, { backgroundColor: cfg.bg, marginTop: 6 }]}>
                                                    <Text style={[styles.statusPillTxt, { color: cfg.color }]}>{cfg.label}</Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                                                <X size={20} color={theme.colors.muted} />
                                            </TouchableOpacity>
                                        </View>
                                    </LinearGradient>

                                    <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                                        {/* Buyer Info */}
                                        <View style={styles.infoCard}>
                                            <View style={styles.infoCardRow}>
                                                <View style={styles.infoIcon}><User size={15} color={theme.colors.primaryLight} /></View>
                                                <View>
                                                    <Text style={styles.infoLbl}>Penerima</Text>
                                                    <Text style={styles.infoVal}>{selectedOrder.buyer?.name || '-'}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.infoDivider} />
                                            <View style={styles.infoCardRow}>
                                                <View style={styles.infoIcon}><Phone size={15} color={theme.colors.primaryLight} /></View>
                                                <View>
                                                    <Text style={styles.infoLbl}>Nomor HP</Text>
                                                    <Text style={styles.infoVal}>{selectedOrder.buyer?.contact || '-'}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.infoDivider} />
                                            <View style={styles.infoCardRow}>
                                                <View style={styles.infoIcon}><MapPin size={15} color={theme.colors.primaryLight} /></View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.infoLbl}>Alamat</Text>
                                                    <Text style={styles.infoVal}>{selectedOrder.buyer?.address || '-'}</Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Items */}
                                        <Text style={styles.itemsHeading}>Daftar Muatan</Text>
                                        <View style={styles.itemsCard}>
                                            {selectedOrder.items?.map((it, idx) => (
                                                <View key={idx} style={[styles.itemRow, idx > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }]}>
                                                    <View style={styles.itemDot} />
                                                    <Text style={styles.itemName} numberOfLines={1}>{it.product?.name || '-'}</Text>
                                                    <View style={styles.itemQtyBox}>
                                                        <Text style={styles.itemQtyTxt}>{it.quantity} unit</Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>

                                        {/* Action */}
                                        <View style={styles.modalActionBox}>
                                            {selectedOrder.status === 'SHIPPED' ? (
                                                <TouchableOpacity
                                                    style={styles.deliverBtn}
                                                    onPress={() => handleUpdateStatus(selectedOrder.id, 'DELIVERED')}
                                                    disabled={loading}
                                                    activeOpacity={0.85}
                                                >
                                                    <LinearGradient
                                                        colors={['#059669', '#10b981']}
                                                        style={styles.deliverBtnInner}
                                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                    >
                                                        {loading
                                                            ? <ActivityIndicator color="#fff" />
                                                            : <>
                                                                <CheckCircle2 size={20} color="#fff" />
                                                                <Text style={styles.deliverBtnTxt}>Konfirmasi Sudah Sampai</Text>
                                                            </>}
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            ) : selectedOrder.status === 'DELIVERED' ? (
                                                <View style={styles.deliveredBanner}>
                                                    <CheckCircle2 size={18} color="#10b981" />
                                                    <Text style={styles.deliveredBannerTxt}>Pesanan sudah selesai diantarkan</Text>
                                                </View>
                                            ) : (
                                                <View style={styles.waitingBanner}>
                                                    <Clock size={18} color="#f59e0b" />
                                                    <Text style={styles.waitingBannerTxt}>Menunggu konfirmasi muat di gudang</Text>
                                                </View>
                                            )}
                                        </View>
                                    </ScrollView>
                                </>
                            );
                        })()}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0e1a' },
    listContainer: { paddingBottom: 24 },

    /* ── Header ── */
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 44 : 14, paddingBottom: 20,
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
    onlinePulse: {
        position: 'absolute', bottom: -2, right: -2,
        width: 16, height: 16, borderRadius: 8,
        backgroundColor: 'rgba(16,185,129,0.3)',
    },
    onlineDot: {
        position: 'absolute', bottom: 0, right: 0,
        width: 12, height: 12, borderRadius: 6,
        borderWidth: 2, borderColor: '#0f0e1a',
    },
    helloTxt: { fontSize: 17, fontWeight: '800', color: '#fff' },
    roleTxt: { fontSize: 10, color: '#6b7280', fontWeight: '700', letterSpacing: 1, marginTop: 1 },
    logoutBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)',
        justifyContent: 'center', alignItems: 'center',
    },

    /* ── Toggle Card ── */
    toggleCard: {
        borderRadius: 18, padding: 18, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    },
    radarRing1: {
        position: 'absolute', top: -40, right: -40,
        width: 140, height: 140, borderRadius: 70,
        borderWidth: 1,
    },
    radarRing2: {
        position: 'absolute', top: -10, right: -10,
        width: 90, height: 90, borderRadius: 45,
        borderWidth: 1,
    },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    toggleStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    toggleDot: { width: 7, height: 7, borderRadius: 4 },
    toggleBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    toggleTitle: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
    toggleSub: { fontSize: 12, lineHeight: 17 },
    powerBtn: {
        width: 58, height: 58, borderRadius: 18,
        borderWidth: 1.5,
        justifyContent: 'center', alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
    },

    /* ── Stats ── */
    statsRow: {
        flexDirection: 'row', marginHorizontal: 20, marginBottom: 18,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        paddingVertical: 14,
    },
    statBox: { flex: 1, alignItems: 'center', gap: 4 },
    statVal: { fontSize: 22, fontWeight: '900' },
    statLbl: { fontSize: 10, color: '#6b7280', fontWeight: '700', letterSpacing: 0.5 },

    /* ── Section ── */
    sectionRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, marginBottom: 10,
    },
    sectionTitle: { fontSize: 13, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 },
    refreshBtn: {
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: 'rgba(99,102,241,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },

    /* ── Order Cards ── */
    orderCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16, marginHorizontal: 20, marginBottom: 10,
        padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        gap: 12,
    },
    cardLeft: { flexShrink: 0 },
    cardIconBox: { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
    cardMid: { flex: 1 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    cardInvoice: { fontSize: 11, fontWeight: '700', color: '#818cf8', fontFamily: 'monospace', flex: 1 },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusPillTxt: { fontSize: 10, fontWeight: '800' },
    cardBuyer: { fontSize: 14, fontWeight: '800', color: '#f9fafb', marginBottom: 4 },
    cardAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardAddress: { fontSize: 11, color: '#6b7280', flex: 1 },
    cardRight: { alignItems: 'center', flexShrink: 0 },
    cardItemsBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4,
    },
    cardItemsTxt: { fontSize: 11, color: '#9ca3af', fontWeight: '700' },

    /* ── Empty ── */
    emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyIcon: {
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        justifyContent: 'center', alignItems: 'center',
    },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: '#9ca3af' },
    emptyDesc: { fontSize: 13, color: '#4b5563', textAlign: 'center' },

    /* ── Modal ── */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: '#13111f',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        maxHeight: height * 0.82,
        borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        paddingBottom: 32,
    },
    sheetHandle: {
        width: 36, height: 4, borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignSelf: 'center', marginTop: 12,
    },
    modalHeadGrad: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
    modalHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    modalInvoice: { fontSize: 20, fontWeight: '900', color: '#fff', fontFamily: 'monospace' },
    closeBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center', alignItems: 'center',
    },

    /* Info Card */
    infoCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        marginBottom: 20,
    },
    infoCardRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
    infoIcon: {
        width: 32, height: 32, borderRadius: 9,
        backgroundColor: 'rgba(99,102,241,0.12)',
        justifyContent: 'center', alignItems: 'center', marginTop: 1,
    },
    infoDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 14 },
    infoLbl: { fontSize: 10, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    infoVal: { fontSize: 14, fontWeight: '700', color: '#f9fafb', marginTop: 3, lineHeight: 20 },

    /* Items */
    itemsHeading: { fontSize: 11, fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
    itemsCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
        marginBottom: 20,
    },
    itemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    itemDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6366f1', flexShrink: 0 },
    itemName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#e5e7eb' },
    itemQtyBox: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
    },
    itemQtyTxt: { fontSize: 11, fontWeight: '800', color: '#9ca3af' },

    /* Action */
    modalActionBox: { paddingBottom: 10 },
    deliverBtn: { borderRadius: 16, overflow: 'hidden' },
    deliverBtnInner: { height: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    deliverBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
    deliveredBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: 'rgba(16,185,129,0.1)',
        borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
        borderRadius: 14, height: 52,
    },
    deliveredBannerTxt: { color: '#10b981', fontSize: 14, fontWeight: '700' },
    waitingBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: 'rgba(245,158,11,0.08)',
        borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
        borderRadius: 14, height: 52,
    },
    waitingBannerTxt: { color: '#f59e0b', fontSize: 14, fontWeight: '700' },
});
