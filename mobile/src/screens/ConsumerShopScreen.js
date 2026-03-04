import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    SafeAreaView, TextInput, ActivityIndicator, FlatList,
    RefreshControl, Modal, Platform, Dimensions,
} from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
    Search, Package, ShoppingCart, Plus, Minus, X,
    ShoppingBag, Star, Box, AlertCircle, CheckCircle2,
} from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const getPrice = (product, priceLevel) => {
    if (product.userPriceTiers?.length > 0) return product.userPriceTiers[0].price;
    const tier = product.priceTiers?.find(t => t.level_name === priceLevel)
        || product.priceTiers?.find(t => t.level_name === 'Harga Umum')
        || product.priceTiers?.[0];
    return tier?.price || 0;
};

const formatRp = (v) => `Rp ${v.toLocaleString('id-ID')}`;

export default function ConsumerShopScreen() {
    const { user } = useAuth();
    const { addItem, items } = useCart();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [detail, setDetail] = useState(null); // product shown in bottom sheet
    const [detailQty, setDetailQty] = useState(1);
    const [addedId, setAddedId] = useState(null); // flash green feedback

    const stokisId = user.parent_id;
    const priceLevel = user.price_level || 'Harga Umum';

    useEffect(() => { fetchProducts(); }, []);

    const fetchProducts = async () => {
        try {
            const res = await axios.get(
                `${BASE_URL}/api/products?userId=${stokisId}&buyerId=${user.id}`,
                { timeout: 10000 }
            );
            setProducts(res.data);
        } catch (_) { } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => { setRefreshing(true); fetchProducts(); };

    const filtered = useMemo(() => {
        if (!search.trim()) return products;
        const q = search.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.brand?.toLowerCase().includes(q) ||
            p.code?.toLowerCase().includes(q)
        );
    }, [products, search]);

    const openDetail = (product) => {
        setDetail(product);
        setDetailQty(1);
    };

    const handleAddToCart = (product, qty = 1) => {
        const price = getPrice(product, priceLevel);
        addItem({ productId: product.id, name: product.name, brand: product.brand, code: product.code, price, maxStock: product.stock, quantity: qty });
        setAddedId(product.id);
        setTimeout(() => setAddedId(null), 1500);
        setDetail(null);
    };

    const cartQtyForProduct = (productId) => items.find(i => i.productId === productId)?.quantity || 0;

    const renderProduct = ({ item }) => {
        const price = getPrice(item, priceLevel);
        const inCart = cartQtyForProduct(item.id);
        const outOfStock = item.stock === 0;
        const isJustAdded = addedId === item.id;

        return (
            <TouchableOpacity
                style={[styles.productCard, outOfStock && styles.productCardDim]}
                onPress={() => !outOfStock && openDetail(item)}
                activeOpacity={0.85}
            >
                {/* Product icon placeholder */}
                <LinearGradient
                    colors={outOfStock
                        ? ['rgba(100,116,139,0.1)', 'rgba(100,116,139,0.05)']
                        : ['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.05)']
                    }
                    style={styles.productImgBox}
                >
                    <Package size={32} color={outOfStock ? theme.colors.muted : theme.colors.primaryLight} />
                </LinearGradient>

                {outOfStock && (
                    <View style={styles.soldOutBadge}>
                        <Text style={styles.soldOutTxt}>Habis</Text>
                    </View>
                )}

                {inCart > 0 && !outOfStock && (
                    <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeTxt}>{inCart}</Text>
                    </View>
                )}

                <View style={styles.productInfo}>
                    {item.brand ? <Text numberOfLines={1} style={styles.productBrand}>{item.brand}</Text> : null}
                    <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                    <Text numberOfLines={1} style={styles.productPrice}>{formatRp(price)}</Text>
                    <Text style={[styles.productStock, outOfStock && { color: theme.colors.danger }]}>
                        Stok: {item.stock}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.addBtn, outOfStock && styles.addBtnDisabled, isJustAdded && styles.addBtnSuccess]}
                    onPress={() => !outOfStock && handleAddToCart(item)}
                    disabled={outOfStock}
                    activeOpacity={0.8}
                >
                    {isJustAdded
                        ? <CheckCircle2 size={16} color="#fff" />
                        : <Plus size={16} color="#fff" />
                    }
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Halo, {user.name.split(' ')[0]} 👋</Text>
                    <Text style={styles.headerSub}>
                        {user.role === 'MEMBER' ? '✦ Member' : 'Konsumen Umum'}
                    </Text>
                </View>
                <View style={[styles.rolePill, user.role === 'MEMBER' && styles.rolePillMember]}>
                    <Star size={11} color={user.role === 'MEMBER' ? '#f59e0b' : theme.colors.muted} fill={user.role === 'MEMBER' ? '#f59e0b' : 'none'} />
                    <Text style={[styles.rolePillTxt, user.role === 'MEMBER' && { color: '#f59e0b' }]}>
                        {user.role === 'MEMBER' ? 'Member' : 'Umum'}
                    </Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
                <Search size={16} color={theme.colors.muted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Cari produk..."
                    placeholderTextColor={theme.colors.muted}
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <X size={15} color={theme.colors.muted} />
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={theme.colors.primaryLight} size="large" />
                    <Text style={styles.loadingTxt}>Memuat produk...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id.toString()}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primaryLight} />}
                    ListEmptyComponent={(
                        <View style={styles.emptyWrap}>
                            <ShoppingBag size={48} color={theme.colors.muted} />
                            <Text style={styles.emptyTitle}>{search ? 'Produk tidak ditemukan' : 'Belum ada produk'}</Text>
                            <Text style={styles.emptyDesc}>{search ? `Tidak ada hasil untuk "${search}"` : 'Stokis belum menambahkan produk'}</Text>
                        </View>
                    )}
                    renderItem={renderProduct}
                />
            )}

            {/* Product Detail Bottom Sheet */}
            {detail && (
                <Modal visible animationType="slide" transparent onRequestClose={() => setDetail(null)}>
                    <View style={styles.overlay}>
                        <TouchableOpacity style={styles.overlayDismiss} onPress={() => setDetail(null)} />
                        <View style={styles.sheet}>
                            <View style={styles.sheetHandle} />

                            <View style={styles.sheetHeader}>
                                <Text style={styles.sheetTitle} numberOfLines={2}>{detail.name}</Text>
                                <TouchableOpacity onPress={() => setDetail(null)} style={styles.closeBtn}>
                                    <X size={18} color={theme.colors.muted} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
                                {/* Product visual */}
                                <LinearGradient
                                    colors={['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.05)']}
                                    style={styles.sheetImg}
                                >
                                    <Package size={56} color={theme.colors.primaryLight} />
                                </LinearGradient>

                                {detail.brand && <Text style={styles.sheetBrand}>{detail.brand}</Text>}
                                <Text style={styles.sheetName}>{detail.name}</Text>
                                <Text style={styles.sheetCode}>SKU: {detail.code}</Text>

                                <View style={styles.sheetPriceRow}>
                                    <Text style={styles.sheetPrice}>{formatRp(getPrice(detail, priceLevel))}</Text>
                                    <View style={[styles.stockChip, detail.stock === 0 && styles.stockChipEmpty]}>
                                        <Box size={12} color={detail.stock > 0 ? '#10b981' : theme.colors.danger} />
                                        <Text style={[styles.stockChipTxt, detail.stock === 0 && { color: theme.colors.danger }]}>
                                            Stok {detail.stock}
                                        </Text>
                                    </View>
                                </View>

                                {/* Price tiers info */}
                                {detail.priceTiers?.length > 1 && (
                                    <View style={styles.tierBox}>
                                        <Text style={styles.tierTitle}>Tier Harga</Text>
                                        {detail.priceTiers.map((t, i) => (
                                            <View key={i} style={styles.tierRow}>
                                                <View style={[styles.tierDot, t.level_name === priceLevel && { backgroundColor: theme.colors.primaryLight }]} />
                                                <Text style={[styles.tierName, t.level_name === priceLevel && { color: theme.colors.primaryLight }]}>
                                                    {t.level_name}
                                                </Text>
                                                <Text style={[styles.tierPrice, t.level_name === priceLevel && { color: theme.colors.primaryLight }]}>
                                                    {formatRp(t.price)}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Qty selector */}
                                <View style={styles.qtyRow}>
                                    <Text style={styles.qtyLabel}>Jumlah</Text>
                                    <View style={styles.qtyControl}>
                                        <TouchableOpacity
                                            style={[styles.qtyBtn, detailQty <= 1 && styles.qtyBtnDisabled]}
                                            onPress={() => setDetailQty(q => Math.max(1, q - 1))}
                                        >
                                            <Minus size={16} color={detailQty <= 1 ? theme.colors.muted : theme.colors.text} />
                                        </TouchableOpacity>
                                        <Text style={styles.qtyVal}>{detailQty}</Text>
                                        <TouchableOpacity
                                            style={[styles.qtyBtn, detailQty >= detail.stock && styles.qtyBtnDisabled]}
                                            onPress={() => setDetailQty(q => Math.min(detail.stock, q + 1))}
                                        >
                                            <Plus size={16} color={detailQty >= detail.stock ? theme.colors.muted : theme.colors.text} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.sheetSubtotalRow}>
                                    <Text style={styles.sheetSubtotalLbl}>Subtotal</Text>
                                    <Text style={styles.sheetSubtotalVal}>
                                        {formatRp(getPrice(detail, priceLevel) * detailQty)}
                                    </Text>
                                </View>
                            </ScrollView>

                            <View style={styles.sheetFooter}>
                                <TouchableOpacity
                                    style={[styles.addToCartBtn, detail.stock === 0 && styles.addToCartBtnDisabled]}
                                    onPress={() => handleAddToCart(detail, detailQty)}
                                    disabled={detail.stock === 0}
                                    activeOpacity={0.85}
                                >
                                    <ShoppingCart size={18} color="#fff" />
                                    <Text style={styles.addToCartTxt}>
                                        {detail.stock === 0 ? 'Stok Habis' : 'Tambah ke Keranjang'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
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
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 44 : 14,
        paddingBottom: 12,
    },
    greeting: { fontSize: 20, fontWeight: '900', color: theme.colors.text },
    headerSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
    rolePill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 20, backgroundColor: theme.colors.glass,
        borderWidth: 1, borderColor: theme.colors.border,
    },
    rolePillMember: { borderColor: 'rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.08)' },
    rolePillTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },

    searchWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: 20, marginBottom: 16,
        backgroundColor: theme.colors.card,
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: theme.colors.border,
    },
    searchInput: { flex: 1, color: theme.colors.text, fontSize: 14 },

    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingTxt: { fontSize: 13, color: theme.colors.muted },

    listContent: { paddingHorizontal: 16, paddingBottom: 20 },
    row: { justifyContent: 'space-between', marginBottom: 12 },

    productCard: {
        width: CARD_WIDTH,
        backgroundColor: theme.colors.card,
        borderRadius: 16, overflow: 'hidden',
        borderWidth: 1.5, borderColor: theme.colors.cardBorder,
    },
    productCardDim: { opacity: 0.55 },
    productImgBox: {
        width: '100%', height: 110,
        justifyContent: 'center', alignItems: 'center',
    },
    soldOutBadge: {
        position: 'absolute', top: 8, left: 8,
        backgroundColor: 'rgba(239,68,68,0.85)',
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    soldOutTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
    cartBadge: {
        position: 'absolute', top: 8, right: 8,
        backgroundColor: theme.colors.primaryLight,
        width: 22, height: 22, borderRadius: 11,
        justifyContent: 'center', alignItems: 'center',
    },
    cartBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '900' },
    productInfo: { padding: 10, paddingBottom: 4 },
    productBrand: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', marginBottom: 2 },
    productName: { fontSize: 12, fontWeight: '800', color: theme.colors.text, lineHeight: 17 },
    productPrice: { fontSize: 13, fontWeight: '900', color: theme.colors.primaryLight, marginTop: 4 },
    productStock: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
    addBtn: {
        margin: 8, marginTop: 6,
        backgroundColor: theme.colors.primary,
        borderRadius: 10,
        paddingVertical: 8,
        alignItems: 'center',
    },
    addBtnDisabled: { backgroundColor: theme.colors.glass },
    addBtnSuccess: { backgroundColor: '#10b981' },

    emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textSecondary },
    emptyDesc: { fontSize: 13, color: theme.colors.muted, textAlign: 'center' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    overlayDismiss: { flex: 1 },
    sheet: {
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        maxHeight: '88%',
        borderTopWidth: 1, borderColor: theme.colors.border,
    },
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: theme.colors.border,
        alignSelf: 'center', marginTop: 10,
    },
    sheetHeader: {
        flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: theme.colors.border,
        gap: 10,
    },
    sheetTitle: { flex: 1, fontSize: 17, fontWeight: '900', color: theme.colors.text },
    closeBtn: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    sheetBody: { padding: 20 },
    sheetImg: {
        width: '100%', height: 140, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    },
    sheetBrand: { fontSize: 12, color: theme.colors.muted, fontWeight: '600', marginBottom: 4 },
    sheetName: { fontSize: 18, fontWeight: '900', color: theme.colors.text, marginBottom: 4 },
    sheetCode: { fontSize: 11, color: theme.colors.muted, marginBottom: 14 },
    sheetPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sheetPrice: { fontSize: 22, fontWeight: '900', color: theme.colors.primaryLight },
    stockChip: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(16,185,129,0.1)',
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    },
    stockChipEmpty: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' },
    stockChipTxt: { fontSize: 11, fontWeight: '700', color: '#10b981' },

    tierBox: {
        backgroundColor: theme.colors.background,
        borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: theme.colors.border,
        marginBottom: 16,
    },
    tierTitle: { fontSize: 11, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    tierDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
    tierName: { flex: 1, fontSize: 13, color: theme.colors.muted, fontWeight: '600' },
    tierPrice: { fontSize: 13, fontWeight: '700', color: theme.colors.text },

    qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    qtyLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 0 },
    qtyBtn: {
        width: 38, height: 38, borderRadius: 10,
        backgroundColor: theme.colors.glass,
        borderWidth: 1, borderColor: theme.colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    qtyBtnDisabled: { opacity: 0.4 },
    qtyVal: { fontSize: 18, fontWeight: '900', color: theme.colors.text, width: 48, textAlign: 'center' },

    sheetSubtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sheetSubtotalLbl: { fontSize: 13, color: theme.colors.muted, fontWeight: '600' },
    sheetSubtotalVal: { fontSize: 16, fontWeight: '900', color: theme.colors.text },

    sheetFooter: {
        padding: 20, paddingTop: 12,
        borderTopWidth: 1, borderTopColor: theme.colors.border,
    },
    addToCartBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: theme.colors.primary,
        borderRadius: 14, paddingVertical: 15,
    },
    addToCartBtnDisabled: { backgroundColor: theme.colors.glass },
    addToCartTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
