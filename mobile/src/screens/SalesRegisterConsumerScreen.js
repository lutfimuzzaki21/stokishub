import React, { useState, useEffect } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Platform, SafeAreaView, TextInput, ActivityIndicator,
    Alert, KeyboardAvoidingView, FlatList, RefreshControl, Modal, StatusBar, Linking, Clipboard
} from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import {
    UserPlus, Users, ChevronRight, User, Phone,
    MapPin, Mail, Crown, ShoppingBag, X, Check, Navigation,
    Store, Share2, Building2
} from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

const ROLE_CONFIG = {
    KONSUMEN: { label: 'Umum', desc: 'Pembeli satu kali / tidak terikat kontrak', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: ShoppingBag },
    MEMBER:   { label: 'Member', desc: 'Pelanggan terikat kontrak, dapat harga khusus', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: Crown },
};

export default function SalesRegisterConsumerScreen() {
    const { user } = useAuth();
    const [consumers, setConsumers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tabActive, setTabActive] = useState('list'); // 'list' | 'register'

    // Form
    const [form, setForm] = useState({ name: '', store_name: '', email: '', contact: '', address: '', role: 'KONSUMEN', price_level: 'Harga Umum', latitude: '', longitude: '' });
    const [submitting, setSubmitting] = useState(false);
    const [successModal, setSuccessModal] = useState(null);
    const [locationModal, setLocationModal] = useState(null); // { name, latitude, longitude }
    const [parentOptions, setParentOptions] = useState([]);
    const [selectedParentId, setSelectedParentId] = useState(user.parent_id || user.id);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [mapPickerVisible, setMapPickerVisible] = useState(false);
    const [mapPickerCoord, setMapPickerCoord] = useState(null); // { latitude, longitude }
    const [mapPickerRegion, setMapPickerRegion] = useState({
        latitude: -6.1751,
        longitude: 106.8272,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });

    useEffect(() => {
        fetchConsumers();
        fetchParentOptions();
    }, []);

    const fetchParentOptions = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/parent-options?salesId=${user.id}`, { timeout: 8000 });
            if (res.data && res.data.length > 0) {
                setParentOptions(res.data);
                // Default: set to user's direct parent if available
                const directParent = res.data.find(o => o.id === (user.parent_id || user.id));
                if (directParent) setSelectedParentId(directParent.id);
                else setSelectedParentId(res.data[0].id);
            }
        } catch (_) { /* silent fail, fallback to user.parent_id */ }
    };

    const fetchConsumers = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/consumers?parentId=${user.parent_id || user.id}`, { timeout: 10000 });
            setConsumers(res.data);
        } catch (e) {
            Alert.alert('Gagal', 'Tidak bisa memuat data konsumen');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchConsumers();
    };

    const getGPSLocation = async () => {
        setGettingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izin Ditolak', 'Izin lokasi diperlukan untuk mendapatkan koordinat GPS.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 10000 });
            setForm(f => ({
                ...f,
                latitude: loc.coords.latitude.toFixed(7),
                longitude: loc.coords.longitude.toFixed(7),
            }));
            Alert.alert('Berhasil', `Koordinat berhasil diambil\n${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
        } catch (e) {
            Alert.alert('Gagal', 'Tidak bisa mendapatkan lokasi. Pastikan GPS aktif.');
        } finally {
            setGettingLocation(false);
        }
    };

    const openMapPicker = async () => {
        // If form already has coords, center map there
        if (form.latitude && form.longitude) {
            setMapPickerRegion({
                latitude: parseFloat(form.latitude),
                longitude: parseFloat(form.longitude),
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
            setMapPickerCoord({ latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude) });
        } else {
            // Try to get current GPS position to center map
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    setMapPickerRegion({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    });
                }
            } catch (_) {}
            setMapPickerCoord(null);
        }
        setMapPickerVisible(true);
    };

    const confirmMapPicker = () => {
        if (!mapPickerCoord) {
            Alert.alert('Belum Ada Titik', 'Ketuk peta untuk menentukan titik lokasi konsumen.');
            return;
        }
        setForm(f => ({
            ...f,
            latitude: mapPickerCoord.latitude.toFixed(7),
            longitude: mapPickerCoord.longitude.toFixed(7),
        }));
        setMapPickerVisible(false);
    };

    const submitConsumer = async () => {
        if (!form.name.trim() || !form.email.trim()) {
            Alert.alert('Lengkapi Data', 'Nama dan email wajib diisi');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            Alert.alert('Format Salah', 'Format email tidak valid');
            return;
        }
        setSubmitting(true);
        try {
            const res = await axios.post(`${BASE_URL}/api/consumers`, {
                name: form.name.trim(),
                store_name: form.store_name.trim() || null,
                email: form.email.trim().toLowerCase(),
                contact: form.contact.trim() || null,
                address: form.address.trim() || null,
                role: form.role,
                price_level: form.role === 'MEMBER' ? form.price_level : 'Harga Umum',
                parentId: selectedParentId,
                latitude: form.latitude ? parseFloat(form.latitude) : null,
                longitude: form.longitude ? parseFloat(form.longitude) : null,
            });
            setSuccessModal({ name: form.name, store_name: form.store_name, email: form.email, role: form.role, contact: form.contact });
            setForm({ name: '', store_name: '', email: '', contact: '', address: '', role: 'KONSUMEN', price_level: 'Harga Umum', latitude: '', longitude: '' });
            fetchConsumers();
        } catch (e) {
            const msg = e.response?.data?.message || 'Gagal mendaftarkan konsumen';
            Alert.alert('Gagal', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const memberCount = consumers.filter(c => c.role === 'MEMBER').length;
    const konsumenCount = consumers.filter(c => c.role === 'KONSUMEN').length;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Daftarkan Konsumen</Text>
                    <Text style={styles.headerSub}>Registrasi & manajemen pelanggan</Text>
                </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <View style={[styles.statIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                        <ShoppingBag size={18} color="#f59e0b" />
                    </View>
                    <Text style={styles.statNum}>{konsumenCount}</Text>
                    <Text numberOfLines={1} style={styles.statLbl}>Konsumen</Text>
                </View>
                <View style={styles.statBox}>
                    <View style={[styles.statIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                        <Crown size={18} color="#8b5cf6" />
                    </View>
                    <Text style={[styles.statNum, { color: '#8b5cf6' }]}>{memberCount}</Text>
                    <Text numberOfLines={1} style={styles.statLbl}>Member</Text>
                </View>
                <View style={styles.statBox}>
                    <View style={[styles.statIcon, { backgroundColor: theme.colors.primaryGlow }]}>
                        <Users size={18} color={theme.colors.primaryLight} />
                    </View>
                    <Text style={styles.statNum}>{consumers.length}</Text>
                    <Text numberOfLines={1} style={styles.statLbl}>Total</Text>
                </View>
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabBar}>
                <TouchableOpacity style={[styles.tabBtn, tabActive === 'list' && styles.tabBtnActive]} onPress={() => setTabActive('list')}>
                    <Users size={15} color={tabActive === 'list' ? '#fff' : theme.colors.muted} />
                    <Text style={[styles.tabBtnTxt, tabActive === 'list' && { color: '#fff' }]}>Daftar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, tabActive === 'register' && styles.tabBtnActive]} onPress={() => setTabActive('register')}>
                    <UserPlus size={15} color={tabActive === 'register' ? '#fff' : theme.colors.muted} />
                    <Text style={[styles.tabBtnTxt, tabActive === 'register' && { color: '#fff' }]}>Daftar Baru</Text>
                </TouchableOpacity>
            </View>

            {/* List Tab */}
            {tabActive === 'list' && (
                loading ? (
                    <ActivityIndicator color={theme.colors.primaryLight} style={{ marginTop: 40 }} />
                ) : (
                    <FlatList
                        data={consumers}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />}
                        ListEmptyComponent={(
                            <View style={styles.emptyBox}>
                                <Users size={40} color={theme.colors.muted} />
                                <Text style={styles.emptyTxt}>Belum ada konsumen terdaftar</Text>
                                <TouchableOpacity style={styles.emptyBtn} onPress={() => setTabActive('register')}>
                                    <Text style={styles.emptyBtnTxt}>+ Daftar Sekarang</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        renderItem={({ item }) => {
                            const cfg = ROLE_CONFIG[item.role] || ROLE_CONFIG.KONSUMEN;
                            const Ico = cfg.icon;
                            const hasLocation = item.latitude && item.longitude;
                            return (
                                <View style={styles.consumerCard}>
                                    <View style={[styles.consumerIcon, { backgroundColor: cfg.bg }]}>
                                        <Ico size={18} color={cfg.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.consumerName}>{item.name}</Text>
                                        {item.store_name ? <Text style={styles.consumerStore}>🏪 {item.store_name}</Text> : null}
                                        <Text style={styles.consumerEmail}>{item.email}</Text>
                                        {item.contact && <Text style={styles.consumerContact}>{item.contact}</Text>}
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                        <View style={[styles.roleBadge, { backgroundColor: cfg.bg }]}>
                                            <Text numberOfLines={1} style={[styles.roleBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                                        </View>
                                        {hasLocation && (
                                            <TouchableOpacity
                                                style={styles.locationBtn}
                                                onPress={() => setLocationModal({ name: item.name, latitude: item.latitude, longitude: item.longitude })}
                                                activeOpacity={0.7}
                                            >
                                                <MapPin size={11} color="#10b981" />
                                                <Text style={styles.locationBtnTxt}>Lihat Lokasi</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        }}
                    />
                )
            )}

            {/* Register Tab */}
            {tabActive === 'register' && (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                        {/* Parent / Stokis Picker */}
                        {parentOptions.length > 0 && (
                            <>
                                <View style={styles.parentLabelRow}>
                                    <Building2 size={14} color={theme.colors.primaryLight} />
                                    <Text style={[styles.formLabel, { marginTop: 0, marginBottom: 0 }]}>Daftarkan ke *</Text>
                                </View>
                                <View style={styles.parentOptions}>
                                    {parentOptions.map(opt => {
                                        const isSelected = selectedParentId === opt.id;
                                        const isSubstokis = opt.role === 'SUBSTOKIS';
                                        return (
                                            <TouchableOpacity
                                                key={opt.id}
                                                style={[styles.parentOption, isSelected && styles.parentOptionSelected]}
                                                onPress={() => setSelectedParentId(opt.id)}
                                                activeOpacity={0.8}
                                            >
                                                <View style={[styles.parentOptionIcon, isSelected && { backgroundColor: 'rgba(99,102,241,0.2)' }]}>
                                                    <Building2 size={15} color={isSelected ? theme.colors.primaryLight : theme.colors.muted} />
                                                </View>
                                                <View style={{ flex: 1, minWidth: 0 }}>
                                                    <Text numberOfLines={1} style={[styles.parentOptionName, isSelected && { color: theme.colors.primaryLight }]}>{opt.name}</Text>
                                                    <Text style={styles.parentOptionRole}>{isSubstokis ? 'Sub Stokis' : 'Stokis'}</Text>
                                                </View>
                                                {isSelected && (
                                                    <View style={styles.parentOptionCheck}>
                                                        <Check size={11} color="#fff" />
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        {/* Role Picker */}
                        <Text style={[styles.formLabel, { marginTop: 4 }]}>Tipe Pelanggan *</Text>
                        <View style={styles.roleCards}>
                            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
                                const Ico = cfg.icon;
                                const isSelected = form.role === key;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.roleCard, isSelected && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                                        onPress={() => setForm(f => ({ ...f, role: key }))}
                                    >
                                        <View style={[styles.roleCardIcon, isSelected && { backgroundColor: cfg.bg }]}>
                                            <Ico size={22} color={isSelected ? cfg.color : theme.colors.muted} />
                                        </View>
                                        <Text style={[styles.roleCardTitle, isSelected && { color: cfg.color }]}>{cfg.label}</Text>
                                        <Text style={styles.roleCardDesc} numberOfLines={2}>{cfg.desc}</Text>
                                        {isSelected && (
                                            <View style={[styles.checkBadge, { backgroundColor: cfg.color }]}>
                                                <Check size={10} color="#fff" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.formLabel}>Nama Pemilik *</Text>
                        <View style={styles.inputWrapper}>
                            <User size={16} color={theme.colors.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Nama lengkap pemilik"
                                placeholderTextColor={theme.colors.muted}
                                value={form.name}
                                onChangeText={v => setForm(f => ({ ...f, name: v }))}
                            />
                        </View>

                        <Text style={styles.formLabel}>Nama Toko <Text style={{ color: theme.colors.muted, fontWeight: '400', textTransform: 'none' }}>(opsional)</Text></Text>
                        <View style={styles.inputWrapper}>
                            <Store size={16} color={theme.colors.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Kosongkan jika tidak punya toko"
                                placeholderTextColor={theme.colors.muted}
                                value={form.store_name}
                                onChangeText={v => setForm(f => ({ ...f, store_name: v }))}
                            />
                        </View>

                        <Text style={styles.formLabel}>Alamat Email *</Text>
                        <View style={styles.inputWrapper}>
                            <Mail size={16} color={theme.colors.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="email@example.com"
                                placeholderTextColor={theme.colors.muted}
                                value={form.email}
                                onChangeText={v => setForm(f => ({ ...f, email: v }))}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <Text style={styles.formLabel}>No. WhatsApp</Text>
                        <View style={styles.inputWrapper}>
                            <Phone size={16} color={theme.colors.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="08xxxxxxxxx"
                                placeholderTextColor={theme.colors.muted}
                                value={form.contact}
                                onChangeText={v => setForm(f => ({ ...f, contact: v }))}
                                keyboardType="phone-pad"
                            />
                        </View>

                        <Text style={styles.formLabel}>Alamat</Text>
                        <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingTop: 12 }]}>
                            <MapPin size={16} color={theme.colors.muted} />
                            <TextInput
                                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                                placeholder="Alamat lengkap..."
                                placeholderTextColor={theme.colors.muted}
                                value={form.address}
                                onChangeText={v => setForm(f => ({ ...f, address: v }))}
                                multiline
                            />
                        </View>

                        {/* GPS Location */}
                        <Text style={styles.formLabel}>Titik Lokasi (GPS)</Text>
                        <View style={styles.gpsBtnRow}>
                            <TouchableOpacity
                                style={[styles.gpsBtn, { flex: 1 }]}
                                onPress={getGPSLocation}
                                disabled={gettingLocation}
                                activeOpacity={0.8}
                            >
                                {gettingLocation ? (
                                    <ActivityIndicator size="small" color={theme.colors.primaryLight} />
                                ) : (
                                    <Navigation size={15} color={theme.colors.primaryLight} />
                                )}
                                <Text style={styles.gpsBtnTxt} numberOfLines={1}>
                                    {gettingLocation ? 'Memuat...' : 'Lokasi Saya'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.gpsBtn, { flex: 1, borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.08)' }]}
                                onPress={openMapPicker}
                                activeOpacity={0.8}
                            >
                                <MapPin size={15} color="#10b981" />
                                <Text style={[styles.gpsBtnTxt, { color: '#10b981' }]} numberOfLines={1}>Pilih di Peta</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.coordRow}>
                            <View style={[styles.inputWrapper, { flex: 1, marginRight: 6 }]}>
                                <Text style={styles.coordLabel}>Lat</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="-6.1751"
                                    placeholderTextColor={theme.colors.muted}
                                    value={form.latitude}
                                    onChangeText={v => setForm(f => ({ ...f, latitude: v }))}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.inputWrapper, { flex: 1, marginLeft: 6 }]}>
                                <Text style={styles.coordLabel}>Lng</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="106.8272"
                                    placeholderTextColor={theme.colors.muted}
                                    value={form.longitude}
                                    onChangeText={v => setForm(f => ({ ...f, longitude: v }))}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                        {(form.latitude && form.longitude) ? (
                            <Text style={styles.coordConfirm}>📍 {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}</Text>
                        ) : (
                            <Text style={styles.coordHint}>Opsional — digunakan untuk titik pengiriman di peta</Text>
                        )}

                        <View style={styles.infoBox}>
                            <Text style={styles.infoTxt}>
                                🔑 Password default otomatis: <Text style={{ fontWeight: '900', color: theme.colors.primaryLight }}>pass1234</Text>{'\n'}
                                {form.role === 'MEMBER' ? 'Member' : 'Konsumen'} bisa login lalu ubah password sendiri.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.submitBtn}
                            onPress={submitConsumer}
                            disabled={submitting}
                            activeOpacity={0.85}
                        >
                            <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.submitBtnGrad}>
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <UserPlus size={18} color="#fff" />
                                        <Text style={styles.submitBtnTxt}>
                                            Daftar sebagai {form.role === 'MEMBER' ? 'Member' : 'Konsumen'}
                                        </Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            )}

            {/* Map Picker Modal */}
            <Modal visible={mapPickerVisible} animationType="slide" onRequestClose={() => setMapPickerVisible(false)}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    {/* Map Header */}
                    <View style={styles.mapPickerHeader}>
                        <TouchableOpacity style={styles.mapPickerClose} onPress={() => setMapPickerVisible(false)}>
                            <X size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.mapPickerTitle}>Pilih Titik Lokasi</Text>
                            <Text style={styles.mapPickerSub}>
                                {mapPickerCoord
                                    ? `📍 ${mapPickerCoord.latitude.toFixed(5)}, ${mapPickerCoord.longitude.toFixed(5)}`
                                    : 'Ketuk peta untuk menandai lokasi konsumen'}
                            </Text>
                        </View>
                    </View>

                    {/* Map */}
                    <MapView
                        style={{ flex: 1 }}
                        provider={PROVIDER_DEFAULT}
                        initialRegion={mapPickerRegion}
                        onPress={e => setMapPickerCoord(e.nativeEvent.coordinate)}
                        showsUserLocation
                        showsMyLocationButton
                    >
                        {mapPickerCoord && (
                            <Marker
                                coordinate={mapPickerCoord}
                                title="Lokasi Konsumen"
                                pinColor="#6366f1"
                            />
                        )}
                    </MapView>

                    {/* Confirm Button */}
                    <TouchableOpacity
                        style={[styles.mapConfirmBtn, !mapPickerCoord && { opacity: 0.4 }]}
                        onPress={confirmMapPicker}
                        activeOpacity={0.85}
                    >
                        <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.mapConfirmGrad}>
                            <Check size={18} color="#fff" />
                            <Text style={styles.mapConfirmTxt}>Konfirmasi Titik Lokasi</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Location Modal */}
            {locationModal && (
                <Modal visible={!!locationModal} animationType="slide" onRequestClose={() => setLocationModal(null)}>
                    <View style={{ flex: 1, backgroundColor: '#000' }}>
                        <View style={styles.mapPickerHeader}>
                            <TouchableOpacity style={styles.mapPickerClose} onPress={() => setLocationModal(null)}>
                                <X size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.mapPickerTitle}>{locationModal.name}</Text>
                                <Text style={styles.mapPickerSub}>📍 {parseFloat(locationModal.latitude).toFixed(5)}, {parseFloat(locationModal.longitude).toFixed(5)}</Text>
                            </View>
                        </View>
                        <MapView
                            style={{ flex: 1 }}
                            provider={PROVIDER_DEFAULT}
                            initialRegion={{
                                latitude: parseFloat(locationModal.latitude),
                                longitude: parseFloat(locationModal.longitude),
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                            }}
                            showsUserLocation
                        >
                            <Marker
                                coordinate={{ latitude: parseFloat(locationModal.latitude), longitude: parseFloat(locationModal.longitude) }}
                                title={locationModal.name}
                                pinColor="#6366f1"
                            />
                        </MapView>
                    </View>
                </Modal>
            )}

            {/* Success Modal */}
            <Modal visible={!!successModal} transparent animationType="fade" onRequestClose={() => setSuccessModal(null)}>
                <View style={styles.successOverlay}>
                    <View style={styles.successBox}>
                        <LinearGradient colors={['#059669', '#10b981']} style={styles.successIcon}>
                            <Check size={32} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.successTitle}>Berhasil Terdaftar!</Text>
                        <Text style={styles.successName}>{successModal?.name}</Text>
                        {successModal?.store_name ? <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>🏪 {successModal.store_name}</Text> : null}
                        <Text style={styles.successRole}>{ROLE_CONFIG[successModal?.role]?.label}</Text>
                        <Text style={styles.successEmail}>{successModal?.email}</Text>
                        {/* Password info */}
                        <View style={styles.successPassBox}>
                            <Text style={styles.successPassLabel}>Password Login</Text>
                            <Text style={styles.successPassVal}>pass1234</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                            <TouchableOpacity
                                style={styles.successShareBtn}
                                onPress={() => {
                                    const no = (successModal?.contact || '').replace(/\D/g, '');
                                    const msg = `Halo ${successModal?.name}, akun Anda sudah aktif!\nEmail: ${successModal?.email}\nPassword: pass1234\nSilakan login dan segera ganti password Anda.`;
                                    const url = no ? `whatsapp://send?phone=62${no.replace(/^0/, '')}&text=${encodeURIComponent(msg)}` : `whatsapp://send?text=${encodeURIComponent(msg)}`;
                                    Linking.openURL(url).catch(() => Alert.alert('WhatsApp tidak tersedia'));
                                }}
                                activeOpacity={0.8}
                            >
                                <Share2 size={14} color="#25d366" />
                                <Text style={[styles.successBtnTxt, { color: '#25d366' }]}>Kirim via WA</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.successShareBtn, { borderColor: 'rgba(99,102,241,0.3)', backgroundColor: theme.colors.primaryGlow }]}
                                onPress={() => {
                                    Clipboard.setString('pass1234');
                                    Alert.alert('Disalin', 'Password "pass1234" berhasil disalin.');
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.successBtnTxt, { color: theme.colors.primaryLight }]}>Salin Password</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.successBtn} onPress={() => { setSuccessModal(null); setTabActive('list'); }}>
                            <Text style={styles.successBtnTxt}>Lihat Daftar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 44 : 14, paddingBottom: 14 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.text },
    headerSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
    statBox: { flex: 1, backgroundColor: theme.colors.card, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: theme.colors.cardBorder, minWidth: 0 },
    statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    statNum: { fontSize: 20, fontWeight: '900', color: theme.colors.primaryLight },
    statLbl: { fontSize: 10, color: theme.colors.muted, fontWeight: '700', textAlign: 'center' },
    tabBar: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: theme.colors.card, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1.5, borderColor: theme.colors.cardBorder },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
    tabBtnActive: { backgroundColor: theme.colors.primary },
    tabBtnTxt: { fontSize: 13, fontWeight: '800', color: theme.colors.muted },
    consumerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: theme.colors.cardBorder, gap: 12 },
    consumerIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    consumerName: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
    consumerStore: { fontSize: 11, color: theme.colors.primaryLight, marginTop: 1, fontWeight: '700' },
    consumerEmail: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
    consumerContact: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
    roleBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, maxWidth: 110 },
    roleBadgeTxt: { fontSize: 10, fontWeight: '800', flexShrink: 1 },
    locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
    locationBtnTxt: { fontSize: 10, color: '#10b981', fontWeight: '700' },
    emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 12 },
    emptyTxt: { color: theme.colors.muted, fontSize: 14 },
    emptyBtn: { backgroundColor: theme.colors.primaryGlow, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
    emptyBtnTxt: { color: theme.colors.primaryLight, fontWeight: '700', fontSize: 13 },
    // Form
    formLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
    // Parent picker
    parentLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 10 },
    parentOptions: { gap: 8, marginBottom: 18 },
    parentOption: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: theme.colors.card,
        borderRadius: 12, padding: 12,
        borderWidth: 1.5, borderColor: theme.colors.cardBorder,
    },
    parentOptionSelected: {
        borderColor: theme.colors.primaryLight,
        backgroundColor: 'rgba(99,102,241,0.07)',
    },
    parentOptionIcon: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: theme.colors.glass,
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    parentOptionName: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
    parentOptionRole: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
    parentOptionCheck: {
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: theme.colors.primaryLight,
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    roleCards: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    roleCard: { flex: 1, backgroundColor: theme.colors.card, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: theme.colors.cardBorder, alignItems: 'center', gap: 6, position: 'relative' },
    roleCardIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.glass },
    roleCardTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
    roleCardDesc: { fontSize: 10, color: theme.colors.muted, textAlign: 'center', lineHeight: 14 },
    checkBadge: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 0, gap: 10, marginBottom: 0 },
    input: { flex: 1, color: theme.colors.text, fontSize: 14, paddingVertical: Platform.OS === 'android' ? 12 : 0 },
    // GPS
    gpsBtnRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.primaryGlow, borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.35)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13 },
    gpsBtnTxt: { color: theme.colors.primaryLight, fontWeight: '700', fontSize: 12 },
    // Map Picker
    mapPickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.card, paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54, paddingBottom: 14, borderBottomWidth: 1, borderColor: theme.colors.border },
    mapPickerClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.glass, justifyContent: 'center', alignItems: 'center' },
    mapPickerTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.text },
    mapPickerSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
    mapConfirmBtn: { margin: 16, borderRadius: 14, overflow: 'hidden' },
    mapConfirmGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
    mapConfirmTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
    coordRow: { flexDirection: 'row', marginBottom: 6 },
    coordLabel: { fontSize: 10, fontWeight: '800', color: theme.colors.muted, letterSpacing: 0.5, marginRight: 4 },
    coordConfirm: { fontSize: 12, color: '#10b981', fontWeight: '700', marginBottom: 4 },
    coordHint: { fontSize: 11, color: theme.colors.muted, marginBottom: 4, fontStyle: 'italic' },
    infoBox: { backgroundColor: 'rgba(99,102,241,0.08)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)', borderRadius: 10, padding: 14, marginTop: 20, marginBottom: 10 },
    infoTxt: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 },
    // Price Level
    priceLevelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    priceLevelBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.card },
    priceLevelBtnActive: { borderColor: 'rgba(139,92,246,0.5)', backgroundColor: 'rgba(139,92,246,0.1)' },
    priceLevelBtnTxt: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },
    submitBtn: { marginTop: 10, borderRadius: 14, overflow: 'hidden' },
    submitBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
    submitBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
    // Success Modal
    successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 40 },
    successBox: { backgroundColor: theme.colors.card, borderRadius: 24, padding: 28, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: theme.colors.border },
    successIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    successTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.text, marginBottom: 8 },
    successName: { fontSize: 18, fontWeight: '800', color: theme.colors.primaryLight },
    successRole: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },
    successEmail: { fontSize: 12, color: theme.colors.muted, fontFamily: 'monospace', marginTop: 4, marginBottom: 12 },
    successPassBox: { backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 14, alignItems: 'center' },
    successPassLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    successPassVal: { fontSize: 22, fontWeight: '900', color: theme.colors.primaryLight, letterSpacing: 2 },
    successShareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(37,211,102,0.08)', borderWidth: 1, borderColor: 'rgba(37,211,102,0.3)', paddingVertical: 10, borderRadius: 12 },
    successBtn: { backgroundColor: theme.colors.primaryGlow, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
    successBtnTxt: { color: theme.colors.primaryLight, fontWeight: '800', fontSize: 14 },
});
