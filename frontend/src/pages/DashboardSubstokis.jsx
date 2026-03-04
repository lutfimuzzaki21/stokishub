import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
    Activity, Diamond, ShoppingCart, Users, FileText, Settings, LogOut, Search, Bell, X,
    TrendingUp, TrendingDown, CreditCard, Wallet, ArrowUpRight, ArrowDownLeft, Menu, Truck, MapPin,
    BarChart3, Zap, CheckCircle2, AlertTriangle, ChevronDown, Edit3, Building2, Phone, Package,
    DollarSign, Layers, Clock, Command, Plus, Gift, ToggleLeft, ToggleRight, CalendarDays
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { io } from 'socket.io-client';

const MySwal = withReactContent(Swal);

const FlyToVisit = ({ coord }) => {
    const map = useMap();
    React.useEffect(() => {
        if (coord) map.flyTo([coord.lat, coord.lng], 16, { animate: true, duration: 1.2 });
    }, [coord]);
    return null;
};

// Custom Icons for Leaflet
const driverIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
});

const pendingDestIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
});

const shippedDestIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/9131/9131546.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
});

const noLocationIcon = new L.divIcon({
    className: 'custom-noloc-icon',
    html: `<div style="background-color: #6b7280; width: 28px; height: 28px; border-radius: 50%; border: 2px dashed #f59e0b; box-shadow: 0 0 5px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 14px;">❓</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

const DashboardSubstokis = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Overview');

    // Identitas user
    const userId = localStorage.getItem('userId');
    const parentId = localStorage.getItem('parentId');
    const myPriceLevel = localStorage.getItem('priceLevel') || 'Harga Umum';

    // States
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [team, setTeam] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [loadingTeam, setLoadingTeam] = useState(false);

    // States for Purchasing Stokis
    const [stokisProducts, setStokisProducts] = useState([]);
    const [loadingStokisProducts, setLoadingStokisProducts] = useState(false);
    const [purchaseCart, setPurchaseCart] = useState([]);
    const [isCartModalOpen, setIsCartModalOpen] = useState(false);

    // States for Pricing Overrides
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const [pricingTargetUser, setPricingTargetUser] = useState(null);
    const [pricingOverrides, setPricingOverrides] = useState([]);

    const [profile, setProfile] = useState({ name: '', store_name: '', address: '', email: '', contact: '', latitude: '', longitude: '' });
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Distribution States
    const [viewMode, setViewMode] = useState('MAP'); // MAP or LIST
    const [liveDrivers, setLiveDrivers] = useState({}); // {driverId: {lat, lng}}
    const [osrmRoutes, setOsrmRoutes] = useState({}); // { orderId: [[lat,lng],...] }
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [visitMarkers, setVisitMarkers] = useState([]);
    const [visitFilter, setVisitFilter] = useState('ALL');
    const [focusedVisit, setFocusedVisit] = useState(null);

    // Commission States
    const [commProducts, setCommProducts] = useState([]);
    const [commCampaigns, setCommCampaigns] = useState([]);
    const [commLoading, setCommLoading] = useState(false);
    const [commTab, setCommTab] = useState('default');
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState(null);
    const [campaignForm, setCampaignForm] = useState({ name: '', description: '', isActive: true, combineWithDefault: true, startDate: '', endDate: '', items: [], salesId: null });
    const [commSalesTeam, setCommSalesTeam] = useState([]);
    const [selectedSalesId, setSelectedSalesId] = useState(null);
    const [pendingConfigs, setPendingConfigs] = useState({});

    // Fetch OSRM road routes whenever live driver locations or orders change
    useEffect(() => {
        const fetchOsrmRoutes = async () => {
            const shipped = orders.filter(o => o.stokisId === parseInt(userId) && o.status === 'SHIPPED' && o.driverId && liveDrivers[o.driverId] && o.buyer?.latitude && o.buyer?.longitude);
            if (shipped.length === 0) { setOsrmRoutes({}); return; }
            const newRoutes = {};
            await Promise.all(shipped.map(async (order) => {
                const d = liveDrivers[order.driverId];
                const destLat = order.buyer.latitude;
                const destLng = order.buyer.longitude;
                try {
                    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${d.lng},${d.lat};${destLng},${destLat}?overview=full&geometries=geojson`);
                    const data = await res.json();
                    if (data.routes?.[0]) {
                        newRoutes[order.id] = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                    } else {
                        newRoutes[order.id] = [[d.lat, d.lng], [destLat, destLng]];
                    }
                } catch (_) {
                    newRoutes[order.id] = [[d.lat, d.lng], [destLat, destLng]];
                }
            }));
            setOsrmRoutes(newRoutes);
        };
        fetchOsrmRoutes();
    }, [liveDrivers, orders]);

    // Fetch API Functions
    const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/products?userId=${userId}`);
            setProducts(res.data);
        } catch (error) {
            console.error('Error fetching products', error);
        } finally {
            setLoadingProducts(false);
        }
    };

    const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
            // Purchases WHERE this SubStokis acts as the BUYER
            const purchasesRes = await axios.get(`http://localhost:5000/api/orders?buyerId=${userId}`);
            // Sales WHERE this SubStokis acts as the SELLER
            const salesRes = await axios.get(`http://localhost:5000/api/orders?stokisId=${userId}`);

            // Combine them and sort descending
            const combinedOrders = [...purchasesRes.data, ...salesRes.data].sort((a, b) => new Date(b.date) - new Date(a.date));
            setOrders(combinedOrders);
        } catch (error) {
            console.error('Error fetching orders', error);
        } finally {
            setLoadingOrders(false);
        }
    };

    const fetchTeam = async () => {
        setLoadingTeam(true);
        try {
            // Team where this SubStokis is the parent
            const res = await axios.get(`http://localhost:5000/api/team?parentId=${userId}`);
            setTeam(res.data);
        } catch (error) {
            console.error('Error fetching team', error);
        } finally {
            setLoadingTeam(false);
        }
    };

    const fetchStokisProducts = async () => {
        setLoadingStokisProducts(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/products?userId=${parentId}&buyerId=${userId}`);
            setStokisProducts(res.data);
        } catch (error) {
            console.error('Error fetching parent stokis products', error);
        } finally {
            setLoadingStokisProducts(false);
        }
    };

    const fetchProfile = async () => {
        setLoadingProfile(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/user/${userId}`);
            setProfile(res.data);
        } catch (error) {
            console.error('Error fetching profile', error);
        } finally {
            setLoadingProfile(false);
        }
    };

    const fetchVisitMarkers = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/visits?stokisId=${userId}`);
            setVisitMarkers(res.data || []);
        } catch (err) {
            console.error('Gagal memuat data kunjungan', err);
        }
    };

    const fetchCommissionData = async (salesIdParam) => {
        setCommLoading(true);
        const sid = salesIdParam !== undefined ? salesIdParam : selectedSalesId;
        try {
            const salesIdQuery = sid ? `&salesId=${sid}` : '';
            const [prodRes, campRes, teamRes] = await Promise.all([
                axios.get(`http://localhost:5000/api/commission-configs?stokisId=${userId}${salesIdQuery}`),
                axios.get(`http://localhost:5000/api/commission-campaigns?stokisId=${userId}`),
                axios.get(`http://localhost:5000/api/team?parentId=${userId}`),
            ]);
            setCommProducts(prodRes.data);
            const pc = {};
            prodRes.data.forEach(p => {
                const cfg = p.commissionConfigs && p.commissionConfigs[0];
                pc[p.id] = { isActive: cfg ? cfg.isActive : false, commissionType: cfg ? cfg.commissionType : 'CUMULATIVE' };
            });
            setPendingConfigs(pc);
            setCommCampaigns(campRes.data);
            setCommSalesTeam((teamRes.data || []).filter(m => m.role === 'SALES'));
        } catch (err) {
            console.error('Gagal memuat data komisi', err);
        } finally {
            setCommLoading(false);
        }
    };

    const saveCommissionConfigs = async () => {
        const configs = Object.entries(pendingConfigs).map(([productId, v]) => ({
            productId: parseInt(productId), isActive: v.isActive, commissionType: v.commissionType
        }));
        try {
            await axios.post('http://localhost:5000/api/commission-configs/save', { stokisId: userId, salesId: selectedSalesId, configs });
            MySwal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Konfigurasi komisi default berhasil disimpan.', timer: 1800, showConfirmButton: false });
        } catch {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak bisa menyimpan konfigurasi komisi.' });
        }
    };

    const openNewCampaign = () => {
        setEditingCampaign(null);
        setCampaignForm({ name: '', description: '', isActive: true, combineWithDefault: true, startDate: '', endDate: '', items: [], salesId: null });
        setShowCampaignModal(true);
    };

    const openEditCampaign = (c) => {
        setEditingCampaign(c);
        setCampaignForm({
            name: c.name, description: c.description || '', isActive: c.isActive,
            combineWithDefault: c.combineWithDefault,
            startDate: c.startDate ? c.startDate.slice(0, 10) : '',
            endDate: c.endDate ? c.endDate.slice(0, 10) : '',
            items: c.items.map(i => ({ productId: i.productId, amountType: i.amountType, amount: i.amount, productName: i.product ? i.product.name : '' })),
            salesId: c.salesId || null
        });
        setShowCampaignModal(true);
    };

    const saveCampaign = async () => {
        if (!campaignForm.name.trim()) { MySwal.fire({ icon: 'warning', title: 'Nama kampanye wajib diisi' }); return; }
        if (campaignForm.items.length === 0) { MySwal.fire({ icon: 'warning', title: 'Tambahkan minimal 1 produk ke kampanye' }); return; }
        try {
            const payload = { ...campaignForm, stokisId: userId };
            if (editingCampaign) {
                await axios.put(`http://localhost:5000/api/commission-campaigns/${editingCampaign.id}`, payload);
            } else {
                await axios.post('http://localhost:5000/api/commission-campaigns', payload);
            }
            setShowCampaignModal(false);
            fetchCommissionData();
            MySwal.fire({ icon: 'success', title: editingCampaign ? 'Kampanye diperbarui!' : 'Kampanye dibuat!', timer: 1800, showConfirmButton: false });
        } catch {
            MySwal.fire({ icon: 'error', title: 'Gagal menyimpan kampanye' });
        }
    };

    const toggleCampaign = async (id) => {
        try {
            await axios.patch(`http://localhost:5000/api/commission-campaigns/${id}/toggle`);
            fetchCommissionData();
        } catch {
            MySwal.fire({ icon: 'error', title: 'Gagal mengubah status kampanye' });
        }
    };

    const deleteCampaign = async (id) => {
        const result = await MySwal.fire({ title: 'Hapus kampanye?', text: 'Tindakan ini tidak bisa dibatalkan.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Hapus', cancelButtonText: 'Batal' });
        if (!result.isConfirmed) return;
        try {
            await axios.delete(`http://localhost:5000/api/commission-campaigns/${id}`);
            fetchCommissionData();
        } catch {
            MySwal.fire({ icon: 'error', title: 'Gagal menghapus kampanye' });
        }
    };

    const addCampaignItem = (productId, productName) => {
        if (campaignForm.items.find(i => i.productId === productId)) return;
        setCampaignForm(f => ({ ...f, items: [...f.items, { productId, productName, amountType: 'FLAT', amount: '' }] }));
    };

    const removeCampaignItem = (productId) => {
        setCampaignForm(f => ({ ...f, items: f.items.filter(i => i.productId !== productId) }));
    };

    const updateCampaignItem = (productId, field, value) => {
        setCampaignForm(f => ({ ...f, items: f.items.map(i => i.productId === productId ? { ...i, [field]: value } : i) }));
    };

    // WebSocket for Driver Tracking
    useEffect(() => {
        const socket = io('http://localhost:5000');

        socket.on('driverLocationUpdate', (data) => {
            setLiveDrivers(prev => ({
                ...prev,
                [data.driverId]: { lat: data.lat, lng: data.lng, name: data.name }
            }));
        });

        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        if (!userId) {
            navigate('/login');
            return;
        }

        if (activeTab === 'Overview') {
            fetchProducts();
            fetchOrders();
            fetchTeam();
        } else if (activeTab === 'Produk (Katalog)') {
            fetchProducts();
        } else if (activeTab === 'Purchasing Stokis') {
            fetchStokisProducts();
        } else if (activeTab === 'Manajemen Tim') {
            fetchTeam();
        } else if (activeTab === 'Pengaturan Toko' || activeTab === 'Profil Bisnis') {
            fetchProfile();
        } else if (activeTab === 'Distribusi') {
            fetchOrders();
            fetchTeam();
        } else if (activeTab === 'Kunjungan Sales') {
            fetchVisitMarkers();
        } else if (activeTab === 'Komisi Sales') {
            fetchCommissionData();
        }
    }, [activeTab]);

    // Fetch profile on mount
    useEffect(() => {
        fetchProfile();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        navigate('/login');
    };

    const navigation = [
        {
            category: 'Dashboard',
            items: [
                { name: 'Overview', icon: <Activity size={18} /> },
                { name: 'Keuangan', icon: <Wallet size={18} /> },
                { name: 'Laporan', icon: <BarChart3 size={18} /> },
            ]
        },
        {
            category: 'Logistik & Stok',
            items: [
                { name: 'Produk & Harga', icon: <Diamond size={18} /> },
                { name: 'Purchasing Stokis', icon: <ShoppingCart size={18} /> },
                { name: 'Distribusi', icon: <Truck size={18} /> },
            ]
        },
        {
            category: 'Jaringan & SDM',
            items: [
                { name: 'Manajemen Tim', icon: <Users size={18} /> },
                { name: 'Manajemen Tier & Pelanggan', icon: <Layers size={18} /> },
                { name: 'Kunjungan Sales', icon: <MapPin size={18} /> },
                { name: 'Komisi Sales', icon: <Gift size={18} /> },
            ]
        },
        {
            category: 'Preferensi',
            items: [
                { name: 'Pengaturan Toko', icon: <Settings size={18} /> },
            ]
        }
    ];

    // States for Editing Product Pricing
    const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formTiers, setFormTiers] = useState([{ level_name: 'Harga Konsumen', price: '', commission: '' }]);

    const openEditProductModal = (product) => {
        setEditingProduct(product);
        if (product.priceTiers && product.priceTiers.length > 0) {
            setFormTiers(product.priceTiers.map(t => ({
                level_name: t.level_name, price: t.price, commission: t.commission
            })));
        } else {
            setFormTiers([{ level_name: 'Harga Umum', price: '', commission: '' }]);
        }
        setIsEditProductModalOpen(true);
    };

    const handleTierChange = (index, field, value) => {
        const updatedTiers = [...formTiers];
        updatedTiers[index][field] = value;
        setFormTiers(updatedTiers);
    };

    const handleAddTierRow = () => {
        setFormTiers([...formTiers, { level_name: '', price: '', commission: '' }]);
    };

    const handleRemoveTierRow = (index) => {
        setFormTiers(formTiers.filter((_, i) => i !== index));
    };

    const submitProductEdit = async () => {
        try {
            const payload = {
                name: editingProduct.name, // keep original
                stock: editingProduct.stock, // keep original
                userId: userId,
                priceTiers: formTiers.filter(t => t.level_name)
            };
            await axios.put(`http://localhost:5000/api/products/${editingProduct.id}`, payload);
            MySwal.fire({
                icon: 'success', title: 'Berhasil!', text: 'Sistem Harga & Komisi produk Anda telah diperbarui.',
                background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false
            });
            setIsEditProductModalOpen(false);
            fetchProducts();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message, background: 'var(--bg-card)', color: 'var(--text-main)' });
        }
    };

    // --- PURCHASE STOKIS HANDLERS ---
    const handleAddToCart = (product, qtyStr) => {
        const qty = parseInt(qtyStr);
        if (isNaN(qty) || qty <= 0) return;

        // Cari Harga sesuai tier yang ditentukan oleh Stokis Utama
        const override = product.userPriceTiers?.[0];
        const targetLevel = override ? override.level_name : myPriceLevel;
        let targetTier = product.priceTiers?.find(t => t.level_name.toLowerCase() === targetLevel.toLowerCase());
        if (!targetTier) targetTier = product.priceTiers && product.priceTiers[0];

        const price = targetTier ? targetTier.price : 50000; // default 50rb jika belum ada

        const existingItem = purchaseCart.find(i => i.productId === product.id);

        if (existingItem) {
            setPurchaseCart(purchaseCart.map(i =>
                i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i
            ));
        } else {
            setPurchaseCart([...purchaseCart, {
                productId: product.id,
                code: product.code,
                name: product.name,
                quantity: qty,
                price: price
            }]);
        }

        MySwal.fire({
            toast: true, position: 'top-end', icon: 'success', title: `+${qty} ${product.code} di Keranjang!`,
            showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-main)'
        });
    };

    const removeFromCart = (productId) => {
        setPurchaseCart(purchaseCart.filter(i => i.productId !== productId));
    };

    const submitPurchaseOrder = async () => {
        if (purchaseCart.length === 0) return;

        const result = await MySwal.fire({
            title: 'Kirim Purchase Order?',
            text: `Anda akan membeli ${purchaseCart.length} SKU Barang ke Stokis Pusat`,
            icon: 'question',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showCancelButton: true,
            confirmButtonColor: 'var(--primary)',
            cancelButtonColor: 'var(--bg-hover)',
            confirmButtonText: 'Proses Pesanan',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                // Post order to Phase 1 backend schema where Sub-Stokis is the Buyer, Stokis Utama is Stokis
                await axios.post('http://localhost:5000/api/orders', {
                    buyerId: userId,
                    stokisId: parentId,
                    items: purchaseCart.map(c => ({
                        productId: c.productId,
                        quantity: c.quantity,
                        price: c.price
                    }))
                });

                MySwal.fire({
                    icon: 'success', title: 'PO Sedang Diproses Pekerja Gudang!', text: 'Order telah diteruskan ke Stokis Utama. Silakan pantau di Status Pengiriman.',
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 3000, showConfirmButton: false
                });

                setPurchaseCart([]);
                setIsCartModalOpen(false);
                fetchStokisProducts(); // refresh remaining stock
            } catch (err) {
                MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message, background: 'var(--bg-card)', color: 'var(--text-main)' });
            }
        }
    };


    // States for Team Management
    const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [formTeam, setFormTeam] = useState({ name: '', email: '', password: '', role: 'SALES', contact: '', address: '' });

    const openAddTeamModal = () => {
        setEditingTeamId(null);
        setFormTeam({ name: '', email: '', password: '', role: 'SALES', contact: '', address: '' });
        setIsAddTeamModalOpen(true);
    };

    const handleEditTeam = (member) => {
        setEditingTeamId(member.id);
        setFormTeam({
            name: member.name, email: member.email, password: '', role: member.role,
            contact: member.contact || '', address: member.address || ''
        });
        setIsAddTeamModalOpen(true);
    };

    const submitTeam = async () => {
        if (!formTeam.name || !formTeam.email || (!editingTeamId && !formTeam.password)) {
            return MySwal.fire({ icon: 'error', title: 'Data Tidak Lengkap', text: 'Nama, Email, dan Password wajib diisi!', background: 'var(--bg-card)', color: 'var(--text-main)' });
        }

        try {
            if (editingTeamId) {
                // Hapus password jika kosong (jangan diupdate)
                const payload = { ...formTeam };
                if (!payload.password) delete payload.password;
                await axios.put(`http://localhost:5000/api/team/${editingTeamId}`, payload);
                MySwal.fire({
                    icon: 'success', title: 'Berhasil!', text: `Akses ${formTeam.role} diperbarui.`,
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false
                });
            } else {
                await axios.post('http://localhost:5000/api/team', { ...formTeam, parent_id: userId });
                MySwal.fire({
                    icon: 'success', title: 'Berhasil!', text: `Akun ${formTeam.role} tim Anda berhasil diterbitkan.`,
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false
                });
            }

            setIsAddTeamModalOpen(false);
            setEditingTeamId(null);
            fetchTeam();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message, background: 'var(--bg-card)', color: 'var(--text-main)' });
        }
    };

    const handleDeleteTeam = async (id, name, role) => {
        const result = await MySwal.fire({
            title: `Copot Akses ${role}?`,
            text: `Anda yakin ingin menghapus sistem akses untuk "${name}" secara permanen?`,
            icon: 'warning',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: 'var(--bg-hover)',
            confirmButtonText: 'Ya, Copot!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`http://localhost:5000/api/team/${id}`);
                MySwal.fire({
                    icon: 'success', title: 'Terhapus!', text: `Akses ${name} telah dicabut dari sistem Cabang.`,
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2000, showConfirmButton: false
                });
                fetchTeam();
            } catch (err) {
                MySwal.fire({ icon: 'error', title: 'Gagal Menghapus', text: err.response?.data?.message || err.message, background: 'var(--bg-card)' });
            }
        }
    };

    const openPricingModal = async (user) => {
        setPricingTargetUser(user);
        setIsPricingModalOpen(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/team/${user.id}/pricing`);
            setPricingOverrides(res.data);
        } catch (error) {
            console.error(error);
            setPricingOverrides([]);
        }
    };

    const handlePricingChange = (productId, level_name) => {
        setPricingOverrides(prev => {
            const existing = prev.find(p => p.productId === productId);
            if (existing) {
                return prev.map(p => p.productId === productId ? { ...p, level_name } : p);
            } else {
                return [...prev, { productId, level_name }];
            }
        });
    };

    const savePricingOverrides = async () => {
        try {
            await axios.post(`http://localhost:5000/api/team/${pricingTargetUser.id}/pricing`, {
                pricingOverrides: pricingOverrides.filter(p => p.level_name)
            });
            MySwal.fire({
                toast: true, position: 'top-end', icon: 'success', title: `Harga spesifik ${pricingTargetUser.name} tersimpan!`,
                showConfirmButton: false, timer: 2000, background: 'var(--bg-card)', color: 'var(--text-main)'
            });
            setIsPricingModalOpen(false);
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat menyimpan hak harga spesifik.', background: 'var(--bg-card)' });
        }
    };

    const handleUpdateProfile = async () => {
        setLoadingProfile(true);
        try {
            await axios.put(`http://localhost:5000/api/user/${userId}`, {
                name: profile.name,
                email: profile.email,
                address: profile.address,
                store_name: profile.store_name,
                contact: profile.contact,
                latitude: profile.latitude !== '' ? parseFloat(profile.latitude) : null,
                longitude: profile.longitude !== '' ? parseFloat(profile.longitude) : null,
            });
            MySwal.fire({
                icon: 'success', title: 'Profil Diperbarui', text: 'Informasi cabang Anda telah berhasil disimpan.',
                background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2000, showConfirmButton: false
            });
            fetchProfile();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat memperbarui profil cabang.', background: 'var(--bg-card)' });
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        const { value: newPassword } = await MySwal.fire({
            title: 'Ganti Password Akun',
            input: 'password',
            inputLabel: 'Masukkan Password Baru',
            inputPlaceholder: 'Minimal 6 karakter',
            showCancelButton: true,
            background: 'var(--bg-card)', color: 'var(--text-main)',
            inputAttributes: {
                autocapitalize: 'off',
                autocorrect: 'off'
            }
        });

        if (newPassword) {
            if (newPassword.length < 6) return MySwal.fire({ icon: 'warning', title: 'Terlalu Pendek', text: 'Password minimal 6 karakter.', background: 'var(--bg-card)' });
            try {
                await axios.put(`http://localhost:5000/api/team/${userId}`, {
                    ...profile,
                    password: newPassword,
                    role: 'SUBSTOKIS'
                });
                MySwal.fire({ icon: 'success', title: 'Berhasil', text: 'Password anda telah diperbarui.', background: 'var(--bg-card)' });
            } catch (err) {
                MySwal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat mengubah password saat ini.', background: 'var(--bg-card)' });
            }
        }
    };

    const handleUpdateOrderStatus = async (orderId, status, driverId = null) => {
        try {
            await axios.put(`http://localhost:5000/api/orders/${orderId}`, { status, driverId });
            MySwal.fire({
                toast: true, position: 'top-end', icon: 'success', title: `Status Pesanan Diperbarui!`,
                showConfirmButton: false, timer: 2000, background: 'var(--bg-card)', color: 'var(--text-main)'
            });
            fetchOrders();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat memperbarui status pesanan.', background: 'var(--bg-card)' });
        }
    };

    const renderContent = () => {
        if (activeTab === 'Overview') {
            // Hitung Statistik
            const mySales = orders.filter(o => o.stokisId === userId);
            const totalRevenue = mySales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            const totalStock = products.reduce((acc, curr) => acc + (curr.stock || 0), 0);
            const salesCount = team.filter(t => t.role === 'SALES').length;
            const driverCount = team.filter(t => t.role === 'DRIVER').length;
            const pendingOrders = orders.filter(o => o.stokisId === userId && o.status === 'PENDING').length;

            return (
                <div className="animate-fade-up">
                    <style>{`
                        .sub-ov-welcome { background:linear-gradient(135deg,rgba(99,102,241,.12) 0%,rgba(168,85,247,.08) 100%); border:1.5px solid rgba(129,140,248,.2); border-radius:16px; padding:1.5rem 1.75rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; }
                        .sub-ov-welcome-title { font-size:1.2rem; font-weight:800; margin:0 0 .3rem; }
                        .sub-ov-welcome-sub { font-size:.82rem; color:var(--text-muted); }
                        .sub-ov-badge { display:inline-flex; align-items:center; gap:.4rem; padding:.35rem .85rem; border-radius:20px; background:rgba(99,102,241,.15); border:1px solid rgba(129,140,248,.3); color:#818cf8; font-size:.75rem; font-weight:700; }
                        .sub-ov-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin-bottom:1.5rem; }
                        @media(max-width:900px){ .sub-ov-stats{ grid-template-columns:repeat(2,1fr); } }
                        .sub-ov-stat { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.1rem 1.25rem; display:flex; align-items:center; gap:.9rem; }
                        .sub-ov-stat-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .sub-ov-stat-icon.green { background:rgba(34,197,94,.12); color:#22c55e; }
                        .sub-ov-stat-icon.blue  { background:rgba(59,130,246,.12); color:#3b82f6; }
                        .sub-ov-stat-icon.amber { background:rgba(245,158,11,.12); color:#f59e0b; }
                        .sub-ov-stat-icon.red   { background:rgba(239,68,68,.12);  color:#ef4444; }
                        .sub-ov-stat-icon.indigo{ background:rgba(99,102,241,.12); color:#6366f1; }
                        .sub-ov-stat-label { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-bottom:.25rem; }
                        .sub-ov-stat-value { font-size:1.15rem; font-weight:800; font-family:'Courier New',monospace; }
                        .sub-ov-stat-sub { font-size:.7rem; color:var(--text-muted); margin-top:.15rem; }
                        .sub-ov-2col { display:grid; grid-template-columns:1.2fr 1fr; gap:1.25rem; }
                        @media(max-width:800px){ .sub-ov-2col{ grid-template-columns:1fr; } }
                        .sub-ov-panel { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.25rem; }
                        .sub-ov-panel-title { font-size:.9rem; font-weight:800; margin:0 0 .9rem; display:flex; align-items:center; gap:.5rem; }
                        .sub-ov-panel-title span.icon { width:28px; height:28px; background:rgba(99,102,241,.1); color:#818cf8; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; }
                        .sub-ov-activity-row { display:flex; align-items:center; gap:.75rem; padding:.7rem .75rem; border-radius:9px; border:1.5px solid var(--border-color); margin-bottom:.6rem; background:rgba(255,255,255,.01); transition:border-color .15s; }
                        .sub-ov-activity-row:last-child { margin-bottom:0; }
                        .sub-ov-activity-row:hover { border-color:#6366f1; }
                        .sub-ov-activity-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
                        .sub-ov-activity-type { font-size:.73rem; font-weight:700; }
                        .sub-ov-activity-inv { font-size:.65rem; color:var(--text-muted); font-family:'Courier New',monospace; margin-top:.1rem; }
                        .sub-ov-activity-amount { font-size:.78rem; font-weight:800; font-family:'Courier New',monospace; margin-left:auto; white-space:nowrap; }
                        .sub-ov-qa-btn { display:flex; flex-direction:column; align-items:center; gap:.4rem; padding:1rem .5rem; border-radius:12px; border:1.5px solid var(--border-color); background:var(--bg-card); cursor:pointer; transition:border-color .18s,background .18s; }
                        .sub-ov-qa-btn:hover { border-color:#6366f1; background:rgba(99,102,241,.05); }
                        .sub-ov-qa-btn span { font-size:.7rem; font-weight:700; text-align:center; }
                    `}</style>

                    {/* Welcome banner */}
                    <div className="sub-ov-welcome">
                        <div>
                            <div className="sub-ov-welcome-title">Selamat datang, {profile.name || 'Manager Cabang'} ðŸ‘‹</div>
                            <div className="sub-ov-welcome-sub">{profile.store_name || 'Sub-Stokis'} Â· Ringkasan operasional cabang Anda hari ini.</div>
                        </div>
                        <div className="sub-ov-badge"><Activity size={13} /> Cabang Aktif</div>
                    </div>

                    {/* Stat cards */}
                    <div className="sub-ov-stats">
                        <div className="sub-ov-stat">
                            <div className="sub-ov-stat-icon green"><TrendingUp size={20} /></div>
                            <div>
                                <div className="sub-ov-stat-label">Omzet Penjualan</div>
                                <div className="sub-ov-stat-value">Rp {totalRevenue.toLocaleString('id-ID')}</div>
                                <div className="sub-ov-stat-sub">{mySales.length} transaksi</div>
                            </div>
                        </div>
                        <div className="sub-ov-stat">
                            <div className="sub-ov-stat-icon blue"><Package size={20} /></div>
                            <div>
                                <div className="sub-ov-stat-label">Sisa Stok</div>
                                <div className="sub-ov-stat-value">{totalStock.toLocaleString('id-ID')}</div>
                                <div className="sub-ov-stat-sub">{products.length} SKU</div>
                            </div>
                        </div>
                        <div className="sub-ov-stat">
                            <div className="sub-ov-stat-icon amber"><Users size={20} /></div>
                            <div>
                                <div className="sub-ov-stat-label">Tim Lapangan</div>
                                <div className="sub-ov-stat-value">{salesCount + driverCount}</div>
                                <div className="sub-ov-stat-sub">{salesCount} Sales Â· {driverCount} Driver</div>
                            </div>
                        </div>
                        <div className="sub-ov-stat">
                            <div className={`sub-ov-stat-icon ${pendingOrders > 0 ? 'red' : 'indigo'}`}><Clock size={20} /></div>
                            <div>
                                <div className="sub-ov-stat-label">Order Pending</div>
                                <div className="sub-ov-stat-value">{pendingOrders}</div>
                                <div className="sub-ov-stat-sub">{pendingOrders > 0 ? 'Segera diproses' : 'Semua lancar'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="sub-ov-2col">
                        {/* Recent activity */}
                        <div className="sub-ov-panel">
                            <div className="sub-ov-panel-title">
                                <span className="icon"><Activity size={13} /></span>
                                Aktivitas Terkini
                            </div>
                            {orders.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '.83rem' }}>Belum ada aktivitas.</div>
                            ) : orders.slice(0, 5).map(o => {
                                const isSale = o.stokisId === userId;
                                return (
                                    <div className="sub-ov-activity-row" key={o.id}>
                                        <div className="sub-ov-activity-dot" style={{ background: isSale ? '#22c55e' : '#ef4444' }}></div>
                                        <div>
                                            <div className="sub-ov-activity-type">{isSale ? 'PENJUALAN' : 'PO GUDANG'}</div>
                                            <div className="sub-ov-activity-inv">{o.invoice_id} Â· {new Date(o.date).toLocaleDateString('id-ID')}</div>
                                        </div>
                                        <div className="sub-ov-activity-amount" style={{ color: isSale ? '#22c55e' : 'var(--text-primary)' }}>
                                            {isSale ? '+' : '-'}Rp {o.total_amount.toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Quick Actions */}
                        <div className="sub-ov-panel">
                            <div className="sub-ov-panel-title">
                                <span className="icon"><Zap size={13} /></span>
                                Navigasi Cepat
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '.75rem' }}>
                                {[
                                    { tab: 'Produk & Harga', icon: <Diamond size={20} color="#818cf8" />, label: 'Atur Harga Jual' },
                                    { tab: 'Purchasing Stokis', icon: <ShoppingCart size={20} color="#22c55e" />, label: 'Beli Stok ke Pusat' },
                                    { tab: 'Manajemen Tim', icon: <Users size={20} color="#3b82f6" />, label: 'Kelola Driver/Sales' },
                                    { tab: 'Distribusi', icon: <Truck size={20} color="#f59e0b" />, label: 'Monitor Pengiriman' },
                                ].map(qa => (
                                    <button key={qa.tab} className="sub-ov-qa-btn" onClick={() => setActiveTab(qa.tab)}>
                                        {qa.icon}
                                        <span>{qa.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'Produk & Harga') {
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .sph-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.75rem; flex-wrap:wrap; gap:1rem; }
                        .sph-header h2 { font-size:1.2rem; font-weight:800; margin:0 0 .25rem; }
                        .sph-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .sph-list-header { display:grid; grid-template-columns:110px 1fr 1fr 120px; gap:.75rem; padding:.4rem .75rem; margin-bottom:.5rem; }
                        .sph-list-header span { font-size:.67rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); }
                        .sph-item { display:grid; grid-template-columns:110px 1fr 1fr 120px; gap:.75rem; align-items:start; padding:.9rem .75rem; border-radius:12px; border:1.5px solid var(--border-color); margin-bottom:.65rem; background:var(--bg-card); transition:border-color .18s; }
                        .sph-item:last-child { margin-bottom:0; }
                        .sph-item:hover { border-color:#6366f1; }
                        .sph-sku { display:inline-block; font-size:.68rem; font-family:'Courier New',monospace; background:rgba(99,102,241,.1); color:#818cf8; border:1px solid rgba(99,102,241,.2); border-radius:6px; padding:.2rem .5rem; }
                        .sph-name { font-weight:700; font-size:.88rem; margin-bottom:.3rem; }
                        .sph-stock { font-size:.72rem; color:var(--text-muted); }
                        .sph-tiers { display:flex; flex-direction:column; gap:.4rem; }
                        .sph-tier-row { display:flex; justify-content:space-between; align-items:center; font-size:.78rem; padding:.35rem .6rem; border-radius:8px; border:1px solid var(--border-color); background:rgba(255,255,255,.01); }
                        .sph-tier-name { color:var(--text-muted); font-weight:600; }
                        .sph-tier-price { font-weight:700; font-family:'Courier New',monospace; }
                        .sph-tier-comm { color:#818cf8; font-size:.7rem; }
                        .sph-edit-btn { display:inline-flex; align-items:center; gap:.4rem; padding:.5rem .8rem; border-radius:9px; border:1.5px solid var(--border-color); background:transparent; color:var(--text-primary); font-size:.78rem; font-weight:700; cursor:pointer; transition:all .18s; white-space:nowrap; }
                        .sph-edit-btn:hover { border-color:#6366f1; color:#818cf8; background:rgba(99,102,241,.07); }
                        .sph-empty { text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:.85rem; border:1.5px dashed var(--border-color); border-radius:14px; }
                        .sph-warn { font-size:.73rem; color:#f59e0b; display:inline-flex; align-items:center; gap:.3rem; }
                    `}</style>

                    <div className="sph-header">
                        <div>
                            <h2>Produk & Skema Harga Cabang</h2>
                            <p>Kelola stok barang di gudang cabang dan tentukan harga jual serta komisi untuk sales Anda.</p>
                        </div>
                    </div>

                    <div className="sph-list-header">
                        <span>Kode SKU</span>
                        <span>Info Produk</span>
                        <span>Tier Harga & Komisi</span>
                        <span>Aksi</span>
                    </div>

                    {loadingProducts ? (
                        <div className="sph-empty">Membaca daftar stok dari database...</div>
                    ) : products.length === 0 ? (
                        <div className="sph-empty">Gudang cabang Anda masih kosong. Lakukan Purchasing ke Stokis Utama.</div>
                    ) : (
                        products.map((p) => (
                            <div className="sph-item" key={p.id}>
                                <div><span className="sph-sku">{p.code}</span></div>
                                <div>
                                    <div className="sph-name">{p.name}</div>
                                    <div className="sph-stock">Sisa Stok: <strong style={{color:'var(--text-primary)'}}>{p.stock}</strong> Unit</div>
                                </div>
                                <div className="sph-tiers">
                                    {p.priceTiers?.length ? p.priceTiers.map((tier, idx) => (
                                        <div key={idx} className="sph-tier-row">
                                            <span className="sph-tier-name">{tier.level_name}</span>
                                            <span className="sph-tier-price">Rp {Number(tier.price).toLocaleString('id-ID')}</span>
                                            <span className="sph-tier-comm">Komisi Rp {Number(tier.commission).toLocaleString('id-ID')}</span>
                                        </div>
                                    )) : <span className="sph-warn"><AlertTriangle size={13} /> Belum ada harga jual</span>}
                                </div>
                                <div>
                                    <button className="sph-edit-btn" onClick={() => openEditProductModal(p)}><Edit3 size={13} /> Edit Harga</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            );
        }

        if (activeTab === 'Purchasing Stokis') {
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .spo-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.75rem; flex-wrap:wrap; gap:1rem; }
                        .spo-header h2 { font-size:1.2rem; font-weight:800; margin:0 0 .25rem; }
                        .spo-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .spo-cart-btn { display:inline-flex; align-items:center; gap:.5rem; padding:.6rem 1.2rem; border-radius:10px; background:linear-gradient(135deg,#059669,#10b981); color:#fff; border:none; font-size:.83rem; font-weight:700; cursor:pointer; transition:opacity .18s; }
                        .spo-cart-btn:hover { opacity:.88; }
                        .spo-cart-btn:disabled { opacity:.4; cursor:not-allowed; }
                        .spo-list-header { display:grid; grid-template-columns:100px 1fr 130px 160px; gap:.75rem; padding:.4rem .75rem; margin-bottom:.5rem; }
                        .spo-list-header span { font-size:.67rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); }
                        .spo-item { display:grid; grid-template-columns:100px 1fr 130px 160px; gap:.75rem; align-items:center; padding:.9rem .75rem; border-radius:12px; border:1.5px solid var(--border-color); margin-bottom:.65rem; background:var(--bg-card); transition:border-color .18s; }
                        .spo-item:last-child { margin-bottom:0; }
                        .spo-item:hover { border-color:#10b981; }
                        .spo-sku { display:inline-block; font-size:.68rem; font-family:'Courier New',monospace; background:rgba(59,130,246,.1); color:#3b82f6; border:1px solid rgba(59,130,246,.22); border-radius:6px; padding:.2rem .5rem; }
                        .spo-name { font-weight:700; font-size:.88rem; margin-bottom:.3rem; }
                        .spo-avail { font-size:.72rem; color:var(--text-muted); }
                        .spo-price { font-size:.95rem; font-weight:800; font-family:'Courier New',monospace; color:#10b981; }
                        .spo-price-sub { font-size:.7rem; color:var(--text-muted); margin-top:.15rem; }
                        .spo-order-wrap { display:flex; flex-direction:column; gap:.5rem; align-items:flex-start; }
                        .spo-qty-sel { padding:.4rem .6rem; border-radius:8px; border:1.5px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-size:.82rem; font-family:'Courier New',monospace; cursor:pointer; }
                        .spo-add-btn { display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .85rem; border-radius:8px; background:rgba(16,185,129,.12); color:#10b981; border:1.5px solid rgba(16,185,129,.25); font-size:.78rem; font-weight:700; cursor:pointer; transition:all .18s; white-space:nowrap; }
                        .spo-add-btn:hover { background:rgba(16,185,129,.22); }
                        .spo-empty { text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:.85rem; border:1.5px dashed var(--border-color); border-radius:14px; }
                    `}</style>

                    <div className="spo-header">
                        <div>
                            <h2>Katalog Pembelian (PO Gudang Pusat)</h2>
                            <p>Belanja barang dari distributor Anda untuk menambah stok di gudang cabang secara real-time.</p>
                        </div>
                        <button className="spo-cart-btn" onClick={() => setIsCartModalOpen(true)} disabled={purchaseCart.length === 0}>
                            <ShoppingCart size={15} /> Keranjang PO ({purchaseCart.length})
                        </button>
                    </div>

                    <div className="spo-list-header">
                        <span>Kode SKU</span>
                        <span>Produk</span>
                        <span>Harga PO</span>
                        <span>Order Stok</span>
                    </div>

                    {loadingStokisProducts ? (
                        <div className="spo-empty">Membuka lemari Pusat...</div>
                    ) : stokisProducts.length === 0 ? (
                        <div className="spo-empty">Belum ada barang di Stokis Pusat / Gudang mereka kosong.</div>
                    ) : (
                        stokisProducts.map((p) => {
                            const override = p.userPriceTiers?.[0];
                            const targetLevel = override ? override.level_name : myPriceLevel;
                            let modalHargaSubstokis = p.priceTiers?.find(t => t.level_name.toLowerCase() === targetLevel.toLowerCase());
                            if (!modalHargaSubstokis) modalHargaSubstokis = p.priceTiers && p.priceTiers[0];
                            const hargaPO = modalHargaSubstokis ? modalHargaSubstokis.price : 50000;
                            return (
                                <div className="spo-item" key={p.id}>
                                    <div><span className="spo-sku">{p.code}</span></div>
                                    <div>
                                        <div className="spo-name">{p.name}</div>
                                        <div className="spo-avail">Tersedia: <strong style={{color:'var(--text-primary)'}}>{p.stock}</strong> Unit</div>
                                    </div>
                                    <div>
                                        <div className="spo-price">Rp {Number(hargaPO).toLocaleString('id-ID')}</div>
                                        <div className="spo-price-sub">/ Unit ({targetLevel})</div>
                                    </div>
                                    <div className="spo-order-wrap">
                                        <select id={`qty-${p.id}`} className="spo-qty-sel" defaultValue="10">
                                            <option value="5">5 Unit</option>
                                            <option value="10">10 Unit</option>
                                            <option value="50">50 Unit</option>
                                            <option value="100">100 Unit</option>
                                        </select>
                                        <button className="spo-add-btn" onClick={() => handleAddToCart(p, document.getElementById(`qty-${p.id}`).value)}>
                                            <ShoppingCart size={13} /> Masukkan
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            );
        }

        if (activeTab === 'Manajemen Tier & Pelanggan') {
            const customerTeam = team.filter(t => ['KONSUMEN', 'MEMBER'].includes(t.role));
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .scust-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.75rem; flex-wrap:wrap; gap:1rem; }
                        .scust-header h2 { font-size:1.2rem; font-weight:800; margin:0 0 .25rem; }
                        .scust-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .scust-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:1.5rem; }
                        @media(max-width:700px){ .scust-stats{ grid-template-columns:1fr; } }
                        .scust-stat { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:12px; padding:1rem 1.2rem; display:flex; align-items:center; gap:.85rem; }
                        .scust-stat-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .scust-stat-icon.amber  { background:rgba(245,158,11,.12);color:#f59e0b; }
                        .scust-stat-icon.green  { background:rgba(16,185,129,.12); color:#10b981; }
                        .scust-stat-icon.indigo { background:rgba(99,102,241,.12); color:#6366f1; }
                        .scust-stat-label { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); }
                        .scust-stat-value { font-size:1.3rem; font-weight:800; margin-top:.15rem; }
                        .scust-list-header { display:grid; grid-template-columns:1fr 120px 1fr 160px; gap:.75rem; padding:.3rem .75rem; margin-bottom:.5rem; }
                        .scust-list-header span { font-size:.67rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); }
                        .scust-row { display:grid; grid-template-columns:1fr 120px 1fr 160px; gap:.75rem; align-items:center; padding:.85rem .75rem; border-radius:12px; border:1.5px solid var(--border-color); margin-bottom:.6rem; background:var(--bg-card); transition:border-color .18s; }
                        .scust-row:hover { border-color:#818cf8; }
                        .scust-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:.78rem; border:2px solid; flex-shrink:0; }
                        .scust-name { font-weight:700; font-size:.88rem; margin-left:.65rem; }
                        .scust-email { font-size:.7rem; color:var(--text-muted); font-family:'Courier New',monospace; }
                        .scust-role-badge { display:inline-block; font-size:.68rem; font-weight:700; border-radius:20px; padding:.2rem .6rem; border:1px solid; }
                        .scust-contact { font-size:.78rem; }
                        .scust-addr { font-size:.7rem; color:var(--text-muted); margin-top:.1rem; }
                        .scust-actions { display:flex; flex-direction:column; gap:.4rem; align-items:flex-end; }
                        .scust-btn-price { padding:.35rem .75rem; border-radius:7px; border:none; background:linear-gradient(135deg,#4338ca,#818cf8); color:#fff; font-size:.73rem; font-weight:700; cursor:pointer; }
                        .scust-btn-edit { padding:.35rem .75rem; border-radius:7px; border:1.5px solid var(--border-color); background:transparent; font-size:.73rem; font-weight:700; cursor:pointer; color:var(--text-primary); transition:all .18s; }
                        .scust-btn-edit:hover { border-color:#818cf8; color:#818cf8; }
                        .scust-empty { text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:.85rem; border:1.5px dashed var(--border-color); border-radius:14px; }
                    `}</style>

                    <div className="scust-header">
                        <div>
                            <h2>Data & Pemetaan Harga Pelanggan</h2>
                            <p>Atur harga spesifik setiap produk untuk jaringan Konsumen dan Member Anda.</p>
                        </div>
                    </div>

                    <div className="scust-stats">
                        <div className="scust-stat">
                            <div className="scust-stat-icon amber"><Users size={18} /></div>
                            <div><div className="scust-stat-label">Konsumen</div><div className="scust-stat-value">{customerTeam.filter(t=>t.role==='KONSUMEN').length}</div></div>
                        </div>
                        <div className="scust-stat">
                            <div className="scust-stat-icon green"><Diamond size={18} /></div>
                            <div><div className="scust-stat-label">Member</div><div className="scust-stat-value">{customerTeam.filter(t=>t.role==='MEMBER').length}</div></div>
                        </div>
                        <div className="scust-stat">
                            <div className="scust-stat-icon indigo"><Layers size={18} /></div>
                            <div><div className="scust-stat-label">Total</div><div className="scust-stat-value">{customerTeam.length}</div></div>
                        </div>
                    </div>

                    <div className="scust-list-header">
                        <span>Identitas</span>
                        <span>Status</span>
                        <span>Kontak / Alamat</span>
                        <span style={{textAlign:'right'}}>Aksi</span>
                    </div>

                    {loadingTeam ? (
                        <div className="scust-empty">Sedang mengambil direktori pelanggan...</div>
                    ) : customerTeam.length === 0 ? (
                        <div className="scust-empty">Belum ada pelanggan atau member terdaftar di bawah cabang Anda.</div>
                    ) : (
                        customerTeam.map((t) => {
                            const roleColor = t.role === 'MEMBER' ? '#10b981' : '#f59e0b';
                            const roleBg = t.role === 'MEMBER' ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)';
                            return (
                                <div className="scust-row" key={t.id}>
                                    <div style={{display:'flex',alignItems:'center'}}>
                                        <div className="scust-avatar" style={{background:roleBg,color:roleColor,borderColor:`${roleColor}44`}}>
                                            {t.name.substring(0,2).toUpperCase()}
                                        </div>
                                        <div className="scust-name">
                                            <div>{t.name}</div>
                                            <div className="scust-email">{t.store_name || t.email}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="scust-role-badge" style={{color:roleColor,background:roleBg,borderColor:`${roleColor}44`}}>{t.role}</span>
                                    </div>
                                    <div>
                                        <div className="scust-contact">{t.contact || 'â€”'}</div>
                                        <div className="scust-addr">{t.address || 'â€”'}</div>
                                    </div>
                                    <div className="scust-actions">
                                        <button className="scust-btn-price" onClick={() => openPricingModal(t)}>Atur Harga</button>
                                        <button className="scust-btn-edit" onClick={() => handleEditTeam(t)}>Edit Akun</button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            );
        }

        if (activeTab === 'Manajemen Tim') {
            const salesTeam = team.filter(t => t.role === 'SALES');
            const driverTeam = team.filter(t => t.role === 'DRIVER');
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .stm-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
                        .stm-header h2 { font-size:1.2rem; font-weight:800; margin:0 0 .25rem; }
                        .stm-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .stm-add-btn { display:inline-flex; align-items:center; gap:.5rem; padding:.6rem 1.2rem; border-radius:10px; background:linear-gradient(135deg,#4338ca,#818cf8); color:#fff; border:none; font-size:.83rem; font-weight:700; cursor:pointer; transition:opacity .18s; }
                        .stm-add-btn:hover { opacity:.88; }
                        .stm-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:1.5rem; }
                        @media(max-width:700px){ .stm-stats{ grid-template-columns:1fr; } }
                        .stm-stat { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:12px; padding:1rem 1.2rem; display:flex; align-items:center; gap:.85rem; }
                        .stm-stat-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .stm-stat-icon.blue  { background:rgba(59,130,246,.12); color:#3b82f6; }
                        .stm-stat-icon.amber { background:rgba(245,158,11,.12); color:#f59e0b; }
                        .stm-stat-icon.indigo{ background:rgba(99,102,241,.12); color:#6366f1; }
                        .stm-stat-label { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); }
                        .stm-stat-value { font-size:1.3rem; font-weight:800; margin-top:.15rem; }
                        .stm-row { display:grid; grid-template-columns:auto 1fr 130px 200px 180px; gap:.75rem; align-items:center; padding:.9rem 1rem; border-radius:12px; border:1.5px solid var(--border-color); margin-bottom:.6rem; background:var(--bg-card); transition:border-color .18s; }
                        .stm-row:hover { border-color:#6366f1; }
                        .stm-avatar { width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:.88rem; border:2px solid; flex-shrink:0; }
                        .stm-name { font-weight:700; font-size:.88rem; }
                        .stm-email { font-size:.7rem; color:var(--text-muted); font-family:'Courier New',monospace; margin-top:.15rem; }
                        .stm-role-badge { display:inline-block; font-size:.68rem; font-weight:700; border-radius:20px; padding:.2rem .6rem; border:1px solid; }
                        .stm-contact { font-size:.78rem; }
                        .stm-addr { font-size:.7rem; color:var(--text-muted); margin-top:.15rem; }
                        .stm-actions { display:flex; flex-direction:column; gap:.4rem; align-items:flex-end; }
                        .stm-btn-edit { padding:.35rem .75rem; border-radius:7px; border:1.5px solid var(--border-color); background:transparent; font-size:.73rem; font-weight:700; cursor:pointer; color:var(--text-primary); transition:all .18s; }
                        .stm-btn-edit:hover { border-color:#818cf8; color:#818cf8; }
                        .stm-btn-del { padding:.35rem .75rem; border-radius:7px; border:1.5px solid rgba(239,68,68,.25); background:transparent; font-size:.73rem; font-weight:700; cursor:pointer; color:#ef4444; transition:all .18s; }
                        .stm-btn-del:hover { background:rgba(239,68,68,.08); }
                        .stm-empty { text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:.85rem; border:1.5px dashed var(--border-color); border-radius:14px; }
                        .stm-list-header { display:grid; grid-template-columns:auto 1fr 130px 200px 180px; gap:.75rem; padding:.3rem 1rem; margin-bottom:.5rem; }
                        .stm-list-header span { font-size:.67rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); }
                    `}</style>

                    <div className="stm-header">
                        <div>
                            <h2>Pasukan Lapangan Cabang</h2>
                            <p>Daftarkan Sales atau Driver agar mereka bisa login aplikasi di smartphone.</p>
                        </div>
                        <button className="stm-add-btn" onClick={openAddTeamModal}><Users size={15} /> Rekrut Personel</button>
                    </div>

                    {/* Stats */}
                    <div className="stm-stats">
                        <div className="stm-stat">
                            <div className="stm-stat-icon blue"><Users size={18} /></div>
                            <div><div className="stm-stat-label">Sales</div><div className="stm-stat-value">{salesTeam.length}</div></div>
                        </div>
                        <div className="stm-stat">
                            <div className="stm-stat-icon amber"><Truck size={18} /></div>
                            <div><div className="stm-stat-label">Driver</div><div className="stm-stat-value">{driverTeam.length}</div></div>
                        </div>
                        <div className="stm-stat">
                            <div className="stm-stat-icon indigo"><Activity size={18} /></div>
                            <div><div className="stm-stat-label">Total</div><div className="stm-stat-value">{team.length}</div></div>
                        </div>
                    </div>

                    <div className="stm-list-header">
                        <span style={{width:42}}></span>
                        <span>Identitas</span>
                        <span>Role</span>
                        <span>Kontak / Wilayah</span>
                        <span style={{textAlign:'right'}}>Aksi</span>
                    </div>

                    {loadingTeam ? (
                        <div className="stm-empty">Mencari data personel...</div>
                    ) : team.length === 0 ? (
                        <div className="stm-empty">Belum ada tim. Rekrut Sales atau Driver untuk memulai distribusi!</div>
                    ) : (
                        team.map(member => {
                            const isDriver = member.role === 'DRIVER';
                            const roleColor = isDriver ? '#f59e0b' : '#3b82f6';
                            const roleBg = isDriver ? 'rgba(245,158,11,.1)' : 'rgba(59,130,246,.1)';
                            return (
                                <div className="stm-row" key={member.id}>
                                    <div className="stm-avatar" style={{background:roleBg,color:roleColor,borderColor:`${roleColor}44`}}>
                                        {member.name.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="stm-name">{member.name}</div>
                                        <div className="stm-email">{member.email}</div>
                                    </div>
                                    <div>
                                        <span className="stm-role-badge" style={{color:roleColor,background:roleBg,borderColor:`${roleColor}44`}}>
                                            {isDriver ? 'ðŸšš Driver' : 'ðŸ’¼ Sales'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="stm-contact">{member.contact || 'â€”'}</div>
                                        <div className="stm-addr">{member.address || 'â€”'}</div>
                                    </div>
                                    <div className="stm-actions">
                                        <button className="stm-btn-edit" onClick={() => handleEditTeam(member)}>Edit Akun</button>
                                        <button className="stm-btn-del" onClick={() => handleDeleteTeam(member.id, member.name, member.role)}>Hapus Akun</button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            );
        }

        if (activeTab === 'Keuangan') {
            const mySales = orders.filter(o => o.stokisId === userId);
            const myPurchases = orders.filter(o => o.buyerId === userId && o.status === 'DELIVERED');

            const totalOmzet = mySales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            const totalCost = myPurchases.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            const profitEstimate = totalOmzet * 0.15;

            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .sfin-header { margin-bottom:1.75rem; }
                        .sfin-header h2 { font-size:1.2rem; font-weight:800; margin:0 0 .25rem; }
                        .sfin-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .sfin-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:1.75rem; }
                        @media(max-width:700px){ .sfin-stats{ grid-template-columns:1fr; } }
                        .sfin-stat { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.2rem 1.4rem; display:flex; align-items:center; gap:.9rem; }
                        .sfin-stat-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .sfin-stat-icon.green  { background:rgba(34,197,94,.12);  color:#22c55e; }
                        .sfin-stat-icon.blue   { background:rgba(59,130,246,.12); color:#3b82f6; }
                        .sfin-stat-icon.amber  { background:rgba(245,158,11,.12); color:#f59e0b; }
                        .sfin-stat-label { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-bottom:.25rem; }
                        .sfin-stat-value { font-size:1.1rem; font-weight:800; font-family:'Courier New',monospace; }
                        .sfin-stat-sub { font-size:.7rem; color:var(--text-muted); margin-top:.15rem; }
                        .sfin-panel { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.4rem; }
                        .sfin-panel-title { font-size:.92rem; font-weight:800; margin-bottom:1rem; display:flex; align-items:center; gap:.5rem; }
                        .sfin-item { display:grid; grid-template-columns:130px 100px 1fr 130px 150px; gap:.75rem; align-items:center; padding:.7rem .75rem; border-radius:10px; border:1.5px solid var(--border-color); margin-bottom:.6rem; background:rgba(255,255,255,.01); transition:border-color .15s; }
                        .sfin-item:last-child { margin-bottom:0; }
                        .sfin-item:hover { border-color:#6366f1; }
                        .sfin-list-header { display:grid; grid-template-columns:130px 100px 1fr 130px 150px; gap:.75rem; padding:.3rem .75rem; margin-bottom:.5rem; }
                        .sfin-list-header span { font-size:.65rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); }
                        .sfin-inv { font-size:.7rem; font-family:'Courier New',monospace; color:var(--text-muted); }
                        .sfin-type { font-size:.78rem; font-weight:700; display:flex; align-items:center; gap:.4rem; }
                        .sfin-party { font-size:.78rem; }
                        .sfin-amount { font-size:.85rem; font-weight:800; font-family:'Courier New',monospace; text-align:right; }
                        .sfin-empty { text-align:center; padding:2rem; color:var(--text-muted); font-size:.85rem; }
                    `}</style>

                    <div className="sfin-header">
                        <h2>Laporan & Arus Kas Keuangan</h2>
                        <p>Pantau performa penjualan dan histori transaksi restock cabang Anda.</p>
                    </div>

                    <div className="sfin-stats">
                        <div className="sfin-stat">
                            <div className="sfin-stat-icon green"><TrendingUp size={20} /></div>
                            <div>
                                <div className="sfin-stat-label">Total Omzet Penjualan</div>
                                <div className="sfin-stat-value">Rp {totalOmzet.toLocaleString('id-ID')}</div>
                                <div className="sfin-stat-sub">{mySales.length} transaksi keluar</div>
                            </div>
                        </div>
                        <div className="sfin-stat">
                            <div className="sfin-stat-icon blue"><ShoppingCart size={20} /></div>
                            <div>
                                <div className="sfin-stat-label">Modal Pembelian Stok</div>
                                <div className="sfin-stat-value">Rp {totalCost.toLocaleString('id-ID')}</div>
                                <div className="sfin-stat-sub">Restock dari Stokis Pusat</div>
                            </div>
                        </div>
                        <div className="sfin-stat">
                            <div className="sfin-stat-icon amber"><Wallet size={20} /></div>
                            <div>
                                <div className="sfin-stat-label">Net Profit (Est.)</div>
                                <div className="sfin-stat-value" style={{color:'#f59e0b'}}>Rp {profitEstimate.toLocaleString('id-ID')}</div>
                                <div className="sfin-stat-sub">Estimasi ~15% margin</div>
                            </div>
                        </div>
                    </div>

                    <div className="sfin-panel">
                        <div className="sfin-panel-title"><CreditCard size={16} /> Histori Transaksi Finansial</div>
                        <div className="sfin-list-header">
                            <span>Tanggal</span>
                            <span>Invoice</span>
                            <span>Tipe</span>
                            <span>Pihak</span>
                            <span style={{textAlign:'right'}}>Nominal</span>
                        </div>
                        {orders.length === 0 ? (
                            <div className="sfin-empty">Belum ada mutasi keuangan terdeteksi.</div>
                        ) : (
                            orders.map((o) => {
                                const isSale = o.stokisId === userId;
                                return (
                                    <div className="sfin-item" key={o.id}>
                                        <div className="sfin-inv">{new Date(o.date).toLocaleDateString('id-ID')}</div>
                                        <div className="sfin-inv">{o.invoice_id}</div>
                                        <div className="sfin-type" style={{color: isSale ? '#22c55e' : '#ef4444'}}>
                                            {isSale ? <ArrowDownLeft size={13}/> : <ArrowUpRight size={13}/>}
                                            {isSale ? 'PENJUALAN' : 'RESTOCK'}
                                        </div>
                                        <div className="sfin-party">
                                            {isSale ? (o.buyer?.store_name || o.buyer?.name || 'Pelanggan') : (o.stokis?.name || 'Gudang Pusat')}
                                        </div>
                                        <div className="sfin-amount" style={{color: isSale ? '#22c55e' : 'var(--text-primary)'}}>
                                            {isSale ? '+' : '-'} Rp {o.total_amount.toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            );
        }

        if (activeTab === 'Distribusi') {
            const myOrders = orders.filter(o => o.stokisId === userId);
            const myDrivers = team.filter(t => t.role === 'DRIVER');
            return (
                <div className="animate-fade-up">
                    <style>{`
                        .sdist-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
                        .sdist-header h2 { font-size:1.2rem; font-weight:800; margin:0 0 .25rem; }
                        .sdist-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .sdist-toggle { display:inline-flex; background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:10px; padding:3px; gap:3px; }
                        .sdist-toggle-btn { padding:.45rem 1rem; border-radius:8px; border:none; font-size:.78rem; font-weight:700; cursor:pointer; transition:all .18s; background:transparent; color:var(--text-muted); }
                        .sdist-toggle-btn.active { background:linear-gradient(135deg,#4338ca,#818cf8); color:#fff; }
                        .sdist-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin-bottom:1.5rem; }
                        @media(max-width:800px){ .sdist-stats{ grid-template-columns:repeat(2,1fr); } }
                        .sdist-stat { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:12px; padding:1rem 1.2rem; display:flex; align-items:center; gap:.75rem; }
                        .sdist-stat-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .sdist-stat-icon.amber  { background:rgba(245,158,11,.12); color:#f59e0b; }
                        .sdist-stat-icon.blue   { background:rgba(59,130,246,.12);  color:#3b82f6; }
                        .sdist-stat-icon.purple { background:rgba(139,92,246,.12);  color:#8b5cf6; }
                        .sdist-stat-icon.green  { background:rgba(34,197,94,.12);   color:#22c55e; }
                        .sdist-stat-label { font-size:.67rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); }
                        .sdist-stat-value { font-size:1.2rem; font-weight:800; margin-top:.1rem; }
                        .sdist-order { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:12px; padding:1rem; margin-bottom:.75rem; transition:border-color .18s; }
                        .sdist-order:hover { border-color:#6366f1; }
                        .sdist-order-head { display:flex; align-items:center; gap:.75rem; margin-bottom:.75rem; flex-wrap:wrap; }
                        .sdist-inv { font-size:.72rem; font-weight:700; font-family:'Courier New',monospace; background:rgba(99,102,241,.1); color:#818cf8; border:1px solid rgba(99,102,241,.22); border-radius:6px; padding:.2rem .5rem; }
                        .sdist-buyer { font-weight:700; font-size:.88rem; }
                        .sdist-addr { font-size:.7rem; color:var(--text-muted); }
                        .sdist-status-badge { display:inline-block; font-size:.68rem; font-weight:700; padding:.2rem .6rem; border-radius:20px; border:1px solid; margin-left:auto; }\n                        .sdist-items { display:flex; flex-wrap:wrap; gap:.45rem; margin-bottom:.75rem; }\n                        .sdist-item-chip { font-size:.72rem; padding:.2rem .55rem; border-radius:6px; background:rgba(255,255,255,.04); border:1px solid var(--border-color); }\n                        .sdist-actions { display:flex; gap:.5rem; flex-wrap:wrap; }\n                        .sdist-btn { padding:.4rem .85rem; border-radius:8px; border:none; font-size:.75rem; font-weight:700; cursor:pointer; transition:all .18s; }\n                        .sdist-btn-process { background:rgba(59,130,246,.12); color:#3b82f6; border:1.5px solid rgba(59,130,246,.25); }\n                        .sdist-btn-process:hover { background:rgba(59,130,246,.22); }\n                        .sdist-btn-confirm { background:rgba(34,197,94,.12); color:#22c55e; border:1.5px solid rgba(34,197,94,.25); }\n                        .sdist-btn-confirm:hover { background:rgba(34,197,94,.22); }\n                        .sdist-driver-sel { padding:.35rem .6rem; border-radius:8px; border:1.5px solid rgba(139,92,246,.3); background:rgba(139,92,246,.08); color:var(--text-primary); font-size:.75rem; }\n                        .sdist-map-layout { display:flex; gap:1.25rem; }\n                        .sdist-map-sidebar { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.25rem; width:280px; flex-shrink:0; }\n                        .sdist-map-container { flex:1; border-radius:14px; overflow:hidden; border:1.5px solid var(--border-color); height:550px; }\n                        .sdist-live-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; display:inline-block; margin-right:6px; }\n                        .sdist-driver-card { display:flex; align-items:center; gap:.65rem; padding:.6rem .75rem; border-radius:9px; border:1.5px solid var(--border-color); margin-bottom:.5rem; background:rgba(255,255,255,.01); }\n                        .sdist-driver-icon { width:32px; height:32px; border-radius:50%; background:rgba(99,102,241,.15); color:#818cf8; display:flex; align-items:center; justify-content:center; flex-shrink:0; }\n                        .sdist-empty { text-align:center; padding:3rem; color:var(--text-muted); font-size:.85rem; border:1.5px dashed var(--border-color); border-radius:14px; }\n                    `}</style>

                    <div className="sdist-header">
                        <div>
                            <h2>Monitor Distribusi Cabang</h2>
                            <p>Pantau pengiriman dari Cabang ke Member/Umum secara Real-time.</p>
                        </div>
                        <div className="sdist-toggle">
                            <button className={`sdist-toggle-btn ${viewMode === 'MAP' ? 'active' : ''}`} onClick={() => setViewMode('MAP')}><MapPin size={13} style={{display:'inline',marginRight:4}}/>Radar</button>
                            <button className={`sdist-toggle-btn ${viewMode === 'LIST' ? 'active' : ''}`} onClick={() => setViewMode('LIST')}><FileText size={13} style={{display:'inline',marginRight:4}}/>Antrean</button>
                        </div>
                    </div>

                    <div className="sdist-stats">
                        {[
                            { label:'Pending', count: myOrders.filter(o=>o.status==='PENDING').length, cls:'amber' },
                            { label:'Diproses', count: myOrders.filter(o=>o.status==='PROCESSING').length, cls:'blue' },
                            { label:'Dikirim', count: myOrders.filter(o=>o.status==='SHIPPED').length, cls:'purple' },
                            { label:'Tuntas', count: myOrders.filter(o=>o.status==='DELIVERED').length, cls:'green' },
                        ].map(s => (
                            <div className="sdist-stat" key={s.label}>
                                <div className={`sdist-stat-icon ${s.cls}`}><Truck size={18}/></div>
                                <div><div className="sdist-stat-label">{s.label}</div><div className="sdist-stat-value">{s.count}</div></div>
                            </div>
                        ))}
                    </div>

                    {viewMode === 'MAP' ? (
                        <>
                        {(() => {
                            const noLocCount = myOrders.filter(o => o.status !== 'DELIVERED' && (!o.buyer?.latitude || !o.buyer?.longitude)).length;
                            if (noLocCount === 0) return null;
                            return (
                                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10, padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#f59e0b', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '1rem' }}>⚠</span>
                                    <span><strong>{noLocCount} pengiriman</strong> ditandai <strong>❓</strong> karena buyer belum mengatur koordinat lokasi di profil akun mereka.</span>
                                </div>
                            );
                        })()}
                        <div className="sdist-map-layout">
                            <div className="sdist-map-sidebar">
                                <div style={{fontSize:'.85rem',fontWeight:800,marginBottom:'.75rem',display:'flex',alignItems:'center'}}>
                                    <span className="sdist-live-dot"></span> Radar Armada Cabang
                                </div>
                                <div style={{background:'rgba(139,92,246,.08)',border:'1px solid rgba(139,92,246,.25)',borderRadius:10,padding:'.75rem',marginBottom:'1rem'}}>
                                    <div style={{fontSize:'.78rem',fontWeight:700,color:'#a78bfa'}}>Unit Aktif: {Object.keys(liveDrivers).length}</div>
                                    <div style={{fontSize:'.7rem',color:'var(--text-muted)',marginTop:2}}>GPS Tersambung</div>
                                </div>
                                <div style={{fontSize:'.75rem',fontWeight:700,textTransform:'uppercase',color:'var(--text-muted)',marginBottom:'.5rem'}}>Driver Online</div>
                                {Object.values(liveDrivers).length === 0 ? (
                                    <div style={{textAlign:'center',padding:'1rem',color:'var(--text-muted)',fontSize:'.78rem',borderRadius:8,border:'1px dashed var(--border-color)'}}>Tidak ada driver online</div>
                                ) : Object.values(liveDrivers).map(driver => {
                                    const driverData = team.find(t => t.id === parseInt(driver.driverId));
                                    return (
                                        <div className="sdist-driver-card" key={driver.driverId}>
                                            <div className="sdist-driver-icon"><Truck size={15}/></div>
                                            <div style={{flex:1}}>
                                                <div style={{fontSize:'.8rem',fontWeight:700}}>{driverData?.name || `Driver #${driver.driverId}`}</div>
                                                <div style={{fontSize:'.68rem',color:'var(--text-muted)'}}>Lokasi Aktif</div>
                                            </div>
                                            <span style={{fontSize:'.65rem',fontWeight:700,background:'rgba(34,197,94,.1)',color:'#22c55e',border:'1px solid rgba(34,197,94,.25)',borderRadius:20,padding:'2px 8px'}}>LIVE</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="sdist-map-container">
                                <MapContainer center={[-6.1751, 106.8272]} zoom={12} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                                    <TileLayer attribution="Map data &copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    {myOrders.filter(o => o.status !== 'DELIVERED').map((order, idx) => {
                                        const destLat = order.buyer?.latitude;
                                        const destLng = order.buyer?.longitude;
                                        if (destLat && destLng) {
                                            const currentIcon = order.status === 'SHIPPED' ? shippedDestIcon : pendingDestIcon;
                                            return (
                                                <Marker key={`dest-${order.id}`} position={[destLat, destLng]} icon={currentIcon}>
                                                    <Popup><strong>{order.buyer?.store_name || order.buyer?.name || 'Customer'}</strong><br/>{order.invoice_id}<br/>Status: {order.status}</Popup>
                                                </Marker>
                                            );
                                        } else {
                                            const driverPos = Object.values(liveDrivers)[0];
                                            const baseLat = driverPos ? driverPos.lat : -6.1751;
                                            const baseLng = driverPos ? driverPos.lng : 106.8272;
                                            const offsetLat = baseLat + (idx * 0.012);
                                            const offsetLng = baseLng + ((idx % 3) * 0.012);
                                            return (
                                                <Marker key={`dest-noloc-${order.id}`} position={[offsetLat, offsetLng]} icon={noLocationIcon}>
                                                    <Popup>
                                                        <strong style={{color:'#f59e0b'}}>⚠ Lokasi Belum Diset</strong><br/>
                                                        <span>{order.buyer?.store_name || order.buyer?.name || 'Buyer'}</span><br/>
                                                        <span>{order.invoice_id}</span><br/>
                                                        <span style={{fontSize:'0.75em',color:'#888'}}>Minta buyer atur koordinat di halaman Pengaturan akun mereka.</span>
                                                    </Popup>
                                                </Marker>
                                            );
                                        }
                                    })}
                                    {Object.values(liveDrivers).map(driver => {
                                        const driverData = team.find(t => t.id === parseInt(driver.driverId));
                                        return (
                                            <Marker key={`driver-${driver.driverId}`} position={[driver.lat, driver.lng]} icon={driverIcon}>
                                                <Popup><strong>{driverData?.name || `Driver #${driver.driverId}`}</strong><br/>Pengantaran Aktif</Popup>
                                            </Marker>
                                        );
                                    })}
                                    {myOrders.filter(o => o.status === 'SHIPPED' && o.driverId).map(order => {
                                        const driverLocation = liveDrivers[order.driverId];
                                        if (!driverLocation) return null;
                                        const destLat = order.buyer?.latitude;
                                        const destLng = order.buyer?.longitude;
                                        if (!destLat || !destLng) return null;
                                        const routePositions = osrmRoutes[order.id] || [[driverLocation.lat, driverLocation.lng], [destLat, destLng]];
                                        return (
                                            <Polyline key={`route-${order.id}`} positions={routePositions} color="#8b5cf6" weight={4} opacity={0.85} />
                                        );
                                    })}
                                </MapContainer>
                            </div>
                        </div>
                        </>
                    ) : (
                        <>
                            {myOrders.length === 0 ? (
                                <div className="sdist-empty">Belum ada pesanan masuk yang perlu didistribusikan.</div>
                            ) : myOrders.map(o => {
                                let statusColor = '#9ca3af', statusBg = 'rgba(156,163,175,.1)';
                                if (o.status === 'PENDING')    { statusColor = '#f59e0b'; statusBg = 'rgba(245,158,11,.1)'; }
                                if (o.status === 'PROCESSING') { statusColor = '#3b82f6'; statusBg = 'rgba(59,130,246,.1)'; }
                                if (o.status === 'SHIPPED')    { statusColor = '#8b5cf6'; statusBg = 'rgba(139,92,246,.1)'; }
                                if (o.status === 'DELIVERED')  { statusColor = '#10b981'; statusBg = 'rgba(16,185,129,.1)'; }
                                return (
                                    <div className="sdist-order" key={o.id}>
                                        <div className="sdist-order-head">
                                            <span className="sdist-inv">{o.invoice_id}</span>
                                            <div>
                                                <div className="sdist-buyer">{o.buyer_name || o.buyer?.name || 'Customer'}</div>
                                                <div className="sdist-addr">{new Date(o.date).toLocaleDateString('id-ID')} Â· Rp {Number(o.total_amount).toLocaleString('id-ID')}</div>
                                            </div>
                                            <span className="sdist-status-badge" style={{color:statusColor,background:statusBg,borderColor:`${statusColor}44`}}>{o.status}</span>
                                        </div>
                                        <div className="sdist-items">
                                            {o.items?.map((it, idx) => (
                                                <span key={idx} className="sdist-item-chip">{it.quantity}Ã— {it.product_name || it.product?.name}</span>
                                            ))}
                                        </div>
                                        <div className="sdist-actions">
                                            {o.status === 'PENDING' && (
                                                <button className="sdist-btn sdist-btn-process" onClick={() => handleUpdateOrderStatus(o.id, 'PROCESSING')}>Proses Pesanan</button>
                                            )}
                                            {o.status === 'PROCESSING' && (
                                                <>
                                                    <select className="sdist-driver-sel" onChange={e => e.target.value && handleUpdateOrderStatus(o.id, 'SHIPPED', e.target.value)} defaultValue="">
                                                        <option value="" disabled>Pilih Driver...</option>
                                                        {myDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                    </select>
                                                    {myDrivers.length === 0 && <span style={{fontSize:'.72rem',color:'#ef4444'}}>Belum ada Driver terdaftar!</span>}
                                                </>
                                            )}
                                            {o.status === 'SHIPPED' && (
                                                <button className="sdist-btn sdist-btn-confirm" onClick={() => handleUpdateOrderStatus(o.id, 'DELIVERED')}>âœ“ Tandai Diterima</button>
                                            )}
                                            {o.driver && <span style={{fontSize:'.73rem',color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4,marginLeft:'auto'}}><Truck size={12}/>{o.driver.name}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            );
        }

        if (activeTab === 'Laporan') {
            const mySales = orders.filter(o => o.stokisId === userId);
            const myPurchases = orders.filter(o => o.buyerId === userId);
            const totalRevenue = mySales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            const totalPurchase = myPurchases.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            const grossProfit = totalRevenue - totalPurchase;

            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .slap-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.75rem; flex-wrap:wrap; gap:1rem; }
                        .slap-header h2 { font-size:1.2rem; font-weight:800; margin:0 0 .25rem; }
                        .slap-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .slap-print-btn { display:inline-flex; align-items:center; gap:.5rem; padding:.6rem 1.2rem; border-radius:10px; border:1.5px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-size:.82rem; font-weight:600; cursor:pointer; transition:all .2s; }
                        .slap-print-btn:hover { border-color:#6366f1; color:#818cf8; }
                        .slap-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:1.5rem; }
                        @media(max-width:700px){ .slap-stats{ grid-template-columns:1fr; } }
                        .slap-stat { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.1rem 1.3rem; display:flex; align-items:center; gap:.9rem; }
                        .slap-stat-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .slap-stat-icon.green  { background:rgba(34,197,94,.12);  color:#22c55e; }
                        .slap-stat-icon.blue   { background:rgba(59,130,246,.12); color:#3b82f6; }
                        .slap-stat-icon.indigo { background:rgba(99,102,241,.12); color:#6366f1; }
                        .slap-stat-icon.red    { background:rgba(239,68,68,.12);  color:#ef4444; }
                        .slap-stat-label { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-bottom:.25rem; }
                        .slap-stat-value { font-size:1.1rem; font-weight:800; font-family:'Courier New',monospace; }
                        .slap-stat-value.positive { color:#22c55e; }
                        .slap-stat-value.negative { color:#ef4444; }
                        .slap-stat-sub { font-size:.7rem; color:var(--text-muted); margin-top:.15rem; }
                        .slap-panel { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.4rem; margin-bottom:1.25rem; }
                        .slap-panel-title { font-size:.9rem; font-weight:800; margin-bottom:.85rem; display:flex; align-items:center; gap:.5rem; }
                        .slap-meta-row { display:flex; justify-content:space-between; align-items:center; padding:.55rem 0; border-bottom:1px solid var(--border-color); }
                        .slap-meta-row:last-child { border-bottom:none; }
                        .slap-meta-label { font-size:.78rem; color:var(--text-muted); }
                        .slap-meta-value { font-size:.82rem; font-weight:700; font-family:'Courier New',monospace; }
                    `}</style>

                    <div className="slap-header">
                        <div>
                            <h2>Laporan Cabang</h2>
                            <p>Rekapitulasi performa penjualan dan stok gudang cabang.</p>
                        </div>
                        <button className="slap-print-btn" onClick={() => window.print()}><FileText size={14}/> Export PDF</button>
                    </div>

                    <div className="slap-stats">
                        <div className="slap-stat">
                            <div className="slap-stat-icon green"><TrendingUp size={20}/></div>
                            <div>
                                <div className="slap-stat-label">Omzet Penjualan</div>
                                <div className="slap-stat-value">Rp {totalRevenue.toLocaleString('id-ID')}</div>
                                <div className="slap-stat-sub">{mySales.length} transaksi</div>
                            </div>
                        </div>
                        <div className="slap-stat">
                            <div className="slap-stat-icon blue"><ShoppingCart size={20}/></div>
                            <div>
                                <div className="slap-stat-label">Modal Restock</div>
                                <div className="slap-stat-value">Rp {totalPurchase.toLocaleString('id-ID')}</div>
                                <div className="slap-stat-sub">{myPurchases.length} PO</div>
                            </div>
                        </div>
                        <div className="slap-stat">
                            <div className={`slap-stat-icon ${grossProfit >= 0 ? 'indigo' : 'red'}`}><BarChart3 size={20}/></div>
                            <div>
                                <div className="slap-stat-label">Laba Kotor (Est.)</div>
                                <div className={`slap-stat-value ${grossProfit >= 0 ? 'positive' : 'negative'}`}>Rp {Math.abs(grossProfit).toLocaleString('id-ID')}</div>
                                <div className="slap-stat-sub">{grossProfit >= 0 ? 'Surplus' : 'Defisit'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="slap-panel">
                        <div className="slap-panel-title"><Activity size={16}/> Ringkasan Aktivitas Cabang</div>
                        <div className="slap-meta-row"><span className="slap-meta-label">Total Transaksi Penjualan</span><span className="slap-meta-value">{mySales.length}</span></div>
                        <div className="slap-meta-row"><span className="slap-meta-label">Rata-rata Per Transaksi</span><span className="slap-meta-value">Rp {mySales.length ? Math.floor(totalRevenue / mySales.length).toLocaleString('id-ID') : 0}</span></div>
                        <div className="slap-meta-row"><span className="slap-meta-label">Total SKU Aktif</span><span className="slap-meta-value">{products.length} SKU</span></div>
                        <div className="slap-meta-row"><span className="slap-meta-label">Total Unit Stok</span><span className="slap-meta-value">{products.reduce((a, b) => a + (b.stock || 0), 0)} Unit</span></div>
                        <div className="slap-meta-row"><span className="slap-meta-label">Tim Lapangan</span><span className="slap-meta-value">{team.length} Personel</span></div>
                        <div className="slap-meta-row"><span className="slap-meta-label">Status Gudang</span><span className="slap-meta-value" style={{color:'#22c55e'}}>â— NORMAL</span></div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'Pengaturan Toko') {
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .sset-header { margin-bottom:1.75rem; }
                        .sset-header h2 { font-size:1.2rem; font-weight:800; margin:0 0 .25rem; }
                        .sset-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .sset-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
                        @media(max-width:900px){ .sset-grid{ grid-template-columns:1fr; } }
                        .sset-panel { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:16px; overflow:hidden; }
                        .sset-panel-head { display:flex; align-items:center; gap:.85rem; padding:1.1rem 1.3rem; border-bottom:1.5px solid var(--border-color); }
                        .sset-panel-head-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .sset-panel-head-icon.indigo { background:rgba(99,102,241,.12); color:#6366f1; }
                        .sset-panel-head-icon.red    { background:rgba(239,68,68,.1);   color:#ef4444; }
                        .sset-panel-head-icon.amber  { background:rgba(245,158,11,.1);  color:#f59e0b; }
                        .sset-panel-title { font-size:.9rem; font-weight:800; }\n                        .sset-panel-sub { font-size:.72rem; color:var(--text-muted); margin-top:.1rem; }
                        .sset-panel-body { padding:1.3rem; display:flex; flex-direction:column; gap:1rem; }
                        .sset-label { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-bottom:.35rem; display:block; }
                        .sset-input { width:100%; padding:.6rem .85rem; border-radius:9px; border:1.5px solid var(--border-color); background:var(--bg-main,var(--bg-hover)); color:var(--text-primary); font-size:.85rem; outline:none; transition:border-color .18s; box-sizing:border-box; }
                        .sset-input:focus { border-color:#6366f1; }
                        .sset-input:disabled { opacity:.45; cursor:not-allowed; }
                        .sset-textarea { width:100%; padding:.65rem .85rem; border-radius:9px; border:1.5px solid var(--border-color); background:var(--bg-main,var(--bg-hover)); color:var(--text-primary); font-size:.85rem; outline:none; resize:vertical; min-height:88px; transition:border-color .18s; box-sizing:border-box; font-family:inherit; }
                        .sset-textarea:focus { border-color:#6366f1; }
                        .sset-save-btn { display:inline-flex; align-items:center; gap:.4rem; padding:.62rem 1.5rem; border-radius:10px; background:linear-gradient(135deg,#4338ca,#818cf8); color:#fff; border:none; font-size:.83rem; font-weight:700; cursor:pointer; transition:opacity .18s; align-self:flex-start; }
                        .sset-save-btn:hover { opacity:.88; }
                        .sset-action-row { display:flex; align-items:center; gap:.85rem; padding:.75rem .9rem; border-radius:10px; border:1.5px solid var(--border-color); cursor:pointer; transition:all .18s; }
                        .sset-action-row:hover { border-color:#6366f1; background:rgba(99,102,241,.04); }
                        .sset-action-icon { width:32px; height:32px; border-radius:8px; background:var(--bg-hover); display:flex; align-items:center; justify-content:center; color:var(--text-muted); flex-shrink:0; }\n                        .sset-action-text { flex:1; font-size:.83rem; font-weight:600; }
                        .sset-meta-row { display:flex; justify-content:space-between; align-items:center; padding:.45rem 0; }
                        .sset-meta-label { font-size:.72rem; color:var(--text-muted); }
                        .sset-meta-value { font-size:.72rem; font-weight:700; font-family:'Courier New',monospace; background:rgba(99,102,241,.1); color:#818cf8; border:1px solid rgba(99,102,241,.2); padding:.18rem .5rem; border-radius:6px; }
                        .sset-divider { border:none; border-top:1.5px solid var(--border-color); margin:.2rem 0; }
                    `}</style>

                    <div className="sset-header">
                        <h2>Pengaturan Toko Cabang</h2>
                        <p>Kelola profil bisnis, keamanan, dan konfigurasi toko cabang Anda.</p>
                    </div>

                    <div className="sset-grid">
                        {/* Profil Bisnis */}
                        <div className="sset-panel">
                            <div className="sset-panel-head">
                                <div className="sset-panel-head-icon indigo"><Building2 size={17}/></div>
                                <div>
                                    <div className="sset-panel-title">Identitas Toko Cabang</div>
                                    <div className="sset-panel-sub">Nama, kontak, dan alamat operasional</div>
                                </div>
                            </div>
                            <div className="sset-panel-body">
                                <div>
                                    <label className="sset-label">Nama Brand / Toko</label>
                                    <input type="text" className="sset-input" value={profile.store_name || ''} onChange={e => setProfile({ ...profile, store_name: e.target.value })} placeholder="Nama toko cabang" />
                                </div>
                                <div>
                                    <label className="sset-label">Email Login (tidak bisa diubah)</label>
                                    <input type="text" className="sset-input" value={profile.email || ''} disabled />
                                </div>
                                <div>
                                    <label className="sset-label">No. WhatsApp Bisnis</label>
                                    <input type="text" className="sset-input" value={profile.contact || ''} onChange={e => setProfile({ ...profile, contact: e.target.value })} placeholder="08xxxxxxxxxx" />
                                </div>
                                <div>
                                    <label className="sset-label">Alamat Operasional Cabang</label>
                                    <textarea className="sset-textarea" value={profile.address || ''} onChange={e => setProfile({ ...profile, address: e.target.value })} placeholder="Jl. Contoh No. 1, Kota"/>
                                </div>
                                <div>
                                    <label className="sset-label">📍 Koordinat Lokasi Pengiriman</label>
                                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.5rem'}}>
                                        <input
                                            type="number"
                                            className="sset-input"
                                            placeholder="Latitude (mis. -6.2088)"
                                            value={profile.latitude || ''}
                                            onChange={e => setProfile({ ...profile, latitude: e.target.value })}
                                            step="any"
                                        />
                                        <input
                                            type="number"
                                            className="sset-input"
                                            placeholder="Longitude (mis. 106.8456)"
                                            value={profile.longitude || ''}
                                            onChange={e => setProfile({ ...profile, longitude: e.target.value })}
                                            step="any"
                                        />
                                    </div>
                                    <button type="button"
                                        disabled={gettingLocation}
                                        style={{marginTop:'.5rem',fontSize:'.72rem',background:'rgba(129,140,248,0.15)',color:'#818cf8',border:'1px solid rgba(129,140,248,0.3)',borderRadius:6,padding:'4px 12px',cursor: gettingLocation ? 'not-allowed' : 'pointer',opacity: gettingLocation ? 0.6 : 1}}
                                        onClick={() => {
                                            if (!navigator.geolocation) {
                                                MySwal.fire({ icon: 'error', title: 'Tidak Didukung', text: 'Browser Anda tidak mendukung fitur GPS.', background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false });
                                                return;
                                            }
                                            setGettingLocation(true);
                                            navigator.geolocation.getCurrentPosition(
                                                pos => {
                                                    setProfile(prev => ({
                                                        ...prev,
                                                        latitude: pos.coords.latitude.toFixed(6),
                                                        longitude: pos.coords.longitude.toFixed(6),
                                                    }));
                                                    setGettingLocation(false);
                                                    MySwal.fire({ icon: 'success', title: 'Lokasi Didapat!', text: `Koordinat: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`, background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2000, showConfirmButton: false });
                                                },
                                                err => {
                                                    setGettingLocation(false);
                                                    const msg = err.code === 1 ? 'Izin lokasi ditolak. Aktifkan izin lokasi di browser Anda.' : err.code === 3 ? 'Timeout — sinyal GPS lemah, coba lagi.' : 'Tidak bisa mendapatkan lokasi.';
                                                    MySwal.fire({ icon: 'warning', title: 'Lokasi Gagal', text: msg, background: 'var(--bg-card)', color: 'var(--text-main)' });
                                                },
                                                { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
                                            );
                                        }}>
                                        {gettingLocation ? '⏳ Mengambil Lokasi...' : '📍 Gunakan Lokasi Saya'}
                                    </button>
                                    <p style={{fontSize:'.7rem',color:'var(--text-muted)',marginTop:'.4rem',marginBottom:0}}>
                                        Koordinat ini digunakan sebagai titik tujuan pengiriman di peta driver &amp; distribusi. Isi dengan koordinat Google Maps lokasi toko Anda.
                                    </p>
                                </div>
                                <button className="sset-save-btn" onClick={handleUpdateProfile}>
                                    {loadingProfile ? 'Menyimpan...' : <><CheckCircle2 size={14}/> Simpan Perubahan</>}
                                </button>
                            </div>
                        </div>

                        <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
                            {/* Keamanan */}
                            <div className="sset-panel">
                                <div className="sset-panel-head">
                                    <div className="sset-panel-head-icon red"><Settings size={17}/></div>
                                    <div>
                                        <div className="sset-panel-title">Keamanan Akun</div>
                                        <div className="sset-panel-sub">Password dan manajemen akses</div>
                                    </div>
                                </div>
                                <div className="sset-panel-body">
                                    <div className="sset-action-row" onClick={handleChangePassword}>
                                        <div className="sset-action-icon"><Settings size={14}/></div>
                                        <span className="sset-action-text">Ganti Password Akun</span>
                                        <ChevronDown size={14} style={{color:'var(--text-muted)',transform:'rotate(-90deg)'}}/>
                                    </div>
                                    <div className="sset-action-row" onClick={() => MySwal.fire({ title: 'Notifikasi', text: 'Fitur notifikasi sedang disiapkan.', background: 'var(--bg-card)' })}>
                                        <div className="sset-action-icon"><Bell size={14}/></div>
                                        <span className="sset-action-text">Pengaturan Notifikasi (WA)</span>
                                        <ChevronDown size={14} style={{color:'var(--text-muted)',transform:'rotate(-90deg)'}}/>
                                    </div>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="sset-panel">
                                <div className="sset-panel-head">
                                    <div className="sset-panel-head-icon amber"><Zap size={17}/></div>
                                    <div>
                                        <div className="sset-panel-title">Info Platform</div>
                                        <div className="sset-panel-sub">Versi dan status koneksi</div>
                                    </div>
                                </div>
                                <div className="sset-panel-body">
                                    <div className="sset-meta-row">
                                        <span className="sset-meta-label">Versi Aplikasi</span>
                                        <span className="sset-meta-value">v1.0.4-beta</span>
                                    </div>
                                    <hr className="sset-divider"/>
                                    <div className="sset-meta-row">
                                        <span className="sset-meta-label">Tipe Akun</span>
                                        <span className="sset-meta-value">Sub-Stokis (Cabang)</span>
                                    </div>
                                    <hr className="sset-divider"/>
                                    <div className="sset-meta-row">
                                        <span className="sset-meta-label">Status Server</span>
                                        <span className="sset-meta-value" style={{background:'rgba(34,197,94,.1)',color:'#22c55e',borderColor:'rgba(34,197,94,.25)'}}>â— Online</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'Kunjungan Sales') {
            const VSTATUS = {
                PENDING:    { label: 'Belum Dikunjungi', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
                INTERESTED: { label: 'Tertarik',         color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
                REGISTERED: { label: 'Terdaftar',        color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
                REJECTED:   { label: 'Ditolak',          color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
            };
            const filtered = visitFilter === 'ALL' ? visitMarkers : visitMarkers.filter(v => v.status === visitFilter);
            const hasCoords = visitMarkers.filter(v => v.lat && v.lng);
            const center = hasCoords.length > 0 ? [hasCoords[0].lat, hasCoords[0].lng] : [-2.5, 118.0];
            const getVIcon = (status, isFocused) => {
                const c = (VSTATUS[status] || VSTATUS.PENDING).color;
                const emoji = { PENDING: '🔍', INTERESTED: '⭐', REGISTERED: '✅', REJECTED: '✖' }[status] || '📍';
                const w = isFocused ? 44 : 34, h = isFocused ? 54 : 42;
                return L.divIcon({
                    className: '',
                    html: `<div style="position:relative;width:${w}px;height:${h}px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.55));">
                        <svg viewBox="0 0 34 42" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17 1C8.163 1 1 8.163 1 17c0 10.941 15 24 16 24s16-13.059 16-24C33 8.163 25.837 1 17 1z" fill="${c}" stroke="white" stroke-width="${isFocused?3:2}"/>
                            <circle cx="17" cy="16" r="7.5" fill="rgba(255,255,255,0.25)"/>
                        </svg>
                        <div style="position:absolute;top:${isFocused?7:5}px;left:0;width:${w}px;text-align:center;font-size:${isFocused?17:14}px;line-height:1;">${emoji}</div>
                    </div>`,
                    iconSize: [w, h],
                    iconAnchor: [Math.round(w/2), h],
                    popupAnchor: [0, -h],
                });
            };
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .vmap-header { margin-bottom:1.25rem; }
                        .vmap-header h2 { font-size:1.25rem; font-weight:800; margin:0 0 .2rem; display:flex; align-items:center; gap:.5rem; }
                        .vmap-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .vmap-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:.75rem; margin-bottom:1.25rem; }
                        @media(max-width:900px){ .vmap-stats{ grid-template-columns:repeat(2,1fr); } }
                        .vmap-stat-card { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:12px; padding:.9rem 1rem; }
                        .vmap-stat-label { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-bottom:.35rem; }
                        .vmap-stat-value { font-size:1.6rem; font-weight:900; line-height:1; }
                        .vmap-filter-bar { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:.85rem; }
                        .vmap-chip { padding:.35rem .85rem; border-radius:20px; border:1.5px solid var(--border-color); font-size:.75rem; font-weight:700; cursor:pointer; transition:all .15s; background:var(--bg-card); color:var(--text-muted); }
                        .vmap-chip.active { background:#4f46e5; border-color:#4f46e5; color:#fff; }
                        .vmap-chip:hover:not(.active) { border-color:#6366f1; color:#818cf8; }
                        .vmap-wrap { border-radius:16px; overflow:hidden; border:1.5px solid var(--border-color); height:520px; }
                        .vmap-empty { text-align:center; padding:3rem; background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:16px; }
                        .vmap-legend { display:flex; flex-wrap:wrap; gap:.5rem 1.25rem; padding:.8rem 0 0; }
                        .vmap-legend-item { display:flex; align-items:center; gap:.45rem; font-size:.75rem; font-weight:600; color:var(--text-muted); }
                        .vmap-legend-dot { width:12px; height:12px; border-radius:50%; flex-shrink:0; }
                        .leaflet-popup-content { margin: 10px 14px; }
                        .dist-map-panel { border-radius:14px; border:1px solid var(--border-color); background:var(--bg-card); padding:1.2rem; }
                        .vmap-visit-row { display:flex; align-items:flex-start; gap:.65rem; padding:.7rem .9rem; border-radius:10px; border:1px solid var(--border-color); background:rgba(255,255,255,0.02); cursor:pointer; transition:all .15s; margin-bottom:.5rem; }
                        .vmap-visit-row:hover { background:rgba(255,255,255,0.05); border-color:rgba(99,102,241,0.4); }
                        .vmap-visit-row.focused { background:rgba(99,102,241,0.1); border-color:#4f46e5; }
                        .vmap-visit-row.no-gps { opacity:.45; cursor:default; }
                    `}</style>
                    <div className="vmap-header">
                        <h2><MapPin size={18} />Peta Kunjungan Sales</h2>
                        <p>Titik survei lapangan tim sales · {hasCoords.length} titik berkoordinat GPS dari {visitMarkers.length} total kunjungan</p>
                    </div>
                    <div className="vmap-stats">
                        <div className="vmap-stat-card">
                            <div className="vmap-stat-label">Total Kunjungan</div>
                            <div className="vmap-stat-value" style={{color:'#818cf8'}}>{visitMarkers.length}</div>
                        </div>
                        <div className="vmap-stat-card">
                            <div className="vmap-stat-label">Tertarik</div>
                            <div className="vmap-stat-value" style={{color:'#8b5cf6'}}>{visitMarkers.filter(v=>v.status==='INTERESTED').length}</div>
                        </div>
                        <div className="vmap-stat-card">
                            <div className="vmap-stat-label">Terdaftar</div>
                            <div className="vmap-stat-value" style={{color:'#10b981'}}>{visitMarkers.filter(v=>v.status==='REGISTERED').length}</div>
                        </div>
                        <div className="vmap-stat-card">
                            <div className="vmap-stat-label">Ditolak</div>
                            <div className="vmap-stat-value" style={{color:'#ef4444'}}>{visitMarkers.filter(v=>v.status==='REJECTED').length}</div>
                        </div>
                    </div>
                    <div className="vmap-filter-bar">
                        {['ALL','PENDING','INTERESTED','REGISTERED','REJECTED'].map(s => (
                            <button key={s} className={`vmap-chip ${visitFilter===s?'active':''}`} onClick={()=>{ setVisitFilter(s); setFocusedVisit(null); }}>
                                {s==='ALL' ? `Semua (${visitMarkers.length})` : `${VSTATUS[s].label} (${visitMarkers.filter(v=>v.status===s).length})`}
                            </button>
                        ))}
                        <button className="vmap-chip" onClick={fetchVisitMarkers} style={{marginLeft:'auto',borderColor:'rgba(99,102,241,.3)',color:'#818cf8'}}>&#8635; Refresh</button>
                    </div>
                    <div style={{display:'flex', gap:'1.25rem', flexWrap:'wrap'}}>
                        {/* Side panel */}
                        <div className="dist-map-panel" style={{width:'280px', flexShrink:0}}>
                            <div style={{fontSize:'.72rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.65rem'}}>Daftar Kunjungan ({filtered.length})</div>
                            {filtered.length === 0 ? (
                                <div style={{fontSize:'.78rem',color:'var(--text-muted)',fontStyle:'italic',textAlign:'center',padding:'1rem',background:'rgba(255,255,255,0.02)',borderRadius:8,border:'1px dashed var(--border-color)'}}>Tidak ada data kunjungan</div>
                            ) : (
                                <div style={{maxHeight:480, overflowY:'auto', paddingRight:2}}>
                                    {filtered.map(v => {
                                        const cfg = VSTATUS[v.status] || VSTATUS.PENDING;
                                        const hasGps = v.lat && v.lng;
                                        const isFocused = focusedVisit && focusedVisit.id === v.id;
                                        return (
                                            <div
                                                key={v.id}
                                                className={`vmap-visit-row${isFocused?' focused':''}${!hasGps?' no-gps':''}`}
                                                onClick={() => { if (hasGps) setFocusedVisit({lat:v.lat, lng:v.lng, id:v.id}); }}
                                                title={!hasGps ? 'Tidak memiliki koordinat GPS' : 'Klik untuk tampilkan di peta'}
                                            >
                                                <div style={{width:10,height:10,borderRadius:'50%',background:cfg.color,flexShrink:0,marginTop:4}} />
                                                <div style={{flex:1,minWidth:0}}>
                                                    <div style={{fontWeight:700,fontSize:'.8rem',color:'var(--text-main)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{v.name}</div>
                                                    <div style={{fontSize:'.69rem',color:'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:1}}>{v.address}</div>
                                                    <div style={{display:'flex',alignItems:'center',gap:'.35rem',marginTop:3,flexWrap:'wrap'}}>
                                                        <span style={{fontSize:'.65rem',fontWeight:700,background:cfg.bg,color:cfg.color,borderRadius:6,padding:'1px 6px'}}>{cfg.label}</span>
                                                        {v.sales && <span style={{fontSize:'.65rem',color:'var(--text-muted)'}}>{v.sales.name}</span>}
                                                    </div>
                                                    {!hasGps && <div style={{fontSize:'.62rem',color:'#f59e0b',marginTop:2}}>⚠ Tanpa GPS</div>}
                                                    {isFocused && <div style={{fontSize:'.62rem',color:'#818cf8',marginTop:2}}>📍 Ditampilkan di peta</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {/* Map */}
                        <div style={{flex:1, minWidth:300, display:'flex', flexDirection:'column', gap:'.5rem'}}>
                            {hasCoords.length === 0 ? (
                                <div className="vmap-empty">
                                    <MapPin size={40} color="var(--text-muted)" style={{margin:'0 auto 1rem'}} />
                                    <p style={{color:'var(--text-muted)',fontSize:'.85rem',margin:0}}>
                                        {visitMarkers.length === 0
                                            ? 'Belum ada data kunjungan dari tim sales.'
                                            : `${visitMarkers.length} kunjungan belum memiliki koordinat GPS.`
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="vmap-wrap">
                                    <MapContainer center={center} zoom={12} style={{height:'100%',width:'100%'}}>
                                        <FlyToVisit coord={focusedVisit} />
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                                        {visitMarkers.filter(v=>v.lat&&v.lng).map(v => {
                                            const cfg = VSTATUS[v.status] || VSTATUS.PENDING;
                                            const isFocused = focusedVisit && focusedVisit.id === v.id;
                                            return (
                                                <Marker key={v.id} position={[v.lat, v.lng]} icon={getVIcon(v.status, isFocused)}>
                                                    <Popup>
                                                        <div style={{minWidth:210,fontFamily:'system-ui,sans-serif'}}>
                                                            <div style={{fontWeight:800,fontSize:'1rem',marginBottom:4,lineHeight:1.3}}>{v.name}</div>
                                                            <div style={{fontSize:'.78rem',color:'#6b7280',marginBottom:8,lineHeight:1.4}}>{v.address}</div>
                                                            <span style={{display:'inline-block',background:cfg.bg,color:cfg.color,borderRadius:12,padding:'2px 10px',fontSize:'.72rem',fontWeight:700,marginBottom:8}}>{cfg.label}</span><br/>
                                                            {v.sales && <div style={{fontSize:'.75rem',color:'#6b7280',marginBottom:3}}>&#129489; Sales: <strong>{v.sales.name}</strong></div>}
                                                            {v.notes && <div style={{fontSize:'.73rem',color:'#9ca3af',fontStyle:'italic',margin:'4px 0'}}>&#8220;{v.notes}&#8221;</div>}
                                                            <div style={{fontSize:'.7rem',color:'#9ca3af',marginTop:4}}>{new Date(v.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</div>
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            );
                                        })}
                                    </MapContainer>
                                </div>
                            )}
                            <div className="vmap-legend">
                                {Object.entries(VSTATUS).map(([k,v])=>(
                                    <span key={k} className="vmap-legend-item">
                                        <span className="vmap-legend-dot" style={{background:v.color}} />{v.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'Komisi Sales') {
            return (
                <div className="animate-fade-up delay-100">
                    <style>{[
                        '.comm-header{margin-bottom:1.25rem}',
                        '.comm-header h2{font-size:1.25rem;font-weight:800;margin:0 0 .2rem;display:flex;align-items:center;gap:.5rem}',
                        '.comm-header p{font-size:.8rem;color:var(--text-muted);margin:0}',
                        '.comm-tab-bar{display:flex;gap:.5rem;margin-bottom:1.25rem;border-bottom:1px solid var(--border-color);padding-bottom:.75rem}',
                        '.comm-tab{padding:.4rem 1.1rem;border-radius:8px;border:none;background:none;font-size:.82rem;font-weight:700;color:var(--text-muted);cursor:pointer;transition:all .15s}',
                        '.comm-tab.active{background:rgba(99,102,241,0.15);color:#818cf8}',
                        '.comm-tab:hover:not(.active){color:var(--text-main)}',
                        '.comm-table{width:100%;border-collapse:separate;border-spacing:0 .4rem}',
                        '.comm-table th{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);padding:.5rem .85rem;text-align:left}',
                        '.comm-table td{padding:.65rem .85rem;background:var(--bg-card);font-size:.82rem}',
                        '.comm-table tr td:first-child{border-radius:10px 0 0 10px;border-left:1.5px solid var(--border-color);border-top:1.5px solid var(--border-color);border-bottom:1.5px solid var(--border-color)}',
                        '.comm-table tr td:last-child{border-radius:0 10px 10px 0;border-right:1.5px solid var(--border-color);border-top:1.5px solid var(--border-color);border-bottom:1.5px solid var(--border-color)}',
                        '.comm-table tr td:not(:first-child):not(:last-child){border-top:1.5px solid var(--border-color);border-bottom:1.5px solid var(--border-color)}',
                        '.comm-toggle{display:inline-flex;align-items:center;cursor:pointer}',
                        '.comm-select{background:var(--bg-main,#0f1117);border:1.5px solid var(--border-color);color:var(--text-main);border-radius:8px;padding:.3rem .6rem;font-size:.8rem}',
                        '.comm-campaign-card{background:var(--bg-card);border:1.5px solid var(--border-color);border-radius:14px;padding:1.1rem 1.25rem;margin-bottom:.85rem}',
                        '.comm-campaign-card.inactive{opacity:.55}',
                        '.comm-campaign-header{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.65rem}',
                        '.comm-campaign-name{font-size:.95rem;font-weight:800;color:var(--text-main)}',
                        '.comm-campaign-desc{font-size:.78rem;color:var(--text-muted);margin-bottom:.6rem}',
                        '.comm-campaign-meta{display:flex;flex-wrap:wrap;gap:.4rem .85rem;font-size:.72rem;color:var(--text-muted);margin-bottom:.65rem}',
                        '.comm-campaign-items{display:flex;flex-wrap:wrap;gap:.4rem}',
                        '.comm-campaign-item-chip{background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:8px;padding:.3rem .7rem;font-size:.72rem;font-weight:700;color:#818cf8}',
                        '.comm-actions{display:flex;gap:.5rem}',
                        '.comm-btn{padding:.35rem .85rem;border-radius:8px;font-size:.78rem;font-weight:700;cursor:pointer;border:1.5px solid var(--border-color);background:none;color:var(--text-muted);transition:all .15s}',
                        '.comm-btn:hover{border-color:#6366f1;color:#818cf8}',
                        '.comm-btn.danger:hover{border-color:#ef4444;color:#ef4444}',
                        '.comm-btn.primary{background:#4f46e5;border-color:#4f46e5;color:#fff}',
                        '.comm-btn.primary:hover{background:#4338ca}',
                        '.comm-modal-overlay{display:none}',
                        '.comm-inline-form{background:var(--bg-card);border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:1.75rem;margin-bottom:1.5rem;box-shadow:0 8px 32px rgba(0,0,0,.25)}',
                        '.comm-inline-form-title{font-size:1rem;font-weight:900;color:var(--text-main);margin:0 0 1.25rem;padding-bottom:.85rem;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between}',
                        '.comm-inline-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;align-items:start}',
                        '@media(max-width:700px){.comm-inline-grid{grid-template-columns:1fr}}',
                        '.comm-form-group{margin-bottom:1rem}',
                        '.comm-form-label{font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.45rem;display:block}',
                        '.comm-input{width:100%;background:var(--bg-main,#0f1117);border:1.5px solid var(--border-color);color:var(--text-main);border-radius:10px;padding:.6rem .9rem;font-size:.85rem;box-sizing:border-box}',
                        '.comm-input:focus{outline:none;border-color:#6366f1}',
                        '.comm-row{display:flex;gap:.75rem}',
                        '.comm-row > *{flex:1}',
                        '.comm-checkbox-row{display:flex;align-items:center;gap:.65rem;cursor:pointer}',
                        '.comm-checkbox-row input{width:16px;height:16px;accent-color:#6366f1;cursor:pointer}',
                        '.comm-product-picker{border:1.5px solid var(--border-color);border-radius:10px;max-height:180px;overflow-y:auto}',
                        '.comm-product-pick-row{display:flex;align-items:center;justify-content:space-between;padding:.5rem .85rem;border-bottom:1px solid var(--border-color);font-size:.8rem;cursor:pointer;transition:background .1s}',
                        '.comm-product-pick-row:last-child{border-bottom:none}',
                        '.comm-product-pick-row:hover{background:rgba(99,102,241,0.06)}',
                        '.comm-product-pick-row.selected{background:rgba(99,102,241,0.1);color:#818cf8}',
                        '.comm-item-row{display:flex;align-items:center;gap:.5rem;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.2);border-radius:9px;padding:.45rem .75rem;margin-bottom:.4rem}',
                        '.comm-item-row-name{flex:1;font-size:.8rem;font-weight:700;color:var(--text-main)}',
                        '.comm-item-small-select{background:var(--bg-main,#0f1117);border:1px solid var(--border-color);color:var(--text-main);border-radius:6px;padding:.2rem .4rem;font-size:.75rem}',
                        '.comm-item-small-input{width:80px;background:var(--bg-main,#0f1117);border:1px solid var(--border-color);color:var(--text-main);border-radius:6px;padding:.2rem .5rem;font-size:.75rem}',
                    ].join('')}</style>

                    <div className="comm-header">
                        <h2><Gift size={18} />Manajemen Komisi Sales</h2>
                        <p>Atur komisi default per produk dan buat kampanye komisi tambahan untuk tim sales Anda</p>
                    </div>

                    <div className="comm-tab-bar">
                        <button className={'comm-tab ' + (commTab === 'default' ? 'active' : '')} onClick={() => setCommTab('default')}>Komisi Default (Katalog)</button>
                        <button className={'comm-tab ' + (commTab === 'campaigns' ? 'active' : '')} onClick={() => setCommTab('campaigns')}>Kampanye Komisi</button>
                    </div>

                    {commLoading ? (
                        <div style={{textAlign:'center',padding:'3rem',color:'var(--text-muted)'}}>Memuat data...</div>
                    ) : commTab === 'default' ? (
                        <>
                            <div style={{marginBottom:'1rem',display:'flex',alignItems:'center',gap:'.75rem',flexWrap:'wrap'}}>
                                <label style={{fontSize:'.78rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',whiteSpace:'nowrap'}}>Tampilkan Untuk:</label>
                                <select className="comm-input" style={{maxWidth:240,flex:'0 0 auto'}} value={selectedSalesId || ''} onChange={e => {
                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                    setSelectedSalesId(val);
                                    fetchCommissionData(val);
                                }}>
                                    <option value="">Default (Semua Sales)</option>
                                    {commSalesTeam.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div style={{marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'.5rem'}}>
                                <p style={{margin:0,fontSize:'.82rem',color:'var(--text-muted)'}}>Komisi default diambil dari nilai komisi di tabel harga produk. Atur apakah komisi berlaku kumulatif (setiap pembelian) atau hanya pembelian pertama.</p>
                                <button className="comm-btn primary" onClick={saveCommissionConfigs}>Simpan Perubahan</button>
                            </div>
                            {commProducts.length === 0 ? (
                                <div style={{textAlign:'center',padding:'3rem',color:'var(--text-muted)',background:'var(--bg-card)',borderRadius:14,border:'1.5px solid var(--border-color)'}}>Belum ada produk.</div>
                            ) : (
                                <table className="comm-table">
                                    <thead>
                                        <tr>
                                            <th>Produk</th>
                                            <th>Komisi per Tier</th>
                                            <th style={{textAlign:'center'}}>Aktifkan</th>
                                            <th>Jenis Komisi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {commProducts.map(p => {
                                            const cfg = pendingConfigs[p.id] || { isActive: false, commissionType: 'CUMULATIVE' };
                                            const tiers = p.priceTiers || [];
                                            return (
                                                <tr key={p.id}>
                                                    <td>
                                                        <div style={{fontWeight:800,color:'var(--text-main)'}}>{p.name}</div>
                                                        <div style={{fontSize:'.72rem',color:'var(--text-muted)'}}>{p.code}</div>
                                                    </td>
                                                    <td>
                                                        {tiers.length === 0
                                                            ? <span style={{color:'var(--text-muted)',fontSize:'.75rem'}}>Belum ada tier harga</span>
                                                            : tiers.map(t => (
                                                                <div key={t.id} style={{fontSize:'.75rem',color:'var(--text-muted)',lineHeight:1.6}}>
                                                                    {t.level_name}: <strong style={{color:'#10b981'}}>Rp {t.commission.toLocaleString('id-ID')}</strong>
                                                                </div>
                                                            ))
                                                        }
                                                    </td>
                                                    <td style={{textAlign:'center'}}>
                                                        <span className="comm-toggle" onClick={() => setPendingConfigs(pc => ({ ...pc, [p.id]: { ...cfg, isActive: !cfg.isActive } }))} title={cfg.isActive ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}>
                                                            {cfg.isActive ? <ToggleRight size={28} color="#10b981" /> : <ToggleLeft size={28} color="var(--text-muted)" />}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <select className="comm-select" value={cfg.commissionType} disabled={!cfg.isActive} onChange={e => setPendingConfigs(pc => ({ ...pc, [p.id]: { ...cfg, commissionType: e.target.value } }))}>
                                                            <option value="CUMULATIVE">Kumulatif (setiap pembelian)</option>
                                                            <option value="FIRST_PURCHASE">Hanya pembelian pertama</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'.5rem'}}>
                                <p style={{margin:0,fontSize:'.82rem',color:'var(--text-muted)'}}>Buat kampanye komisi tambahan di luar komisi default. Kampanye bisa digabung dengan komisi default atau berdiri sendiri.</p>
                                <button className="comm-btn primary" onClick={openNewCampaign}><Plus size={14} style={{display:'inline',marginRight:4}} />Buat Kampanye Baru</button>
                            </div>
                            {commCampaigns.length === 0 ? (
                                <div style={{textAlign:'center',padding:'3rem',color:'var(--text-muted)',background:'var(--bg-card)',borderRadius:14,border:'1.5px solid var(--border-color)'}}>Belum ada kampanye. Klik "Buat Kampanye Baru" untuk memulai.</div>
                            ) : (
                                commCampaigns.map(c => (
                                    <div key={c.id} className={'comm-campaign-card' + (c.isActive ? '' : ' inactive')}>
                                        <div className="comm-campaign-header">
                                            <div>
                                                <div className="comm-campaign-name">{c.name}</div>
                                                {c.description && <div className="comm-campaign-desc">{c.description}</div>}
                                            </div>
                                            <div className="comm-actions">
                                                <button className="comm-btn" onClick={() => toggleCampaign(c.id)}>
                                                    {c.isActive ? <ToggleRight size={16} color="#10b981" /> : <ToggleLeft size={16} />}
                                                    {' '}{c.isActive ? 'Aktif' : 'Nonaktif'}
                                                </button>
                                                <button className="comm-btn" onClick={() => openEditCampaign(c)}>Edit</button>
                                                <button className="comm-btn danger" onClick={() => deleteCampaign(c.id)}>Hapus</button>
                                            </div>
                                        </div>
                                        <div className="comm-campaign-meta">
                                            <span>{c.combineWithDefault ? 'Digabung dengan komisi default' : 'Tidak digabung dengan komisi default'}</span>
                                            {c.salesUser ? <span style={{color:'#818cf8',fontWeight:700}}>Target: {c.salesUser.name}</span> : <span style={{color:'var(--text-muted)'}}>Target: Semua Sales</span>}
                                            {c.startDate && <span>Mulai: {new Date(c.startDate).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'})}</span>}
                                            {c.endDate && <span>Berakhir: {new Date(c.endDate).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'})}</span>}
                                        </div>
                                        <div className="comm-campaign-items">
                                            {c.items.map(item => (
                                                <span key={item.id} className="comm-campaign-item-chip">
                                                    {item.product ? item.product.name : ''} {item.amountType === 'FLAT' ? ('Rp ' + parseFloat(item.amount).toLocaleString('id-ID')) : (item.amount + '%')}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}

                    {showCampaignModal && (
                        <div className="comm-inline-form">
                            <div className="comm-inline-form-title">
                                <span>{editingCampaign ? 'Edit Kampanye Komisi' : 'Buat Kampanye Komisi Baru'}</span>
                                <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',padding:'2px 4px',borderRadius:6,fontSize:'1.1rem',lineHeight:1}} onClick={() => setShowCampaignModal(false)}>✕</button>
                            </div>
                            <div className="comm-inline-grid">
                                <div>
                                    <div className="comm-form-group">
                                        <label className="comm-form-label">Nama Kampanye *</label>
                                        <input className="comm-input" value={campaignForm.name} onChange={e => setCampaignForm(f => ({...f, name: e.target.value}))} placeholder="Contoh: Bonus Produk A Oktober 2026" />
                                    </div>
                                    <div className="comm-form-group">
                                        <label className="comm-form-label">Target Sales (Opsional)</label>
                                        <select className="comm-input" value={campaignForm.salesId || ''} onChange={e => setCampaignForm(f => ({...f, salesId: e.target.value ? parseInt(e.target.value) : null}))}>
                                            <option value="">Semua Sales (Tidak Spesifik)</option>
                                            {commSalesTeam.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="comm-form-group">
                                        <label className="comm-form-label">Deskripsi</label>
                                        <textarea className="comm-input" rows={2} value={campaignForm.description} onChange={e => setCampaignForm(f => ({...f, description: e.target.value}))} placeholder="Keterangan tambahan (opsional)" style={{resize:'vertical'}} />
                                    </div>
                                    <div className="comm-row">
                                        <div className="comm-form-group">
                                            <label className="comm-form-label">Tanggal Mulai</label>
                                            <input type="date" className="comm-input" value={campaignForm.startDate} onChange={e => setCampaignForm(f => ({...f, startDate: e.target.value}))} />
                                        </div>
                                        <div className="comm-form-group">
                                            <label className="comm-form-label">Tanggal Berakhir</label>
                                            <input type="date" className="comm-input" value={campaignForm.endDate} onChange={e => setCampaignForm(f => ({...f, endDate: e.target.value}))} />
                                        </div>
                                    </div>
                                    <div className="comm-form-group" style={{display:'flex',gap:'1.5rem',flexWrap:'wrap'}}>
                                        <label className="comm-checkbox-row">
                                            <input type="checkbox" checked={campaignForm.isActive} onChange={e => setCampaignForm(f => ({...f, isActive: e.target.checked}))} />
                                            <span style={{fontSize:'.83rem',color:'var(--text-main)'}}>Kampanye aktif</span>
                                        </label>
                                        <label className="comm-checkbox-row">
                                            <input type="checkbox" checked={campaignForm.combineWithDefault} onChange={e => setCampaignForm(f => ({...f, combineWithDefault: e.target.checked}))} />
                                            <span style={{fontSize:'.83rem',color:'var(--text-main)'}}>Gabungkan dengan komisi default</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <div className="comm-form-group">
                                        <label className="comm-form-label">Pilih Produk untuk Kampanye</label>
                                        <div className="comm-product-picker">
                                            {commProducts.map(p => {
                                                const selected = !!campaignForm.items.find(i => i.productId === p.id);
                                                return (
                                                    <div key={p.id} className={'comm-product-pick-row' + (selected ? ' selected' : '')} onClick={() => selected ? removeCampaignItem(p.id) : addCampaignItem(p.id, p.name)}>
                                                        <span>{p.name} <span style={{fontSize:'.7rem',color:'var(--text-muted)'}}>{p.code}</span></span>
                                                        {selected ? <CheckCircle2 size={15} color="#10b981" /> : <Plus size={14} color="var(--text-muted)" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {campaignForm.items.length > 0 && (
                                        <div className="comm-form-group">
                                            <label className="comm-form-label">Atur Nominal Komisi per Produk</label>
                                            {campaignForm.items.map(item => (
                                                <div key={item.productId} className="comm-item-row">
                                                    <span className="comm-item-row-name">{item.productName}</span>
                                                    <select className="comm-item-small-select" value={item.amountType} onChange={e => updateCampaignItem(item.productId, 'amountType', e.target.value)}>
                                                        <option value="FLAT">Rp (Flat)</option>
                                                        <option value="PERCENTAGE">Persen</option>
                                                    </select>
                                                    <input type="number" min="0" className="comm-item-small-input" value={item.amount} onChange={e => updateCampaignItem(item.productId, 'amount', e.target.value)} placeholder={item.amountType === 'FLAT' ? '50000' : '5'} />
                                                    <button style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',padding:0,lineHeight:1}} onClick={() => removeCampaignItem(item.productId)}><X size={15} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{display:'flex',gap:'.75rem',justifyContent:'flex-end',marginTop:'1rem',paddingTop:'1rem',borderTop:'1px solid var(--border-color)'}}>
                                        <button className="comm-btn" onClick={() => setShowCampaignModal(false)}>Batal</button>
                                        <button className="comm-btn primary" onClick={saveCampaign}>{editingCampaign ? 'Simpan Perubahan' : 'Buat Kampanye'}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
    };


    return (
        <div className="layout-wrapper">
            {/* SIDEBAR NAVIGATION */}
            <aside className={`app-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                {/* Logo */}
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <TrendingUp size={18} color="#fff" />
                    </div>
                    {!isSidebarCollapsed && (
                        <span className="sidebar-logo-text">
                            Stokis<span style={{ background: 'linear-gradient(135deg,#818cf8,#e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hub</span>
                        </span>
                    )}
                </div>

                {/* Nav */}
                <nav className="sidebar-nav">
                    {navigation.map((section) => (
                        <div key={section.category} style={{ marginBottom: '1.25rem' }}>
                            {!isSidebarCollapsed
                                ? <div className="sidebar-cat-label">{section.category}</div>
                                : <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.25rem 0.5rem 0.75rem' }} />
                            }
                            <div>
                                {section.items.map((item) => (
                                    <button
                                        key={item.name}
                                        className={`nav-item ${activeTab === item.name ? 'active' : ''}`}
                                        onClick={() => setActiveTab(item.name)}
                                        title={isSidebarCollapsed ? item.name : ''}
                                    >
                                        <div className="nav-icon-wrapper">{item.icon}</div>
                                        {!isSidebarCollapsed && <span className="nav-label">{item.name}</span>}
                                        {(activeTab === item.name && !isSidebarCollapsed) && <div className="active-indicator" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Logout at bottom */}
                {!isSidebarCollapsed && (
                    <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button className="nav-item" style={{ width: '100%', color: '#f87171' }} onClick={handleLogout}>
                            <div className="nav-icon-wrapper"><LogOut size={18} /></div>
                            <span className="nav-label">Keluar</span>
                        </button>
                    </div>
                )}
            </aside>

            {/* MAIN CONTAINER */}
            <div className="app-main">
                {/* TOP HEADER */}
                <header className="app-header">
                    <div className="flex items-center gap-4">
                        <button className="btn btn-secondary p-1.5 rounded-md" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                            <Menu size={18} />
                        </button>
                        <div className="search-bar">
                            <Search size={16} className="text-muted" />
                            <input type="text" placeholder="Temukan order atau produk..." />
                            <div className="text-xs text-muted font-mono bg-[rgba(255,255,255,0.05)] px-1.5 rounded">âŒ˜ K</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Notif bell */}
                        <button className="btn btn-secondary p-2 rounded-full" style={{ position: 'relative' }}>
                            <Bell size={17} />
                            <span style={{ position: 'absolute', top: 5, right: 5, width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', border: '2px solid var(--bg-main,#0f1117)' }}></span>
                        </button>

                        {/* Profile dropdown */}
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.4rem 0.75rem', borderRadius: 12, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', transition: 'border-color .18s' }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#818cf8'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                            >
                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(168,85,247,.2))', border: '1.5px solid rgba(129,140,248,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.8rem', color: '#818cf8', textTransform: 'uppercase' }}>
                                    {profile.name ? profile.name.substring(0, 2) : 'SS'}
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '.82rem', fontWeight: 700, lineHeight: 1.2 }}>{profile.name || 'Cabang Manager'}</div>
                                    <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{profile.store_name || 'Sub-Stokis'}</div>
                                </div>
                                <ChevronDown size={14} style={{ color: 'var(--text-muted)', transition: 'transform .2s', transform: isProfileDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                            </button>

                            {isProfileDropdownOpen && (
                                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 200, background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: 12, padding: '0.5rem', zIndex: 100, boxShadow: '0 12px 40px rgba(0,0,0,.45)' }}>
                                    <div style={{ padding: '0.75rem 0.85rem 0.6rem', borderBottom: '1px solid var(--border-color)', marginBottom: '0.4rem' }}>
                                        <div style={{ fontSize: '.8rem', fontWeight: 700 }}>{profile.name}</div>
                                        <div style={{ fontSize: '.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{profile.email}</div>
                                    </div>
                                    <button onClick={() => { setActiveTab('Pengaturan Toko'); setIsProfileDropdownOpen(false); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '.6rem', width: '100%', padding: '.55rem .85rem', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '.82rem', cursor: 'pointer', transition: 'background .15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <Settings size={14} /> Pengaturan Toko
                                    </button>
                                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.3rem 0' }} />
                                    <button onClick={handleLogout}
                                        style={{ display: 'flex', alignItems: 'center', gap: '.6rem', width: '100%', padding: '.55rem .85rem', borderRadius: 8, border: 'none', background: 'transparent', color: '#f87171', fontSize: '.82rem', cursor: 'pointer', transition: 'background .15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.08)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <LogOut size={14} /> Keluar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="main-content">
                    {renderContent()}
                </main>
            </div>
            {/* DYNAMIC REACT MODAL: ADD TEAM MEMBER */}
            {
                isAddTeamModalOpen && (
                    <div className="modal-overlay animate-fade-up">
                        <div className="modal-content animate-fade-up" style={{ maxWidth: '550px' }}>

                            <div className="modal-header">
                                <h3 className="text-lg font-bold">{editingTeamId ? 'Edit Profil Personel Lapangan' : 'Rekrut Personel Ekspedisi'}</h3>
                                <button onClick={() => setIsAddTeamModalOpen(false)} className="text-muted hover:text-white" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>&times;</button>
                            </div>

                            <div className="modal-body pb-2">
                                <div className="mb-4">
                                    <label className="text-xs text-muted font-bold tracking-wider uppercase mb-1 block">Tentukan Role Operasional Pasukan</label>
                                    <div className="flex gap-2">
                                        {['SALES', 'DRIVER'].map(r => (
                                            <button key={r} onClick={() => setFormTeam({ ...formTeam, role: r })}
                                                className="flex-1 rounded-md text-sm font-bold transition-colors"
                                                style={{
                                                    padding: '0.6rem',
                                                    background: formTeam.role === r ? 'var(--primary-glow)' : 'rgba(0,0,0,0.2)',
                                                    color: formTeam.role === r ? 'white' : 'var(--text-muted)',
                                                    border: `1px solid ${formTeam.role === r ? 'var(--primary)' : 'var(--border-color)'}`
                                                }}
                                            >
                                                {r === 'SALES' ? 'Sales Eksternal' : 'Armada Driver'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1">
                                        <label className="text-xs text-muted font-bold tracking-wider uppercase mb-1 block">Nama Lengkap</label>
                                        <input type="text" className="modal-input" placeholder="Nama KTP"
                                            value={formTeam.name} onChange={e => setFormTeam({ ...formTeam, name: e.target.value })} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs text-muted font-bold tracking-wider uppercase mb-1 block">No Handphone / WA</label>
                                        <input type="text" className="modal-input" placeholder="08..."
                                            value={formTeam.contact} onChange={e => setFormTeam({ ...formTeam, contact: e.target.value })} />
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-xs text-muted font-bold tracking-wider uppercase mb-1 block">Alamat Wilayah Operasi / Rumah</label>
                                    <input type="text" className="modal-input" placeholder="Jalan Raya No. 123..."
                                        value={formTeam.address} onChange={e => setFormTeam({ ...formTeam, address: e.target.value })} />
                                </div>

                                <hr style={{ borderColor: 'var(--border-color)', margin: '1.5rem 0' }} />

                                <div className="flex gap-4 mb-2">
                                    <div className="flex-1">
                                        <label className="text-xs text-primary font-bold tracking-wider uppercase mb-1 block">Email Login Akun</label>
                                        <input type="email" className="modal-input font-mono" placeholder="email@contoh.com"
                                            value={formTeam.email} onChange={e => setFormTeam({ ...formTeam, email: e.target.value })} />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs text-primary font-bold tracking-wider uppercase mb-1 block">Password {editingTeamId && '(Kosongkan jika tidak diubah)'}</label>
                                        <input type="text" className="modal-input font-mono" placeholder="Minimal 6 Karakter"
                                            value={formTeam.password} onChange={e => setFormTeam({ ...formTeam, password: e.target.value })} />
                                    </div>
                                </div>
                                <div className="text-xs text-muted leading-relaxed">Akses email dan password ini nantinya akan dipakai personel cabang Anda untuk login pelaporan di Smartphonenya masing-masing.</div>
                            </div>

                            <div className="modal-footer">
                                <button onClick={() => setIsAddTeamModalOpen(false)} className="btn btn-secondary">Batal</button>
                                <button onClick={submitTeam} className="btn" style={{ background: 'var(--primary)', color: 'white', border: 'none', fontWeight: 'bold' }}>Simpan & Beri Akses</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* DYNAMIC REACT MODAL: EDIT PRODUCT (TIERS & COMMISSIONS) */}
            {
                isEditProductModalOpen && editingProduct && (
                    <div className="modal-overlay animate-fade-up">
                        <div className="modal-content animate-fade-up" style={{ maxWidth: '700px' }}>
                            <div style={{ background: 'linear-gradient(135deg,#0f172a,#1a1040)', borderBottom: '1.5px solid rgba(99,102,241,.25)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '.9rem' }}>
                                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,rgba(99,102,241,.25),rgba(168,85,247,.2))', border: '1.5px solid rgba(99,102,241,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Diamond size={20} color="#818cf8" /></div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '.95rem' }}>Harga Jual & Komisi</div>
                                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Produk: <span style={{ color: '#818cf8', fontWeight: 700 }}>{editingProduct.name}</span></div>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditProductModalOpen(false)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                            </div>

                            <div className="modal-body">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Skema Harga (Konsumen / Member / Area)</label>
                                    <button className="btn btn-secondary py-1 text-xs" onClick={handleAddTierRow}>+ Tambah Skema</button>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {formTiers.map((tier, index) => (
                                        <div key={index} className="flex gap-3 items-start animate-fade-up" style={{ animationDelay: `${index * 50}ms` }}>
                                            <div className="flex-1">
                                                <div className="text-[10px] text-muted mb-1.5 uppercase font-bold tracking-tight h-[12px] flex items-center">
                                                    {index === 0 ? 'Nama Level / Tipe' : ''}
                                                </div>
                                                <input type="text" className="modal-input text-sm" placeholder="Contoh: Harga Umum / Agen B"
                                                    value={tier.level_name} onChange={e => handleTierChange(index, 'level_name', e.target.value)} />
                                            </div>
                                            <div style={{ width: '135px' }}>
                                                <div className="text-[10px] text-muted mb-1.5 uppercase font-bold tracking-tight h-[12px] flex items-center">
                                                    {index === 0 ? 'Harga Jual (Rp)' : ''}
                                                </div>
                                                <input type="number" className="modal-input text-sm font-mono" placeholder="0"
                                                    value={tier.price} onChange={e => handleTierChange(index, 'price', e.target.value)} />
                                            </div>
                                            <div style={{ width: '135px' }}>
                                                <div className="text-[10px] text-primary mb-1.5 uppercase font-bold tracking-tight h-[12px] flex items-center">
                                                    {index === 0 ? 'Komisi (Rp)' : ''}
                                                </div>
                                                <input type="number" className="modal-input text-sm font-bold font-mono border-primary/20" placeholder="0"
                                                    value={tier.commission} onChange={e => handleTierChange(index, 'commission', e.target.value)} />
                                            </div>
                                            <div style={{ width: '38px' }}>
                                                <div className="mb-1.5 h-[12px]"></div>
                                                <button
                                                    className="w-full h-[38px] flex items-center justify-center rounded-md border border-[rgba(255,255,255,0.05)] text-muted hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all duration-200"
                                                    onClick={() => handleRemoveTierRow(index)}
                                                    style={{ background: 'rgba(255, 255, 255, 0.02)' }}
                                                    title="Hapus Baris"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-muted mt-4 leading-relaxed italic">
                                    *) Harga jual adalah harga yang akan tertera di struk konsumen. <br />
                                    *) Komisi Sales adalah hak yang didapatkan tenaga penjual Anda per unit barang yang terjual.
                                </p>
                            </div>

                            <div className="modal-footer">
                                <button onClick={() => setIsEditProductModalOpen(false)} className="btn btn-secondary">Batal</button>
                                <button onClick={submitProductEdit} className="btn btn-primary font-bold">Simpan Skema Harga</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DYNAMIC REACT MODAL: PURCHASE (PO) CART */}
            {
                isCartModalOpen && (
                    <div className="modal-overlay animate-fade-up">
                        <div className="modal-content animate-fade-up" style={{ maxWidth: '600px' }}>
                            <div style={{ background: 'linear-gradient(135deg,#052e16,#14532d)', borderBottom: '1.5px solid rgba(34,197,94,.2)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '.9rem' }}>
                                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(34,197,94,.15)', border: '1.5px solid rgba(34,197,94,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingCart size={20} color="#22c55e" /></div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '.95rem' }}>Keranjang Restock PO</div>
                                        <div style={{ fontSize: '.72rem', color: 'rgba(34,197,94,.7)', marginTop: 2 }}>{purchaseCart.length} produk dalam keranjang</div>
                                    </div>
                                </div>
                                <button onClick={() => setIsCartModalOpen(false)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                            </div>

                            <div className="modal-body max-h-[50vh] overflow-y-auto custom-scrollbar">
                                {purchaseCart.length === 0 ? (
                                    <div className="text-center text-muted py-8 text-sm">Keranjang Anda kosong!</div>
                                ) : (
                                    <ul className="flex flex-col gap-3">
                                        {purchaseCart.map((item, idx) => (
                                            <li key={idx} className="flex justify-between items-center p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)]">
                                                <div>
                                                    <div className="font-bold text-sm tracking-wide">{item.name}</div>
                                                    <div className="text-xs text-muted font-mono mt-1">{item.code} &bull; Harga PO: <span className="text-main">Rp {item.price.toLocaleString('id-ID')}</span></div>
                                                </div>
                                                <div className="flex items-center gap-4 text-right">
                                                    <div>
                                                        <div className="text-[0.65rem] text-muted tracking-wide uppercase font-bold">Order Qty</div>
                                                        <div className="font-mono mt-1 text-sm bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded text-main">{item.quantity} Unit</div>
                                                    </div>
                                                    <button className="text-red-500 font-bold hover:text-red-400 p-2 ml-2 text-lg leading-none" onClick={() => removeFromCart(item.productId)}>&times;</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {purchaseCart.length > 0 && (
                                <div className="px-6 py-4 bg-[rgba(0,0,0,0.3)] border-t border-[var(--border-color)] flex justify-between items-center">
                                    <div className="text-xs text-muted uppercase tracking-widest font-bold">Estimasi Tagihan</div>
                                    <div className="text-lg font-bold text-primary font-mono tracking-tight">
                                        Rp {purchaseCart.reduce((total, item) => total + (item.price * item.quantity), 0).toLocaleString('id-ID')}
                                    </div>
                                </div>
                            )}

                            <div className="modal-footer">
                                <button onClick={() => setIsCartModalOpen(false)} className="btn btn-secondary">Simpan Draft Saja</button>
                                <button onClick={submitPurchaseOrder} disabled={purchaseCart.length === 0} className="btn btn-primary" style={{ fontWeight: 'bold' }}>KIRIM PO!</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DYNAMIC REACT MODAL: PREFERENSI HARGA — CLICKABLE CHIPS */}
            {
                isPricingModalOpen && pricingTargetUser && (
                    <div className="modal-overlay animate-fade-up">
                        <div className="modal-content animate-fade-up" style={{ maxWidth: '860px' }}>
                            {/* Gradient header */}
                            <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderBottom: '1.5px solid rgba(99,102,241,.3)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '.9rem' }}>
                                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(99,102,241,.25)', border: '1.5px solid rgba(129,140,248,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={20} color="#818cf8" /></div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '.95rem' }}>Preferensi Harga Katalog</div>
                                        <div style={{ fontSize: '.72rem', color: 'rgba(165,180,252,.7)', marginTop: 2 }}>Member: <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{pricingTargetUser.name}</span></div>
                                    </div>
                                </div>
                                <button onClick={() => setIsPricingModalOpen(false)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                            </div>

                            <div className="modal-body" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
                                <style>{`
                                    .spricing-row { padding:.85rem; border-radius:12px; border:1.5px solid var(--border-color); margin-bottom:.65rem; transition:border-color .18s; }
                                    .spricing-row:hover { border-color:rgba(99,102,241,.35); }
                                    .spricing-prod { font-size:.85rem; font-weight:800; margin-bottom:.15rem; }
                                    .spricing-code { font-size:.68rem; color:var(--text-muted); }
                                    .spricing-chips { display:flex; flex-wrap:wrap; gap:.45rem; margin-top:.65rem; }
                                    .spricing-chip { display:inline-flex; align-items:center; gap:.35rem; padding:.3rem .75rem; border-radius:20px; border:1.5px solid var(--border-color); font-size:.73rem; font-weight:600; cursor:pointer; transition:all .18s; background:transparent; color:var(--text-muted); }
                                    .spricing-chip:hover { border-color:#6366f1; color:#818cf8; }
                                    .spricing-chip.selected { background:rgba(99,102,241,.15); border-color:#6366f1; color:#818cf8; }
                                    .spricing-chip-default { display:inline-flex; align-items:center; gap:.35rem; padding:.3rem .75rem; border-radius:20px; border:1.5px solid var(--border-color); font-size:.73rem; font-weight:600; cursor:pointer; transition:all .18s; background:transparent; color:var(--text-muted); }
                                    .spricing-chip-default:hover { border-color:#6366f1; color:#818cf8; }
                                    .spricing-chip-default.selected { background:rgba(99,102,241,.1); border-color:rgba(99,102,241,.4); color:#6366f1; }
                                `}</style>

                                {products.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1.5px dashed var(--border-color)', borderRadius: 12 }}>Belum ada produk untuk diatur harganya.</div>
                                ) : products.map(product => {
                                    const override = pricingOverrides.find(p => p.productId === product.id);
                                    const currentLevel = override ? override.level_name : '';
                                    return (
                                        <div className="spricing-row" key={product.id}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div className="spricing-prod">{product.name}</div>
                                                    <div className="spricing-code">{product.code}</div>
                                                </div>
                                                {currentLevel && (
                                                    <span style={{ fontSize: '.68rem', fontWeight: 700, background: 'rgba(99,102,241,.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,.25)', borderRadius: 20, padding: '2px 10px' }}>✓ {currentLevel}</span>
                                                )}
                                            </div>
                                            <div className="spricing-chips">
                                                <button
                                                    className={`spricing-chip-default ${currentLevel === '' ? 'selected' : ''}`}
                                                    onClick={() => handlePricingChange(product.id, '')}
                                                >Umum (Default)</button>
                                                {product.priceTiers?.map(pt => (
                                                    <button
                                                        key={pt.id}
                                                        className={`spricing-chip ${currentLevel === pt.level_name ? 'selected' : ''}`}
                                                        onClick={() => handlePricingChange(product.id, pt.level_name)}
                                                    >
                                                        {currentLevel === pt.level_name && <CheckCircle2 size={12} />}
                                                        {pt.level_name} &bull; Rp {Number(pt.price).toLocaleString('id-ID')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="modal-footer">
                                <div style={{ marginRight: 'auto', fontSize: '.72rem', color: 'var(--text-muted)' }}>Pilihan ini akan berlaku saat <strong>{pricingTargetUser.name}</strong> memesan produk.</div>
                                <button onClick={() => setIsPricingModalOpen(false)} className="btn btn-secondary">Batal</button>
                                <button onClick={savePricingOverrides} className="btn btn-primary" style={{ fontWeight: 'bold' }}>Simpan Harga</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DashboardSubstokis;
