import React, { useState, useEffect } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    SafeAreaView, Platform, Alert, Modal, TextInput,
    KeyboardAvoidingView, ActivityIndicator, StatusBar,
} from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import {
    User, Mail, Phone, MapPin, Building2,
    Star, LogOut, Pencil, X, Check, Navigation, Lock, Eye, EyeOff,
} from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

export default function ConsumerProfileScreen() {
    const { user, logout, updateUser } = useAuth();
    const [parentInfo, setParentInfo] = useState(null);
    const [registeredByInfo, setRegisteredByInfo] = useState(null);
    const [editModal, setEditModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [mapPickerVisible, setMapPickerVisible] = useState(false);
    const [mapPickerCoord, setMapPickerCoord] = useState(null);
    const [mapPickerRegion, setMapPickerRegion] = useState({
        latitude: -6.1751, longitude: 106.8272,
        latitudeDelta: 0.05, longitudeDelta: 0.05,
    });
    const [editForm, setEditForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        contact: user?.contact || '',
        address: user?.address || '',
        latitude: user?.latitude != null ? String(user.latitude) : '',
        longitude: user?.longitude != null ? String(user.longitude) : '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        if (user?.parent_id) fetchParentInfo();
        if (user?.sales_id) fetchRegisteredByInfo();
    }, []);

    if (!user) return null;

    const fetchParentInfo = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/user/${user.parent_id}`, { timeout: 8000 });
            setParentInfo(res.data);
        } catch (_) {}
    };

    const fetchRegisteredByInfo = async () => {
        try {
            const res = await axios.get(`${BASE_URL}/api/user/${user.sales_id}`, { timeout: 8000 });
            setRegisteredByInfo(res.data);
        } catch (_) {}
    };

    const openEdit = async () => {
        // Refresh user data from backend to ensure email & all fields are up-to-date
        let fresh = user;
        try {
            const res = await axios.get(`${BASE_URL}/api/user/${user.id}`, { timeout: 8000 });
            fresh = { ...user, ...res.data };
            await updateUser(res.data);
        } catch (_) {}
        setEditForm({
            name: fresh.name || '',
            email: fresh.email || '',
            contact: fresh.contact || '',
            address: fresh.address || '',
            latitude: fresh.latitude != null ? String(fresh.latitude) : '',
            longitude: fresh.longitude != null ? String(fresh.longitude) : '',
            newPassword: '',
            confirmPassword: '',
        });
        setEditModal(true);
    };

    const handleSave = async () => {
        if (!editForm.name.trim()) {
            Alert.alert('Nama wajib diisi');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
            Alert.alert('Format email tidak valid');
            return;
        }
        setSaving(true);
        if (editForm.newPassword || editForm.confirmPassword) {
            if (editForm.newPassword.length < 6) {
                Alert.alert('Password terlalu pendek', 'Password baru minimal 6 karakter.');
                setSaving(false);
                return;
            }
            if (editForm.newPassword !== editForm.confirmPassword) {
                Alert.alert('Password tidak cocok', 'New password dan Confirm password harus sama.');
                setSaving(false);
                return;
            }
        }
        try {
            const lat = editForm.latitude.trim();
            const lng = editForm.longitude.trim();
            if (lat && isNaN(parseFloat(lat))) { Alert.alert('Latitude tidak valid'); setSaving(false); return; }
            if (lng && isNaN(parseFloat(lng))) { Alert.alert('Longitude tidak valid'); setSaving(false); return; }
            const payload = {
                name: editForm.name.trim(),
                email: editForm.email.trim().toLowerCase(),
                contact: editForm.contact.trim() || null,
                address: editForm.address.trim() || null,
                latitude: lat ? parseFloat(lat) : null,
                longitude: lng ? parseFloat(lng) : null,
            };
            if (editForm.newPassword) payload.password = editForm.newPassword;
            const res = await axios.put(`${BASE_URL}/api/user/${user.id}`, payload, { timeout: 10000 });
            await updateUser(res.data);
            setEditModal(false);
            Alert.alert('Tersimpan âœ“', 'Profil berhasil diperbarui.');
        } catch (e) {
            Alert.alert('Gagal', e.response?.data?.message || 'Tidak bisa menyimpan perubahan.');
        } finally {
            setSaving(false);
        }
    };

    const getGPSLocation = async () => {
        setGettingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izin Ditolak', 'Izin lokasi diperlukan untuk mendapatkan koordinat GPS.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setEditForm(f => ({
                ...f,
                latitude: loc.coords.latitude.toFixed(7),
                longitude: loc.coords.longitude.toFixed(7),
            }));
            Alert.alert('Berhasil', `Koordinat diambil\n${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
        } catch (_) {
            Alert.alert('Gagal', 'Tidak bisa mendapatkan lokasi. Pastikan GPS aktif.');
        } finally {
            setGettingLocation(false);
        }
    };

    const openMapPicker = async () => {
        if (editForm.latitude && editForm.longitude) {
            setMapPickerRegion({
                latitude: parseFloat(editForm.latitude),
                longitude: parseFloat(editForm.longitude),
                latitudeDelta: 0.01, longitudeDelta: 0.01,
            });
            setMapPickerCoord({ latitude: parseFloat(editForm.latitude), longitude: parseFloat(editForm.longitude) });
        } else {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    setMapPickerRegion({
                        latitude: loc.coords.latitude, longitude: loc.coords.longitude,
                        latitudeDelta: 0.01, longitudeDelta: 0.01,
                    });
                }
            } catch (_) {}
            setMapPickerCoord(null);
        }
        setMapPickerVisible(true);
    };

    const confirmMapPicker = () => {
        if (!mapPickerCoord) {
            Alert.alert('Belum Ada Titik', 'Ketuk peta untuk menandai lokasi.');
            return;
        }
        setEditForm(f => ({
            ...f,
            latitude: mapPickerCoord.latitude.toFixed(7),
            longitude: mapPickerCoord.longitude.toFixed(7),
        }));
        setMapPickerVisible(false);
    };

    const handleLogout = () => {
        Alert.alert('Keluar?', 'Kamu yakin ingin logout?', [
            { text: 'Batal', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
        ]);
    };

    const isMember = user.role === 'MEMBER';

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* Avatar / Hero */}
                <LinearGradient
                    colors={isMember ? ['#92400e', '#78350f', '#451a03'] : ['#1e1b4b', '#1e1b4b', '#0f0f2d']}
                    style={styles.hero}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                    <View style={styles.heroDecor1} />
                    <View style={styles.heroDecor2} />
                    <View style={styles.avatarWrap}>
                        <Text style={styles.avatarText}>
                            {user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.heroName}>{user.name}</Text>
                    <View style={[styles.roleBadge, isMember && styles.roleBadgeMember]}>
                        <Star size={12} color={isMember ? '#f59e0b' : theme.colors.primaryLight} fill={isMember ? '#f59e0b' : 'none'} />
                        <Text style={[styles.roleBadgeTxt, isMember && { color: '#f59e0b' }]}>
                            {isMember ? 'Member' : 'Konsumen Umum'}
                        </Text>
                    </View>
                </LinearGradient>

                {/* Info Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHead}>
                        <Text style={styles.sectionTitle}>Informasi Akun</Text>
                        <TouchableOpacity style={styles.editBtn} onPress={openEdit} activeOpacity={0.8}>
                            <Pencil size={13} color={theme.colors.primaryLight} />
                            <Text style={styles.editBtnTxt}>Edit</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.infoBox}>
                        {[
                            { icon: User,   label: 'Nama',          value: user.name },
                            { icon: Mail,   label: 'Email',         value: user.email },
                            { icon: Phone,  label: 'No. WhatsApp',  value: user.contact },
                            { icon: MapPin, label: 'Alamat',        value: user.address },
                        ].map(({ icon: Icon, label, value }, idx, arr) => (
                            value ? (
                                <View key={label} style={[styles.infoRow, idx === arr.filter(i => i.value).length - 1 && { borderBottomWidth: 0 }]}>
                                    <View style={styles.infoIcon}>
                                        <Icon size={15} color={theme.colors.primaryLight} />
                                    </View>
                                    <View style={styles.infoContent}>
                                        <Text style={styles.infoLabel}>{label}</Text>
                                        <Text numberOfLines={2} style={styles.infoValue}>{value}</Text>
                                    </View>
                                </View>
                            ) : null
                        ))}
                    </View>
                </View>

                {/* Membership info for MEMBER */}
                {isMember && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Keanggotaan</Text>
                        <View style={styles.memberCard}>
                            <LinearGradient
                                colors={['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.05)']}
                                style={styles.memberCardInner}
                            >
                                <Star size={22} color="#f59e0b" fill="#f59e0b" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.memberCardTitle}>Member Aktif</Text>
                                    <Text style={styles.memberCardDesc}>
                                        Kamu mendapatkan harga khusus sesuai tier keanggotaan
                                    </Text>
                                </View>
                            </LinearGradient>
                        </View>
                    </View>
                )}

                {/* Toko terdaftar */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Terdaftar di</Text>
                    <View style={styles.stokisCard}>
                        <View style={styles.stokisIcon}>
                            <Building2 size={20} color={theme.colors.primaryLight} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.stokisLabel}>
                                {parentInfo?.role === 'SUBSTOKIS' ? 'Sub Stokis' : 'Stokis'}
                            </Text>
                            <Text numberOfLines={1} style={styles.stokisName}>
                                {parentInfo?.store_name || parentInfo?.name || `ID #${user.parent_id || '-'}`}
                            </Text>
                            {parentInfo?.contact && (
                                <Text numberOfLines={1} style={styles.stokisContact}>{parentInfo.contact}</Text>
                            )}
                        </View>
                    </View>

                    {/* Didaftarkan oleh */}
                    <View style={[styles.stokisCard, { marginTop: 10 }]}>
                        <View style={[styles.stokisIcon, { backgroundColor: user.sales_id ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)' }]}>
                            <User size={20} color={user.sales_id ? '#10b981' : theme.colors.primaryLight} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.stokisLabel}>Didaftarkan oleh</Text>
                            <Text numberOfLines={1} style={styles.stokisName}>
                                {user.sales_id
                                    ? (registeredByInfo?.name || `Sales #${user.sales_id}`)
                                    : (parentInfo?.store_name || parentInfo?.name || 'Stokis')}
                            </Text>
                            <Text numberOfLines={1} style={[styles.stokisContact, { color: user.sales_id ? '#10b981' : theme.colors.primaryLight }]}>
                                {user.sales_id ? 'Sales' : (parentInfo?.role === 'SUBSTOKIS' ? 'Sub Stokis' : 'Stokis')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
                    <LogOut size={16} color={theme.colors.danger} />
                    <Text style={styles.logoutTxt}>Keluar dari Akun</Text>
                </TouchableOpacity>

                <Text style={styles.version}>StokisHub v1.0</Text>
            </ScrollView>

            {/* Edit Modal */}
            <Modal visible={editModal} animationType="slide" transparent onRequestClose={() => !saving && setEditModal(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.overlay}
                >
                    <TouchableOpacity style={styles.overlayDismiss} onPress={() => !saving && setEditModal(false)} />
                    <View style={styles.sheet}>
                        <View style={styles.sheetHandle} />

                        {/* Sheet Header */}
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Edit Profil</Text>
                            <TouchableOpacity onPress={() => !saving && setEditModal(false)} style={styles.closeBtn} disabled={saving}>
                                <X size={18} color={theme.colors.muted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.sheetBody}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Name */}
                            <Text style={styles.fieldLabel}>Nama Lengkap *</Text>
                            <View style={styles.fieldWrap}>
                                <User size={15} color={theme.colors.muted} />
                                <TextInput
                                    style={styles.fieldInput}
                                    value={editForm.name}
                                    onChangeText={v => setEditForm(f => ({ ...f, name: v }))}
                                    placeholder="Nama lengkap"
                                    placeholderTextColor={theme.colors.muted}
                                />
                            </View>

                            {/* Email */}
                            <Text style={styles.fieldLabel}>Alamat Email *</Text>
                            <View style={styles.fieldWrap}>
                                <Mail size={15} color={theme.colors.muted} />
                                <TextInput
                                    style={styles.fieldInput}
                                    value={editForm.email}
                                    onChangeText={v => setEditForm(f => ({ ...f, email: v }))}
                                    placeholder="email@example.com"
                                    placeholderTextColor={theme.colors.muted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Phone */}
                            <Text style={styles.fieldLabel}>No. WhatsApp</Text>
                            <View style={styles.fieldWrap}>
                                <Phone size={15} color={theme.colors.muted} />
                                <TextInput
                                    style={styles.fieldInput}
                                    value={editForm.contact}
                                    onChangeText={v => setEditForm(f => ({ ...f, contact: v }))}
                                    placeholder="08xxxxxxxxx"
                                    placeholderTextColor={theme.colors.muted}
                                    keyboardType="phone-pad"
                                />
                            </View>

                            {/* Address */}
                            <Text style={styles.fieldLabel}>Alamat</Text>
                            <View style={[styles.fieldWrap, { alignItems: 'flex-start', paddingTop: 12 }]}>
                                <MapPin size={15} color={theme.colors.muted} style={{ marginTop: 2 }} />
                                <TextInput
                                    style={[styles.fieldInput, { height: 80, textAlignVertical: 'top' }]}
                                    value={editForm.address}
                                    onChangeText={v => setEditForm(f => ({ ...f, address: v }))}
                                    placeholder="Alamat lengkap..."
                                    placeholderTextColor={theme.colors.muted}
                                    multiline
                                />
                            </View>

                            {/* Koordinat */}
                            <Text style={styles.fieldLabel}>Titik Lokasi (GPS)</Text>
                            <View style={styles.gpsBtnRow}>
                                <TouchableOpacity
                                    style={[styles.gpsBtn, { flex: 1 }]}
                                    onPress={getGPSLocation}
                                    disabled={gettingLocation}
                                    activeOpacity={0.8}
                                >
                                    {gettingLocation
                                        ? <ActivityIndicator size="small" color={theme.colors.primaryLight} />
                                        : <Navigation size={15} color={theme.colors.primaryLight} />
                                    }
                                    <Text style={styles.gpsBtnTxt} numberOfLines={1}>
                                        {gettingLocation ? 'Memuat...' : 'Lokasi Saat Ini'}
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
                                <View style={[styles.fieldWrap, { flex: 1, marginRight: 6 }]}>
                                    <Text style={styles.coordLabel}>Lat</Text>
                                    <TextInput
                                        style={styles.fieldInput}
                                        value={editForm.latitude}
                                        onChangeText={v => setEditForm(f => ({ ...f, latitude: v }))}
                                        placeholder="-6.1751"
                                        placeholderTextColor={theme.colors.muted}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.fieldWrap, { flex: 1, marginLeft: 6 }]}>
                                    <Text style={styles.coordLabel}>Lng</Text>
                                    <TextInput
                                        style={styles.fieldInput}
                                        value={editForm.longitude}
                                        onChangeText={v => setEditForm(f => ({ ...f, longitude: v }))}
                                        placeholder="106.8272"
                                        placeholderTextColor={theme.colors.muted}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>
                            {(editForm.latitude && editForm.longitude) ? (
                                <Text style={styles.coordConfirm}>📍 {parseFloat(editForm.latitude).toFixed(5)}, {parseFloat(editForm.longitude).toFixed(5)}</Text>
                            ) : (
                <Text style={styles.coordHint}>Opsional — digunakan untuk titik pengiriman di peta</Text>
                            )}

                            {/* Password Section */}
                            <View style={styles.pwDivider} />
                            <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Ganti Password</Text>
                            <Text style={styles.pwHint}>Kosongkan jika tidak ingin mengganti password</Text>

                            <Text style={styles.fieldLabel}>New Password</Text>
                            <View style={styles.fieldWrap}>
                                <Lock size={15} color={theme.colors.muted} />
                                <TextInput
                                    style={styles.fieldInput}
                                    value={editForm.newPassword}
                                    onChangeText={v => setEditForm(f => ({ ...f, newPassword: v }))}
                                    placeholder="Min. 6 karakter"
                                    placeholderTextColor={theme.colors.muted}
                                    secureTextEntry={!showNewPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setShowNewPassword(v => !v)}>
                                    {showNewPassword
                                        ? <EyeOff size={15} color={theme.colors.muted} />
                                        : <Eye size={15} color={theme.colors.muted} />}
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.fieldLabel}>Confirm Password</Text>
                            <View style={[styles.fieldWrap, editForm.confirmPassword && editForm.newPassword !== editForm.confirmPassword ? { borderColor: '#ef4444' } : {}]}>
                                <Lock size={15} color={theme.colors.muted} />
                                <TextInput
                                    style={styles.fieldInput}
                                    value={editForm.confirmPassword}
                                    onChangeText={v => setEditForm(f => ({ ...f, confirmPassword: v }))}
                                    placeholder="Ulangi password baru"
                                    placeholderTextColor={theme.colors.muted}
                                    secureTextEntry={!showConfirmPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)}>
                                    {showConfirmPassword
                                        ? <EyeOff size={15} color={theme.colors.muted} />
                                        : <Eye size={15} color={theme.colors.muted} />}
                                </TouchableOpacity>
                            </View>
                            {editForm.confirmPassword && editForm.newPassword !== editForm.confirmPassword && (
                                <Text style={styles.pwMismatch}>Password tidak cocok</Text>
                            )}
                        </ScrollView>

                        {/* Save Button */}
                        <View style={styles.sheetFooter}>
                            <TouchableOpacity
                                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                                onPress={handleSave}
                                disabled={saving}
                                activeOpacity={0.85}
                            >
                                {saving
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <Check size={17} color="#fff" />
                                }
                                <Text style={styles.saveBtnTxt}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Map Picker Modal */}
            <Modal visible={mapPickerVisible} animationType="slide" onRequestClose={() => setMapPickerVisible(false)}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={styles.mapPickerHeader}>
                        <TouchableOpacity style={styles.mapPickerClose} onPress={() => setMapPickerVisible(false)}>
                            <X size={20} color={theme.colors.text} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.mapPickerTitle}>Pilih Titik Lokasi</Text>
                            <Text style={styles.mapPickerSub}>
                                {mapPickerCoord
                                    ? `📍 ${mapPickerCoord.latitude.toFixed(5)}, ${mapPickerCoord.longitude.toFixed(5)}`
                                    : 'Ketuk peta untuk menandai lokasi kamu'}
                            </Text>
                        </View>
                    </View>
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
                                title="Lokasi Saya"
                                pinColor="#6366f1"
                            />
                        )}
                    </MapView>
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { paddingBottom: 40 },

    hero: {
        alignItems: 'center', padding: 32,
        paddingTop: Platform.OS === 'android' ? 56 : 36,
        overflow: 'hidden',
    },
    heroDecor1: {
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.04)', top: -60, right: -60,
    },
    heroDecor2: {
        position: 'absolute', width: 120, height: 120, borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.03)', bottom: -30, left: -20,
    },
    avatarWrap: {
        width: 76, height: 76, borderRadius: 38,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    },
    avatarText: { fontSize: 26, fontWeight: '900', color: '#fff' },
    heroName: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8 },
    roleBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    },
    roleBadgeMember: {
        backgroundColor: 'rgba(245,158,11,0.2)',
        borderColor: 'rgba(245,158,11,0.4)',
    },
    roleBadgeTxt: { color: theme.colors.primaryLight, fontSize: 12, fontWeight: '800' },

    section: { paddingHorizontal: 20, marginTop: 24 },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
    editBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(99,102,241,0.1)',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
    },
    editBtnTxt: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryLight },

    infoBox: {
        backgroundColor: theme.colors.card,
        borderRadius: 16, borderWidth: 1.5, borderColor: theme.colors.cardBorder,
        overflow: 'hidden',
    },
    infoRow: {
        flexDirection: 'row', alignItems: 'center',
        padding: 14, gap: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    infoIcon: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(99,102,241,0.12)',
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    infoContent: { flex: 1, minWidth: 0 },
    infoLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '700' },
    infoValue: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 2 },

    memberCard: {
        backgroundColor: theme.colors.card,
        borderRadius: 16, overflow: 'hidden',
        borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.25)',
    },
    memberCardInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
    memberCardTitle: { fontSize: 14, fontWeight: '900', color: '#f59e0b' },
    memberCardDesc: { fontSize: 12, color: theme.colors.muted, marginTop: 4, lineHeight: 18 },

    stokisCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: theme.colors.card,
        borderRadius: 14, padding: 14,
        borderWidth: 1.5, borderColor: theme.colors.cardBorder,
    },
    stokisIcon: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: 'rgba(99,102,241,0.12)',
        justifyContent: 'center', alignItems: 'center',
    },
    stokisLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '700' },
    stokisName: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginTop: 2 },
    stokisContact: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        marginHorizontal: 20, marginTop: 28,
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderRadius: 14, paddingVertical: 14,
        borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.2)',
    },
    logoutTxt: { fontSize: 14, fontWeight: '800', color: theme.colors.danger },
    version: { textAlign: 'center', fontSize: 11, color: theme.colors.muted, marginTop: 20 },

    // Edit Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    overlayDismiss: { flex: 1 },
    sheet: {
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        maxHeight: '90%',
        borderTopWidth: 1, borderColor: theme.colors.border,
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: theme.colors.border,
        alignSelf: 'center', marginTop: 10, marginBottom: 4,
    },
    sheetHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    },
    sheetTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.text },
    closeBtn: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    sheetBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    fieldLabel: {
        fontSize: 11, fontWeight: '800', color: theme.colors.muted,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 14,
    },
    fieldWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: theme.colors.background,
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
        borderWidth: 1.5, borderColor: theme.colors.border,
    },
    fieldHint: {
        fontSize: 11, color: theme.colors.muted, marginBottom: 8, marginTop: -4,
    },
    gpsBtnRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.primaryGlow, borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.35)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13 },
    gpsBtnTxt: { color: theme.colors.primaryLight, fontWeight: '700', fontSize: 12 },
    coordRow: { flexDirection: 'row', marginBottom: 6 },
    coordLabel: { fontSize: 10, fontWeight: '800', color: theme.colors.muted, letterSpacing: 0.5, marginRight: 4 },
    coordConfirm: { fontSize: 12, color: '#10b981', fontWeight: '700', marginBottom: 4 },
    coordHint: { fontSize: 11, color: theme.colors.muted, marginBottom: 4, fontStyle: 'italic' },
    pwDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 20 },
    pwHint: { fontSize: 11, color: theme.colors.muted, marginBottom: 12, marginTop: -8 },
    pwMismatch: { fontSize: 11, color: '#ef4444', marginTop: -8, marginBottom: 8, marginLeft: 4 },
    mapPickerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.card, paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54, paddingBottom: 14, borderBottomWidth: 1, borderColor: theme.colors.border },
    mapPickerClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.glass, justifyContent: 'center', alignItems: 'center' },
    mapPickerTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.text },
    mapPickerSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
    mapConfirmBtn: { margin: 16, borderRadius: 14, overflow: 'hidden' },
    mapConfirmGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
    mapConfirmTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
    fieldInput: { flex: 1, color: theme.colors.text, fontSize: 14, fontWeight: '600' },
    sheetFooter: {
        padding: 20, paddingTop: 12,
        borderTopWidth: 1, borderTopColor: theme.colors.border,
    },
    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: theme.colors.primary,
        borderRadius: 14, paddingVertical: 15,
    },
    saveBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
