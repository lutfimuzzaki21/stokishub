import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, StatusBar, SafeAreaView, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import { ShoppingCart, Calendar } from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

export default function PurchasesScreen({ onNavigate = () => {} }) {
    const { user } = useAuth();
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!user) return;
        fetchPurchases();
    }, [user]);

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${BASE_URL}/api/purchases?userId=${user.id}`,
                { timeout: 10000 }
            );
            setPurchases(res.data || []);
        } catch (error) {
            console.log('Error fetching purchases:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchPurchases();
    };

    const formatCurrency = (value) => `Rp ${Math.floor(value).toLocaleString('id-ID')}`;

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const totalCost = purchases.reduce((sum, p) => sum + ((p.price_buy || 0) * (p.quantity || 0)), 0);
    const avgCost = purchases.length > 0 ? totalCost / purchases.length : 0;

    const PurchaseItem = ({ purchase }) => {
        const itemTotal = (purchase.price_buy || 0) * (purchase.quantity || 0);
        return (
            <View style={styles.purchaseCard}>
                <View style={styles.purchaseHeader}>
                    <View style={styles.productInfo}>
                        <Text style={styles.productCode}>{purchase.product?.code || 'N/A'}</Text>
                        <Text style={styles.productName} numberOfLines={1}>
                            {purchase.product?.name || 'Product'}
                        </Text>
                    </View>
                    <Text style={styles.purchaseDate}>{formatDate(purchase.date)}</Text>
                </View>

                <View style={styles.purchaseDetails}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Harga Beli</Text>
                        <Text style={styles.detailValue}>{formatCurrency(purchase.price_buy)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Qty</Text>
                        <Text style={styles.detailValue}>{purchase.quantity} Unit</Text>
                    </View>
                </View>

                <View style={styles.purchaseFooter}>
                    <Text style={styles.totalLabel}>Total Pembelian</Text>
                    <Text style={styles.totalValue}>{formatCurrency(itemTotal)}</Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} translucent={false} />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Laporan Pembelian</Text>
                    <Text style={styles.headerSubtitle}>{purchases.length} transaksi</Text>
                </View>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
                <LinearGradient
                    colors={['#ef4444', '#dc2626']}
                    style={styles.summaryCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.summaryTop}>
                        <ShoppingCart size={18} color="#fff" strokeWidth={2} />
                        <Text style={styles.summaryLabel}>Total Biaya</Text>
                    </View>
                    <Text style={styles.summaryValue}>{formatCurrency(totalCost)}</Text>
                </LinearGradient>

                <LinearGradient
                    colors={['#f59e0b', '#d97706']}
                    style={styles.summaryCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.summaryTop}>
                        <Calendar size={18} color="#fff" strokeWidth={2} />
                        <Text style={styles.summaryLabel}>Rata-rata</Text>
                    </View>
                    <Text style={styles.summaryValue}>{formatCurrency(avgCost)}</Text>
                </LinearGradient>
            </View>

            {/* Purchases List */}
            <ScrollView
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {purchases.length > 0 ? (
                    purchases.map((purchase) => (
                        <PurchaseItem key={purchase.id} purchase={purchase} />
                    ))
                ) : (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>Tidak ada pembelian</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    loadingBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: theme.colors.text,
    },
    headerSubtitle: {
        fontSize: 11,
        color: theme.colors.muted,
        marginTop: 4,
    },
    summaryContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 20,
    },
    summaryCard: {
        flex: 1,
        borderRadius: 14,
        padding: 14,
    },
    summaryTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '600',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#fff',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    purchaseCard: {
        backgroundColor: theme.colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    purchaseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    productInfo: {
        flex: 1,
    },
    productCode: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.colors.muted,
        marginBottom: 2,
    },
    productName: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text,
    },
    purchaseDate: {
        fontSize: 10,
        color: theme.colors.muted,
        fontWeight: '500',
    },
    purchaseDetails: {
        paddingVertical: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 10,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    detailLabel: {
        fontSize: 10,
        color: theme.colors.muted,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.text,
    },
    purchaseFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 10,
        color: theme.colors.muted,
        fontWeight: '500',
    },
    totalValue: {
        fontSize: 12,
        fontWeight: '800',
        color: '#ef4444',
    },
    emptyBox: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: theme.colors.muted,
        fontWeight: '500',
    },
});
