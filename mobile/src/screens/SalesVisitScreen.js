import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Platform, SafeAreaView, StatusBar, Modal, TextInput, ActivityIndicator,
    Alert, KeyboardAvoidingView, FlatList, RefreshControl, Dimensions
} from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import {
    MapPin, Plus, X, CheckCircle2, Clock, XCircle,
    Star, ChevronRight, Navigation2, FileText, Filter, Check
} from 'lucide-react-native';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const VISIT_STATUS = {
    PENDING:    { label: 'Belum Dikunjungi', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: Clock },
    INTERESTED: { label: 'Tertarik',          color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: Star },
    REGISTERED: { label: 'Sudah Daftar',      color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: CheckCircle2 },
    REJECTED:   { label: 'Ditolak',            color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: XCircle },
};

export default function SalesVisitScreen() {
    const { user } = useAuth();
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [detailModal, setDetailModal] = useState(null);
    const [filterStatus, setFilterStatus] = useState('ALL');

    // Form state
    const [form, setForm] = useState({ name: '', address: '', notes: '', status: 'PENDING' });
    const [submitting, setSubmitting] = useState(false);
    const [locating, setLocating] = useState(false);
    const [coordsReady, setCoordsReady] = useState(null);
    const [mapPickerVisible, setMapPickerVisible] = useState(false);
    const [mapPickerCoord, setMapPickerCoord] = useState(null);
    const [mapPickerRegion, setMapPickerRegion] = useState({
        latitude: -2.5, longitude: 118.0, latitudeDelta: 5, longitudeDelta: 5
    });

    useEffect(() => {
        fetchVisits();
    }, []);

    const fetchVisits = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/visits?salesId=${user.id}`, { timeout: 10000 });
            setVisits(res.data);
        } catch (e) {
            Alert.alert('Gagal', 'Tidak bisa memuat data kunjungan');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchVisits();
    };

    const getLocation = async () => {
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izin Ditolak', 'Aktifkan GPS untuk mengisi koordinat otomatis');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
            setCoordsReady(coords);
            setMapPickerCoord(coords);
            setMapPickerRegion({ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 });

            // Reverse geocode for address fill
            const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            if (geo.length > 0 && !form.address) {
                const g = geo[0];
                const addr = [g.street, g.district, g.city, g.region].filter(Boolean).join(', ');
                setForm(f => ({ ...f, address: addr }));
            }
        } catch (e) {
            Alert.alert('Gagal', 'Tidak bisa mendapatkan lokasi GPS');
        } finally {
            setLocating(false);
        }
    };

    const openMapPicker = async () => {
        if (coordsReady) {
            setMapPickerCoord(coordsReady);
            setMapPickerRegion({ latitude: coordsReady.lat, longitude: coordsReady.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 });
        } else {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    const r = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
                    setMapPickerRegion(r);
                    setMapPickerCoord({ lat: loc.coords.latitude, lng: loc.coords.longitude });
                }
            } catch (_) {}
        }
        setMapPickerVisible(true);
    };

    const confirmMapPicker = () => {
        if (mapPickerCoord) setCoordsReady(mapPickerCoord);
        setMapPickerVisible(false);
    };

    const submitVisit = async () => {
        if (!form.name.trim() || !form.address.trim()) {
            Alert.alert('Isi Dulu', 'Nama dan alamat wajib diisi');
            return;
        }
        setSubmitting(true);
        try {
            await axios.post(`${BASE_URL}/api/visits`, {
                salesId: user.id,
                name: form.name.trim(),
                address: form.address.trim(),
                notes: form.notes.trim() || null,
                status: form.status,
                lat: coordsReady?.lat || null,
                lng: coordsReady?.lng || null,
            });
            setModalVisible(false);
            setForm({ name: '', address: '', notes: '', status: 'PENDING' });
            setCoordsReady(null);
            setMapPickerCoord(null);
            fetchVisits();
            Alert.alert('✓ Tersimpan!', 'Kunjungan berhasil dicatat');
        } catch (e) {
            Alert.alert('Gagal', 'Tidak bisa menyimpan kunjungan');
        } finally {
            setSubmitting(false);
        }
    };

    const updateStatus = async (id, status) => {
        try {
            await axios.put(`${BASE_URL}/api/visits/${id}`, { status });
            fetchVisits();
            setDetailModal(null);
        } catch (e) {
            Alert.alert('Gagal', 'Update status gagal');
        }
    };

    const filtered = filterStatus === 'ALL' ? visits : visits.filter(v => v.status === filterStatus);

    const stats = {
        total: visits.length,
        interested: visits.filter(v => v.status === 'INTERESTED').length,
        registered: visits.filter(v => v.status === 'REGISTERED').length,
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} translucent={false} />
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Kunjungan Lapangan</Text>
                    <Text style={styles.headerSub}>Pendataan Calon Konsumen</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
                    <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.addBtnGrad}>
                        <Plus size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statNum}>{stats.total}</Text>
                    <Text style={styles.statLbl}>Total Visit</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNum, { color: '#8b5cf6' }]}>{stats.interested}</Text>
                    <Text style={styles.statLbl}>Tertarik</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNum, { color: '#10b981' }]}>{stats.registered}</Text>
                    <Text style={styles.statLbl}>Terdaftar</Text>
                </View>
            </View>

            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {['ALL', 'PENDING', 'INTERESTED', 'REGISTERED', 'REJECTED'].map(s => (
                    <TouchableOpacity
                        key={s}
                        style={[styles.filterChip, filterStatus === s && styles.filterChipActive]}
                        onPress={() => setFilterStatus(s)}
                    >
                        <Text style={[styles.filterChipTxt, filterStatus === s && { color: '#fff' }]} numberOfLines={1}>
                            {s === 'ALL' ? 'Semua' : VISIT_STATUS[s]?.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* List */}
            {loading ? (
                <ActivityIndicator color={theme.colors.primaryLight} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />}
                    ListEmptyComponent={(
                        <View style={styles.emptyBox}>
                            <MapPin size={40} color={theme.colors.muted} />
                            <Text style={styles.emptyTxt}>Belum ada kunjungan tercatat</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
                                <Text style={styles.emptyBtnTxt}>+ Tambah Kunjungan</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const cfg = VISIT_STATUS[item.status] || VISIT_STATUS.PENDING;
                        const Ico = cfg.icon;
                        return (
                            <TouchableOpacity style={styles.visitCard} onPress={() => setDetailModal(item)} activeOpacity={0.85}>
                                <View style={[styles.visitIconBox, { backgroundColor: cfg.bg }]}>
                                    <Ico size={18} color={cfg.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.visitName}>{item.name}</Text>
                                    <Text style={styles.visitAddr} numberOfLines={1}>{item.address}</Text>
                                    <Text style={styles.visitDate}>{new Date(item.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                                        <Text style={[styles.statusBadgeTxt, { color: cfg.color }]} numberOfLines={1}>{cfg.label}</Text>
                                    </View>
                                    {item.lat && <View style={styles.gpsBadge}><Navigation2 size={10} color="#10b981" /><Text style={styles.gpsLbl}>GPS</Text></View>}
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* Add Visit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => { if (mapPickerVisible) { setMapPickerVisible(false); } else { setModalVisible(false); } }}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalSheet}>
                            <View style={styles.sheetHandle} />
                            <View style={styles.modalHeadRow}>
                                <Text style={styles.modalTitle}>Catat Kunjungan</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                                    <X size={20} color={theme.colors.muted} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Nama Toko / Calon Pelanggan *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Warung Bu Sari, Toko Sembako..."
                                        placeholderTextColor={theme.colors.muted}
                                        value={form.name}
                                        onChangeText={v => setForm(f => ({ ...f, name: v }))}
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Alamat *</Text>
                                    <TextInput
                                        style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                                        placeholder="Jl. Merdeka No. 5, Kelurahan..."
                                        placeholderTextColor={theme.colors.muted}
                                        value={form.address}
                                        onChangeText={v => setForm(f => ({ ...f, address: v }))}
                                        multiline
                                    />
                                    <View style={styles.locBtnRow}>
                                        <TouchableOpacity style={styles.locBtn} onPress={getLocation} disabled={locating}>
                                            {locating
                                                ? <ActivityIndicator size="small" color={theme.colors.primaryLight} />
                                                : <>
                                                    <View style={styles.locBtnIcon}>
                                                        <Navigation2 size={15} color={theme.colors.primaryLight} />
                                                    </View>
                                                    <Text style={styles.locBtnTxt}>GPS Otomatis</Text>
                                                  </>
                                            }
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.locBtn, styles.locBtnGreen]} onPress={openMapPicker}>
                                            <View style={[styles.locBtnIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                                                <MapPin size={15} color="#10b981" />
                                            </View>
                                            <Text style={[styles.locBtnTxt, { color: '#10b981' }]}>Pilih di Peta</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {coordsReady && (
                                        <View style={styles.coordBox}>
                                            <Check size={13} color="#10b981" />
                                            <Text style={styles.coordTxt}>
                                                {coordsReady.lat.toFixed(6)}, {coordsReady.lng.toFixed(6)}
                                            </Text>
                                            <TouchableOpacity onPress={() => { setCoordsReady(null); setMapPickerCoord(null); }}>
                                                <X size={13} color={theme.colors.muted} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Catatan</Text>
                                    <TextInput
                                        style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                                        placeholder="Tertarik produk A, minta info harga..."
                                        placeholderTextColor={theme.colors.muted}
                                        value={form.notes}
                                        onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                                        multiline
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Status Kunjungan</Text>
                                    <View style={styles.statusGrid}>
                                        {Object.entries(VISIT_STATUS).map(([key, cfg]) => (
                                            <TouchableOpacity
                                                key={key}
                                                style={[styles.statusOption, form.status === key && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                                                onPress={() => setForm(f => ({ ...f, status: key }))}
                                            >
                                                <Text style={[styles.statusOptTxt, form.status === key && { color: cfg.color }]}>{cfg.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                                    setModalVisible(false);
                                    setCoordsReady(null);
                                    setMapPickerCoord(null);
                                }}>
                                    <Text style={styles.cancelBtnTxt}>Batal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.submitBtn} onPress={submitVisit} disabled={submitting}>
                                    <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.submitBtnGrad}>
                                        {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnTxt}>Simpan Kunjungan</Text>}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                {/* Map Picker — rendered inside the same Modal for iOS compatibility */}
                {mapPickerVisible && (
                    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]}>
                        <MapView
                            provider={PROVIDER_DEFAULT}
                            style={{ flex: 1 }}
                            region={mapPickerRegion}
                            onPress={(e) => {
                                const { latitude, longitude } = e.nativeEvent.coordinate;
                                setMapPickerCoord({ lat: latitude, lng: longitude });
                                setMapPickerRegion(r => ({ ...r, latitude, longitude }));
                            }}
                        >
                            {mapPickerCoord && (
                                <Marker coordinate={{ latitude: mapPickerCoord.lat, longitude: mapPickerCoord.lng }} />
                            )}
                        </MapView>
                        <View style={[styles.mapPickerBar, { paddingBottom: Platform.OS === 'ios' ? 34 : 16 }]}>
                            <Text style={styles.mapPickerHint}>Ketuk peta untuk menentukan titik lokasi kunjungan</Text>
                            {mapPickerCoord && (
                                <Text style={styles.mapPickerCoord}>{mapPickerCoord.lat.toFixed(6)}, {mapPickerCoord.lng.toFixed(6)}</Text>
                            )}
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                                <TouchableOpacity style={styles.mapPickerCancel} onPress={() => setMapPickerVisible(false)}>
                                    <Text style={{ color: theme.colors.muted, fontWeight: '700', fontSize: 14 }}>Batal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.mapPickerConfirm, !mapPickerCoord && { opacity: 0.45 }]}
                                    onPress={confirmMapPicker}
                                    disabled={!mapPickerCoord}
                                >
                                    <LinearGradient colors={['#10b981', '#059669']} style={{ flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Konfirmasi Titik Lokasi</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
                </KeyboardAvoidingView>
            </Modal>

            {/* Detail Modal */}
            {detailModal && (
                <Modal visible={!!detailModal} animationType="fade" transparent onRequestClose={() => setDetailModal(null)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalSheet, { maxHeight: '65%' }]}>
                            <View style={styles.sheetHandle} />
                            <View style={styles.modalHeadRow}>
                                <Text style={styles.modalTitle}>{detailModal.name}</Text>
                                <TouchableOpacity onPress={() => setDetailModal(null)} style={styles.closeBtn}>
                                    <X size={20} color={theme.colors.muted} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
                                <Text style={styles.detailLabel}>Alamat</Text>
                                <Text style={styles.detailValue}>{detailModal.address}</Text>
                                {detailModal.notes && <>
                                    <Text style={[styles.detailLabel, { marginTop: 12 }]}>Catatan</Text>
                                    <Text style={styles.detailValue}>{detailModal.notes}</Text>
                                </>}
                                <Text style={[styles.detailLabel, { marginTop: 12 }]}>Tanggal Kunjungan</Text>
                                <Text style={styles.detailValue}>{new Date(detailModal.createdAt).toLocaleString('id-ID')}</Text>
                                <Text style={[styles.detailLabel, { marginTop: 16, marginBottom: 10 }]}>Update Status</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {Object.entries(VISIT_STATUS).map(([key, cfg]) => (
                                        <TouchableOpacity
                                            key={key}
                                            style={[styles.statusOption, detailModal.status === key && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                                            onPress={() => updateStatus(detailModal.id, key)}
                                        >
                                            <Text style={[styles.statusOptTxt, detailModal.status === key && { color: cfg.color }]}>{cfg.label}</Text>
                                        </TouchableOpacity>
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
    container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.text },
    headerSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
    addBtn: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden' },
    addBtnGrad: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statsRow: { flexDirection: 'row', backgroundColor: theme.colors.card, borderRadius: 14, marginHorizontal: 20, marginBottom: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: theme.colors.cardBorder },
    statItem: { flex: 1, alignItems: 'center' },
    statNum: { fontSize: 22, fontWeight: '900', color: theme.colors.primaryLight },
    statLbl: { fontSize: 10, color: theme.colors.muted, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
    statDivider: { width: 1, height: '50%', backgroundColor: theme.colors.border, alignSelf: 'center' },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1.5, borderColor: theme.colors.cardBorder, maxWidth: SCREEN_WIDTH * 0.5 },
    filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primaryDark },
    filterChipTxt: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },
    filterScroll: { maxHeight: 44, marginBottom: 14 },
    visitCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: theme.colors.cardBorder, gap: 12 },
    visitIconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    visitName: { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginBottom: 2 },
    visitAddr: { fontSize: 12, color: theme.colors.textSecondary },
    visitDate: { fontSize: 10, color: theme.colors.muted, marginTop: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, maxWidth: SCREEN_WIDTH * 0.35 },
    statusBadgeTxt: { fontSize: 10, fontWeight: '800' },
    visitCardRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0, maxWidth: SCREEN_WIDTH * 0.38 },
    gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    gpsLbl: { fontSize: 9, color: '#10b981', fontWeight: '700' },
    emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 12 },
    emptyTxt: { color: theme.colors.muted, fontSize: 14 },
    emptyBtn: { backgroundColor: theme.colors.primaryGlow, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
    emptyBtnTxt: { color: theme.colors.primaryLight, fontWeight: '700', fontSize: 13 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', borderTopWidth: 1, borderColor: theme.colors.border, flex: 1 },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: 10 },
    modalHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
    modalTitle: { fontSize: 19, fontWeight: '900', color: theme.colors.text },
    closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
    formGroup: { paddingHorizontal: 20, marginBottom: 16 },
    formLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    input: { backgroundColor: theme.colors.background, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: theme.colors.text, fontSize: 14 },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-end' },
    gpsBtnTxt: { color: theme.colors.primaryLight, fontSize: 12, fontWeight: '700' },
    locBtnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    locBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.25)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
    locBtnGreen: { backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.25)' },
    locBtnIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' },
    locBtnTxt: { fontSize: 12, fontWeight: '800', color: theme.colors.primaryLight, flexShrink: 1 },
    coordBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    coordTxt: { flex: 1, fontSize: 11, fontWeight: '700', color: '#10b981', fontFamily: 'monospace' },
    mapPickerBar: { backgroundColor: theme.colors.card, padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
    mapPickerHint: { fontSize: 13, color: theme.colors.muted, textAlign: 'center', marginBottom: 4 },
    mapPickerCoord: { fontSize: 11, color: '#10b981', fontWeight: '700', textAlign: 'center', fontFamily: 'monospace', marginBottom: 4 },
    mapPickerCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
    mapPickerConfirm: { flex: 2, height: 48, borderRadius: 12, overflow: 'hidden' },
    statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statusOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: theme.colors.border },
    statusOptTxt: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },
    modalFooter: { flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: theme.colors.border },
    cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center' },
    cancelBtnTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 14 },
    submitBtn: { flex: 2, borderRadius: 12, overflow: 'hidden' },
    submitBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
    submitBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
    detailLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 14, color: theme.colors.text, fontWeight: '600', marginTop: 4, lineHeight: 20 },
});
