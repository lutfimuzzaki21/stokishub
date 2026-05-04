import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, StatusBar, SafeAreaView, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal } from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import { TrendingUp, ChevronRight, Calendar, Filter, X } from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

export default function SalesRevenueScreen({ onNavigate = () => {} }) {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterModal, setFilterModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState('DELIVERED');

    useEffect(() => {
        if (!user) return;
        fetchOrders();
    }, [user, filterStatus]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${BASE_URL}/api/orders?stokisId=${user.id}&status=${filterStatus}`,
                { timeout: 10000 }
            );
            setOrders(res.data || []);
        } catch (error) {
            console.log('Error fetching orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const formatCurrency = (value) => `Rp ${Math.floor(value).toLocaleString('id-ID')}`;

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    const OrderItem = ({ order }) => (
        <TouchableOpacity style={styles.orderCard} activeOpacity={0.7}>
            <View style={styles.orderHeader}>
                <View>
                    <Text style={styles.invoiceNo}>{order.invoice_id}</Text>
                    <Text style={styles.orderDate}>{formatDate(order.date)}</Text>
                </View>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{order.status}</Text>
                </View>
            </View>

            <View style={styles.orderBody}>
                <View style={styles.orderInfo}>
                    <Text style={styles.buyerLabel}>Pembeli</Text>
                    <Text style={styles.buyerName}>{order.buyer?.name || 'N/A'}</Text>
                </View>
                <View style={styles.itemsInfo}>
                    <Text style={styles.itemsLabel}>{order.items?.length || 0} Items</Text>
                </View>
            </View>

            <View style={styles.orderFooter}>
                <Text style={styles.amountLabel}>Total</Text>
                <Text style={styles.amountValue}>{formatCurrency(order.total_amount)}</Text>
            </View>
        </TouchableOpacity>
    );

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
                    <Text style={styles.headerTitle}>Laporan Penjualan</Text>
                    <Text style={styles.headerSubtitle}>{orders.length} transaksi</Text>
                </View>
                <TouchableOpacity
                    style={styles.filterBtn}
                    onPress={() => setFilterModal(true)}
                    activeOpacity={0.7}
                >
                    <Filter size={18} color={theme.colors.primary} strokeWidth={2.5} />
                </TouchableOpacity>
            </View>

            {/* Summary Card */}
            <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.summaryCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.summaryTop}>
                    <TrendingUp size={20} color="#fff" strokeWidth={2} />
                    <Text style={styles.summaryLabel}>Total Revenue</Text>
                </View>
                <Text style={styles.summaryValue}>{formatCurrency(totalRevenue)}</Text>
                <Text style={styles.summaryDetail}>{orders.length} transaksi berhasil</Text>
            </LinearGradient>

            {/* Orders List */}
            <FlatList
                data={orders}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => <OrderItem order={item} />}
                contentContainerStyle={styles.listContent}
                scrollEnabled={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>Tidak ada penjualan</Text>
                    </View>
                }
            />

            {/* Filter Modal */}
            <Modal
                visible={filterModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setFilterModal(false)}
            >
                <View style={styles.filterModalOverlay}>
                    <View style={styles.filterModalContent}>
                        <View style={styles.filterHeader}>
                            <Text style={styles.filterTitle}>Filter Status</Text>
                            <TouchableOpacity onPress={() => setFilterModal(false)}>
                                <X size={20} color={theme.colors.text} strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>

                        {['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map((status) => (
                            <TouchableOpacity
                                key={status}
                                style={[styles.filterItem, filterStatus === status && styles.filterItemActive]}
                                onPress={() => {
                                    setFilterStatus(status);
                                    setFilterModal(false);
                                }}
                            >
                                <Text style={[styles.filterItemText, filterStatus === status && styles.filterItemTextActive]}>
                                    {status}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>
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
    filterBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: theme.colors.card,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryCard: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 14,
        padding: 16,
        marginTop: 8,
    },
    summaryTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '600',
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
    },
    summaryDetail: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    orderCard: {
        backgroundColor: theme.colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    invoiceNo: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.colors.text,
    },
    orderDate: {
        fontSize: 10,
        color: theme.colors.muted,
        marginTop: 2,
    },
    statusBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#10b981',
    },
    orderBody: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    orderInfo: {
        flex: 1,
    },
    buyerLabel: {
        fontSize: 9,
        color: theme.colors.muted,
        fontWeight: '500',
    },
    buyerName: {
        fontSize: 11,
        fontWeight: '600',
        color: theme.colors.text,
        marginTop: 2,
    },
    itemsInfo: {
        alignItems: 'flex-end',
    },
    itemsLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: theme.colors.muted,
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    amountLabel: {
        fontSize: 10,
        color: theme.colors.muted,
        fontWeight: '500',
    },
    amountValue: {
        fontSize: 13,
        fontWeight: '800',
        color: '#10b981',
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
    filterModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    filterModalContent: {
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingBottom: 30,
        paddingTop: 20,
    },
    filterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    filterTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: theme.colors.text,
    },
    filterItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 8,
        backgroundColor: theme.colors.background,
    },
    filterItemActive: {
        backgroundColor: theme.colors.primary,
    },
    filterItemText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text,
    },
    filterItemTextActive: {
        color: '#fff',
    },
});
