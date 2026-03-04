import React, { useState } from 'react';
import {
    StyleSheet, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, KeyboardAvoidingView, Platform,
    Dimensions, StatusBar, ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState(null);
    const { login } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Email dan password wajib diisi');
            return;
        }
        setIsLoading(true);
        setError('');
        const res = await login(email, password);
        if (!res.success) {
            setError(res.message || 'Email atau password salah');
        }
        setIsLoading(false);
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* ── Top Hero Section ── */}
            <LinearGradient
                colors={['#1e1b4b', '#312e81', '#4338ca']}
                style={styles.hero}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
            >
                {/* decorative rings */}
                <View style={styles.ring1} />
                <View style={styles.ring2} />
                <View style={styles.ring3} />
                {/* dot grid */}
                <View style={styles.dotGrid}>
                    {Array.from({ length: 30 }).map((_, i) => (
                        <View key={i} style={styles.dot} />
                    ))}
                </View>

                {/* Brand */}
                <View style={styles.brandWrapper}>
                    <View style={styles.logoBox}>
                        <LinearGradient
                            colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
                            style={styles.logoInner}
                        >
                            <Text style={styles.logoLetter}>S</Text>
                        </LinearGradient>
                    </View>
                    <Text style={styles.brandName}>StokisHub</Text>
                    <View style={styles.tagPill}>
                        <Text style={styles.tagText}>ENTERPRISE DISTRIBUTION</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* ── Form Sheet ── */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.sheetWrapper}
            >
                <ScrollView
                    contentContainerStyle={styles.sheet}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.sheetHandle} />

                    <Text style={styles.sheetTitle}>Masuk ke Akun</Text>
                    <Text style={styles.sheetSub}>Gunakan kredensial yang diberikan oleh admin</Text>

                    {/* Error */}
                    {!!error && (
                        <View style={styles.errorBox}>
                            <AlertCircle size={16} color="#ef4444" />
                            <Text style={styles.errorTxt}>{error}</Text>
                        </View>
                    )}

                    {/* Email */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Email</Text>
                        <View style={[styles.fieldRow, focusedField === 'email' && styles.fieldRowFocused]}>
                            <Mail size={18} color={focusedField === 'email' ? theme.colors.primaryLight : theme.colors.muted} strokeWidth={2} />
                            <TextInput
                                style={styles.fieldInput}
                                placeholder="nama@email.com"
                                placeholderTextColor={theme.colors.muted}
                                value={email}
                                onChangeText={t => { setEmail(t); setError(''); }}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                returnKeyType="next"
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                            />
                        </View>
                    </View>

                    {/* Password */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Password</Text>
                        <View style={[styles.fieldRow, focusedField === 'pass' && styles.fieldRowFocused]}>
                            <Lock size={18} color={focusedField === 'pass' ? theme.colors.primaryLight : theme.colors.muted} strokeWidth={2} />
                            <TextInput
                                style={styles.fieldInput}
                                placeholder="••••••••"
                                placeholderTextColor={theme.colors.muted}
                                value={password}
                                onChangeText={t => { setPassword(t); setError(''); }}
                                secureTextEntry={!showPass}
                                returnKeyType="done"
                                onSubmitEditing={handleLogin}
                                onFocus={() => setFocusedField('pass')}
                                onBlur={() => setFocusedField(null)}
                            />
                            <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                {showPass
                                    ? <EyeOff size={18} color={theme.colors.muted} />
                                    : <Eye size={18} color={theme.colors.muted} />}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                        onPress={handleLogin}
                        disabled={isLoading}
                        activeOpacity={0.88}
                        style={styles.btnWrap}
                    >
                        <LinearGradient
                            colors={isLoading ? ['#6b7280', '#6b7280'] : ['#6366f1', '#4338ca']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.btn}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Text style={styles.btnTxt}>Masuk Sekarang</Text>
                                    <View style={styles.btnArrow}>
                                        <ArrowRight size={16} color="#6366f1" strokeWidth={2.5} />
                                    </View>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerTxt}>Kendala akses? </Text>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={styles.footerLink}>Hubungi Admin</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.version}>v1.2.0 · StokisHub Enterprise</Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const HERO_H = height * 0.38;

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0f0e1a' },

    /* ── Hero ── */
    hero: {
        height: HERO_H,
        justifyContent: 'flex-end',
        paddingBottom: 48,
        overflow: 'hidden',
    },
    ring1: {
        position: 'absolute', top: -80, right: -80,
        width: 280, height: 280, borderRadius: 140,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    ring2: {
        position: 'absolute', top: -40, right: -40,
        width: 180, height: 180, borderRadius: 90,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    ring3: {
        position: 'absolute', bottom: 20, left: -60,
        width: 200, height: 200, borderRadius: 100,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    },
    dotGrid: {
        position: 'absolute', top: 60, left: 20,
        flexDirection: 'row', flexWrap: 'wrap', width: 120, gap: 10,
    },
    dot: {
        width: 3, height: 3, borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    brandWrapper: { alignItems: 'center', gap: 10 },
    logoBox: {
        width: 72, height: 72, borderRadius: 22,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
        overflow: 'hidden',
        shadowColor: '#6366f1', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5, shadowRadius: 20, elevation: 16,
    },
    logoInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    logoLetter: { fontSize: 36, fontWeight: '900', color: '#fff' },
    brandName: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
    tagPill: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    },
    tagText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },

    /* ── Sheet ── */
    sheetWrapper: { flex: 1, marginTop: -24 },
    sheet: {
        backgroundColor: '#13111f',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40,
        minHeight: height - HERO_H + 24,
        borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    sheetHandle: {
        width: 36, height: 4, borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignSelf: 'center', marginBottom: 28,
    },
    sheetTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
    sheetSub: { fontSize: 13, color: '#6b7280', marginTop: 6, marginBottom: 24, lineHeight: 19 },

    /* ── Error ── */
    errorBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
        borderRadius: 12, padding: 12, marginBottom: 18,
    },
    errorTxt: { color: '#ef4444', fontSize: 13, fontWeight: '600', flex: 1 },

    /* ── Fields ── */
    fieldGroup: { marginBottom: 16 },
    fieldLabel: {
        fontSize: 11, fontWeight: '800', color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
    },
    fieldRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14, paddingHorizontal: 16, height: 56,
    },
    fieldRowFocused: {
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.06)',
    },
    fieldInput: {
        flex: 1, color: '#fff', fontSize: 15, fontWeight: '500',
    },

    /* ── Button ── */
    btnWrap: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
    btn: {
        height: 56, flexDirection: 'row',
        justifyContent: 'center', alignItems: 'center', gap: 10,
    },
    btnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
    btnArrow: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center', alignItems: 'center',
    },

    /* ── Footer ── */
    footer: {
        flexDirection: 'row', justifyContent: 'center',
        alignItems: 'center', marginTop: 28,
    },
    footerTxt: { color: '#6b7280', fontSize: 13 },
    footerLink: { color: '#818cf8', fontSize: 13, fontWeight: '800' },
    version: {
        textAlign: 'center', color: '#374151',
        fontSize: 10, marginTop: 24, letterSpacing: 0.5,
    },
});
