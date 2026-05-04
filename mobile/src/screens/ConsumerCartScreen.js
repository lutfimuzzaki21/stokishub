import React, { useState } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, FlatList,
    SafeAreaView, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
    ShoppingCart, Trash2, Plus, Minus, ShoppingBag,
    ChevronRight, Package,
} from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const formatRp = (v) => `Rp ${(v ?? 0).toLocaleString('id-ID')}`;

export default function ConsumerCartScreen({ onNavigate }) {
    const { user } = useAuth();
    const { items, updateQty, removeItem, clearCart, totalItems, totalUnits, totalPrice } = useCart();
    const [submitting, setSubmitting] = useState(false);

    const handleCheckout = async () => {
        if (items.length === 0) return;

        Alert.alert(
            'Konfirmasi Pesanan',
            `${totalItems} item — Total ${formatRp(totalPrice)}\n\nBuat pesanan sekarang?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ya, Pesan!', onPress: async () => {
                        setSubmitting(true);
                        try {
                            await axios.post(`${BASE_URL}/api/orders`, {
                                buyerId: user.id,
                                stokisId: user.parent_id,
                                items: items.map(i => ({
                                    productId: i.productId,
                                    quantity: i.quantity,
                                    price: i.price,
                                    packagingId: i.packagingId || null,
                                    packagingName: i.packagingName || null,
                                    unitQty: i.unitQty || 1,
                                })),
                            }, { timeout: 15000 });
                            clearCart();
                            Alert.alert('Pesanan Dibuat! 🎉', 'Pesanan kamu sudah masuk dan sedang diproses oleh stokis.', [
                                { text: 'Lihat Pesanan', onPress: () => onNavigate?.('orders') },
                                { text: 'Belanja Lagi', style: 'cancel' },
                            ]);
                        } catch (e) {
                            Alert.alert('Gagal', e.response?.data?.message || 'Tidak bisa membuat pesanan. Coba lagi.');
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    if (items.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Keranjang</Text>
                </View>
                <View style={styles.emptyWrap}>
                    <LinearGradient
                        colors={['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.05)']}
                        style={styles.emptyIcon}
                    >
                        <ShoppingCart size={38} color={theme.colors.primaryLight} />
                    </LinearGradient>
                    <Text style={styles.emptyTitle}>Keranjang Kosong</Text>
                    <Text style={styles.emptyDesc}>Tambahkan produk dari toko untuk mulai belanja</Text>
                    <TouchableOpacity style={styles.shopBtn} onPress={() => onNavigate?.('shop')}>
                        <ShoppingBag size={16} color="#fff" />
                        <Text style={styles.shopBtnTxt}>Ke Toko</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Keranjang</Text>
                <TouchableOpacity
                    onPress={() => Alert.alert('Kosongkan Keranjang?', '', [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Kosongkan', style: 'destructive', onPress: clearCart },
                    ])}
                >
                    <Text style={styles.clearTxt}>Kosongkan</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={items}
                keyExtractor={i => `${i.productId}-${i.packagingId || 'unit'}`}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <View style={styles.cartItem}>
                        <View style={styles.cartItemIcon}>
                            <Package size={20} color={theme.colors.primaryLight} />
                        </View>
                        <View style={styles.cartItemMid}>
                            {item.brand ? <Text numberOfLines={1} style={styles.cartItemBrand}>{item.brand}</Text> : null}
                            <Text numberOfLines={2} style={styles.cartItemName}>{item.name}</Text>
                            {item.packagingName && <Text style={styles.cartItemPkg}>📦 {item.packagingName} ({item.unitQty} unit)</Text>}
                            <Text style={styles.cartItemPrice}>{formatRp(item.price)}/{item.packagingName || 'pcs'}</Text>
                        </View>
                        <View style={styles.cartItemRight}>
                            <TouchableOpacity onPress={() => removeItem(item.productId, item.packagingId)} style={styles.deleteBtn}>
                                <Trash2 size={14} color={theme.colors.danger} />
                            </TouchableOpacity>
                            <View style={styles.qtyControl}>
                                <TouchableOpacity
                                    style={styles.qtyBtn}
                                    onPress={() => updateQty(item.productId, item.quantity - 1, item.packagingId)}
                                >
                                    <Minus size={14} color={theme.colors.text} />
                                </TouchableOpacity>
                                <Text style={styles.qtyVal}>{item.quantity}</Text>
                                <TouchableOpacity
                                    style={[styles.qtyBtn, item.quantity >= item.maxStock && styles.qtyBtnDisabled]}
                                    onPress={() => updateQty(item.productId, item.quantity + 1, item.packagingId)}
                                    disabled={item.quantity >= item.maxStock}
                                >
                                    <Plus size={14} color={item.quantity >= item.maxStock ? theme.colors.muted : theme.colors.text} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.cartItemSubtotal}>{formatRp(item.price * item.quantity)}</Text>
                        </View>
                    </View>
                )}
                ListFooterComponent={(
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryTitle}>Ringkasan</Text>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLbl}>Total Unit</Text>
                            <Text style={styles.summaryVal}>{totalUnits} unit</Text>
                        </View>
                        <View style={[styles.summaryRow, { marginTop: 4 }]}>
                            <Text style={styles.summaryLbl}>Jenis Produk</Text>
                            <Text style={styles.summaryVal}>{items.length} produk</Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryTotalLbl}>Total Pembayaran</Text>
                            <Text style={styles.summaryTotalVal}>{formatRp(totalPrice)}</Text>
                        </View>
                    </View>
                )}
            />

            <View style={styles.footer}>
                <View style={styles.footerInfo}>
                    <Text style={styles.footerTotal}>{formatRp(totalPrice)}</Text>
                    <Text style={styles.footerCount}>{totalItems} item · {totalUnits} unit</Text>
                </View>
                <TouchableOpacity
                    style={[styles.checkoutBtn, submitting && styles.checkoutBtnLoading]}
                    onPress={handleCheckout}
                    disabled={submitting}
                    activeOpacity={0.85}
                >
                    {submitting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <>
                            <Text style={styles.checkoutBtnTxt}>Pesan Sekarang</Text>
                            <ChevronRight size={18} color="#fff" />
                        </>
                    }
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 44 : 14,
        paddingBottom: 16,
    },
    headerTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.text },
    clearTxt: { fontSize: 12, color: theme.colors.danger, fontWeight: '700' },

    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 40 },
    emptyIcon: { width: 90, height: 90, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.textSecondary },
    emptyDesc: { color: theme.colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 20 },
    shopBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 4,
    },
    shopBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },

    cartItem: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: theme.colors.card,
        borderRadius: 14, padding: 14, marginBottom: 10,
        borderWidth: 1.5, borderColor: theme.colors.cardBorder,
        gap: 12,
    },
    cartItemIcon: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: 'rgba(99,102,241,0.12)',
        justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    },
    cartItemMid: { flex: 1, minWidth: 0 },
    cartItemBrand: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', marginBottom: 2 },
    cartItemName: { fontSize: 13, fontWeight: '800', color: theme.colors.text },
    cartItemPrice: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },
    cartItemPkg: { fontSize: 10, color: theme.colors.primaryLight, fontWeight: '700', marginTop: 2 },
    cartItemRight: { alignItems: 'flex-end', gap: 6 },
    deleteBtn: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: 'rgba(239,68,68,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    qtyControl: { flexDirection: 'row', alignItems: 'center' },
    qtyBtn: {
        width: 28, height: 28, borderRadius: 8,
        backgroundColor: theme.colors.glass,
        borderWidth: 1, borderColor: theme.colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    qtyBtnDisabled: { opacity: 0.35 },
    qtyVal: { fontSize: 14, fontWeight: '900', color: theme.colors.text, width: 32, textAlign: 'center' },
    cartItemSubtotal: { fontSize: 13, fontWeight: '900', color: theme.colors.primaryLight },

    summaryBox: {
        backgroundColor: theme.colors.card,
        borderRadius: 16, padding: 16,
        borderWidth: 1.5, borderColor: theme.colors.cardBorder,
        marginTop: 4,
    },
    summaryTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryLbl: { fontSize: 13, color: theme.colors.muted },
    summaryVal: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
    summaryDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },
    summaryTotalLbl: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
    summaryTotalVal: { fontSize: 16, fontWeight: '900', color: theme.colors.primaryLight },

    footer: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 14,
        borderTopWidth: 1, borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        gap: 14,
    },
    footerInfo: { flex: 1, minWidth: 0 },
    footerTotal: { fontSize: 16, fontWeight: '900', color: theme.colors.text },
    footerCount: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
    checkoutBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14,
    },
    checkoutBtnLoading: { opacity: 0.7 },
    checkoutBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
