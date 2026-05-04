import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, StatusBar, SafeAreaView, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { theme } from '../theme';
import { useAuth, BASE_URL } from '../context/AuthContext';
import { Wallet, Plus, Edit2, Trash2, X, ChevronDown } from 'lucide-react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

export default function CommissionManagementScreen({ onNavigate = () => {} }) {
    const { user } = useAuth();
    const [commissionConfigs, setCommissionConfigs] = useState([]);
    const [salesPeople, setSalesPeople] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        salesId: null,
        productId: null,
        commissionAmount: '',
        commissionType: 'PERCENTAGE', // PERCENTAGE | FLAT
    });
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [showSalesPicker, setShowSalesPicker] = useState(false);
    const [showTypePicker, setShowTypePicker] = useState(false);

    useEffect(() => {
        if (!user) return;
        fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [configRes, salesRes, productsRes] = await Promise.all([
                axios.get(`${BASE_URL}/api/commission-configs?stokisId=${user.id}`, { timeout: 10000 }).catch(() => null),
                axios.get(`${BASE_URL}/api/team?parentId=${user.id}`, { timeout: 10000 }).catch(() => null),
                axios.get(`${BASE_URL}/api/products?userId=${user.id}`, { timeout: 10000 }).catch(() => null),
            ]);

            if (configRes?.data) {
                setCommissionConfigs(configRes.data);
            }
            if (salesRes?.data) {
                setSalesPeople(salesRes.data.filter(p => p.role === 'SALES'));
            }
            if (productsRes?.data) {
                setProducts(productsRes.data);
            }
        } catch (error) {
            console.log('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleAddOrUpdate = async () => {
        if (!formData.productId || !formData.commissionAmount) {
            Alert.alert('Validation', 'Mohon isi semua field');
            return;
        }

        try {
            if (editingId) {
                // Update
                await axios.put(
                    `${BASE_URL}/api/commission-configs/${editingId}`,
                    {
                        commissionAmount: parseFloat(formData.commissionAmount),
                        commissionType: formData.commissionType,
                    },
                    { timeout: 10000 }
                );
            } else {
                // Create
                await axios.post(
                    `${BASE_URL}/api/commission-configs`,
                    {
                        stokisId: user.id,
                        salesId: formData.salesId,
                        productId: formData.productId,
                        commissionAmount: parseFloat(formData.commissionAmount),
                        commissionType: formData.commissionType,
                    },
                    { timeout: 10000 }
                );
            }
            setShowModal(false);
            setEditingId(null);
            setFormData({
                salesId: null,
                productId: null,
                commissionAmount: '',
                commissionType: 'PERCENTAGE',
            });
            fetchData();
            Alert.alert('Sukses', editingId ? 'Komisi diupdate' : 'Komisi ditambahkan');
        } catch (error) {
            Alert.alert('Error', 'Gagal menyimpan komisi');
        }
    };

    const handleDelete = async (id) => {
        Alert.alert('Hapus', 'Yakin ingin menghapus komisi ini?', [
            { text: 'Batal', onPress: () => {} },
            {
                text: 'Hapus',
                onPress: async () => {
                    try {
                        await axios.delete(`${BASE_URL}/api/commission-configs/${id}`, { timeout: 10000 });
                        fetchData();
                        Alert.alert('Sukses', 'Komisi dihapus');
                    } catch (error) {
                        Alert.alert('Error', 'Gagal menghapus komisi');
                    }
                },
            },
        ]);
    };

    const handleEdit = (config) => {
        setEditingId(config.id);
        setFormData({
            salesId: config.salesId,
            productId: config.productId,
            commissionAmount: config.commissionAmount.toString(),
            commissionType: config.commissionType,
        });
        setShowModal(true);
    };

    const handleOpenAdd = () => {
        setEditingId(null);
        setFormData({
            salesId: null,
            productId: null,
            commissionAmount: '',
            commissionType: 'PERCENTAGE',
        });
        setShowModal(true);
    };

    const ConfigItem = ({ config }) => {
        const product = products.find(p => p.id === config.productId);
        const sales = salesPeople.find(s => s.id === config.salesId);

        return (
            <View style={styles.configCard}>
                <View style={styles.configHeader}>
                    <View style={styles.configInfo}>
                        <Text style={styles.productName}>{product?.name || 'Product'}</Text>
                        {config.salesId && (
                            <Text style={styles.salesName}>{sales?.name || 'All Sales'}</Text>
                        )}
                    </View>
                    <View style={styles.configActions}>
                        <TouchableOpacity onPress={() => handleEdit(config)} style={styles.iconBtn}>
                            <Edit2 size={14} color={theme.colors.primary} strokeWidth={2.5} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(config.id)} style={[styles.iconBtn, { marginLeft: 8 }]}>
                            <Trash2 size={14} color="#ef4444" strokeWidth={2.5} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.configDetails}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Jenis</Text>
                        <Text style={styles.detailValue}>{config.commissionType}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Nilai</Text>
                        <Text style={styles.detailValue}>
                            {config.commissionType === 'PERCENTAGE' ? `${config.commissionAmount}%` : `Rp ${config.commissionAmount}`}
                        </Text>
                    </View>
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
                <View>
                    <Text style={styles.headerTitle}>Manajemen Komisi</Text>
                    <Text style={styles.headerSubtitle}>{commissionConfigs.length} konfigurasi</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd} activeOpacity={0.7}>
                    <Plus size={18} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
            </View>

            {/* Summary */}
            <LinearGradient
                colors={['#f59e0b', '#d97706']}
                style={styles.summaryCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Wallet size={20} color="#fff" strokeWidth={2} />
                <Text style={styles.summaryText}>Atur komisi untuk setiap produk & sales</Text>
            </LinearGradient>

            {/* Configs List */}
            <ScrollView
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
            >
                {commissionConfigs.length > 0 ? (
                    commissionConfigs.map((config) => (
                        <ConfigItem key={config.id} config={config} />
                    ))
                ) : (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>Belum ada konfigurasi komisi</Text>
                        <TouchableOpacity style={styles.emptyBtn} onPress={handleOpenAdd}>
                            <Text style={styles.emptyBtnText}>Tambah Komisi</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingId ? 'Edit Komisi' : 'Tambah Komisi'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <X size={20} color={theme.colors.text} strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalForm}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Produk *</Text>
                                <TouchableOpacity
                                    style={styles.selectButton}
                                    onPress={() => setShowProductPicker(true)}
                                >
                                    <Text style={styles.selectButtonText}>
                                        {products.find(p => p.id === formData.productId)?.name || 'Pilih Produk'}
                                    </Text>
                                    <ChevronDown size={16} color={theme.colors.muted} strokeWidth={2} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Sales (Optional)</Text>
                                <TouchableOpacity
                                    style={styles.selectButton}
                                    onPress={() => setShowSalesPicker(true)}
                                >
                                    <Text style={styles.selectButtonText}>
                                        {formData.salesId ? salesPeople.find(s => s.id === formData.salesId)?.name : 'Default (Semua Sales)'}
                                    </Text>
                                    <ChevronDown size={16} color={theme.colors.muted} strokeWidth={2} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Jenis Komisi *</Text>
                                <TouchableOpacity
                                    style={styles.selectButton}
                                    onPress={() => setShowTypePicker(true)}
                                >
                                    <Text style={styles.selectButtonText}>
                                        {formData.commissionType === 'PERCENTAGE' ? 'Persentase (%)' : 'Nominal (Rp)'}
                                    </Text>
                                    <ChevronDown size={16} color={theme.colors.muted} strokeWidth={2} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>
                                    Nilai {formData.commissionType === 'PERCENTAGE' ? '(%)' : '(Rp)'} *
                                </Text>
                                <TextInput
                                    placeholder="Masukkan nilai"
                                    placeholderTextColor={theme.colors.muted}
                                    keyboardType="decimal-pad"
                                    value={formData.commissionAmount}
                                    onChangeText={(text) =>
                                        setFormData({ ...formData, commissionAmount: text })
                                    }
                                    style={styles.input}
                                />
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.submitBtn} onPress={handleAddOrUpdate}>
                            <Text style={styles.submitBtnText}>
                                {editingId ? 'Update' : 'Tambah'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Product Picker Modal */}
            <Modal
                visible={showProductPicker}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowProductPicker(false)}
            >
                <View style={styles.pickerModalOverlay}>
                    <View style={styles.pickerModalContent}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Pilih Produk</Text>
                            <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                                <X size={20} color={theme.colors.text} strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {products.map((product) => (
                                <TouchableOpacity
                                    key={product.id}
                                    style={[styles.pickerItem, formData.productId === product.id && styles.pickerItemActive]}
                                    onPress={() => {
                                        setFormData({ ...formData, productId: product.id });
                                        setShowProductPicker(false);
                                    }}
                                >
                                    <Text style={[styles.pickerItemText, formData.productId === product.id && styles.pickerItemTextActive]}>
                                        {product.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Sales Picker Modal */}
            <Modal
                visible={showSalesPicker}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowSalesPicker(false)}
            >
                <View style={styles.pickerModalOverlay}>
                    <View style={styles.pickerModalContent}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Pilih Sales</Text>
                            <TouchableOpacity onPress={() => setShowSalesPicker(false)}>
                                <X size={20} color={theme.colors.text} strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <TouchableOpacity
                                style={[styles.pickerItem, formData.salesId === null && styles.pickerItemActive]}
                                onPress={() => {
                                    setFormData({ ...formData, salesId: null });
                                    setShowSalesPicker(false);
                                }}
                            >
                                <Text style={[styles.pickerItemText, formData.salesId === null && styles.pickerItemTextActive]}>
                                    Default (Semua Sales)
                                </Text>
                            </TouchableOpacity>
                            {salesPeople.map((sales) => (
                                <TouchableOpacity
                                    key={sales.id}
                                    style={[styles.pickerItem, formData.salesId === sales.id && styles.pickerItemActive]}
                                    onPress={() => {
                                        setFormData({ ...formData, salesId: sales.id });
                                        setShowSalesPicker(false);
                                    }}
                                >
                                    <Text style={[styles.pickerItemText, formData.salesId === sales.id && styles.pickerItemTextActive]}>
                                        {sales.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Type Picker Modal */}
            <Modal
                visible={showTypePicker}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowTypePicker(false)}
            >
                <View style={styles.pickerModalOverlay}>
                    <View style={styles.pickerModalContent}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Pilih Jenis Komisi</Text>
                            <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                                <X size={20} color={theme.colors.text} strokeWidth={2.5} />
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.pickerItem, formData.commissionType === 'PERCENTAGE' && styles.pickerItemActive]}
                            onPress={() => {
                                setFormData({ ...formData, commissionType: 'PERCENTAGE' });
                                setShowTypePicker(false);
                            }}
                        >
                            <Text style={[styles.pickerItemText, formData.commissionType === 'PERCENTAGE' && styles.pickerItemTextActive]}>
                                Persentase (%)
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.pickerItem, formData.commissionType === 'FLAT' && styles.pickerItemActive]}
                            onPress={() => {
                                setFormData({ ...formData, commissionType: 'FLAT' });
                                setShowTypePicker(false);
                            }}
                        >
                            <Text style={[styles.pickerItemText, formData.commissionType === 'FLAT' && styles.pickerItemTextActive]}>
                                Nominal (Rp)
                            </Text>
                        </TouchableOpacity>
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
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryCard: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    summaryText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    configCard: {
        backgroundColor: theme.colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    configHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    configInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 13,
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: 4,
    },
    salesName: {
        fontSize: 10,
        color: theme.colors.muted,
        fontWeight: '500',
    },
    configActions: {
        flexDirection: 'row',
    },
    iconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
    },
    configDetails: {
        flexDirection: 'row',
        gap: 16,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    detailItem: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 9,
        color: theme.colors.muted,
        fontWeight: '500',
        marginBottom: 3,
    },
    detailValue: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.colors.primary,
    },
    emptyBox: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: theme.colors.muted,
        fontWeight: '500',
        marginBottom: 16,
    },
    emptyBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
    },
    emptyBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 30,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: theme.colors.text,
    },
    modalForm: {
        marginBottom: 16,
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: 8,
    },
    selectButton: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 11,
        backgroundColor: theme.colors.background,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectButtonText: {
        color: theme.colors.text,
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    input: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontSize: 13,
    },
    submitBtn: {
        backgroundColor: theme.colors.primary,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
    },
    submitBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
    },
    pickerModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    pickerModalContent: {
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        paddingTop: 16,
        paddingHorizontal: 16,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    pickerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: theme.colors.text,
    },
    pickerItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginVertical: 4,
        backgroundColor: theme.colors.background,
    },
    pickerItemActive: {
        backgroundColor: theme.colors.primary,
    },
    pickerItemText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text,
    },
    pickerItemTextActive: {
        color: '#fff',
    },
});
