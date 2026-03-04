import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Platform, Dimensions, StatusBar, SafeAreaView, Modal,
    ActivityIndicator, Alert, Animated
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import {
    Truck, MapPin, Package, CheckCircle2, User,
    Phone, Navigation2, ChevronRight, Clock, X, AlertCircle
} from 'lucide-react-native';
import * as Location from 'expo-location';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Default Jakarta center
const DEFAULT_REGION = {
    latitude: -6.1751,
    longitude: 106.8272,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

const STATUS_CONFIG = {
    PENDING:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Menunggu' },
    PROCESSING: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  label: 'Diproses' },
    SHIPPED:    { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  label: 'Sedang Dikirim' },
    DELIVERED:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Selesai' },
};

export default function DriverDeliveryScreen() {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
    const [confirming, setConfirming] = useState(false);
    const [driverCoords, setDriverCoords] = useState(null);
    const [routeCoords, setRouteCoords] = useState({}); // { segmentKey: [{latitude, longitude},...] }
    const [sortedActiveIds, setSortedActiveIds] = useState([]); // nearest-first ordered IDs
    const mapRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchOrders();
        getCurrentLocation();
    }, []);

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1, duration: 400, useNativeDriver: true,
        }).start();
    }, [orders]);

    useEffect(() => {
        if (driverCoords && orders.length > 0) {
            fetchRoutes(driverCoords, orders);
        }
    }, [driverCoords, orders]);

    const getCurrentLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setDriverCoords(coords);
            setMapRegion({ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 });
            // Fly map to driver position immediately
            mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 800);
        } catch (e) {
            // Keep default region
        }
    };

    // Haversine distance in km between two lat/lng points
    const haversine = (lat1, lng1, lat2, lng2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    // Greedy nearest-neighbor sort: driver → nearest unvisited → ... 
    const sortByNearest = (dCoords, shippedOrders) => {
        if (!dCoords || shippedOrders.length === 0) return shippedOrders;
        const remaining = [...shippedOrders];
        const sorted = [];
        let curLat = dCoords.latitude;
        let curLng = dCoords.longitude;
        while (remaining.length > 0) {
            let minDist = Infinity, minIdx = 0;
            remaining.forEach((o, i) => {
                const d = haversine(curLat, curLng, o.buyer.latitude, o.buyer.longitude);
                if (d < minDist) { minDist = d; minIdx = i; }
            });
            const next = remaining.splice(minIdx, 1)[0];
            sorted.push(next);
            curLat = next.buyer.latitude;
            curLng = next.buyer.longitude;
        }
        return sorted;
    };

    const fetchRoutes = async (dCoords, ordersArr) => {
        if (!dCoords) return;
        const shipped = ordersArr.filter(o => o.status === 'SHIPPED' && o.buyer?.latitude && o.buyer?.longitude);
        if (shipped.length === 0) { setRouteCoords({}); setSortedActiveIds([]); return; }

        // Sort by nearest-neighbor from driver
        const sorted = sortByNearest(dCoords, shipped);
        setSortedActiveIds(sorted.map(o => o.id));

        // Build waypoint chain: driver → stop1 → stop2 → ...
        const waypoints = [
            `${dCoords.longitude},${dCoords.latitude}`,
            ...sorted.map(o => `${o.buyer.longitude},${o.buyer.latitude}`)
        ].join(';');

        const newRoutes = {};
        try {
            const res = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson&steps=true`,
                { signal: AbortSignal.timeout(10000) }
            );
            const data = await res.json();
            if (data.routes?.[0]?.legs) {
                data.routes[0].legs.forEach((leg, i) => {
                    // Each leg = one segment: driver→stop0, stop0→stop1, etc.
                    const segKey = i === 0 ? `driver-${sorted[0].id}` : `${sorted[i-1].id}-${sorted[i].id}`;
                    const pts = [];
                    leg.steps.forEach(step => {
                        step.geometry.coordinates.forEach(([lng, lat]) => pts.push({ latitude: lat, longitude: lng }));
                    });
                    newRoutes[segKey] = pts;
                    // Also store by orderId for selection highlighting
                    if (i < sorted.length) newRoutes[`order-${sorted[i].id}`] = pts;
                });
            }
        } catch (_) {
            // Fallback: straight lines segment by segment
            let prev = dCoords;
            sorted.forEach(o => {
                const dest = { latitude: o.buyer.latitude, longitude: o.buyer.longitude };
                newRoutes[`order-${o.id}`] = [prev, dest];
                prev = dest;
            });
        }
        setRouteCoords(newRoutes);
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/orders?driverId=${user.id}`, { timeout: 10000 });
            setOrders(res.data);
        } catch (e) {
            Alert.alert('Gagal', 'Tidak bisa memuat data pengiriman');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDelivery = async () => {
        if (!selectedOrder) return;
        Alert.alert(
            'Konfirmasi Selesai',
            `Tandai pengiriman ke\n${selectedOrder.buyer?.name || 'Customer'}\nsebagai SELESAI?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ya, Selesai!',
                    style: 'destructive',
                    onPress: async () => {
                        setConfirming(true);
                        try {
                            await axios.put(`${BASE_URL}/api/orders/${selectedOrder.id}/status`, { status: 'DELIVERED' });
                            Alert.alert('✓ Berhasil!', 'Pengiriman telah selesai dan tercatat!');
                            setModalVisible(false);
                            setSelectedOrder(null);
                            fetchOrders();
                        } catch (e) {
                            Alert.alert('Gagal', 'Coba lagi dalam beberapa saat');
                        } finally {
                            setConfirming(false);
                        }
                    }
                }
            ]
        );
    };

    const openDeliveryDetail = (order) => {
        setSelectedOrder(order);
        setModalVisible(true);
        // Fly map to buyer's registered location
        const destLat = order.buyer?.latitude;
        const destLng = order.buyer?.longitude;
        if (destLat && destLng) {
            mapRef.current?.animateToRegion({
                latitude: destLat,
                longitude: destLng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            }, 600);
        }
    };

    const activeOrders = orders.filter(o => o.status === 'SHIPPED');

    // Nearest-first sorted active orders for display
    const sortedActive = useMemo(() => {
        if (!driverCoords || activeOrders.length === 0) return activeOrders;
        return sortedActiveIds
            .map(id => activeOrders.find(o => o.id === id))
            .filter(Boolean)
            .concat(activeOrders.filter(o => !sortedActiveIds.includes(o.id)));
    }, [sortedActiveIds, activeOrders, driverCoords]);

    const completedToday = orders.filter(o => {
        if (o.status !== 'DELIVERED') return false;
        const today = new Date().toDateString();
        return new Date(o.date).toDateString() === today;
    }).length;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Peta Pengiriman</Text>
                    <Text style={styles.headerSub}>{activeOrders.length} Pengiriman Aktif</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={fetchOrders}>
                    <Navigation2 size={18} color={theme.colors.primaryLight} />
                </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statChip}>
                    <Text style={styles.statNum}>{activeOrders.length}</Text>
                    <Text style={styles.statLbl}>Aktif</Text>
                </View>
                <View style={[styles.statChip, { borderColor: 'rgba(16,185,129,0.3)' }]}>
                    <Text style={[styles.statNum, { color: '#10b981' }]}>{completedToday}</Text>
                    <Text style={styles.statLbl}>Selesai Hari Ini</Text>
                </View>
                <View style={styles.statChip}>
                    <Text style={styles.statNum}>{orders.length}</Text>
                    <Text style={styles.statLbl}>Total Tugas</Text>
                </View>
            </View>

            {/* Map */}
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_DEFAULT}
                    initialRegion={mapRegion}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    customMapStyle={darkMapStyle}
                >
                    {orders.filter(o => o.status === 'SHIPPED').map(order => {
                        const destLat = order.buyer?.latitude;
                        const destLng = order.buyer?.longitude;
                        if (!destLat || !destLng) return null;
                        const stopNum = sortedActiveIds.indexOf(order.id);
                        const isSelected = selectedOrder?.id === order.id;
                        return (
                            <Marker
                                key={order.id}
                                coordinate={{ latitude: destLat, longitude: destLng }}
                                title={`#${stopNum >= 0 ? stopNum + 1 : '?'} ${order.buyer?.store_name || order.buyer?.name || 'Customer'}`}
                                description={`${order.invoice_id} — ${order.buyer?.address || ''}`}
                                onPress={() => openDeliveryDetail(order)}
                            >
                                <View style={[styles.markerPin, isSelected && { backgroundColor: '#f59e0b', transform: [{ scale: 1.25 }] }]}>
                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
                                        {stopNum >= 0 ? String(stopNum + 1) : '?'}
                                    </Text>
                                </View>
                            </Marker>
                        );
                    })}
                    {/* Road routes — colour-coded per segment */}
                    {orders.filter(o => o.status === 'SHIPPED').map(order => {
                        const coords = routeCoords[`order-${order.id}`];
                        if (!coords || coords.length < 2) return null;
                        const stopNum = sortedActiveIds.indexOf(order.id);
                        const isSelected = selectedOrder?.id === order.id;
                        const segColors = ['#8b5cf6','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899'];
                        const color = isSelected ? '#f59e0b' : segColors[stopNum % segColors.length];
                        return (
                            <Polyline
                                key={`route-${order.id}`}
                                coordinates={coords}
                                strokeColor={color}
                                strokeWidth={isSelected ? 5 : 3.5}
                                lineDashPattern={isSelected ? undefined : [10, 5]}
                            />
                        );
                    })}
                </MapView>

                {activeOrders.length === 0 && (
                    <View style={styles.mapEmptyOverlay}>
                        <View style={styles.mapEmptyBox}>
                            <CheckCircle2 size={28} color={theme.colors.success} />
                            <Text style={styles.mapEmptyText}>Tidak ada pengiriman aktif</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Order List */}
            <View style={styles.listSection}>
                <Text style={styles.listTitle}>Manifest Pengiriman</Text>
                {loading ? (
                    <ActivityIndicator color={theme.colors.primaryLight} style={{ marginTop: 20 }} />
                ) : (
                    <ScrollView
                        horizontal={false}
                        style={styles.orderScroll}
                        showsVerticalScrollIndicator={false}
                    >
                        {orders.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Package size={32} color={theme.colors.muted} />
                                <Text style={styles.emptyTxt}>Belum ada manifest hari ini</Text>
                            </View>
                        ) : [
                            // SHIPPED orders in nearest-first order with stop badges
                            ...sortedActive.map((order, idx) => {
                                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                                const segColors = ['#8b5cf6','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899'];
                                const stopColor = segColors[idx % segColors.length];
                                return (
                                    <TouchableOpacity
                                        key={order.id}
                                        style={[styles.orderCard, styles.orderCardActive]}
                                        onPress={() => openDeliveryDetail(order)}
                                        activeOpacity={0.85}
                                    >
                                        <View style={[styles.stopBadge, { backgroundColor: stopColor }]}>
                                            <Text style={styles.stopNum}>{idx + 1}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.orderName} numberOfLines={1}>
                                                {order.buyer?.store_name || order.buyer?.name || 'Customer'}
                                            </Text>
                                            <Text style={styles.orderInv}>{order.invoice_id}</Text>
                                            <Text style={styles.orderAddr} numberOfLines={1}>
                                                {order.buyer?.address || '-'}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
                                                <Text style={[styles.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
                                            </View>
                                            <Text style={styles.orderItems}>{order.items?.length || 0} item</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }),
                            // Non-SHIPPED orders below
                            ...orders.filter(o => o.status !== 'SHIPPED').map(order => {
                                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                                return (
                                    <TouchableOpacity
                                        key={order.id}
                                        style={styles.orderCard}
                                        onPress={() => openDeliveryDetail(order)}
                                        activeOpacity={0.85}
                                    >
                                        <View style={[styles.orderDot, { backgroundColor: cfg.color }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.orderName} numberOfLines={1}>
                                                {order.buyer?.store_name || order.buyer?.name || 'Customer'}
                                            </Text>
                                            <Text style={styles.orderInv}>{order.invoice_id}</Text>
                                            <Text style={styles.orderAddr} numberOfLines={1}>
                                                {order.buyer?.address || '-'}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <View style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
                                                <Text style={[styles.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
                                            </View>
                                            <Text style={styles.orderItems}>{order.items?.length || 0} item</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }),
                        ]}
                    </ScrollView>
                )}
            </View>

            {/* Detail Modal */}
            <Modal
                animationType="slide"
                transparent
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        {/* Modal Header */}
                        <LinearGradient
                            colors={['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)']}
                            style={styles.modalHead}
                        >
                            <View style={styles.sheetHandle} />
                            <View style={styles.modalHeadRow}>
                                <View>
                                    <Text style={styles.modalTitle}>Detail Pengiriman</Text>
                                    <Text style={styles.modalSub}>{selectedOrder?.invoice_id}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                                    <X size={20} color={theme.colors.muted} />
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>

                        {selectedOrder && (
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                {/* Customer Info */}
                                <View style={styles.infoBox}>
                                    <View style={styles.infoRow}>
                                        <View style={[styles.infoIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                                            <User size={16} color={theme.colors.primaryLight} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.infoLabel}>Penerima</Text>
                                            <Text style={styles.infoValue}>{selectedOrder.buyer?.name || '-'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoDivider} />
                                    <View style={styles.infoRow}>
                                        <View style={[styles.infoIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                                            <Phone size={16} color={theme.colors.success} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.infoLabel}>Kontak</Text>
                                            <Text style={styles.infoValue}>{selectedOrder.buyer?.contact || '-'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoDivider} />
                                    <View style={styles.infoRow}>
                                        <View style={[styles.infoIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                                            <MapPin size={16} color={theme.colors.warning} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.infoLabel}>Alamat Pengiriman</Text>
                                            <Text style={styles.infoValue}>{selectedOrder.buyer?.address || '-'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.infoDivider} />
                                    <View style={styles.infoRow}>
                                        <View style={[styles.infoIcon, { backgroundColor: selectedOrder.buyer?.latitude ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                                            <Navigation2 size={16} color={selectedOrder.buyer?.latitude ? theme.colors.success : '#ef4444'} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.infoLabel}>Titik GPS</Text>
                                            <Text style={[styles.infoValue, !selectedOrder.buyer?.latitude && { color: '#ef4444' }]}>
                                                {selectedOrder.buyer?.latitude && selectedOrder.buyer?.longitude
                                                    ? `${parseFloat(selectedOrder.buyer.latitude).toFixed(5)}, ${parseFloat(selectedOrder.buyer.longitude).toFixed(5)}`
                                                    : '⚠ Belum diset — minta buyer atur lokasi di profil'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Muatan */}
                                <Text style={styles.sectionLbl}>Daftar Muatan ({selectedOrder.items?.length || 0} item)</Text>
                                <View style={styles.itemsBox}>
                                    {selectedOrder.items?.map((it, idx) => (
                                        <View key={idx} style={[styles.itemRow, idx > 0 && styles.itemBorder]}>
                                            <View style={styles.itemIconBox}>
                                                <Package size={14} color={theme.colors.primaryLight} />
                                            </View>
                                            <Text style={styles.itemName} numberOfLines={1}>
                                                {it.product?.name || it.product_name || 'Produk'}
                                            </Text>
                                            <View style={styles.itemQtyBox}>
                                                <Text style={styles.itemQty}>{it.quantity}</Text>
                                                <Text style={styles.itemUnit}>Unit</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                {/* Status Warning */}
                                {selectedOrder.status !== 'SHIPPED' && (
                                    <View style={styles.warningBox}>
                                        <AlertCircle size={16} color={theme.colors.warning} />
                                        <Text style={styles.warningTxt}>
                                            Status saat ini {selectedOrder.status}. Hanya bisa dikonfirmasi saat pengiriman Aktif (SHIPPED).
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}

                        {/* Action */}
                        {selectedOrder?.status === 'SHIPPED' && (
                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.confirmBtn}
                                    onPress={handleConfirmDelivery}
                                    disabled={confirming}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#059669', '#10b981']}
                                        style={styles.confirmBtnGradient}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    >
                                        {confirming ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (
                                            <>
                                                <CheckCircle2 size={20} color="#fff" />
                                                <Text style={styles.confirmBtnTxt}>Konfirmasi Sudah Sampai</Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1a1b2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8b8fa8' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1b2e' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2e2f4a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1117' }] },
];

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 44 : 14, paddingBottom: 12,
    },
    headerTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.text },
    headerSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
    refreshBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: theme.colors.primaryGlow,
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
        justifyContent: 'center', alignItems: 'center',
    },
    statsRow: {
        flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 12,
    },
    statChip: {
        flex: 1, backgroundColor: theme.colors.card, borderRadius: 10, paddingVertical: 10,
        paddingHorizontal: 8, alignItems: 'center', borderWidth: 1.5,
        borderColor: theme.colors.cardBorder,
    },
    statNum: { fontSize: 20, fontWeight: '900', color: theme.colors.primaryLight },
    statLbl: { fontSize: 9, color: theme.colors.muted, fontWeight: '700', marginTop: 2, textAlign: 'center' },
    mapContainer: { height: 200, marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
    map: { flex: 1 },
    markerPin: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
    },
    mapEmptyOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(10,10,12,0.6)' },
    mapEmptyBox: { alignItems: 'center', gap: 8 },
    mapEmptyText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' },
    listSection: { flex: 1, paddingHorizontal: 20 },
    listTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.muted },
    orderScroll: { flex: 1 },
    orderCard: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: theme.colors.card, borderRadius: 12, padding: 14, marginBottom: 8,
        borderWidth: 1.5, borderColor: theme.colors.cardBorder,
    },
    orderCardActive: { borderColor: 'rgba(139,92,246,0.4)', backgroundColor: 'rgba(139,92,246,0.05)' },
    orderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    orderDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0, marginRight: 12 },
    stopBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
    stopNum: { color: '#fff', fontWeight: '700', fontSize: 13 },
    orderName: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
    orderInv: { fontSize: 10, color: theme.colors.muted, fontFamily: 'monospace', marginTop: 2 },
    orderAddr: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
    statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    statusTxt: { fontSize: 10, fontWeight: '800' },
    orderItems: { fontSize: 10, color: theme.colors.muted, marginTop: 4 },
    emptyCard: { alignItems: 'center', paddingVertical: 30, gap: 8 },
    emptyTxt: { color: theme.colors.muted, fontSize: 14 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: height * 0.85, borderTopWidth: 1, borderColor: theme.colors.border },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: 10 },
    modalHead: { padding: 20, paddingTop: 8 },
    modalHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.text },
    modalSub: { fontSize: 12, color: theme.colors.muted, fontFamily: 'monospace', marginTop: 3 },
    closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
    modalBody: { paddingHorizontal: 20, paddingBottom: 16 },
    infoBox: { backgroundColor: theme.colors.background, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
    infoIcon: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    infoLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    infoValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 2 },
    infoDivider: { height: 1, backgroundColor: theme.colors.border, marginLeft: 14 + 34 + 12 },
    sectionLbl: { fontSize: 12, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
    itemsBox: { backgroundColor: theme.colors.background, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },
    itemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    itemBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
    itemIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: theme.colors.primaryGlow, justifyContent: 'center', alignItems: 'center' },
    itemName: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.text },
    itemQtyBox: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    itemQty: { fontSize: 16, fontWeight: '900', color: theme.colors.primaryLight },
    itemUnit: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
    warningBox: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', borderRadius: 10, padding: 12, marginBottom: 16 },
    warningTxt: { flex: 1, fontSize: 12, color: theme.colors.warning, lineHeight: 18 },
    modalFooter: { padding: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
    confirmBtn: { borderRadius: 14, overflow: 'hidden' },
    confirmBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
    confirmBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
