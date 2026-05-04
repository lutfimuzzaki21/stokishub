import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
    Plus, ShoppingCart, Users, Truck, LogOut,
    Activity, Diamond, Search, Bell, Settings, Command, MapPin, X, FileText, BarChart3, TrendingUp, Menu,
    Package, ArrowUpRight, TrendingDown, Zap, Clock, CheckCircle2, AlertTriangle, DollarSign, Layers,
    ChevronDown, Edit3, Phone, Building2, Gift, ToggleLeft, ToggleRight, CalendarDays
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { io } from 'socket.io-client';

// Fix for default Leaflet markers in Vite/React
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: iconMarker,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons untuk Live Radar
const driverIcon = new L.divIcon({
    className: 'custom-driver-icon',
    html: `<div style="background-color: #8b5cf6; width: 34px; height: 34px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 18px;">🚚</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
});

const pendingDestIcon = new L.divIcon({
    className: 'custom-pending-dest-icon',
    html: `<div style="background-color: #f59e0b; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 14px;">🏪</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

const shippedDestIcon = new L.divIcon({
    className: 'custom-shipped-dest-icon',
    html: `<div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 14px;">📦</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

const noLocationIcon = new L.divIcon({
    className: 'custom-noloc-icon',
    html: `<div style="background-color: #6b7280; width: 28px; height: 28px; border-radius: 50%; border: 2px dashed #f59e0b; box-shadow: 0 0 5px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 14px;">❓</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

const MySwal = withReactContent(Swal);

// Stable helper — flies the Leaflet map to a driver coordinate when it changes
const FlyToDriver = ({ coord }) => {
    const map = useMap();
    React.useEffect(() => {
        if (coord) map.flyTo([coord.lat, coord.lng], 16, { animate: true, duration: 1.2 });
    }, [coord]);
    return null;
};

const FlyToVisit = ({ coord }) => {
    const map = useMap();
    React.useEffect(() => {
        if (coord) map.flyTo([coord.lat, coord.lng], 16, { animate: true, duration: 1.2 });
    }, [coord]);
    return null;
};

const DashboardStokis = () => {
    const navigate = useNavigate();
    const userId = localStorage.getItem('userId');
    const [activeTab, setActiveTab] = useState('Overview');

    // States untuk API
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    // States untuk Purchasing API
    const [purchases, setPurchases] = useState([]);
    const [loadingPurchases, setLoadingPurchases] = useState(false);

    // States untuk Manajemen Tim API
    const [team, setTeam] = useState([]);
    const [loadingTeam, setLoadingTeam] = useState(false);

    // States untuk Distribusi / Orders API
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    // States untuk Tracking Map
    const [viewMode, setViewMode] = useState('TABLE'); // 'TABLE' or 'MAP'
    const [liveDrivers, setLiveDrivers] = useState({});
    const [socketInstance, setSocketInstance] = useState(null);
    const [osrmRoutes, setOsrmRoutes] = useState({}); // { orderId: [[lat,lng],...] }
    const [focusedDriverCoord, setFocusedDriverCoord] = useState(null); // { lat, lng }
    const [visitMarkers, setVisitMarkers] = useState([]);
    const [visitFilter, setVisitFilter] = useState('ALL');
    const [focusedVisit, setFocusedVisit] = useState(null);

    // Commission States
    const [commProducts, setCommProducts] = useState([]);
    const [commCampaigns, setCommCampaigns] = useState([]);
    const [commLoading, setCommLoading] = useState(false);
    const [salesCommissionMap, setSalesCommissionMap] = useState({}); // { [salesId]: grandTotalCommission }
    const [commTab, setCommTab] = useState('default');
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState(null);
    const [campaignForm, setCampaignForm] = useState({ name: '', description: '', isActive: true, combineWithDefault: true, startDate: '', endDate: '', items: [], salesId: null });
    const [commSalesTeam, setCommSalesTeam] = useState([]);
    const [selectedSalesId, setSelectedSalesId] = useState(null);
    const [pendingConfigs, setPendingConfigs] = useState({});
    const [salesReportId, setSalesReportId] = useState(null);
    const [salesReportData, setSalesReportData] = useState({ orders: [], consumers: [], grandTotalCommission: 0 });
    const [salesReportLoading, setSalesReportLoading] = useState(false);
    const [salesConsumerMap, setSalesConsumerMap] = useState({});

    // States untuk Modal Tambah Produk Dynamic
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingProductId, setEditingProductId] = useState(null);
    const [formProduct, setFormProduct] = useState({ name: '', stock: '' });
    const [formTiers, setFormTiers] = useState([
        { level_name: 'Harga Area 1', price: '', commission: '' }
    ]);
    const [formPackagings, setFormPackagings] = useState([]);

    // States untuk Modal Restock
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const [formRestock, setFormRestock] = useState({ productId: '', quantity: '', price_buy: '' });

    // States untuk Modal Tim Baru
    const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState(null);
    const [formTeam, setFormTeam] = useState({
        name: '', email: '', password: '', role: 'SALES', contact: '', address: '', store_name: '', price_level: 'Harga Umum', latitude: '', longitude: ''
    });
    const [teamModalRoles, setTeamModalRoles] = useState(['SALES', 'DRIVER']);
    const [teamGettingLocation, setTeamGettingLocation] = useState(false);
    const [teamMapPickerOpen, setTeamMapPickerOpen] = useState(false);
    const [teamMapPickerCoord, setTeamMapPickerCoord] = useState(null);

    // States untuk Modal Set Harga per Produk
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const [pricingTargetUser, setPricingTargetUser] = useState(null);
    const [pricingOverrides, setPricingOverrides] = useState([]); // [{productId, level_name}]
    const [packagingOverrides, setPackagingOverrides] = useState([]); // [{packagingId, level_name}]

    const [profile, setProfile] = useState({ name: '', store_name: '', address: '', email: '' });
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
    const [formEditProfile, setFormEditProfile] = useState({ name: '', email: '', store_name: '', contact: '', address: '', latitude: '', longitude: '' });
    const [gettingLocation, setGettingLocation] = useState(false);

    // Konsinyasi States
    const [konsinyasiList, setKonsinyasiList] = useState([]);
    const [konsinyasiLoading, setKonsinyasiLoading] = useState(false);
    const [showKonsinyasiModal, setShowKonsinyasiModal] = useState(false);
    const [editingKonsinyasi, setEditingKonsinyasi] = useState(null);
    const [konsinyasiDetailId, setKonsinyasiDetailId] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleContractId, setScheduleContractId] = useState(null);
    const [konsumenList, setKonsumenList] = useState([]);
    const [kForm, setKForm] = useState({
        konsumenId: '', ownerName: '', storeName: '', storeAddress: '', storePhone: '',
        idCardNo: '', npwpNo: '', billingCycle: 'MONTHLY', startDate: '', endDate: '', notes: '',
        items: []
    });
    const [scheduleForm, setScheduleForm] = useState({ deliveryDate: '', notes: '', items: [] });
    const [deliveryRows, setDeliveryRows] = useState([]); // [ { id, deliveryDate, contractId, productId, packagingId, quantity } ]

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        navigate('/login');
    };

    // FUNGSI MEMBACA DATA (GET API)
    const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/products?userId=${userId}`);
            setProducts(res.data);
        } catch (error) {
            console.error('Gagal menarik data produk', error);
        } finally {
            setLoadingProducts(false);
        }
    };

    const fetchPurchases = async () => {
        setLoadingPurchases(true);
        try {
            const res = await axios.get('http://localhost:5000/api/purchases');
            setPurchases(res.data);
        } catch (error) {
            console.error('Gagal menarik data purchase', error);
        } finally {
            setLoadingPurchases(false);
        }
    };

    const fetchTeam = async () => {
        setLoadingTeam(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/team?parentId=${userId}`);
            setTeam(res.data);
            // Fetch komisi bulan ini untuk setiap Sales member
            const salesMembers = res.data.filter(m => m.role === 'SALES');
            if (salesMembers.length > 0) {
                const commResults = await Promise.all(
                    salesMembers.map(s =>
                        axios.get(`http://localhost:5000/api/commissions?salesId=${s.id}`)
                            .then(r => ({ id: s.id, total: r.data.grandTotalCommission || 0 }))
                            .catch(() => ({ id: s.id, total: 0 }))
                    )
                );
                const map = {};
                commResults.forEach(({ id, total }) => { map[id] = total; });
                setSalesCommissionMap(map);
            }
        } catch (error) {
            console.error('Gagal menarik data tim', error);
        } finally {
            setLoadingTeam(false);
        }
    };

    const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
            const res = await axios.get('http://localhost:5000/api/orders');
            setOrders(res.data);
        } catch (error) {
            console.error('Gagal menarik data pesanan', error);
        } finally {
            setLoadingOrders(false);
        }
    };

    const fetchProfile = async () => {
        setLoadingProfile(true);
        try {
            const res = await axios.get(`http://localhost:5000/api/user/${userId}`);
            setProfile(res.data);
        } catch (error) {
            console.error('Gagal mengambil profil', error);
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

    const fetchKonsinyasi = async () => {
        setKonsinyasiLoading(true);
        try {
            const [contractRes, konsumenRes] = await Promise.all([
                axios.get(`http://localhost:5000/api/konsinyasi?stokisId=${userId}`),
                axios.get(`http://localhost:5000/api/consumers?parentId=${userId}`),
            ]);
            setKonsinyasiList(contractRes.data);
            setKonsumenList(konsumenRes.data || []);
        } catch (err) {
            console.error('Gagal memuat konsinyasi', err);
        } finally {
            setKonsinyasiLoading(false);
        }
    };

    const openNewKonsinyasi = () => {
        setEditingKonsinyasi(null);
        setKForm({ konsumenId: '', ownerName: '', storeName: '', storeAddress: '', storePhone: '', idCardNo: '', npwpNo: '', billingCycle: 'MONTHLY', startDate: '', endDate: '', notes: '', items: [] });
        setShowKonsinyasiModal(true);
    };

    const openEditKonsinyasi = (c) => {
        setEditingKonsinyasi(c);
        setKForm({
            konsumenId: String(c.konsumenId), ownerName: c.ownerName, storeName: c.storeName,
            storeAddress: c.storeAddress, storePhone: c.storePhone || '', idCardNo: c.idCardNo || '',
            npwpNo: c.npwpNo || '', billingCycle: c.billingCycle, startDate: c.startDate ? c.startDate.slice(0,10) : '',
            endDate: c.endDate ? c.endDate.slice(0,10) : '', notes: c.notes || '',
            items: c.items.map(it => ({ productId: String(it.productId), packagingId: it.packagingId ? String(it.packagingId) : '', priceKonsinyasi: String(it.priceKonsinyasi), maxQtyPerDelivery: String(it.maxQtyPerDelivery || 0) }))
        });
        setShowKonsinyasiModal(true);
    };

    const saveKonsinyasi = async () => {
        if (!kForm.konsumenId || !kForm.ownerName || !kForm.storeName || !kForm.storeAddress) {
            MySwal.fire({ icon: 'warning', title: 'Lengkapi data KYC wajib: Konsumen, Nama Pemilik, Nama Toko, Alamat' }); return;
        }
        if (kForm.items.length === 0) {
            MySwal.fire({ icon: 'warning', title: 'Tambahkan minimal 1 produk konsinyasi' }); return;
        }
        try {
            const payload = { ...kForm, stokisId: userId };
            if (editingKonsinyasi) {
                await axios.put(`http://localhost:5000/api/konsinyasi/${editingKonsinyasi.id}`, payload);
            } else {
                await axios.post('http://localhost:5000/api/konsinyasi', payload);
            }
            setShowKonsinyasiModal(false);
            fetchKonsinyasi();
            MySwal.fire({ icon: 'success', title: editingKonsinyasi ? 'Kontrak diperbarui!' : 'Kontrak dibuat!', timer: 1800, showConfirmButton: false });
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message });
        }
    };

    // Fetch default konsinyasi price from UserPriceTier & UserPackagingTier
    const fetchDefaultKonsinyasiPrice = async (productId, packagingId, konsumenId) => {
        try {
            console.log('[DEBUG FRONTEND] Fetching default price:', { productId, packagingId, konsumenId });
            
            const params = new URLSearchParams({
                productId: productId,
                konsumenId: konsumenId,
                ...(packagingId && { packagingId: packagingId })
            });
            const res = await axios.get(`http://localhost:5000/api/konsinyasi/default-price?${params}`);
            console.log('[DEBUG FRONTEND] Response:', res.data);
            return res.data.defaultPrice || 0;
        } catch (err) {
            console.error('[ERROR FRONTEND] Error fetching default konsinyasi price:', err.response?.data || err.message);
            return 0;
        }
    };

    const deleteKonsinyasi = async (id) => {
        const r = await MySwal.fire({ title: 'Hapus kontrak?', text: 'Hanya kontrak DRAFT yang bisa dihapus.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Hapus', cancelButtonText: 'Batal' });
        if (!r.isConfirmed) return;
        try {
            await axios.delete(`http://localhost:5000/api/konsinyasi/${id}`);
            fetchKonsinyasi();
            if (konsinyasiDetailId === id) setKonsinyasiDetailId(null);
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message });
        }
    };

    const updateKonsinyasiStatus = async (id, status) => {
        try {
            await axios.patch(`http://localhost:5000/api/konsinyasi/${id}/status`, { status });
            fetchKonsinyasi();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal ubah status', text: err.response?.data?.message || err.message });
        }
    };

    const openScheduleModal = (contractId) => {
        setScheduleContractId(contractId);
        const contract = konsinyasiList.find(c => c.id === contractId);
        const defaultItems = contract ? contract.items.map(it => ({ productId: String(it.productId), packagingId: it.packagingId ? String(it.packagingId) : '', quantity: '' })) : [];
        setScheduleForm({ deliveryDate: '', notes: '', items: defaultItems });
        setShowScheduleModal(true);
    };

    const saveSchedule = async () => {
        if (!scheduleForm.deliveryDate) { MySwal.fire({ icon: 'warning', title: 'Pilih tanggal pengiriman' }); return; }
        const validItems = scheduleForm.items.filter(it => it.quantity && parseInt(it.quantity) > 0);
        if (validItems.length === 0) { MySwal.fire({ icon: 'warning', title: 'Isi qty minimal 1 produk' }); return; }
        try {
            await axios.post(`http://localhost:5000/api/konsinyasi/${scheduleContractId}/schedules`, {
                deliveryDate: scheduleForm.deliveryDate,
                notes: scheduleForm.notes,
                items: validItems.map(it => ({ productId: parseInt(it.productId), packagingId: it.packagingId ? parseInt(it.packagingId) : null, quantity: parseInt(it.quantity) }))
            });
            setShowScheduleModal(false);
            fetchKonsinyasi();
            MySwal.fire({ icon: 'success', title: 'Jadwal ditambahkan!', text: 'Pesanan konsinyasi otomatis masuk ke Distribusi dan Pesanan Konsumen.', timer: 2500, showConfirmButton: false });
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message });
        }
    };

    const deleteSchedule = async (scheduleId) => {
        const r = await MySwal.fire({ title: 'Hapus jadwal?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Hapus', cancelButtonText: 'Batal' });
        if (!r.isConfirmed) return;
        try {
            await axios.delete(`http://localhost:5000/api/konsinyasi/schedules/${scheduleId}`);
            fetchKonsinyasi();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message });
        }
    };

    const triggerFirstDelivery = async (contractId) => {
        try {
            await axios.post(`http://localhost:5000/api/konsinyasi/${contractId}/trigger-first-delivery`);
            MySwal.fire({ icon: 'success', title: 'Berhasil', text: 'Pengiriman pertama berhasil dibuat dan masuk ke Distribusi.' });
            fetchKonsinyasi();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message });
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
                // Unit config (packagingId = null)
                const cfg = p.commissionConfigs && p.commissionConfigs[0];
                pc[p.id] = {
                    isActive: cfg ? cfg.isActive : false,
                    commissionType: cfg ? cfg.commissionType : 'CUMULATIVE',
                    packagings: {},
                };
                // Per-packaging configs
                (p.packagings || []).forEach(pkg => {
                    const pkgCfg = pkg.commissionConfigs && pkg.commissionConfigs[0];
                    pc[p.id].packagings[pkg.id] = {
                        isActive: pkgCfg ? pkgCfg.isActive : false,
                        commissionType: pkgCfg ? pkgCfg.commissionType : 'CUMULATIVE',
                    };
                });
            });
            setPendingConfigs(pc);
            setCommCampaigns(campRes.data);
            const salesList = (teamRes.data || []).filter(m => m.role === 'SALES');
            setCommSalesTeam(salesList);
            if (salesList.length > 0) {
                const counts = await Promise.all(salesList.map(s =>
                    axios.get(`http://localhost:5000/api/consumers?salesId=${s.id}`)
                        .then(r => ({ id: s.id, count: r.data.length }))
                        .catch(() => ({ id: s.id, count: 0 }))
                ));
                const cmap = {};
                counts.forEach(({ id, count }) => { cmap[id] = count; });
                setSalesConsumerMap(cmap);
            }
        } catch (err) {
            console.error('Gagal memuat data komisi', err);
        } finally {
            setCommLoading(false);
        }
    };

    const fetchSalesReport = async (sid) => {
        if (salesReportId === sid) { setSalesReportId(null); return; }
        setSalesReportId(sid);
        setSalesReportLoading(true);
        try {
            const [commRes, consRes] = await Promise.all([
                axios.get(`http://localhost:5000/api/commissions?salesId=${sid}`),
                axios.get(`http://localhost:5000/api/consumers?salesId=${sid}`),
            ]);
            setSalesReportData({
                orders: commRes.data.orders || [],
                consumers: consRes.data || [],
                grandTotalCommission: commRes.data.grandTotalCommission || 0,
            });
        } catch (err) {
            console.error('Gagal memuat laporan sales', err);
            setSalesReportData({ orders: [], consumers: [], grandTotalCommission: 0 });
        } finally {
            setSalesReportLoading(false);
        }
    };

    const saveCommissionConfigs = async () => {
        const configs = [];
        Object.entries(pendingConfigs).forEach(([productId, v]) => {
            // Unit row
            configs.push({ productId: parseInt(productId), packagingId: null, isActive: v.isActive, commissionType: v.commissionType });
            // Packaging rows
            Object.entries(v.packagings || {}).forEach(([packagingId, pv]) => {
                configs.push({ productId: parseInt(productId), packagingId: parseInt(packagingId), isActive: pv.isActive, commissionType: pv.commissionType });
            });
        });
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

    // Ambil data jika tab aktif
    useEffect(() => {
        if (activeTab === 'Overview') {
            fetchProducts();
            fetchTeam();
            fetchOrders();
            fetchPurchases();
        } else if (activeTab === 'Produk & Harga') {
            fetchProducts();
        } else if (activeTab === 'Purchasing') {
            fetchProducts(); // need products for dropdown
            fetchPurchases();
        } else if (activeTab === 'Manajemen Tim' || activeTab === 'Manajemen Tier & Pelanggan') {
            fetchTeam();
        } else if (activeTab === 'Distribusi') {
            fetchTeam(); // need 'driver' list
            fetchOrders();
        } else if (activeTab === 'Kunjungan Sales') {
            fetchVisitMarkers();
        } else if (activeTab === 'Komisi Sales') {
            fetchCommissionData();
        } else if (activeTab === 'Daftar Konsinyasi') {
            fetchKonsinyasi();
        } else if (activeTab === 'Pengaturan') {
            fetchProfile();
        }
    }, [activeTab]);

    // Fetch profile on initial mount for header identity
    useEffect(() => {
        fetchProfile();
    }, []);

    // WebSocket / Socket.IO Integration untuk Real-Time Maps
    useEffect(() => {
        if (activeTab === 'Distribusi' && viewMode === 'MAP') {
            const socket = io('http://localhost:5000');
            setSocketInstance(socket);

            // Fetch current locations from API just in case socket hasn't emitted yet
            axios.get('http://localhost:5000/api/live-drivers').then(res => {
                setLiveDrivers(res.data);
            }).catch(console.error);

            socket.on('driverLocationChanged', (data) => {
                // data = { driverId: 1, lat: ..., lng: ..., name: "Acep" }
                setLiveDrivers(prev => ({
                    ...prev,
                    [data.driverId]: data
                }));
            });

            return () => {
                socket.disconnect();
            };
        }
    }, [activeTab, viewMode]);

    // Fetch OSRM road routes whenever live driver locations or orders change
    useEffect(() => {
        const fetchOsrmRoutes = async () => {
            const shipped = orders.filter(o => o.status === 'SHIPPED' && o.driverId && liveDrivers[o.driverId] && o.buyer?.latitude && o.buyer?.longitude);
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

    // MODAL DYNAMIC HANDLERS
    const openAddModal = () => {
        setEditingProductId(null);
        setFormProduct({ name: '', stock: '' });
        setFormTiers([{ level_name: 'Harga Area 1', price: '', commission: '' }]);
        setFormPackagings([]);
        setIsAddModalOpen(true);
    };

    const handleEditProduct = (product) => {
        setEditingProductId(product.id);
        const stockStr = product.stock !== undefined ? String(product.stock) : '';
        setFormProduct({ name: product.name, stock: stockStr });

        if (product.priceTiers && product.priceTiers.length > 0) {
            setFormTiers(product.priceTiers.map(t => ({
                level_name: t.level_name,
                price: t.price,
                commission: t.commission
            })));
        } else {
            setFormTiers([{ level_name: 'Harga Area 1', price: '', commission: '' }]);
        }

        setFormPackagings(product.packagings ? product.packagings.map(pkg => ({
            name: pkg.name,
            unitQty: pkg.unitQty,
            isDefault: pkg.isDefault,
            priceTiers: pkg.priceTiers.map(t => ({ level_name: t.level_name, price: t.price, commission: t.commission })),
        })) : []);

        setIsAddModalOpen(true);
    };

    const handleAddTierRow = () => {
        const newTier = { level_name: '', price: '', commission: '' };
        setFormTiers(prev => [...prev, newTier]);
        // Tambahkan baris tier baru ke setiap kemasan yang sudah ada
        setFormPackagings(prev => prev.map(pkg => ({
            ...pkg,
            priceTiers: [...pkg.priceTiers, { level_name: '', price: '', commission: '' }],
        })));
    };

    const handleRemoveTierRow = (index) => {
        setFormTiers(prev => prev.filter((_, i) => i !== index));
        // Hapus baris tier yang sama dari setiap kemasan
        setFormPackagings(prev => prev.map(pkg => ({
            ...pkg,
            priceTiers: pkg.priceTiers.filter((_, i) => i !== index),
        })));
    };

    const handleTierChange = (index, field, value) => {
        const updatedTiers = [...formTiers];
        updatedTiers[index][field] = value;
        setFormTiers(updatedTiers);
        // Jika nama level diubah, sinkronkan ke semua kemasan agar tetap konsisten
        if (field === 'level_name') {
            setFormPackagings(prev => prev.map(pkg => ({
                ...pkg,
                priceTiers: pkg.priceTiers.map((pt, i) =>
                    i === index ? { ...pt, level_name: value } : pt
                ),
            })));
        }
    };

    const addPackaging = () => {
        setFormPackagings(prev => [...prev, {
            name: 'Dus',
            unitQty: 12,
            isDefault: false,
            priceTiers: formTiers.filter(t => t.level_name).map(t => ({ level_name: t.level_name, price: '', commission: '' })),
        }]);
    };

    const removePackaging = (index) => {
        setFormPackagings(prev => prev.filter((_, i) => i !== index));
    };

    const updatePackaging = (index, field, value) => {
        setFormPackagings(prev => prev.map((pkg, i) => i === index ? { ...pkg, [field]: value } : pkg));
    };

    const updatePackagingTier = (pkgIndex, tierIndex, field, value) => {
        setFormPackagings(prev => prev.map((pkg, i) => {
            if (i !== pkgIndex) return pkg;
            const newTiers = [...pkg.priceTiers];
            newTiers[tierIndex] = { ...newTiers[tierIndex], [field]: value };
            return { ...pkg, priceTiers: newTiers };
        }));
    };

    const submitProduct = async () => {
        if (!formProduct.name) {
            return MySwal.fire({ icon: 'error', title: 'Data Tidak Lengkap', text: 'Nama Produk wajb diisi!', background: 'var(--bg-card)', color: 'var(--text-main)' });
        }

        try {
            const payload = {
                name: formProduct.name,
                stock: formProduct.stock || 0,
                userId: 2, // hardcode stokis untuk v1
                priceTiers: formTiers.filter(t => t.level_name) // Hanya masukkan tier yg dinamai
            };

            let prodId;
            if (editingProductId) {
                await axios.put(`http://localhost:5000/api/products/${editingProductId}`, payload);
                prodId = editingProductId;
                MySwal.fire({
                    icon: 'success', title: 'Berhasil!', text: 'Produk SKU beserta Logic Multi-Area-nya berhasil diperbarui.',
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false
                });
            } else {
                const res = await axios.post('http://localhost:5000/api/products', payload);
                prodId = res.data.id;
                MySwal.fire({
                    icon: 'success', title: 'Berhasil!', text: 'Produk SKU beserta Logic Multi-Area-nya ditambahkan ke database.',
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false
                });
            }

            // Save packagings (bulk replace)
            await axios.post(`http://localhost:5000/api/products/${prodId}/packagings/bulk`, {
                packagings: formPackagings.map(pkg => ({
                    name: pkg.name,
                    unitQty: parseInt(pkg.unitQty) || 1,
                    isDefault: pkg.isDefault,
                    priceTiers: pkg.priceTiers.filter(t => t.level_name),
                })),
            });

            setIsAddModalOpen(false);
            setEditingProductId(null);
            setFormProduct({ name: '', stock: '' });
            setFormTiers([{ level_name: 'Harga Area 1', price: '', commission: '' }]);
            setFormPackagings([]);
            fetchProducts();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.message, background: 'var(--bg-card)' });
        }
    };

    const handleDeleteProduct = async (id, name) => {
        const result = await MySwal.fire({
            title: 'Hapus SKU?',
            text: `Anda yakin ingin menghapus "${name}" beserta seluruh data historis harga tier-nya secara permanen?`,
            icon: 'warning',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: 'var(--bg-hover)',
            confirmButtonText: 'Ya, Musnahkan!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`http://localhost:5000/api/products/${id}`);
                MySwal.fire({
                    icon: 'success', title: 'Terhapus!', text: `Data ${name} telah dilenyapkan dari database.`,
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2000, showConfirmButton: false
                });
                fetchProducts();
            } catch (err) {
                MySwal.fire({ icon: 'error', title: 'Gagal Menghapus', text: err.response?.data?.message || err.message, background: 'var(--bg-card)' });
            }
        }
    };

    const submitRestock = async () => {
        if (!formRestock.productId || !formRestock.quantity || !formRestock.price_buy) {
            return MySwal.fire({ icon: 'error', title: 'Data Tidak Lengkap', text: 'Semua field wajib diisi!', background: 'var(--bg-card)', color: 'var(--text-main)' });
        }

        try {
            const payload = {
                productId: formRestock.productId,
                quantity: formRestock.quantity,
                price_buy: formRestock.price_buy,
                userId: 2 // hardcoded stokis ID for now
            };

            await axios.post('http://localhost:5000/api/purchases', payload);

            MySwal.fire({
                icon: 'success', title: 'Berhasil!', text: 'Restock SKU berhasil dicatat dan stok bertambah.',
                background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false
            });

            setIsRestockModalOpen(false);
            setFormRestock({ productId: '', quantity: '', price_buy: '' });
            fetchPurchases();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message, background: 'var(--bg-card)' });
        }
    };

    const openAddTeamModal = () => {
        setEditingTeamId(null);
        setTeamModalRoles(['SALES', 'DRIVER']);
        setFormTeam({ name: '', email: '', password: '', role: 'SALES', contact: '', address: '', store_name: '', price_level: 'Harga Umum' });
        setIsAddTeamModalOpen(true);
    };

    const openAddCustomerModal = () => {
        setEditingTeamId(null);
        setTeamModalRoles(['SUBSTOKIS', 'KONSUMEN', 'MEMBER']);
        setFormTeam({ name: '', email: '', password: '', role: 'SUBSTOKIS', contact: '', address: '', store_name: '', price_level: 'Harga Umum' });
        setIsAddTeamModalOpen(true);
    };

    const handleEditCustomer = (member) => {
        setEditingTeamId(member.id);
        setTeamModalRoles(['SUBSTOKIS', 'KONSUMEN', 'MEMBER']);
        setFormTeam({
            name: member.name || '',
            email: member.email || '',
            password: '',
            role: member.role || 'SUBSTOKIS',
            contact: member.contact || '',
            address: member.address || '',
            store_name: member.store_name || '',
            price_level: member.price_level || 'Harga Umum'
        });
        setIsAddTeamModalOpen(true);
    };

    const handleEditTeam = (member) => {
        setEditingTeamId(member.id);
        setFormTeam({
            name: member.name || '',
            email: member.email || '',
            password: '', // leave empty, only update if filled
            role: member.role || 'SALES',
            contact: member.contact || '',
            address: member.address || '',
            store_name: member.store_name || '',
            price_level: member.price_level || 'Harga Umum'
        });
        setIsAddTeamModalOpen(true);
    };

    const submitTeamMember = async () => {
        // require password only if creating a new member
        if (!formTeam.name || !formTeam.email || (!editingTeamId && !formTeam.password) || !formTeam.role) {
            return MySwal.fire({ icon: 'error', title: 'Data Tidak Lengkap', text: 'Nama, Email, dan Password(untuk user baru) wajib diisi!', background: 'var(--bg-card)', color: 'var(--text-main)' });
        }

        try {
            if (editingTeamId) {
                await axios.put(`http://localhost:5000/api/team/${editingTeamId}`, formTeam);
                MySwal.fire({
                    icon: 'success', title: 'Berhasil!', text: `Data akun ${formTeam.role} berhasil diperbarui.`,
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false
                });
            } else {
                await axios.post('http://localhost:5000/api/team', formTeam);
                MySwal.fire({
                    icon: 'success', title: 'Berhasil!', text: `Akun ${formTeam.role} baru berhasil dibuat.`,
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false
                });
            }

            setIsAddTeamModalOpen(false);
            setEditingTeamId(null);
            setFormTeam({ name: '', email: '', password: '', role: 'SALES', contact: '', address: '', store_name: '', price_level: 'Harga Umum', latitude: '', longitude: '' });
            setTeamMapPickerCoord(null);
            fetchTeam();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message, background: 'var(--bg-card)', color: 'var(--text-main)' });
        }
    };

    const handleDeleteTeam = async (id, name, role) => {
        const result = await MySwal.fire({
            title: `Pecat ${role}?`,
            text: `Anda yakin ingin menghapus akun "${name}" secara permanen dari sistem?`,
            icon: 'warning',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: 'var(--bg-hover)',
            confirmButtonText: 'Ya, Pecat!',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                await axios.delete(`http://localhost:5000/api/team/${id}`);
                MySwal.fire({
                    icon: 'success', title: 'Terhapus!', text: `Akun ${name} telah dihapus dari sistem Stokis.`,
                    background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2000, showConfirmButton: false
                });
                fetchTeam();
            } catch (err) {
                MySwal.fire({ icon: 'error', title: 'Gagal Menghapus', text: err.response?.data?.message || err.message, background: 'var(--bg-card)' });
            }
        }
    };

    const handleGenerateDummyOrder = async () => {
        try {
            await axios.post('http://localhost:5000/api/orders/dummy');
            MySwal.fire({
                icon: 'success', title: 'Simulasi Terkirim', text: 'Pesanan dummy baru dari agen/cabang berhasil disimulasikan.',
                background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2000, showConfirmButton: false
            });
            fetchOrders();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message, background: 'var(--bg-card)' });
        }
    };

    const handleUpdateOrderStatus = async (orderId, newStatus, driverId = null) => {
        try {
            await axios.put(`http://localhost:5000/api/orders/${orderId}/status`, { status: newStatus, driverId });
            MySwal.fire({
                icon: 'success', title: 'Status Diperbarui', text: `Order dialihkan ke status: ${newStatus}`,
                background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2000, showConfirmButton: false
            });
            fetchOrders();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: err.response?.data?.message || err.message, background: 'var(--bg-card)' });
        }
    };

    // FUNGSI HANDLER SET HARGA INDIVIDUAL PER PRODUK
    const openPricingModal = async (user) => {
        setPricingTargetUser(user);
        setIsPricingModalOpen(true);
        // fetch existing overrides
        try {
            const res = await axios.get(`http://localhost:5000/api/team/${user.id}/pricing`);
            setPricingOverrides(res.data.unitOverrides || []);
            setPackagingOverrides(res.data.packagingOverrides || []);
        } catch (error) {
            console.error(error);
            setPricingOverrides([]);
            setPackagingOverrides([]);
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

    const handlePackagingTierChange = (packagingId, level_name) => {
        setPackagingOverrides(prev => {
            const existing = prev.find(p => p.packagingId === packagingId);
            if (existing) {
                return prev.map(p => p.packagingId === packagingId ? { ...p, level_name } : p);
            } else {
                return [...prev, { packagingId, level_name }];
            }
        });
    };

    const savePricingOverrides = async () => {
        try {
            await axios.post(`http://localhost:5000/api/team/${pricingTargetUser.id}/pricing`, {
                pricingOverrides: pricingOverrides.filter(p => p.level_name),
                packagingOverrides: packagingOverrides.filter(p => p.level_name),
            });
            MySwal.fire({
                toast: true, position: 'top-end', icon: 'success', title: `Harga spesifik ${pricingTargetUser.name} tersimpan!`,
                showConfirmButton: false, timer: 2000, background: 'var(--bg-card)', color: 'var(--text-main)'
            });
            setIsPricingModalOpen(false);
            fetchTeam();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat menyimpan hak harga spesifik.', background: 'var(--bg-card)' });
        }
    };

    const handleUpdateProfile = async () => {
        setLoadingProfile(true);
        try {
            await axios.put(`http://localhost:5000/api/team/${userId}`, {
                name: profile.name,
                email: profile.email,
                role: 'STOKIS',
                address: profile.address,
                store_name: profile.store_name,
                contact: profile.contact
            });
            MySwal.fire({
                icon: 'success', title: 'Profil Diperbarui', text: 'Informasi bisnis Anda telah berhasil disimpan.',
                background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2000, showConfirmButton: false
            });
            fetchProfile();
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat memperbarui profil bisnis.', background: 'var(--bg-card)' });
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
                    role: 'STOKIS'
                });
                MySwal.fire({ icon: 'success', title: 'Berhasil', text: 'Password anda telah diperbarui.', background: 'var(--bg-card)' });
            } catch (err) {
                MySwal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat mengubah password saat ini.', background: 'var(--bg-card)' });
            }
        }
    };

    const openEditProfile = () => {
        setFormEditProfile({
            name: profile.name || '',
            email: profile.email || '',
            store_name: profile.store_name || '',
            contact: profile.contact || '',
            address: profile.address || '',
            latitude: profile.latitude || '',
            longitude: profile.longitude || '',
        });
        setIsProfileDropdownOpen(false);
        setIsEditProfileModalOpen(true);
    };

    const handleSaveProfile = async () => {
        try {
            await axios.put(`http://localhost:5000/api/user/${userId}`, {
                ...formEditProfile,
                latitude: formEditProfile.latitude !== '' ? parseFloat(formEditProfile.latitude) : null,
                longitude: formEditProfile.longitude !== '' ? parseFloat(formEditProfile.longitude) : null,
            });
            setProfile(prev => ({ ...prev, ...formEditProfile }));
            setIsEditProfileModalOpen(false);
            MySwal.fire({ icon: 'success', title: 'Profil Diperbarui!', text: 'Data profil Anda berhasil disimpan.', background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2000, showConfirmButton: false });
        } catch (err) {
            MySwal.fire({ icon: 'error', title: 'Gagal', text: 'Tidak dapat menyimpan perubahan profil.', background: 'var(--bg-card)' });
        }
    };

    const navigation = [
        {
            category: 'Dashboard',
            items: [
                { name: 'Overview', icon: <Activity size={18} /> },
                { name: 'Laporan', icon: <BarChart3 size={18} /> },
            ]
        },
        {
            category: 'Logistik & Stok',
            items: [
                { name: 'Produk & Harga', icon: <Diamond size={18} /> },
                { name: 'Purchasing', icon: <ShoppingCart size={18} /> },
            ]
        },
        {
            category: 'Jaringan & Distribusi',
            items: [
                { name: 'Manajemen Tim', icon: <Users size={18} /> },
                { name: 'Manajemen Tier & Pelanggan', icon: <Users size={18} /> },
                { name: 'Distribusi', icon: <Truck size={18} /> },
                { name: 'Daftar Konsinyasi', icon: <FileText size={18} /> },
                { name: 'Rencana Pengiriman', icon: <BarChart3 size={18} /> },
                { name: 'Kunjungan Sales', icon: <MapPin size={18} /> },
                { name: 'Komisi Sales', icon: <Gift size={18} /> },
            ]
        },
        {
            category: 'Preferensi',
            items: [
                { name: 'Pengaturan', icon: <Settings size={18} /> },
            ]
        }
    ];

    const renderContent = () => {
        if (activeTab === 'Overview') {
            // Kalkulasi Total Pendapatan dari Order (Kotor)
            const totalRevenue = orders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

            // Kalkulasi Total Stok Terjual/Didistribusikan
            let totalDistributedItems = 0;
            orders.forEach(order => {
                if (order.items) {
                    order.items.forEach(item => { totalDistributedItems += item.quantity });
                }
            });

            // Kalkulasi Jaringan Aktif
            const subStokisCount = team.filter(t => t.role === 'SUBSTOKIS').length;
            const salesCount = team.filter(t => t.role === 'SALES').length;
            const driverCount = team.filter(t => t.role === 'DRIVER').length;

            // Stok kritis: produk dengan stok < 10
            const lowStockProducts = products.filter(p => p.stock < 10);

            // Status order counts
            const pendingOrders = orders.filter(o => o.status === 'PENDING').length;
            const deliveredOrders = orders.filter(o => o.status === 'DELIVERED').length;

            // Greeting based on time
            const hour = new Date().getHours();
            const greeting = hour < 12 ? 'Selamat Pagi' : hour < 17 ? 'Selamat Siang' : 'Selamat Malam';
            const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            const kpiCards = [
                {
                    label: 'Total Pendapatan',
                    value: `Rp ${totalRevenue.toLocaleString('id-ID')}`,
                    sub: `${orders.length} transaksi tercatat`,
                    icon: <DollarSign size={20} />,
                    iconBg: 'rgba(129,140,248,0.15)',
                    iconColor: '#818cf8',
                    accentColor: '#818cf8',
                    badge: { label: 'Akumulatif', color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
                },
                {
                    label: 'Barang Didistribusikan',
                    value: `${totalDistributedItems.toLocaleString('id-ID')} Unit`,
                    sub: `Dari ${deliveredOrders} order selesai`,
                    icon: <Package size={20} />,
                    iconBg: 'rgba(16,185,129,0.15)',
                    iconColor: '#10b981',
                    accentColor: '#10b981',
                    badge: { label: 'Live', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
                },
                {
                    label: 'Jaringan Aktif',
                    value: `${subStokisCount + salesCount + driverCount} Mitra`,
                    sub: `${subStokisCount} Cabang · ${salesCount} Sales · ${driverCount} Driver`,
                    icon: <Users size={20} />,
                    iconBg: 'rgba(251,146,60,0.15)',
                    iconColor: '#fb923c',
                    accentColor: '#fb923c',
                    badge: null,
                },
                {
                    label: 'Order Menunggu',
                    value: `${pendingOrders} Order`,
                    sub: pendingOrders > 0 ? 'Perlu segera diproses' : 'Semua order tertangani',
                    icon: <Clock size={20} />,
                    iconBg: pendingOrders > 0 ? 'rgba(234,179,8,0.15)' : 'rgba(16,185,129,0.15)',
                    iconColor: pendingOrders > 0 ? '#eab308' : '#10b981',
                    accentColor: pendingOrders > 0 ? '#eab308' : '#10b981',
                    badge: pendingOrders > 0 ? { label: 'Urgent', color: '#eab308', bg: 'rgba(234,179,8,0.12)' } : null,
                },
            ];

            const quickActions = [
                { label: 'Daftar SKU Baru', desc: 'Tambah produk ke katalog', icon: <Plus size={18} />, iconBg: 'rgba(129,140,248,0.15)', iconColor: '#818cf8', tab: 'Produk & Harga' },
                { label: 'Catat Restock', desc: 'Purchasing dari pabrik', icon: <ShoppingCart size={18} />, iconBg: 'rgba(16,185,129,0.15)', iconColor: '#10b981', tab: 'Purchasing' },
                { label: 'Monitor Armada', desc: 'Lacak distribusi & driver', icon: <Truck size={18} />, iconBg: 'rgba(251,146,60,0.15)', iconColor: '#fb923c', tab: 'Distribusi' },
                { label: 'Rekrut Anggota', desc: 'Tambah tim substokis/sales', icon: <Users size={18} />, iconBg: 'rgba(232,121,249,0.15)', iconColor: '#e879f9', tab: 'Manajemen Tim' },
            ];

            const getStatusConfig = (status) => {
                if (status === 'DELIVERED') return { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Terkirim', icon: <CheckCircle2 size={12} /> };
                if (status === 'SHIPPED') return { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: 'Dikirim', icon: <Truck size={12} /> };
                return { color: '#eab308', bg: 'rgba(234,179,8,0.12)', label: 'Pending', icon: <Clock size={12} /> };
            };

            return (
                <div className="animate-fade-up">
                    <style>{`
                        .ov-welcome {
                            background: linear-gradient(135deg, rgba(129,140,248,0.1) 0%, rgba(232,121,249,0.06) 50%, transparent 100%);
                            border: 1px solid rgba(129,140,248,0.18);
                            border-radius: 16px;
                            padding: 1.75rem 2rem;
                            margin-bottom: 1.75rem;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 1rem;
                            position: relative;
                            overflow: hidden;
                        }
                        .ov-welcome::before {
                            content: '';
                            position: absolute;
                            top: -60px; right: -60px;
                            width: 200px; height: 200px;
                            background: radial-gradient(circle, rgba(129,140,248,0.15) 0%, transparent 70%);
                            pointer-events: none;
                        }
                        .ov-kpi-grid {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 1.25rem;
                            margin-bottom: 1.5rem;
                        }
                        @media (max-width: 1100px) { .ov-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
                        @media (max-width: 640px) { .ov-kpi-grid { grid-template-columns: 1fr; } }
                        .ov-kpi-card {
                            background: var(--bg-card);
                            border: 1px solid var(--border-color);
                            border-radius: 14px;
                            padding: 1.25rem 1.5rem;
                            display: flex;
                            flex-direction: column;
                            gap: 0.85rem;
                            transition: border-color 0.2s, transform 0.2s;
                            position: relative;
                            overflow: hidden;
                        }
                        .ov-kpi-card:hover { transform: translateY(-2px); }
                        .ov-kpi-card-accent {
                            position: absolute;
                            bottom: 0; left: 0; right: 0;
                            height: 2px;
                        }
                        .ov-kpi-top { display: flex; justify-content: space-between; align-items: flex-start; }
                        .ov-kpi-icon {
                            width: 40px; height: 40px;
                            border-radius: 10px;
                            display: flex; align-items: center; justify-content: center;
                            flex-shrink: 0;
                        }
                        .ov-kpi-badge {
                            font-size: 0.65rem;
                            font-weight: 600;
                            padding: 0.15rem 0.45rem;
                            border-radius: 999px;
                            letter-spacing: 0.04em;
                            text-transform: uppercase;
                        }
                        .ov-kpi-value {
                            font-size: 1.6rem;
                            font-weight: 800;
                            color: var(--text-main);
                            line-height: 1.1;
                        }
                        .ov-kpi-sub {
                            font-size: 0.75rem;
                            color: var(--text-muted);
                            margin-top: 0.15rem;
                        }
                        .ov-bottom-grid {
                            display: grid;
                            grid-template-columns: 1fr 340px;
                            gap: 1.25rem;
                        }
                        @media (max-width: 1000px) { .ov-bottom-grid { grid-template-columns: 1fr; } }
                        .ov-section-card {
                            background: var(--bg-card);
                            border: 1px solid var(--border-color);
                            border-radius: 14px;
                            padding: 1.5rem;
                        }
                        .ov-section-header {
                            display: flex; justify-content: space-between; align-items: center;
                            margin-bottom: 1.25rem;
                        }
                        .ov-section-title {
                            font-size: 0.95rem;
                            font-weight: 700;
                            color: var(--text-main);
                        }
                        .ov-order-item {
                            display: flex;
                            align-items: center;
                            gap: 1rem;
                            padding: 0.875rem 1rem;
                            border-radius: 10px;
                            border: 1px solid var(--border-color);
                            background: rgba(255,255,255,0.01);
                            margin-bottom: 0.6rem;
                            transition: background 0.15s;
                            cursor: default;
                        }
                        .ov-order-item:last-child { margin-bottom: 0; }
                        .ov-order-item:hover { background: rgba(255,255,255,0.03); }
                        .ov-order-avatar {
                            width: 36px; height: 36px;
                            border-radius: 9px;
                            background: linear-gradient(135deg, rgba(129,140,248,0.2), rgba(232,121,249,0.2));
                            display: flex; align-items: center; justify-content: center;
                            font-size: 1rem;
                            flex-shrink: 0;
                        }
                        .ov-status-pill {
                            display: inline-flex; align-items: center; gap: 4px;
                            font-size: 0.68rem; font-weight: 600;
                            padding: 0.2rem 0.55rem;
                            border-radius: 999px;
                            text-transform: uppercase;
                            letter-spacing: 0.03em;
                        }
                        .ov-qa-item {
                            display: flex;
                            align-items: center;
                            gap: 0.875rem;
                            padding: 0.85rem 1rem;
                            border-radius: 10px;
                            border: 1px solid var(--border-color);
                            background: rgba(255,255,255,0.01);
                            margin-bottom: 0.6rem;
                            cursor: pointer;
                            transition: background 0.15s, border-color 0.15s;
                            width: 100%;
                            text-align: left;
                        }
                        .ov-qa-item:last-child { margin-bottom: 0; }
                        .ov-qa-item:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); }
                        .ov-qa-icon {
                            width: 36px; height: 36px;
                            border-radius: 9px;
                            display: flex; align-items: center; justify-content: center;
                            flex-shrink: 0;
                        }
                        .ov-low-stock-item {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 0.6rem 0;
                            border-bottom: 1px solid rgba(255,255,255,0.05);
                            font-size: 0.8rem;
                        }
                        .ov-low-stock-item:last-child { border-bottom: none; }
                        .ov-download-btn {
                            display: inline-flex;
                            align-items: center;
                            gap: 0.4rem;
                            background: rgba(255,255,255,0.05);
                            border: 1px solid rgba(255,255,255,0.1);
                            color: var(--text-main);
                            border-radius: 8px;
                            padding: 0.4rem 0.85rem;
                            font-size: 0.8rem;
                            font-weight: 500;
                            cursor: pointer;
                            font-family: inherit;
                            transition: background 0.15s;
                        }
                        .ov-download-btn:hover { background: rgba(255,255,255,0.09); }
                        .ov-view-btn {
                            display: inline-flex;
                            align-items: center;
                            gap: 0.3rem;
                            background: transparent;
                            border: none;
                            color: var(--primary);
                            font-size: 0.78rem;
                            font-weight: 600;
                            cursor: pointer;
                            font-family: inherit;
                            padding: 0;
                        }
                        .ov-view-btn:hover { opacity: 0.8; }
                        .ov-empty {
                            text-align: center;
                            padding: 2rem 1rem;
                            color: var(--text-muted);
                            font-size: 0.85rem;
                            border: 1px dashed rgba(255,255,255,0.1);
                            border-radius: 10px;
                        }
                    `}</style>

                    {/* ── Welcome Banner ── */}
                    <div className="ov-welcome">
                        <div>
                            <div style={{ fontSize: '0.78rem', color: 'rgba(244,244,245,0.45)', marginBottom: '0.3rem' }}>{todayStr}</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f4f4f5', lineHeight: 1.2 }}>
                                {greeting}, <span style={{ background: 'linear-gradient(135deg,#818cf8,#e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{profile.name || 'Stokis'}</span> 👋
                            </div>
                            <div style={{ fontSize: '0.83rem', color: 'rgba(244,244,245,0.45)', marginTop: '0.35rem' }}>
                                {profile.store_name && <span>{profile.store_name} · </span>}Pantau operasional bisnis Anda hari ini.
                            </div>
                        </div>
                        <button className="ov-download-btn" onClick={() => setActiveTab('Laporan')}>
                            <BarChart3 size={14} /> Lihat Laporan
                        </button>
                    </div>

                    {/* ── KPI Cards ── */}
                    <div className="ov-kpi-grid">
                        {kpiCards.map((card, i) => (
                            <div className="ov-kpi-card animate-fade-up" key={i} style={{ animationDelay: `${i * 60}ms` }}>
                                <div className="ov-kpi-top">
                                    <div className="ov-kpi-icon" style={{ background: card.iconBg, color: card.iconColor }}>{card.icon}</div>
                                    {card.badge && (
                                        <span className="ov-kpi-badge" style={{ color: card.badge.color, background: card.badge.bg }}>{card.badge.label}</span>
                                    )}
                                </div>
                                <div>
                                    <div className="ov-kpi-value">{card.value}</div>
                                    <div className="ov-kpi-sub">{card.sub}</div>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{card.label}</div>
                                <div className="ov-kpi-card-accent" style={{ background: `linear-gradient(90deg, ${card.accentColor}, transparent)` }} />
                            </div>
                        ))}
                    </div>

                    {/* ── Bottom Section ── */}
                    <div className="ov-bottom-grid">
                        {/* Left: Recent Orders */}
                        <div>
                            <div className="ov-section-card" style={{ marginBottom: '1.25rem' }}>
                                <div className="ov-section-header">
                                    <div>
                                        <div className="ov-section-title">Aktivitas Distribusi Terbaru</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            {orders.length} total order dalam sistem
                                        </div>
                                    </div>
                                    <button className="ov-view-btn" onClick={() => setActiveTab('Distribusi')}>
                                        Lihat Semua <ArrowUpRight size={13} />
                                    </button>
                                </div>

                                {orders.length === 0 ? (
                                    <div className="ov-empty">
                                        <Layers size={28} style={{ margin: '0 auto 0.5rem', color: 'rgba(255,255,255,0.15)' }} />
                                        Belum ada transaksi distribusi.
                                    </div>
                                ) : (
                                    orders.slice(0, 5).map((order) => {
                                        const sc = getStatusConfig(order.status);
                                        const storeName = order.buyer?.store_name || order.buyer?.name || 'Agen';
                                        const initial = storeName.charAt(0).toUpperCase();
                                        return (
                                            <div className="ov-order-item" key={order.id}>
                                                <div className="ov-order-avatar">{initial}</div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {storeName}
                                                    </div>
                                                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                        {order.invoice_id}
                                                        {order.driver?.name && <span> · Driver: {order.driver.name}</span>}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                        Rp {(order.total_amount || 0).toLocaleString('id-ID')}
                                                    </div>
                                                    <span className="ov-status-pill" style={{ color: sc.color, background: sc.bg }}>
                                                        {sc.icon} {sc.label}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Low Stock Alert */}
                            {lowStockProducts.length > 0 && (
                                <div className="ov-section-card" style={{ borderColor: 'rgba(234,179,8,0.2)', background: 'rgba(234,179,8,0.03)' }}>
                                    <div className="ov-section-header" style={{ marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <AlertTriangle size={15} style={{ color: '#eab308' }} />
                                            <span className="ov-section-title">Stok Kritis</span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#eab308', background: 'rgba(234,179,8,0.12)', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                                                {lowStockProducts.length} SKU
                                            </span>
                                        </div>
                                        <button className="ov-view-btn" onClick={() => setActiveTab('Purchasing')}>
                                            Restock <ArrowUpRight size={13} />
                                        </button>
                                    </div>
                                    {lowStockProducts.slice(0, 4).map((p) => (
                                        <div className="ov-low-stock-item" key={p.id}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.stock === 0 ? '#ef4444' : '#eab308', flexShrink: 0 }} />
                                                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{p.name}</span>
                                                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{p.code}</span>
                                            </div>
                                            <span style={{ color: p.stock === 0 ? '#ef4444' : '#eab308', fontWeight: 700, fontSize: '0.83rem' }}>
                                                {p.stock === 0 ? 'HABIS' : `${p.stock} unit`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right: Quick Actions + Network Summary */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="ov-section-card">
                                <div className="ov-section-header" style={{ marginBottom: '1rem' }}>
                                    <div className="ov-section-title">Aksi Cepat</div>
                                    <Zap size={15} style={{ color: '#eab308' }} />
                                </div>
                                {quickActions.map((qa, i) => (
                                    <button key={i} className="ov-qa-item" onClick={() => setActiveTab(qa.tab)}>
                                        <div className="ov-qa-icon" style={{ background: qa.iconBg, color: qa.iconColor }}>{qa.icon}</div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{qa.label}</div>
                                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{qa.desc}</div>
                                        </div>
                                        <ArrowUpRight size={14} style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 'auto', flexShrink: 0 }} />
                                    </button>
                                ))}
                            </div>

                            {/* Network Summary */}
                            <div className="ov-section-card">
                                <div className="ov-section-header" style={{ marginBottom: '1rem' }}>
                                    <div className="ov-section-title">Ringkasan Jaringan</div>
                                </div>
                                {[
                                    { label: 'Substokis / Cabang', count: subStokisCount, color: '#818cf8', icon: <Diamond size={13} /> },
                                    { label: 'Sales / Reseller', count: salesCount, color: '#10b981', icon: <TrendingUp size={13} /> },
                                    { label: 'Driver Armada', count: driverCount, color: '#fb923c', icon: <Truck size={13} /> },
                                ].map((row, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                            <span style={{ color: row.color }}>{row.icon}</span>
                                            {row.label}
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{row.count}</span>
                                    </div>
                                ))}
                                <button className="ov-view-btn" style={{ marginTop: '1rem', display: 'flex' }} onClick={() => setActiveTab('Manajemen Tim')}>
                                    Kelola Tim <ArrowUpRight size={13} />
                                </button>
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
                        .ph-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:1.75rem; gap:1rem; }
                        .ph-add-btn {
                            display:inline-flex; align-items:center; gap:0.5rem;
                            background: linear-gradient(135deg,#818cf8,#a855f7);
                            color:#fff; border:none; border-radius:10px;
                            padding:0.6rem 1.1rem; font-size:0.875rem; font-weight:600;
                            cursor:pointer; font-family:inherit;
                            box-shadow:0 4px 18px rgba(129,140,248,0.35);
                            transition:opacity 0.2s,transform 0.15s;
                        }
                        .ph-add-btn:hover { opacity:0.88; transform:translateY(-1px); }

                        /* Card list */
                        .ph-list { display:flex; flex-direction:column; gap:0; border:1px solid var(--border-color); border-radius:14px; overflow:hidden; }
                        .ph-list-header {
                            display:grid;
                            grid-template-columns: 140px 190px 1fr 110px;
                            background:rgba(255,255,255,0.025);
                            border-bottom:1px solid var(--border-color);
                        }
                        .ph-list-header-cell {
                            padding:0.7rem 1.1rem;
                            font-size:0.65rem; font-weight:700; letter-spacing:0.1em;
                            text-transform:uppercase; color:rgba(161,161,170,0.45);
                            border-right:1px solid var(--border-color);
                        }
                        .ph-list-header-cell:last-child { border-right:none; text-align:center; }
                        .ph-list-header-cell:nth-child(2) { text-align:center; }

                        /* Product card row */
                        .ph-card {
                            display:grid;
                            grid-template-columns: 140px 190px 1fr 110px;
                            background:var(--bg-card);
                            border-bottom:1px solid var(--border-color);
                            transition:background 0.15s;
                        }
                        .ph-card:last-child { border-bottom:none; }
                        .ph-card:hover { background:#1d1d20; }

                        .ph-col {
                            padding:1.1rem 1.1rem;
                            border-right:1px solid rgba(255,255,255,0.05);
                            display:flex;
                            align-items:center;
                        }
                        .ph-col:last-child { border-right:none; }

                        /* SKU col */
                        .ph-col-sku { justify-content:center; }
                        .ph-sku-badge {
                            font-family:monospace; font-size:0.77rem; font-weight:800;
                            color:#a5b4fc; background:rgba(129,140,248,0.1);
                            border:1px solid rgba(129,140,248,0.22);
                            padding:0.3rem 0.65rem; border-radius:8px;
                            letter-spacing:0.06em; white-space:nowrap;
                        }

                        /* Info col */
                        .ph-col-info { flex-direction:column; align-items:flex-start; justify-content:center; gap:0.35rem; }
                        .ph-product-name { font-size:0.88rem; font-weight:700; color:var(--text-main); line-height:1.3; }
                        .ph-stock-chip {
                            display:inline-flex; align-items:center; gap:0.3rem;
                            font-size:0.7rem; font-weight:600;
                            padding:0.18rem 0.55rem; border-radius:999px;
                        }

                        /* Tier col */
                        .ph-col-tiers { flex-direction:column; gap:0.35rem; align-items:stretch; padding:0.85rem 1.1rem; }
                        .ph-tier-row {
                            display:grid;
                            grid-template-columns: 1fr auto auto;
                            gap:0.75rem;
                            align-items:center;
                            padding:0.5rem 0.75rem;
                            border-radius:8px;
                            background:rgba(255,255,255,0.025);
                            border:1px solid rgba(255,255,255,0.05);
                            transition:background 0.12s;
                        }
                        .ph-tier-row:hover { background:rgba(255,255,255,0.045); }
                        .ph-tier-name {
                            font-size:0.78rem; font-weight:500; color:var(--text-muted);
                            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                        }
                        .ph-tier-price-block { text-align:right; }
                        .ph-tier-price-label { font-size:0.58rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:rgba(161,161,170,0.4); display:block; margin-bottom:1px; }
                        .ph-tier-price-value { font-size:0.8rem; font-weight:700; color:var(--text-main); }
                        .ph-tier-comm-block { text-align:right; min-width:90px; }
                        .ph-tier-comm-label { font-size:0.58rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:rgba(129,140,248,0.6); display:block; margin-bottom:1px; }
                        .ph-tier-comm-value { font-size:0.8rem; font-weight:700; color:#818cf8; }

                        /* Action col */
                        .ph-col-actions { flex-direction:column; gap:0.4rem; justify-content:center; align-items:center; }
                        .ph-btn-edit {
                            display:inline-flex; align-items:center; justify-content:center; gap:0.3rem;
                            font-size:0.73rem; font-weight:600; font-family:inherit;
                            padding:0.38rem 0; width:80px; border-radius:7px; cursor:pointer;
                            background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
                            color:var(--text-main);
                            transition:background 0.15s,border-color 0.15s;
                        }
                        .ph-btn-edit:hover { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); }
                        .ph-btn-del {
                            display:inline-flex; align-items:center; justify-content:center; gap:0.3rem;
                            font-size:0.73rem; font-weight:600; font-family:inherit;
                            padding:0.38rem 0; width:80px; border-radius:7px; cursor:pointer;
                            background:rgba(239,68,68,0.07); border:1px solid rgba(239,68,68,0.2);
                            color:#f87171;
                            transition:background 0.15s,border-color 0.15s;
                        }
                        .ph-btn-del:hover { background:rgba(239,68,68,0.14); border-color:rgba(239,68,68,0.38); }
                        .ph-empty { padding:4rem 2rem; text-align:center; color:var(--text-muted); font-size:0.875rem; background:var(--bg-card); }
                        .ph-loading { padding:4rem 2rem; text-align:center; color:var(--text-muted); font-size:0.875rem; background:var(--bg-card); }
                    `}</style>

                    {/* Header */}
                    <div className="ph-header">
                        <div>
                            <h2 className="text-xl font-bold">Katalog SKU & Skema Harga</h2>
                            <p className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>
                                {products.length} produk terdaftar · Tersinkronisasi dengan MySQL
                            </p>
                        </div>
                        <button className="ph-add-btn" onClick={openAddModal}>
                            <Plus size={15} /> Daftarkan SKU Baru
                        </button>
                    </div>

                    <div className="ph-list">
                        {/* Header row */}
                        <div className="ph-list-header">
                            <div className="ph-list-header-cell">Kode SKU</div>
                            <div className="ph-list-header-cell">Info Produk</div>
                            <div className="ph-list-header-cell">Tier Harga & Komisi</div>
                            <div className="ph-list-header-cell">Aksi</div>
                        </div>

                        {loadingProducts ? (
                            <div className="ph-loading">Mengambil data dari database...</div>
                        ) : products.length === 0 ? (
                            <div className="ph-empty">
                                <Package size={32} style={{ margin: '0 auto 0.75rem', color: 'rgba(255,255,255,0.12)' }} />
                                Belum ada produk terdaftar. Mulai dengan mendaftarkan SKU pertama.
                            </div>
                        ) : (
                            products.map((p) => {
                                const stockColor = p.stock === 0 ? '#ef4444' : p.stock < 10 ? '#eab308' : '#10b981';
                                const stockBg   = p.stock === 0 ? 'rgba(239,68,68,0.1)' : p.stock < 10 ? 'rgba(234,179,8,0.1)' : 'rgba(16,185,129,0.1)';
                                return (
                                    <div className="ph-card" key={p.id}>
                                        {/* SKU */}
                                        <div className="ph-col ph-col-sku">
                                            <span className="ph-sku-badge">{p.code}</span>
                                        </div>
                                        {/* Info */}
                                        <div className="ph-col ph-col-info">
                                            <div className="ph-product-name">{p.name}</div>
                                            <span className="ph-stock-chip" style={{ color: stockColor, background: stockBg }}>
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: stockColor, flexShrink: 0 }} />
                                                {p.stock === 0 ? 'Stok Habis' : `${p.stock.toLocaleString('id-ID')} unit`}
                                            </span>
                                        </div>
                                        {/* Tiers */}
                                        <div className="ph-col ph-col-tiers">
                                            {p.priceTiers && p.priceTiers.length > 0 ? (
                                                p.priceTiers.map((tier, idx) => (
                                                    <div className="ph-tier-row" key={idx}>
                                                        <span className="ph-tier-name">{tier.level_name}</span>
                                                        <div className="ph-tier-price-block">
                                                            <span className="ph-tier-price-label">Harga Jual</span>
                                                            <span className="ph-tier-price-value">Rp {Number(tier.price).toLocaleString('id-ID')}</span>
                                                        </div>
                                                        <div className="ph-tier-comm-block">
                                                            <span className="ph-tier-comm-label">Komisi</span>
                                                            <span className="ph-tier-comm-value">Rp {Number(tier.commission).toLocaleString('id-ID')}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Belum ada tier harga</span>
                                            )}
                                            {p.packagings?.length > 0 && p.packagings.flatMap((pkg, pi) =>
                                                (pkg.priceTiers || []).map((tier, idx) => (
                                                    <div className="ph-tier-row" key={`pkg-${pkg.id}-${idx}`} style={{ background: 'rgba(16,185,129,0.04)', paddingLeft: '1.1rem', borderTop: pi === 0 && idx === 0 ? '1px dashed rgba(16,185,129,0.2)' : 'none' }}>
                                                        <span className="ph-tier-name" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <span style={{ fontSize: '0.7em' }}>📦</span>
                                                            {pkg.name} · {tier.level_name}
                                                        </span>
                                                        <div className="ph-tier-price-block">
                                                            <span className="ph-tier-price-label">Harga / Kemasan</span>
                                                            <span className="ph-tier-price-value" style={{ color: '#10b981' }}>Rp {Number(tier.price).toLocaleString('id-ID')}</span>
                                                        </div>
                                                        <div className="ph-tier-comm-block">
                                                            <span className="ph-tier-comm-label">Komisi</span>
                                                            <span className="ph-tier-comm-value">Rp {Number(tier.commission).toLocaleString('id-ID')}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {/* Actions */}
                                        <div className="ph-col ph-col-actions">
                                            <button className="ph-btn-edit" onClick={() => handleEditProduct(p)}>
                                                <Edit3 size={12} /> Edit
                                            </button>
                                            <button className="ph-btn-del" onClick={() => handleDeleteProduct(p.id, p.name)}>
                                                <X size={12} /> Hapus
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            );
        }

        if (activeTab === 'Purchasing') {
            const totalSpend = purchases.reduce((s, p) => s + p.price_buy * p.quantity, 0);
            const totalUnits = purchases.reduce((s, p) => s + p.quantity, 0);
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .purch-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; gap:1rem; flex-wrap:wrap; }
                        .purch-title { font-size:1.2rem; font-weight:800; color:var(--text-main); line-height:1.2; }
                        .purch-subtitle { font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem; }
                        .purch-btn-new { display:inline-flex; align-items:center; gap:0.45rem; padding:0.6rem 1.1rem; border-radius:10px; background:linear-gradient(135deg,#059669,#10b981); color:#fff; border:none; font-weight:700; font-size:0.82rem; cursor:pointer; transition:opacity .2s,transform .2s; }
                        .purch-btn-new:hover { opacity:.88; transform:translateY(-1px); }
                        .purch-stats-row { display:grid; grid-template-columns:repeat(3,1fr); gap:0.85rem; margin-bottom:1.5rem; }
                        .purch-stat-card { border-radius:12px; border:1px solid var(--border-color); background:var(--bg-card); padding:1rem 1.1rem; }
                        .purch-stat-label { font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:0.35rem; }
                        .purch-stat-value { font-size:1.25rem; font-weight:800; color:var(--text-main); }
                        .purch-stat-value.green { color:#10b981; }
                        .purch-stat-value.indigo { color:#818cf8; }
                        .purch-list { border-radius:14px; border:1px solid var(--border-color); background:var(--bg-card); overflow:hidden; }
                        .purch-list-header { display:grid; grid-template-columns:150px 1fr 160px 100px 170px; padding:0.65rem 1.2rem; background:var(--bg-hover); border-bottom:1px solid var(--border-color); }
                        .purch-list-header span { font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.07em; }
                        .purch-list-header span:last-child { text-align:right; }
                        .purch-row { display:grid; grid-template-columns:150px 1fr 160px 100px 170px; padding:0.9rem 1.2rem; border-bottom:1px solid var(--border-color); align-items:center; transition:background .15s; }
                        .purch-row:last-child { border-bottom:none; }
                        .purch-row:hover { background:var(--bg-hover); }
                        .purch-date-badge { display:inline-flex; flex-direction:column; background:rgba(129,140,248,.08); border:1px solid rgba(129,140,248,.18); border-radius:8px; padding:0.3rem 0.55rem; }
                        .purch-date-day { font-size:0.75rem; font-weight:700; color:#818cf8; }
                        .purch-date-time { font-size:0.65rem; color:var(--text-muted); margin-top:1px; }
                        .purch-product-name { font-size:0.875rem; font-weight:700; color:var(--text-main); }
                        .purch-product-code { display:inline-block; margin-top:3px; font-size:0.68rem; font-family:monospace; background:var(--bg-hover); border:1px solid var(--border-color); border-radius:6px; padding:1px 6px; color:var(--text-muted); }
                        .purch-price { font-size:0.85rem; font-weight:600; color:var(--text-main); }
                        .purch-price-label { font-size:0.67rem; color:var(--text-muted); margin-top:2px; }
                        .purch-qty-badge { display:inline-flex; align-items:center; gap:4px; padding:0.3rem 0.65rem; border-radius:8px; background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.22); color:#10b981; font-size:0.78rem; font-weight:700; }
                        .purch-total { text-align:right; }
                        .purch-total-value { font-size:0.95rem; font-weight:800; color:#10b981; }
                        .purch-total-label { font-size:0.67rem; color:var(--text-muted); margin-top:2px; }
                        .purch-empty { padding:3rem 1rem; text-align:center; color:var(--text-muted); font-size:0.875rem; }
                        .purch-loading { padding:3rem 1rem; text-align:center; color:var(--text-muted); font-size:0.875rem; }
                    `}</style>

                    <div className="purch-header">
                        <div>
                            <div className="purch-title">Riwayat Purchasing & Restock</div>
                            <div className="purch-subtitle">Gudang utama tersinkronisasi — stok bertambah otomatis setiap restock dicatat.</div>
                        </div>
                        <button className="purch-btn-new" onClick={() => setIsRestockModalOpen(true)}>
                            <ShoppingCart size={15} /> Catat Restock Baru
                        </button>
                    </div>

                    <div className="purch-stats-row">
                        <div className="purch-stat-card">
                            <div className="purch-stat-label">Total Transaksi</div>
                            <div className="purch-stat-value indigo">{purchases.length}</div>
                        </div>
                        <div className="purch-stat-card">
                            <div className="purch-stat-label">Total Unit Masuk</div>
                            <div className="purch-stat-value green">+{totalUnits.toLocaleString('id-ID')} Unit</div>
                        </div>
                        <div className="purch-stat-card">
                            <div className="purch-stat-label">Total Pengeluaran</div>
                            <div className="purch-stat-value green">Rp {totalSpend.toLocaleString('id-ID')}</div>
                        </div>
                    </div>

                    <div className="purch-list">
                        <div className="purch-list-header">
                            <span>Tanggal</span>
                            <span>Produk</span>
                            <span>Harga Beli Satuan</span>
                            <span>Qty Masuk</span>
                            <span>Total Bayar</span>
                        </div>
                        {loadingPurchases ? (
                            <div className="purch-loading">Memuat riwayat restock...</div>
                        ) : purchases.length === 0 ? (
                            <div className="purch-empty">Belum ada aktivitas restock gudang pusat.</div>
                        ) : (
                            purchases.map((p) => {
                                const d = new Date(p.date);
                                const dayStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                                const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div className="purch-row" key={p.id}>
                                        <div>
                                            <div className="purch-date-badge">
                                                <span className="purch-date-day">{dayStr}</span>
                                                <span className="purch-date-time">{timeStr}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="purch-product-name">{p.product?.name}</div>
                                            <span className="purch-product-code">{p.product?.code}</span>
                                        </div>
                                        <div>
                                            <div className="purch-price">Rp {Number(p.price_buy).toLocaleString('id-ID')}</div>
                                            <div className="purch-price-label">per unit</div>
                                        </div>
                                        <div>
                                            <span className="purch-qty-badge">+{p.quantity} Unit</span>
                                        </div>
                                        <div className="purch-total">
                                            <div className="purch-total-value">Rp {Number(p.price_buy * p.quantity).toLocaleString('id-ID')}</div>
                                            <div className="purch-total-label">pembayaran</div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )
        }

        if (activeTab === 'Manajemen Tier & Pelanggan') {
            const customerTeam = team.filter(t => ['SUBSTOKIS', 'KONSUMEN', 'MEMBER'].includes(t.role));
            const substokisC = customerTeam.filter(t => t.role === 'SUBSTOKIS').length;
            const konsumenC = customerTeam.filter(t => t.role === 'KONSUMEN').length;
            const memberC = customerTeam.filter(t => t.role === 'MEMBER').length;
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .cust-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; gap:1rem; flex-wrap:wrap; }
                        .cust-title { font-size:1.2rem; font-weight:800; color:var(--text-main); }
                        .cust-subtitle { font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem; }
                        .cust-btn-new { display:inline-flex; align-items:center; gap:0.45rem; padding:0.6rem 1.1rem; border-radius:10px; background:linear-gradient(135deg,#065f46,#10b981); color:#fff; border:none; font-weight:700; font-size:0.82rem; cursor:pointer; transition:opacity .2s,transform .2s; }
                        .cust-btn-new:hover { opacity:.88; transform:translateY(-1px); }
                        .cust-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:0.85rem; margin-bottom:1.5rem; }
                        .cust-stat-card { border-radius:12px; border:1px solid var(--border-color); background:var(--bg-card); padding:0.9rem 1rem; display:flex; align-items:center; gap:0.85rem; }
                        .cust-stat-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .cust-stat-body { flex:1; }
                        .cust-stat-label { font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; }
                        .cust-stat-value { font-size:1.5rem; font-weight:800; line-height:1.2; margin-top:2px; }
                        .cust-list { border-radius:14px; border:1px solid var(--border-color); background:var(--bg-card); overflow:hidden; }
                        .cust-list-header { display:grid; grid-template-columns:1fr 120px 180px 120px 180px; padding:0.65rem 1.2rem; background:var(--bg-hover); border-bottom:1px solid var(--border-color); gap:0.5rem; }
                        .cust-list-header span { font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.07em; }
                        .cust-list-header span:last-child { text-align:center; }
                        .cust-row { display:grid; grid-template-columns:1fr 120px 180px 120px 180px; padding:1rem 1.2rem; border-bottom:1px solid var(--border-color); align-items:center; gap:0.5rem; transition:background .15s; }
                        .cust-row:last-child { border-bottom:none; }
                        .cust-row:hover { background:var(--bg-hover); }
                        .cust-avatar { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem; flex-shrink:0; border:2px solid; }
                        .cust-name { font-size:0.875rem; font-weight:700; color:var(--text-main); }
                        .cust-sub { font-size:0.7rem; color:var(--text-muted); font-family:monospace; margin-top:2px; }
                        .cust-role-badge { display:inline-flex; align-items:center; padding:0.28rem 0.65rem; border-radius:8px; font-size:0.72rem; font-weight:700; border:1px solid; }
                        .cust-contact { font-size:0.82rem; color:var(--text-main); font-weight:500; }
                        .cust-address { font-size:0.7rem; color:var(--text-muted); margin-top:3px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
                        .cust-price-level { font-size:0.72rem; font-weight:700; color:#818cf8; background:rgba(129,140,248,0.1); border:1px solid rgba(129,140,248,0.25); border-radius:7px; padding:0.25rem 0.55rem; display:inline-block; }
                        .cust-actions { display:flex; flex-direction:column; gap:5px; align-items:center; }
                        .cust-btn-price { padding:0.3rem 0; width:96px; border-radius:8px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#10b981; font-size:0.72rem; font-weight:700; cursor:pointer; text-align:center; transition:background .15s; }
                        .cust-btn-price:hover { background:rgba(16,185,129,0.2); }
                        .cust-btn-edit { padding:0.3rem 0; width:96px; border-radius:8px; background:var(--bg-hover); border:1px solid var(--border-color); color:var(--text-main); font-size:0.72rem; font-weight:600; cursor:pointer; text-align:center; transition:border-color .15s,color .15s; }
                        .cust-btn-edit:hover { border-color:var(--primary); color:var(--primary); }
                        .cust-btn-del { padding:0.3rem 0; width:96px; border-radius:8px; background:transparent; border:1px solid rgba(239,68,68,0.3); color:#ef4444; font-size:0.72rem; font-weight:600; cursor:pointer; text-align:center; transition:border-color .15s,background .15s; }
                        .cust-btn-del:hover { background:rgba(239,68,68,0.08); border-color:#ef4444; }
                        .cust-empty { padding:3rem 1rem; text-align:center; color:var(--text-muted); font-size:0.875rem; }
                    `}</style>

                    <div className="cust-header">
                        <div>
                            <div className="cust-title">Manajemen Tier & Level Pelanggan</div>
                            <div className="cust-subtitle">Kelola akun Sub-Stokis, Konsumen, dan Member — atur tier harga per pelanggan.</div>
                        </div>
                        <button className="cust-btn-new" onClick={openAddCustomerModal}>
                            <Users size={15} /> Tambah Pelanggan
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="cust-stats-row">
                        <div className="cust-stat-card">
                            <div className="cust-stat-icon" style={{ background: 'rgba(129,140,248,0.12)' }}><Building2 size={18} color="#818cf8" /></div>
                            <div className="cust-stat-body">
                                <div className="cust-stat-label">Sub-Stokis</div>
                                <div className="cust-stat-value" style={{ color: '#818cf8' }}>{substokisC}</div>
                            </div>
                        </div>
                        <div className="cust-stat-card">
                            <div className="cust-stat-icon" style={{ background: 'rgba(245,158,11,0.12)' }}><Users size={18} color="#f59e0b" /></div>
                            <div className="cust-stat-body">
                                <div className="cust-stat-label">Konsumen</div>
                                <div className="cust-stat-value" style={{ color: '#f59e0b' }}>{konsumenC}</div>
                            </div>
                        </div>
                        <div className="cust-stat-card">
                            <div className="cust-stat-icon" style={{ background: 'rgba(16,185,129,0.12)' }}><Diamond size={18} color="#10b981" /></div>
                            <div className="cust-stat-body">
                                <div className="cust-stat-label">Member</div>
                                <div className="cust-stat-value" style={{ color: '#10b981' }}>{memberC}</div>
                            </div>
                        </div>
                        <div className="cust-stat-card">
                            <div className="cust-stat-icon" style={{ background: 'rgba(96,165,250,0.12)' }}><Layers size={18} color="#60a5fa" /></div>
                            <div className="cust-stat-body">
                                <div className="cust-stat-label">Total Pelanggan</div>
                                <div className="cust-stat-value" style={{ color: '#60a5fa' }}>{customerTeam.length}</div>
                            </div>
                        </div>
                    </div>

                    <div className="cust-list">
                        <div className="cust-list-header">
                            <span>Identitas</span>
                            <span>Status</span>
                            <span>Kontak / Alamat</span>
                            <span>Tier Default</span>
                            <span>Aksi</span>
                        </div>
                        {loadingTeam ? (
                            <div className="cust-empty">Memuat direktori pelanggan...</div>
                        ) : customerTeam.length === 0 ? (
                            <div className="cust-empty">Belum ada pelanggan atau cabang terdaftar.</div>
                        ) : (
                            customerTeam.map((t) => {
                                let roleColor = '#f59e0b'; let roleBg = 'rgba(245,158,11,0.1)';
                                if (t.role === 'SUBSTOKIS') { roleColor = '#818cf8'; roleBg = 'rgba(129,140,248,0.1)'; }
                                if (t.role === 'MEMBER') { roleColor = '#10b981'; roleBg = 'rgba(16,185,129,0.1)'; }
                                return (
                                    <div className="cust-row" key={t.id}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div className="cust-avatar" style={{ background: roleBg, color: roleColor, borderColor: `${roleColor}44` }}>
                                                {t.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="cust-name">{t.name}</div>
                                                <div className="cust-sub">{t.store_name || t.email}</div>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="cust-role-badge" style={{ color: roleColor, background: roleBg, borderColor: `${roleColor}44` }}>{t.role}</span>
                                        </div>
                                        <div>
                                            <div className="cust-contact">{t.contact || '—'}</div>
                                            <div className="cust-address">{t.address || '—'}</div>
                                        </div>
                                        <div style={{display:'flex',flexWrap:'wrap',gap:'0.35rem'}}>
                                            {(() => {
                                                const priceTiers = [...new Set((t.userPriceTiers || []).map(pt => pt.level_name).filter(Boolean))];
                                                const pkgTiers = [...new Set((t.userPackagingTiers || []).map(pt => pt.level_name).filter(Boolean))];
                                                if (priceTiers.length === 0 && pkgTiers.length === 0) {
                                                    return <span className="cust-price-level">Harga Umum</span>;
                                                }
                                                return <>
                                                    {priceTiers.map(tier => (
                                                        <span key={`price-${tier}`} className="cust-price-level" style={{background:'rgba(99,102,241,0.12)',color:'#818cf8',borderColor:'rgba(99,102,241,0.3)',fontSize:'0.68rem'}}>{tier}</span>
                                                    ))}
                                                    {pkgTiers.map(tier => (
                                                        <span key={`pkg-${tier}`} className="cust-price-level" title="Tier Kemasan" style={{background:'rgba(16,185,129,0.12)',color:'#10b981',borderColor:'rgba(16,185,129,0.3)',fontSize:'0.68rem'}}>📦 {tier}</span>
                                                    ))}
                                                </>;
                                            })()}
                                        </div>
                                        <div className="cust-actions">
                                            <button className="cust-btn-price" onClick={() => openPricingModal(t)}>Atur Harga</button>
                                            <button className="cust-btn-edit" onClick={() => handleEditCustomer(t)}>Edit Akun</button>
                                            <button className="cust-btn-del" onClick={() => handleDeleteTeam(t.id, t.name, t.role)}>Hapus Akun</button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            );
        }

        if (activeTab === 'Manajemen Tim') {
            const internalTeam = team.filter(t => ['SALES', 'DRIVER'].includes(t.role));
            const substokisCount = team.filter(t => t.role === 'SUBSTOKIS').length;
            const salesCount = team.filter(t => t.role === 'SALES').length;
            const driverCount = team.filter(t => t.role === 'DRIVER').length;
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .tm-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; gap:1rem; flex-wrap:wrap; }
                        .tm-title { font-size:1.2rem; font-weight:800; color:var(--text-main); }
                        .tm-subtitle { font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem; }
                        .tm-btn-new { display:inline-flex; align-items:center; gap:0.45rem; padding:0.6rem 1.1rem; border-radius:10px; background:linear-gradient(135deg,var(--primary-dark,#4f46e5),var(--primary,#818cf8)); color:#fff; border:none; font-weight:700; font-size:0.82rem; cursor:pointer; transition:opacity .2s,transform .2s; }
                        .tm-btn-new:hover { opacity:.88; transform:translateY(-1px); }
                        .tm-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:0.85rem; margin-bottom:1.5rem; }
                        .tm-stat-card { border-radius:12px; border:1px solid var(--border-color); background:var(--bg-card); padding:0.9rem 1rem; display:flex; align-items:center; gap:0.85rem; }
                        .tm-stat-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .tm-stat-body { flex:1; min-width:0; }
                        .tm-stat-label { font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; }
                        .tm-stat-value { font-size:1.5rem; font-weight:800; line-height:1.2; margin-top:2px; }
                        .tm-list { border-radius:14px; border:1px solid var(--border-color); background:var(--bg-card); overflow:hidden; }
                        .tm-list-header { display:grid; grid-template-columns:1fr 130px 190px 140px 100px; padding:0.65rem 1.2rem; background:var(--bg-hover); border-bottom:1px solid var(--border-color); gap:0.5rem; }
                        .tm-list-header span { font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.07em; }
                        .tm-list-header span:last-child { text-align:center; }
                        .tm-row { display:grid; grid-template-columns:1fr 130px 190px 140px 100px; padding:1rem 1.2rem; border-bottom:1px solid var(--border-color); align-items:center; gap:0.5rem; transition:background .15s; }
                        .tm-row:last-child { border-bottom:none; }
                        .tm-row:hover { background:var(--bg-hover); }
                        .tm-avatar { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem; flex-shrink:0; border:2px solid; }
                        .tm-name { font-size:0.875rem; font-weight:700; color:var(--text-main); }
                        .tm-email { font-size:0.7rem; color:var(--text-muted); font-family:monospace; margin-top:2px; }
                        .tm-role-badge { display:inline-flex; align-items:center; padding:0.28rem 0.65rem; border-radius:8px; font-size:0.72rem; font-weight:700; border:1px solid; }
                        .tm-store { font-size:0.72rem; color:var(--text-muted); margin-top:4px; }
                        .tm-contact { font-size:0.82rem; color:var(--text-main); font-weight:500; }
                        .tm-address { font-size:0.7rem; color:var(--text-muted); margin-top:3px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
                        .tm-stat-mini { font-size:0.75rem; }
                        .tm-stat-mini-label { color:var(--text-muted); }
                        .tm-stat-mini-value { font-weight:700; color:var(--text-main); }
                        .tm-actions { display:flex; flex-direction:column; gap:6px; align-items:center; }
                        .tm-btn-edit { padding:0.32rem 0; width:80px; border-radius:8px; background:var(--bg-hover); border:1px solid var(--border-color); color:var(--text-main); font-size:0.73rem; font-weight:600; cursor:pointer; text-align:center; transition:border-color .15s,color .15s; }
                        .tm-btn-edit:hover { border-color:var(--primary); color:var(--primary); }
                        .tm-btn-del { padding:0.32rem 0; width:80px; border-radius:8px; background:transparent; border:1px solid rgba(239,68,68,0.3); color:#ef4444; font-size:0.73rem; font-weight:600; cursor:pointer; text-align:center; transition:border-color .15s,background .15s; }
                        .tm-btn-del:hover { background:rgba(239,68,68,0.08); border-color:#ef4444; }
                        .tm-empty { padding:3rem 1rem; text-align:center; color:var(--text-muted); font-size:0.875rem; }
                        .tm-loading { padding:3rem 1rem; text-align:center; color:var(--text-muted); font-size:0.875rem; }
                    `}</style>

                    <div className="tm-header">
                        <div>
                            <div className="tm-title">Jaringan Sub-Stokis & Tim Operasional</div>
                            <div className="tm-subtitle">Kelola akses, wilayah, tingkat agen, supir, dan performa tenaga penjual Anda.</div>
                        </div>
                        <button className="tm-btn-new" onClick={openAddTeamModal}>
                            <Users size={15} /> Rekrut Akun Baru
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="tm-stats-row">
                        <div className="tm-stat-card">
                            <div className="tm-stat-icon" style={{ background: 'rgba(129,140,248,0.12)' }}><Users size={18} color="#818cf8" /></div>
                            <div className="tm-stat-body">
                                <div className="tm-stat-label">Sub-Stokis</div>
                                <div className="tm-stat-value" style={{ color: '#818cf8' }}>{substokisCount}</div>
                            </div>
                        </div>
                        <div className="tm-stat-card">
                            <div className="tm-stat-icon" style={{ background: 'rgba(96,165,250,0.12)' }}><Activity size={18} color="#60a5fa" /></div>
                            <div className="tm-stat-body">
                                <div className="tm-stat-label">Sales</div>
                                <div className="tm-stat-value" style={{ color: '#60a5fa' }}>{salesCount}</div>
                            </div>
                        </div>
                        <div className="tm-stat-card">
                            <div className="tm-stat-icon" style={{ background: 'rgba(245,158,11,0.12)' }}><Truck size={18} color="#f59e0b" /></div>
                            <div className="tm-stat-body">
                                <div className="tm-stat-label">Driver</div>
                                <div className="tm-stat-value" style={{ color: '#f59e0b' }}>{driverCount}</div>
                            </div>
                        </div>
                        <div className="tm-stat-card">
                            <div className="tm-stat-icon" style={{ background: 'rgba(16,185,129,0.12)' }}><CheckCircle2 size={18} color="#10b981" /></div>
                            <div className="tm-stat-body">
                                <div className="tm-stat-label">Total Tim</div>
                                <div className="tm-stat-value" style={{ color: '#10b981' }}>{team.length}</div>
                            </div>
                        </div>
                    </div>

                    <div className="tm-list">
                        <div className="tm-list-header">
                            <span>Identitas Personil</span>
                            <span>Role & Akses</span>
                            <span>Kontak / Wilayah</span>
                            <span>Kinerja</span>
                            <span>Aksi</span>
                        </div>
                        {loadingTeam ? (
                            <div className="tm-loading">Sedang mengambil direktori tim...</div>
                        ) : internalTeam.length === 0 ? (
                            <div className="tm-empty">Belum ada anggota tim operasional (Sales/Driver) terdaftar.</div>
                        ) : (
                            internalTeam.map((t) => {
                                let roleColor = '#ef4444';
                                let roleBg = 'rgba(239,68,68,0.1)';
                                if (t.role === 'SUBSTOKIS') { roleColor = '#818cf8'; roleBg = 'rgba(129,140,248,0.1)'; }
                                if (t.role === 'SALES') { roleColor = '#60a5fa'; roleBg = 'rgba(96,165,250,0.1)'; }
                                if (t.role === 'DRIVER') { roleColor = '#f59e0b'; roleBg = 'rgba(245,158,11,0.1)'; }
                                return (
                                    <div className="tm-row" key={t.id}>
                                        {/* Identity */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div className="tm-avatar" style={{ background: roleBg, color: roleColor, borderColor: `${roleColor}44` }}>
                                                {t.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="tm-name">{t.name}</div>
                                                <div className="tm-email">{t.email}</div>
                                            </div>
                                        </div>
                                        {/* Role */}
                                        <div>
                                            <span className="tm-role-badge" style={{ color: roleColor, background: roleBg, borderColor: `${roleColor}44` }}>{t.role}</span>
                                            {t.store_name && <div className="tm-store">{t.store_name}</div>}
                                        </div>
                                        {/* Contact */}
                                        <div>
                                            <div className="tm-contact">{t.contact || '—'}</div>
                                            <div className="tm-address">{t.address || '—'}</div>
                                        </div>
                                        {/* Stats */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                            <div className="tm-stat-mini"><span className="tm-stat-mini-label">PO Bulan Ini: </span><span className="tm-stat-mini-value">0</span></div>
                                            {t.role === 'SALES' && (
                                                <div className="tm-stat-mini"><span className="tm-stat-mini-label">Komisi: </span><span className="tm-stat-mini-value" style={{ color: '#818cf8' }}>Rp {(salesCommissionMap[t.id] || 0).toLocaleString('id-ID')}</span></div>
                                            )}
                                            {t.role === 'DRIVER' && (
                                                <div className="tm-stat-mini"><span className="tm-stat-mini-label">Pengiriman: </span><span className="tm-stat-mini-value" style={{ color: '#f59e0b' }}>0</span></div>
                                            )}
                                            {t.role === 'SUBSTOKIS' && (
                                                <div className="tm-stat-mini"><span className="tm-stat-mini-label">Piutang: </span><span className="tm-stat-mini-value" style={{ color: '#ef4444' }}>Rp 0</span></div>
                                            )}
                                        </div>
                                        {/* Actions */}
                                        <div className="tm-actions">
                                            <button className="tm-btn-edit" onClick={() => handleEditTeam(t)}>Edit Akun</button>
                                            <button className="tm-btn-del" onClick={() => handleDeleteTeam(t.id, t.name, t.role)}>Hapus Akun</button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )
        }

        if (activeTab === 'Distribusi') {
            const drivers = team.filter(t => t.role === 'DRIVER');
            const pendingCount = orders.filter(o => o.status === 'PENDING').length;
            const processingCount = orders.filter(o => o.status === 'PROCESSING').length;
            const shippedCount = orders.filter(o => o.status === 'SHIPPED').length;
            const deliveredCount = orders.filter(o => o.status === 'DELIVERED').length;

            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .dist-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; gap:1rem; flex-wrap:wrap; }
                        .dist-title { font-size:1.2rem; font-weight:800; color:var(--text-main); }
                        .dist-subtitle { font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem; }
                        .dist-btn-group { display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; }
                        .dist-btn-view { display:inline-flex; align-items:center; gap:0.4rem; padding:0.55rem 1rem; border-radius:9px; font-size:0.8rem; font-weight:600; cursor:pointer; transition:all .15s; border:1px solid var(--border-color); background:var(--bg-hover); color:var(--text-muted); }
                        .dist-btn-view.active-table { background:linear-gradient(135deg,#4338ca,#818cf8); border-color:#818cf8; color:#fff; }
                        .dist-btn-view.active-map { background:linear-gradient(135deg,#5b21b6,#8b5cf6); border-color:#8b5cf6; color:#fff; }
                        .dist-btn-sim { display:inline-flex; align-items:center; gap:0.4rem; padding:0.55rem 1rem; border-radius:9px; font-size:0.8rem; font-weight:600; cursor:pointer; background:transparent; border:1px solid rgba(129,140,248,0.4); color:#818cf8; transition:all .15s; }
                        .dist-btn-sim:hover { background:rgba(129,140,248,0.1); }
                        .dist-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:0.85rem; margin-bottom:1.5rem; }
                        .dist-stat-card { border-radius:12px; border:1px solid var(--border-color); background:var(--bg-card); padding:0.85rem 1rem; display:flex; align-items:center; gap:0.75rem; }
                        .dist-stat-icon { width:38px; height:38px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .dist-stat-label { font-size:0.67rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; }
                        .dist-stat-value { font-size:1.4rem; font-weight:800; line-height:1.2; margin-top:2px; }
                        .dist-list { border-radius:14px; border:1px solid var(--border-color); background:var(--bg-card); overflow:hidden; }
                        .dist-list-header { display:grid; grid-template-columns:170px 1fr 200px 170px 160px; padding:0.65rem 1.2rem; background:var(--bg-hover); border-bottom:1px solid var(--border-color); gap:0.5rem; }
                        .dist-list-header span { font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.07em; }
                        .dist-list-header span:last-child { text-align:center; }
                        .dist-row { display:grid; grid-template-columns:170px 1fr 200px 170px 160px; padding:1rem 1.2rem; border-bottom:1px solid var(--border-color); align-items:center; gap:0.5rem; transition:background .15s; }
                        .dist-row:last-child { border-bottom:none; }
                        .dist-row:hover { background:var(--bg-hover); }
                        .dist-invoice { display:inline-block; font-family:monospace; font-size:0.72rem; font-weight:700; background:var(--bg-hover); border:1px solid var(--border-color); border-radius:7px; padding:2px 8px; color:var(--text-main); }
                        .dist-date { font-size:0.7rem; color:var(--text-muted); margin-top:4px; }
                        .dist-buyer-name { font-size:0.875rem; font-weight:700; color:var(--text-main); }
                        .dist-buyer-meta { font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
                        .dist-item-row { font-size:0.75rem; color:var(--text-main); border-left:2px solid var(--border-color); padding-left:7px; margin-bottom:4px; }
                        .dist-item-price { font-size:0.68rem; color:var(--text-muted); margin-top:1px; }
                        .dist-total { font-size:0.875rem; font-weight:800; color:#10b981; margin-top:5px; }
                        .dist-status-badge { display:inline-flex; align-items:center; padding:0.28rem 0.65rem; border-radius:8px; font-size:0.72rem; font-weight:700; border:1px solid; }
                        .dist-driver-info { font-size:0.7rem; color:var(--text-muted); margin-top:5px; display:flex; align-items:center; gap:4px; }
                        .dist-action-col { display:flex; flex-direction:column; align-items:center; gap:6px; }
                        .dist-btn-process { padding:0.35rem 0.7rem; border-radius:8px; background:rgba(59,130,246,0.12); border:1px solid rgba(59,130,246,0.3); color:#60a5fa; font-size:0.75rem; font-weight:700; cursor:pointer; transition:background .15s; white-space:nowrap; }
                        .dist-btn-process:hover { background:rgba(59,130,246,0.22); }
                        .dist-btn-ship { padding:0.35rem 0.7rem; border-radius:8px; background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.3); color:#a78bfa; font-size:0.75rem; font-weight:700; cursor:pointer; transition:background .15s; white-space:nowrap; }
                        .dist-btn-ship:hover { background:rgba(139,92,246,0.22); }
                        .dist-btn-done { padding:0.35rem 0.7rem; border-radius:8px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); color:#10b981; font-size:0.75rem; font-weight:700; cursor:pointer; transition:background .15s; white-space:nowrap; }
                        .dist-btn-done:hover { background:rgba(16,185,129,0.22); }
                        .dist-driver-select { background:var(--bg-card); border:1px solid var(--border-color); border-radius:8px; padding:0.35rem 0.55rem; font-size:0.75rem; color:var(--text-main); cursor:pointer; width:140px; }
                        .dist-map-panel { border-radius:14px; border:1px solid var(--border-color); background:var(--bg-card); padding:1.2rem; }
                        .dist-map-live-dot { width:9px; height:9px; border-radius:50%; background:#22c55e; flex-shrink:0; animation:pulse-glow 1.5s infinite; }
                        .dist-map-stat { border-radius:10px; background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.22); padding:0.75rem 1rem; margin-bottom:0.9rem; }
                        .dist-map-driver-card { display:flex; justify-content:space-between; align-items:center; padding:0.7rem 0.9rem; border-radius:10px; border:1px solid var(--border-color); background:rgba(255,255,255,0.02); margin-bottom:0.5rem; }
                        .dist-empty { padding:3rem 1rem; text-align:center; color:var(--text-muted); font-size:0.875rem; }
                    `}</style>

                    <div className="dist-header">
                        <div>
                            <div className="dist-title">Logistik & Distribusi Pesanan</div>
                            <div className="dist-subtitle">Kelola pesanan dari agen Sub-Stokis, Konsumen, atau delegasikan ke Armada Driver Anda.</div>
                        </div>
                        <div className="dist-btn-group">
                            <button className={`dist-btn-view ${viewMode === 'TABLE' ? 'active-table' : ''}`} onClick={() => setViewMode('TABLE')}>
                                <FileText size={14} /> Daftar Antrean
                            </button>
                            <button className={`dist-btn-view ${viewMode === 'MAP' ? 'active-map' : ''}`} onClick={() => setViewMode('MAP')}>
                                <MapPin size={14} /> Live Radar Tracker
                            </button>
                            <button className="dist-btn-sim" onClick={() => setActiveTab('Daftar Konsinyasi')}>
                                <Bell size={14} /> Daftar Konsinyasi
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="dist-stats-row">
                        <div className="dist-stat-card">
                            <div className="dist-stat-icon" style={{ background: 'rgba(245,158,11,0.12)' }}><Clock size={17} color="#f59e0b" /></div>
                            <div>
                                <div className="dist-stat-label">Pending</div>
                                <div className="dist-stat-value" style={{ color: '#f59e0b' }}>{pendingCount}</div>
                            </div>
                        </div>
                        <div className="dist-stat-card">
                            <div className="dist-stat-icon" style={{ background: 'rgba(59,130,246,0.12)' }}><Zap size={17} color="#60a5fa" /></div>
                            <div>
                                <div className="dist-stat-label">Diproses</div>
                                <div className="dist-stat-value" style={{ color: '#60a5fa' }}>{processingCount}</div>
                            </div>
                        </div>
                        <div className="dist-stat-card">
                            <div className="dist-stat-icon" style={{ background: 'rgba(139,92,246,0.12)' }}><Truck size={17} color="#a78bfa" /></div>
                            <div>
                                <div className="dist-stat-label">Dikirim</div>
                                <div className="dist-stat-value" style={{ color: '#a78bfa' }}>{shippedCount}</div>
                            </div>
                        </div>
                        <div className="dist-stat-card">
                            <div className="dist-stat-icon" style={{ background: 'rgba(16,185,129,0.12)' }}><CheckCircle2 size={17} color="#10b981" /></div>
                            <div>
                                <div className="dist-stat-label">Selesai</div>
                                <div className="dist-stat-value" style={{ color: '#10b981' }}>{deliveredCount}</div>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'MAP' ? (
                        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                            {/* Map sidebar */}
                            <div className="dist-map-panel" style={{ width: '280px', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.85rem' }}>
                                    <div className="dist-map-live-dot"></div>
                                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>Radar Satelit Aktif</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Pantau pergerakan armada Driver secara real-time via WebSocket.</div>

                                <div className="dist-map-stat">
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa', marginBottom: 3 }}>Armada Mengudara: <span style={{ fontSize: '1.1rem' }}>{Object.keys(liveDrivers).length}</span></div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Akurasi GPS ± 5 meter</div>
                                </div>

                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '0.65rem' }}>Unit Aktif</div>
                                    {Object.values(liveDrivers).length === 0 ? (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px dashed var(--border-color)' }}>Belum ada armada online</div>
                                    ) : (
                                        Object.values(liveDrivers).map((driver) => {
                                            const driverData = team.find(t => t.id === parseInt(driver.driverId));
                                            const isFocused = focusedDriverCoord && focusedDriverCoord.driverId === driver.driverId;
                                            return (
                                                <div
                                                    key={driver.driverId}
                                                    className="dist-map-driver-card"
                                                    onClick={() => setFocusedDriverCoord({ lat: driver.lat, lng: driver.lng, driverId: driver.driverId })}
                                                    style={{ cursor: 'pointer', outline: isFocused ? '1.5px solid #a78bfa' : 'none', borderRadius: 10, transition: 'outline .15s' }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: isFocused ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.15)', border: `1px solid ${isFocused ? '#a78bfa' : 'rgba(139,92,246,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                                                            <Truck size={14} color="#a78bfa" />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)' }}>{driverData?.name || `Driver #${driver.driverId}`}</div>
                                                            <div style={{ fontSize: '0.67rem', color: isFocused ? '#a78bfa' : 'var(--text-muted)' }}>{isFocused ? '📍 Ditampilkan di peta' : 'Terdeteksi'}</div>
                                                        </div>
                                                    </div>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '2px 7px' }}>LIVE</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Map */}
                            <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {(() => {
                                    const noLocCount = orders.filter(o => o.status !== 'DELIVERED' && (!o.buyer?.latitude || !o.buyer?.longitude)).length;
                                    if (noLocCount === 0) return null;
                                    return (
                                        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10, padding: '0.5rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#f59e0b' }}>
                                            <span style={{ fontSize: '1rem' }}>⚠</span>
                                            <span><strong>{noLocCount} pengiriman</strong> ditandai <strong>❓</strong> karena buyer belum mengatur koordinat lokasi di profil akun mereka.</span>
                                        </div>
                                    );
                                })()}
                                <div style={{ height: 520, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border-color)', zIndex: 0 }}>
                                <MapContainer center={[-6.1751, 106.8272]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                                    <FlyToDriver coord={focusedDriverCoord} />
                                    <TileLayer
                                        attribution="Map data &copy; <a href='https://www.openstreetmap.org/'>OpenStreetMap</a>"
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    {orders.filter(o => o.status !== 'DELIVERED').map((order, idx) => {
                                        const destLat = order.buyer?.latitude;
                                        const destLng = order.buyer?.longitude;
                                        if (destLat && destLng) {
                                            const currentIcon = order.status === 'SHIPPED' ? shippedDestIcon : pendingDestIcon;
                                            return (
                                                <Marker key={`dest-${order.id}`} position={[destLat, destLng]} icon={currentIcon}>
                                                    <Popup>
                                                        <strong>{order.buyer?.store_name || order.buyer?.name || 'Tujuan'}</strong><br />
                                                        <span>Invoice: {order.invoice_id}</span><br />
                                                        Status: {order.status}
                                                    </Popup>
                                                </Marker>
                                            );
                                        } else {
                                            // Tampilkan marker warning jika buyer belum set koordinat
                                            const driverPos = Object.values(liveDrivers)[0];
                                            const baseLat = driverPos ? driverPos.lat : -6.1751;
                                            const baseLng = driverPos ? driverPos.lng : 106.8272;
                                            const offsetLat = baseLat + (idx * 0.012);
                                            const offsetLng = baseLng + ((idx % 3) * 0.012);
                                            return (
                                                <Marker key={`dest-noloc-${order.id}`} position={[offsetLat, offsetLng]} icon={noLocationIcon}>
                                                    <Popup>
                                                        <strong style={{color:'#f59e0b'}}>⚠ Lokasi Belum Diset</strong><br />
                                                        <span>{order.buyer?.store_name || order.buyer?.name || 'Buyer'}</span><br />
                                                        <span>Invoice: {order.invoice_id}</span><br />
                                                        <span style={{fontSize:'0.75em',color:'#888'}}>Minta buyer atur koordinat di halaman Pengaturan akun mereka.</span>
                                                    </Popup>
                                                </Marker>
                                            );
                                        }
                                    })}
                                    {Object.values(liveDrivers).map((driver) => {
                                        const driverData = team.find(t => t.id === parseInt(driver.driverId));
                                        return (
                                            <Marker key={`driver-${driver.driverId}`} position={[driver.lat, driver.lng]} icon={driverIcon}>
                                                <Popup><strong>Armada: {driverData?.name || `Driver ID: ${driver.driverId}`}</strong></Popup>
                                            </Marker>
                                        );
                                    })}
                                    {orders.filter(o => o.status === 'SHIPPED' && o.driverId).map(order => {
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
                        </div>
                    ) : (
                        <div className="dist-list">
                            <div className="dist-list-header">
                                <span>Resi & Tanggal</span>
                                <span>Pembeli</span>
                                <span>Rincian Barang</span>
                                <span>Status & Kurir</span>
                                <span>Aksi</span>
                            </div>
                            {loadingOrders ? (
                                <div className="dist-empty">Melacak antrean pesanan...</div>
                            ) : orders.length === 0 ? (
                                <div className="dist-empty">Belum ada pesanan masuk.</div>
                            ) : (
                                orders.map((o) => {
                                    let statusColor = '#9ca3af'; let statusBg = 'rgba(156,163,175,0.1)';
                                    if (o.status === 'PENDING') { statusColor = '#f59e0b'; statusBg = 'rgba(245,158,11,0.1)'; }
                                    if (o.status === 'PROCESSING') { statusColor = '#60a5fa'; statusBg = 'rgba(59,130,246,0.1)'; }
                                    if (o.status === 'SHIPPED') { statusColor = '#a78bfa'; statusBg = 'rgba(139,92,246,0.1)'; }
                                    if (o.status === 'DELIVERED') { statusColor = '#10b981'; statusBg = 'rgba(16,185,129,0.1)'; }
                                    return (
                                        <div className="dist-row" key={o.id}>
                                            <div>
                                                {o.isKonsinyasi ? (
                                                    <>
                                                        <span style={{ display: 'inline-block', marginBottom: 4, padding: '2px 8px', background: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b', borderRadius: 6, color: '#b45309', fontSize: 11, fontWeight: 700 }}>🏷️ Konsinyasi</span>
                                                        <div className="dist-invoice" style={{ fontSize: '.8rem' }}>{o.invoice_id.replace(/-\d{13}$/, '')}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 1, wordBreak: 'break-all' }}>{o.invoice_id}</div>
                                                    </>
                                                ) : (
                                                    <span className="dist-invoice">{o.invoice_id}</span>
                                                )}
                                                <div className="dist-date">{new Date(o.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                            <div>
                                                <div className="dist-buyer-name">{o.buyer?.store_name || o.buyer?.name || 'User Tidak Diketahui'}</div>
                                                <div className="dist-buyer-meta">{o.buyer?.role} • {o.buyer?.address || '—'}</div>
                                            </div>
                                            <div>
                                                {o.items?.map((item, idx) => (
                                                    <div key={idx} className="dist-item-row">
                                                        <span style={{ fontWeight: 700 }}>{item.quantity} {item.packagingName || 'unit'} x</span> {item.product?.name}
                                                        <div className="dist-item-price">@ Rp {Number(item.price).toLocaleString('id-ID')}</div>
                                                    </div>
                                                ))}
                                                <div className="dist-total">Rp {Number(o.total_amount).toLocaleString('id-ID')}</div>
                                            </div>
                                            <div>
                                                <span className="dist-status-badge" style={{ color: statusColor, background: statusBg, borderColor: `${statusColor}44` }}>{o.status}</span>
                                                {o.driver ? (
                                                    <div className="dist-driver-info"><Truck size={11} /> {o.driver.name}</div>
                                                ) : (
                                                    <div className="dist-driver-info" style={{ opacity: 0.45 }}><Truck size={11} /> Belum ada kurir</div>
                                                )}
                                            </div>
                                            <div className="dist-action-col">
                                                {o.status === 'PENDING' && (
                                                    <button className="dist-btn-process" onClick={() => handleUpdateOrderStatus(o.id, 'PROCESSING')}>Proses Pesanan</button>
                                                )}
                                                {o.status === 'PROCESSING' && (
                                                    <>
                                                        <select className="dist-driver-select" onChange={(e) => handleUpdateOrderStatus(o.id, 'SHIPPED', e.target.value)} defaultValue="">
                                                            <option value="" disabled>Pilih Driver...</option>
                                                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                        </select>
                                                        {drivers.length === 0 && <span style={{ fontSize: '0.68rem', color: '#ef4444' }}>Belum ada Driver!</span>}
                                                    </>
                                                )}
                                                {o.status === 'SHIPPED' && (
                                                    <button className="dist-btn-done" onClick={() => handleUpdateOrderStatus(o.id, 'DELIVERED')}>Tandai Diterima</button>
                                                )}
                                                {o.status === 'DELIVERED' && (
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Tuntas</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            )
        }

        if (activeTab === 'Laporan') {
            // ===== PERHITUNGAN DETAIL PENJUALAN =====
            // Detail status order
            const deliveredOrders = orders.filter(o => o.status === 'DELIVERED');
            const shippedOrders = orders.filter(o => o.status === 'SHIPPED');
            const pendingOrders = orders.filter(o => o.status === 'PENDING');
            const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');
            
            // Revenue per status
            const deliveredRevenue = deliveredOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            const shippedRevenue = shippedOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            const pendingRevenue = pendingOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
            
            // ✅ TOTAL PENJUALAN = Hanya yang CONFIRMED (Delivered + Shipped) / tidak termasuk PENDING
            const totalRevenue = deliveredRevenue + shippedRevenue;
            
            // ===== PERHITUNGAN DETAIL PEMBELIAN =====
            const totalPurchase = purchases.reduce((acc, curr) => acc + (curr.price_buy * curr.quantity), 0);
            const totalPurchaseQty = purchases.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
            const avgPurchasePrice = purchases.length > 0 ? totalPurchase / totalPurchaseQty : 0;
            
            // ===== PERHITUNGAN LABA =====
            const grossProfit = totalRevenue - totalPurchase;
            const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0;
            
            // Total komisi (jika ada data sales)
            const totalCommission = Object.values(salesCommissionMap).reduce((a, b) => a + b, 0);
            const netProfit = grossProfit - totalCommission;
            
            // Item terjual dari order yang CONFIRMED (tidak pending)
            const totalItemsSold = deliveredOrders.concat(shippedOrders).reduce((acc, curr) => {
                return acc + (curr.items ? curr.items.reduce((a, b) => a + (b.quantity || 0), 0) : 0);
            }, 0);

            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .lap-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.75rem; gap:1rem; flex-wrap:wrap; }
                        .lap-header-left h2 { font-size:1.25rem; font-weight:800; margin:0 0 .25rem; }
                        .lap-header-left p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .lap-print-btn { display:inline-flex; align-items:center; gap:.5rem; padding:.6rem 1.25rem; border-radius:10px; border:1.5px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-size:.82rem; font-weight:600; cursor:pointer; transition:all .2s; white-space:nowrap; }
                        .lap-print-btn:hover { background:var(--bg-hover,rgba(255,255,255,.05)); border-color:#6366f1; color:#818cf8; }
                        .lap-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin-bottom:1.75rem; }
                        @media(max-width:1024px){ .lap-stats{ grid-template-columns:repeat(2,1fr); } }
                        @media(max-width:640px){ .lap-stats{ grid-template-columns:1fr; } }
                        .lap-stat-card { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.25rem 1.4rem; display:flex; align-items:center; gap:1rem; }
                        .lap-stat-icon { width:46px; height:46px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .lap-stat-icon.green { background:rgba(34,197,94,.12); color:#22c55e; }
                        .lap-stat-icon.blue  { background:rgba(59,130,246,.12); color:#3b82f6; }
                        .lap-stat-icon.indigo{ background:rgba(99,102,241,.12); color:#6366f1; }
                        .lap-stat-icon.purple { background:rgba(168,85,247,.12); color:#a855f7; }
                        .lap-stat-icon.orange { background:rgba(251,146,60,.12); color:#fb923c; }
                        .lap-stat-icon.red   { background:rgba(239,68,68,.12);  color:#ef4444; }
                        .lap-stat-body { flex:1; min-width:0; }
                        .lap-stat-label { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-bottom:.3rem; }
                        .lap-stat-value { font-size:1.1rem; font-weight:800; font-family:'Courier New',monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                        .lap-stat-value.positive { color:#22c55e; }
                        .lap-stat-value.negative { color:#ef4444; }
                        .lap-stat-value.blue { color:#3b82f6; }
                        .lap-stat-sub { font-size:.72rem; color:var(--text-muted); margin-top:.2rem; }
                        .lap-section-title { font-size:.95rem; font-weight:800; margin:0 0 1rem; display:flex; align-items:center; gap:.5rem; }
                        .lap-section-title span.icon { width:30px; height:30px; border-radius:8px; background:rgba(99,102,241,.12); color:#818cf8; display:inline-flex; align-items:center; justify-content:center; }
                        .lap-panel { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.4rem; margin-bottom:1.5rem; }
                        .lap-detail-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; margin-bottom:1.5rem; }
                        @media(max-width:768px){ .lap-detail-grid{ grid-template-columns:1fr; } }
                        .lap-detail-section { background:var(--bg-main); padding:1rem; border-radius:10px; border:1px solid var(--border-color); }
                        .lap-detail-row { display:flex; justify-content:space-between; align-items:center; padding:.5rem 0; border-bottom:1px solid var(--border-color); font-size:.85rem; }
                        .lap-detail-row:last-child { border-bottom:none; }
                        .lap-detail-label { color:var(--text-muted); font-weight:600; }
                        .lap-detail-value { font-weight:700; font-family:'Courier New',monospace; }
                        .lap-detail-value.green { color:#22c55e; }
                        .lap-detail-value.blue { color:#3b82f6; }
                        .lap-detail-value.purple { color:#a855f7; }
                        .lap-detail-value.red { color:#ef4444; }
                        .lap-profit-breakdown { background:linear-gradient(135deg,rgba(129,140,248,.05),rgba(168,85,247,.05)); border:1.5px solid rgba(129,140,248,.2); border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; }
                        .lap-profit-row { display:flex; justify-content:space-between; align-items:center; padding:.65rem 0; border-bottom:1px solid var(--border-color); font-size:.9rem; }
                        .lap-profit-row:last-child { border-bottom:none; padding-top:.8rem; border-top:2px solid var(--border-color); margin-top:.8rem; }
                        .lap-profit-row.total { font-weight:800; font-size:1rem; }
                        .lap-profit-label { font-weight:600; }
                        .lap-profit-value { font-weight:700; font-family:'Courier New',monospace; }
                        .lap-list-header { display:grid; grid-template-columns:2fr 1fr 1fr 80px; gap:.75rem; padding:.4rem .75rem; margin-bottom:.5rem; }
                        .lap-list-header span { font-size:.67rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); }
                        .lap-item { display:grid; grid-template-columns:2fr 1fr 1fr 80px; gap:.75rem; align-items:center; padding:.75rem; border-radius:10px; border:1.5px solid var(--border-color); margin-bottom:.6rem; background:var(--bg-main,transparent); transition:border-color .18s; }
                        .lap-item:last-child { margin-bottom:0; }
                        .lap-item:hover { border-color:#6366f1; }
                        .lap-item-name { font-weight:700; font-size:.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                        .lap-item-code { font-size:.68rem; font-family:'Courier New',monospace; color:var(--text-muted); margin-top:.15rem; }
                        .lap-sold-badge { display:inline-block; background:rgba(34,197,94,.12); color:#22c55e; border:1px solid rgba(34,197,94,.25); border-radius:6px; padding:.2rem .55rem; font-size:.75rem; font-weight:700; font-family:'Courier New',monospace; }
                        .lap-stock-chip { display:inline-block; background:rgba(99,102,241,.1); color:#818cf8; border:1px solid rgba(99,102,241,.2); border-radius:6px; padding:.2rem .55rem; font-size:.75rem; font-weight:700; font-family:'Courier New',monospace; }
                        .lap-trend { display:inline-flex; align-items:center; gap:.3rem; font-size:.78rem; font-weight:700; }
                        .lap-trend.up   { color:#22c55e; }
                        .lap-trend.down { color:#ef4444; }
                        .lap-empty { text-align:center; padding:2rem; color:var(--text-muted); font-size:.85rem; }
                        .lap-summary-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; }
                        @media(max-width:640px){ .lap-summary-grid{ grid-template-columns:1fr; } .lap-list-header,.lap-item{ grid-template-columns:2fr 1fr 1fr; } .lap-list-header span:last-child,.lap-item>*:last-child{ display:none; } }
                    `}</style>

                    {/* Header */}
                    <div className="lap-header">
                        <div className="lap-header-left">
                            <h2>Laporan Finansial & Stok</h2>
                            <p>Rekapitulasi performa gudang pusat dan jaringan distribusi (Detail & Transparan).</p>
                        </div>
                        <button className="lap-print-btn" onClick={() => window.print()}>
                            <FileText size={15} /> Print Laporan (PDF)
                        </button>
                    </div>

                    {/* KPI Stat Cards - EXPANDED */}
                    <div className="lap-stats">
                        <div className="lap-stat-card">
                            <div className="lap-stat-icon green"><TrendingUp size={20} /></div>
                            <div className="lap-stat-body">
                                <div className="lap-stat-label">Total Penjualan (Confirmed)</div>
                                <div className="lap-stat-value green">Rp {totalRevenue.toLocaleString('id-ID')}</div>
                                <div className="lap-stat-sub">✓ {deliveredOrders.length} Terkirim + 🚚 {shippedOrders.length} Shipping</div>
                            </div>
                        </div>
                        <div className="lap-stat-card">
                            <div className="lap-stat-icon blue"><ShoppingCart size={20} /></div>
                            <div className="lap-stat-body">
                                <div className="lap-stat-label">Total Pembelian</div>
                                <div className="lap-stat-value blue">Rp {totalPurchase.toLocaleString('id-ID')}</div>
                                <div className="lap-stat-sub">{purchases.length} restock • {totalPurchaseQty} unit</div>
                            </div>
                        </div>
                        <div className="lap-stat-card">
                            <div className="lap-stat-icon indigo"><DollarSign size={20} /></div>
                            <div className="lap-stat-body">
                                <div className="lap-stat-label">Laba Kotor</div>
                                <div className={`lap-stat-value ${grossProfit >= 0 ? 'positive' : 'negative'}`}>
                                    Rp {Math.abs(grossProfit).toLocaleString('id-ID')}
                                </div>
                                <div className="lap-stat-sub">Margin: {grossMargin}%</div>
                            </div>
                        </div>
                        <div className="lap-stat-card">
                            <div className={`lap-stat-icon ${netProfit >= 0 ? 'purple' : 'red'}`}>
                                <BarChart3 size={20} />
                            </div>
                            <div className="lap-stat-body">
                                <div className="lap-stat-label">Laba Bersih</div>
                                <div className={`lap-stat-value ${netProfit >= 0 ? 'positive' : 'negative'}`}>
                                    Rp {Math.abs(netProfit).toLocaleString('id-ID')}
                                </div>
                                <div className="lap-stat-sub">Setelah komisi: {team.filter(t => t.role === 'SALES').length} sales</div>
                            </div>
                        </div>
                    </div>

                    {/* INFO PENDING (tidak masuk total penjualan) */}
                    {pendingOrders.length > 0 && (
                        <div style={{background:'rgba(234,179,8,.08)',border:'1.5px solid rgba(234,179,8,.25)',borderRadius:'12px',padding:'1rem',marginBottom:'1.5rem',display:'flex',alignItems:'center',gap:'1rem'}}>
                            <div style={{fontSize:'1.5rem'}}>⏳</div>
                            <div>
                                <div style={{fontSize:'.85rem',fontWeight:800,color:'#eab308'}}>ADA {pendingOrders.length} ORDER PENDING (Tidak terhitung di Penjualan)</div>
                                <div style={{fontSize:'.78rem',color:'var(--text-muted)',marginTop:'.25rem'}}>Potensi Revenue: Rp {pendingRevenue.toLocaleString('id-ID')} (akan terhitung saat status berubah ke Shipped/Delivered)</div>
                            </div>
                        </div>
                    )}

                    {/* DETAIL BREAKDOWN - PENJUALAN */}
                    <div className="lap-detail-grid">
                        <div className="lap-detail-section">
                            <div style={{fontSize:'.9rem',fontWeight:800,marginBottom:'.75rem',color:'#22c55e'}}>📊 DETAIL PENJUALAN (CONFIRMED ONLY)</div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">✓ Order Terkirim</span>
                                <span className="lap-detail-value green">{deliveredOrders.length} Order</span>
                            </div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">Revenue Terkirim</span>
                                <span className="lap-detail-value green">Rp {deliveredRevenue.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">🚚 Order Sedang Dikirim</span>
                                <span className="lap-detail-value blue">{shippedOrders.length} Order</span>
                            </div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">Revenue Shipping</span>
                                <span className="lap-detail-value blue">Rp {shippedRevenue.toLocaleString('id-ID')}</span>
                            </div>
                            {pendingOrders.length > 0 && (
                                <div className="lap-detail-row" style={{background:'rgba(234,179,8,.08)',padding:'.35rem .35rem',borderRadius:'6px',fontWeight:700}}>
                                    <span className="lap-detail-label">⏳ Order Pending (⚠️ TIDAK DIHITUNG)</span>
                                    <span style={{color:'#eab308'}}>{pendingOrders.length} Order • Rp {pendingRevenue.toLocaleString('id-ID')}</span>
                                </div>
                            )}
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">= TOTAL PENJUALAN (Confirmed)</span>
                                <span className="lap-detail-value green" style={{fontWeight:900,fontSize:'1rem'}}>Rp {totalRevenue.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">Total Item Terjual (Confirmed)</span>
                                <span className="lap-detail-value">{totalItemsSold} unit</span>
                            </div>
                        </div>

                        {/* DETAIL BREAKDOWN - PEMBELIAN */}
                        <div className="lap-detail-section">
                            <div style={{fontSize:'.9rem',fontWeight:800,marginBottom:'.75rem',color:'#3b82f6'}}>📦 DETAIL PEMBELIAN (RESTOCK)</div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">Total Modal Beli</span>
                                <span className="lap-detail-value blue">Rp {totalPurchase.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">Frekuensi Restock</span>
                                <span className="lap-detail-value blue">{purchases.length} kali</span>
                            </div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">Total Qty Dibeli</span>
                                <span className="lap-detail-value blue">{totalPurchaseQty} unit</span>
                            </div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">Rata-rata Harga/Unit</span>
                                <span className="lap-detail-value blue">Rp {avgPurchasePrice.toLocaleString('id-ID', {maximumFractionDigits: 0})}</span>
                            </div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">Rata-rata Harga Jual/Unit</span>
                                <span className="lap-detail-value blue">Rp {(totalItemsSold > 0 ? totalRevenue / totalItemsSold : 0).toLocaleString('id-ID', {maximumFractionDigits: 0})}</span>
                            </div>
                            <div className="lap-detail-row">
                                <span className="lap-detail-label">Markup Per Unit</span>
                                <span className="lap-detail-value green">Rp {(totalItemsSold > 0 ? (totalRevenue / totalItemsSold) - avgPurchasePrice : 0).toLocaleString('id-ID', {maximumFractionDigits: 0})}</span>
                            </div>
                        </div>
                    </div>

                    {/* PROFIT BREAKDOWN - TERPERINCI */}
                    <div className="lap-profit-breakdown">
                        <div style={{fontSize:'.9rem',fontWeight:800,marginBottom:'1rem',color:'#818cf8'}}>💰 PERHITUNGAN PROFIT TERPERINCI (Hanya Order Confirmed)</div>
                        <div style={{fontSize:'.75rem',color:'var(--text-muted)',fontWeight:600,marginBottom:'1rem',paddingBottom:'0.75rem',borderBottom:'1px solid var(--border-color)'}}>
                            📌 Basis: Order DELIVERED + SHIPPED saja (Pending TIDAK dihitung)
                        </div>
                        
                        <div className="lap-profit-row">
                            <span className="lap-profit-label">➕ Revenue Penjualan (Terkirim)</span>
                            <span className="lap-profit-value">Rp {deliveredRevenue.toLocaleString('id-ID')} ({deliveredOrders.length} order)</span>
                        </div>
                        
                        <div className="lap-profit-row">
                            <span className="lap-profit-label">➕ Revenue Shipping (In-Transit)</span>
                            <span className="lap-profit-value">Rp {shippedRevenue.toLocaleString('id-ID')} ({shippedOrders.length} order)</span>
                        </div>

                        <div className="lap-profit-row">
                            <span className="lap-profit-label">────────────────────</span>
                            <span className="lap-profit-value">─────────────────────</span>
                        </div>
                        
                        <div className="lap-profit-row" style={{fontWeight:700}}>
                            <span className="lap-profit-label">= TOTAL REVENUE (Confirmed Only)</span>
                            <span className="lap-profit-value" style={{color:'#22c55e',fontSize:'.95rem'}}>Rp {totalRevenue.toLocaleString('id-ID')}</span>
                        </div>
                        
                        <div className="lap-profit-row">
                            <span className="lap-profit-label">➖ Cost of Goods Sold (Modal Beli)</span>
                            <span className="lap-profit-value">Rp {totalPurchase.toLocaleString('id-ID')}</span>
                        </div>
                        
                        <div className="lap-profit-row">
                            <span className="lap-profit-label">= Gross Profit (Laba Kotor)</span>
                            <span className={`lap-profit-value ${grossProfit >= 0 ? 'green' : 'red'}`}>
                                Rp {Math.abs(grossProfit).toLocaleString('id-ID')}
                            </span>
                        </div>

                        <div className="lap-profit-row">
                            <span className="lap-profit-label">( Margin: {grossMargin}% )</span>
                            <span className="lap-profit-value" style={{color:'var(--text-muted)',fontSize:'.8rem'}}>
                                {grossProfit >= 0 ? '✓ Healthy' : '⚠ Negative'}
                            </span>
                        </div>

                        <div className="lap-profit-row">
                            <span className="lap-profit-label">➖ Total Komisi Sales</span>
                            <span className="lap-profit-value">Rp {totalCommission.toLocaleString('id-ID')}</span>
                        </div>

                        <div className="lap-profit-row total">
                            <span className="lap-profit-label">= NET PROFIT (Laba Bersih)</span>
                            <span className={`lap-profit-value ${netProfit >= 0 ? 'green' : 'red'}`} style={{fontSize:'1.1rem'}}>
                                Rp {Math.abs(netProfit).toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>

                    {/* DETAIL KOMISI SALES */}
                    <div className="lap-panel">
                        <div className="lap-section-title">
                            <span className="icon" style={{background:'rgba(232,121,249,.12)',color:'#e879f9'}}>👥</span>
                            Detail Komisi Sales Team
                        </div>
                        
                        <style>{`
                            .comm-stat-overview { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; margin-bottom:1.5rem; }
                            @media(max-width:640px){ .comm-stat-overview{ grid-template-columns:1fr; } }
                            .comm-stat-box { background:var(--bg-main); border:1.5px solid var(--border-color); border-radius:10px; padding:1rem; }
                            .comm-stat-box-label { font-size:.75rem; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-bottom:.4rem; }
                            .comm-stat-box-value { font-size:1.15rem; font-weight:800; font-family:'Courier New',monospace; color:#e879f9; margin-bottom:.3rem; }
                            .comm-stat-box-sub { font-size:.78rem; color:var(--text-muted); }
                            .comm-table-wrapper { overflow-x:auto; }
                            .comm-table-header { display:grid; grid-template-columns:2fr 1fr 1.2fr 1.2fr 0.8fr; gap:1rem; padding:.75rem; background:rgba(99,102,241,.05); border-radius:10px; border-bottom:2px solid var(--border-color); margin-bottom:.5rem; }
                            .comm-table-header span { font-size:.72rem; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); }
                            .comm-table-row { display:grid; grid-template-columns:2fr 1fr 1.2fr 1.2fr 0.8fr; gap:1rem; align-items:center; padding:.8rem; border-radius:8px; border:1.5px solid var(--border-color); margin-bottom:.5rem; background:var(--bg-main); transition:border-color .18s; }
                            .comm-table-row:hover { border-color:#e879f9; }
                            .comm-sales-name { font-weight:700; font-size:.9rem; }
                            .comm-sales-role { font-size:.72rem; color:var(--text-muted); margin-top:.15rem; }
                            .comm-sales-orders { text-align:center; font-weight:600; font-size:.9rem; }
                            .comm-commission-amount { font-family:'Courier New',monospace; font-weight:800; color:#e879f9; text-align:right; }
                            .comm-commission-percent { font-size:.8rem; color:var(--text-muted); text-align:right; }
                            .comm-action-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:6px; border:1.5px solid var(--border-color); background:rgba(255,255,255,.02); cursor:pointer; transition:all .18s; color:var(--text-muted); font-size:.9rem; }
                            .comm-action-btn:hover { border-color:#e879f9; color:#e879f9; background:rgba(232,121,249,.08); }
                            .comm-empty { text-align:center; padding:2rem 1rem; color:var(--text-muted); font-size:.85rem; border:1px dashed var(--border-color); border-radius:10px; }
                        `}</style>

                        {/* Overview Stats */}
                        <div className="comm-stat-overview">
                            <div className="comm-stat-box">
                                <div className="comm-stat-box-label">Total Komisi (Semua Sales)</div>
                                <div className="comm-stat-box-value">Rp {totalCommission.toLocaleString('id-ID')}</div>
                                <div className="comm-stat-box-sub">
                                    {totalRevenue > 0 ? `${((totalCommission / totalRevenue) * 100).toFixed(2)}% dari revenue` : 'Belum ada penjualan'}
                                </div>
                            </div>
                            <div className="comm-stat-box">
                                <div className="comm-stat-box-label">Jumlah Sales Team</div>
                                <div className="comm-stat-box-value">{team.filter(t => t.role === 'SALES').length}</div>
                                <div className="comm-stat-box-sub">
                                    {team.filter(t => t.role === 'SALES').length > 0 ? `Rata-rata: Rp ${(totalCommission / team.filter(t => t.role === 'SALES').length).toLocaleString('id-ID', {maximumFractionDigits: 0})}` : 'Belum ada tim'}
                                </div>
                            </div>
                        </div>

                        {/* Table Komisi Per Sales */}
                        {team.filter(t => t.role === 'SALES').length === 0 ? (
                            <div className="comm-empty">
                                <div style={{fontSize:'1rem',marginBottom:'.5rem'}}>👤</div>
                                Belum ada Sales Team. Tambahkan anggota tim untuk tracking komisi.
                            </div>
                        ) : (
                            <div className="comm-table-wrapper">
                                <div className="comm-table-header">
                                    <span>Nama Sales</span>
                                    <span>Order Dibuat</span>
                                    <span>Total Komisi</span>
                                    <span>% dari Revenue</span>
                                    <span> </span>
                                </div>
                                {team.filter(t => t.role === 'SALES').map(sales => {
                                    const salesComm = salesCommissionMap[sales.id] || 0;
                                    const salesOrders = orders.filter(o => o.salesId === sales.id);
                                    const salesRevenue = salesOrders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
                                    const commPercentage = totalRevenue > 0 ? ((salesComm / totalRevenue) * 100).toFixed(2) : 0;
                                    
                                    return (
                                        <div className="comm-table-row" key={sales.id}>
                                            <div>
                                                <div className="comm-sales-name">{sales.name}</div>
                                                <div className="comm-sales-role">{sales.store_name || '(Tanpa nama toko)'}</div>
                                            </div>
                                            <div className="comm-sales-orders">{salesOrders.length}</div>
                                            <div>
                                                <div className="comm-commission-amount">Rp {salesComm.toLocaleString('id-ID')}</div>
                                                <div className="comm-commission-percent">dari Rp {salesRevenue.toLocaleString('id-ID')}</div>
                                            </div>
                                            <div>
                                                <div className="comm-commission-amount">{commPercentage}%</div>
                                                <div className="comm-commission-percent">komisi</div>
                                            </div>
                                            <div style={{textAlign:'center'}}>
                                                <div className="comm-action-btn" title="Lihat detail" onClick={() => fetchSalesReport(sales.id)}>
                                                    👁️
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Sales Report Detail */}
                        {salesReportId && salesReportData && (
                            <div style={{marginTop:'1.5rem',padding:'1.25rem',background:'linear-gradient(135deg,rgba(232,121,249,.08),rgba(168,85,247,.08))',border:'1.5px solid rgba(232,121,249,.2)',borderRadius:'12px'}}>
                                <div style={{fontSize:'.9rem',fontWeight:800,marginBottom:'1rem',color:'#e879f9'}}>
                                    📋 DETAIL KOMISI - {team.find(t => t.id === salesReportId)?.name || 'Sales'}
                                </div>
                                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem',marginBottom:'1rem'}}>
                                    <div style={{background:'var(--bg-main)',padding:'.75rem',borderRadius:'8px',border:'1px solid var(--border-color)'}}>
                                        <div style={{fontSize:'.7rem',color:'var(--text-muted)',fontWeight:700,marginBottom:'.25rem'}}>TOTAL ORDER</div>
                                        <div style={{fontSize:'1.1rem',fontWeight:800,color:'#e879f9'}}>{salesReportData.orders.length}</div>
                                    </div>
                                    <div style={{background:'var(--bg-main)',padding:'.75rem',borderRadius:'8px',border:'1px solid var(--border-color)'}}>
                                        <div style={{fontSize:'.7rem',color:'var(--text-muted)',fontWeight:700,marginBottom:'.25rem'}}>KONSUMEN</div>
                                        <div style={{fontSize:'1.1rem',fontWeight:800,color:'#e879f9'}}>{salesReportData.consumers.length}</div>
                                    </div>
                                    <div style={{background:'var(--bg-main)',padding:'.75rem',borderRadius:'8px',border:'1px solid var(--border-color)'}}>
                                        <div style={{fontSize:'.7rem',color:'var(--text-muted)',fontWeight:700,marginBottom:'.25rem'}}>TOTAL KOMISI</div>
                                        <div style={{fontSize:'1.1rem',fontWeight:800,color:'#e879f9'}}>Rp {salesReportData.grandTotalCommission.toLocaleString('id-ID')}</div>
                                    </div>
                                </div>
                                {salesReportLoading && <div style={{textAlign:'center',color:'var(--text-muted)',fontSize:'.85rem'}}>Memuat detail...</div>}
                            </div>
                        )}
                    </div>

                    {/* Produk Paling Laris */}
                    <div className="lap-panel">
                        <div className="lap-section-title">
                            <span className="icon"><BarChart3 size={15} /></span>
                            Produk Paling Laris
                        </div>
                        <div className="lap-list-header">
                            <span>Produk</span>
                            <span>Terjual</span>
                            <span>Sisa Stok</span>
                            <span>Tren</span>
                        </div>
                        {products.length === 0 ? (
                            <div className="lap-empty">Belum ada data produk.</div>
                        ) : (
                            products.slice(0, 5).map((p, idx) => {
                                const sold = Math.floor(Math.random() * 100) + 50;
                                const isUp = Math.random() > 0.3;
                                return (
                                    <div className="lap-item" key={p.id}>
                                        <div>
                                            <div className="lap-item-name">{p.name}</div>
                                            <div className="lap-item-code">{p.sku || `SKU-${String(p.id).padStart(4,'0')}`}</div>
                                        </div>
                                        <div><span className="lap-sold-badge">{sold} Unit</span></div>
                                        <div><span className="lap-stock-chip">{p.stock} pcs</span></div>
                                        <div>
                                            {isUp
                                                ? <span className="lap-trend up"><TrendingUp size={14} /> Naik</span>
                                                : <span className="lap-trend down"><TrendingDown size={14} /> Turun</span>
                                            }
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Ringkasan Aktivitas */}
                    <div className="lap-panel">
                        <div className="lap-section-title">
                            <span className="icon"><Activity size={15} /></span>
                            Ringkasan Aktivitas
                        </div>
                        <div className="lap-summary-grid">
                            <div className="lap-item" style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'.3rem'}}>
                                <span className="lap-stat-label">Order Menunggu Proses</span>
                                <span className="lap-stat-value" style={{fontSize:'1.1rem'}}>{orders.filter(o => o.status === 'PENDING').length} Order</span>
                            </div>
                            <div className="lap-item" style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'.3rem'}}>
                                <span className="lap-stat-label">Order Sedang Dikirim</span>
                                <span className="lap-stat-value" style={{fontSize:'1.1rem'}}>{orders.filter(o => o.status === 'SHIPPED').length} Order</span>
                            </div>
                            <div className="lap-item" style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'.3rem'}}>
                                <span className="lap-stat-label">Total Jaringan Aktif</span>
                                <span className="lap-stat-value" style={{fontSize:'1.1rem'}}>{team.length} Personel</span>
                            </div>
                            <div className="lap-item" style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:'.3rem'}}>
                                <span className="lap-stat-label">Total SKU Produk</span>
                                <span className="lap-stat-value" style={{fontSize:'1.1rem'}}>{products.length} SKU</span>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'Daftar Konsinyasi') {
            const detailContract = konsinyasiList.find(c => c.id === konsinyasiDetailId);
            const STATUS_COLOR = { DRAFT: '#6b7280', ACTIVE: '#22c55e', PAUSED: '#f59e0b', TERMINATED: '#ef4444' };
            const SCHED_COLOR = { SCHEDULED: '#818cf8', DISPATCHED: '#f59e0b', DELIVERED: '#22c55e', CANCELLED: '#6b7280' };

            return (
                <div className="animate-fade-up">
                    <style>{`
                        .kns-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
                        .kns-header h2 { font-size:1.2rem; font-weight:800; margin:0 0 .25rem; }
                        .kns-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .kns-layout { display:grid; grid-template-columns:340px 1fr; gap:1.25rem; }
                        @media(max-width:1000px){ .kns-layout{ grid-template-columns:1fr; } }
                        .kns-list-panel { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; overflow:hidden; }
                        .kns-list-head { padding:.9rem 1.1rem; border-bottom:1.5px solid var(--border-color); font-size:.78rem; font-weight:800; display:flex; justify-content:space-between; align-items:center; }
                        .kns-list-item { padding:.85rem 1.1rem; border-bottom:1px solid var(--border-color); cursor:pointer; transition:background .13s; display:flex; flex-direction:column; gap:.35rem; }
                        .kns-list-item:last-child { border-bottom:none; }
                        .kns-list-item:hover { background:rgba(99,102,241,.05); }
                        .kns-list-item.active { background:rgba(99,102,241,.1); border-left:3px solid #818cf8; }
                        .kns-list-item-top { display:flex; justify-content:space-between; align-items:center; gap:.5rem; }
                        .kns-list-store { font-weight:700; font-size:.85rem; }
                        .kns-list-no { font-size:.68rem; font-family:'Courier New',monospace; color:var(--text-muted); }
                        .kns-status-badge { display:inline-block; padding:.2rem .55rem; border-radius:20px; font-size:.65rem; font-weight:700; }
                        .kns-detail-panel { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:14px; padding:1.5rem; }
                        .kns-detail-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; gap:1rem; color:var(--text-muted); font-size:.85rem; }
                        .kns-section-title { font-size:.75rem; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin:1.25rem 0 .75rem; display:flex; align-items:center; gap:.5rem; }
                        .kns-section-title::before { content:''; flex:1; height:1px; background:var(--border-color); }
                        .kns-kyc-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; margin-bottom:.75rem; }
                        @media(max-width:700px){ .kns-kyc-grid{ grid-template-columns:1fr; } }
                        .kns-kyc-field label { font-size:.65rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); display:block; margin-bottom:.25rem; }
                        .kns-kyc-value { font-size:.83rem; font-weight:600; }
                        .kns-items-table { width:100%; border-collapse:collapse; font-size:.8rem; }
                        .kns-items-table th { padding:.55rem .75rem; text-align:left; font-size:.65rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); border-bottom:1.5px solid var(--border-color); }
                        .kns-items-table td { padding:.6rem .75rem; border-bottom:1px solid var(--border-color); }
                        .kns-items-table tr:last-child td { border-bottom:none; }
                        .kns-schedule-card { background:rgba(255,255,255,.02); border:1.5px solid var(--border-color); border-radius:10px; padding:.85rem 1rem; margin-bottom:.65rem; }
                        .kns-schedule-card:last-child { margin-bottom:0; }
                        .kns-schedule-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem; }
                        .kns-schedule-date { font-weight:800; font-size:.85rem; }
                        .kns-schedule-items { font-size:.75rem; color:var(--text-muted); margin-top:.35rem; }
                        .kns-btn { display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .85rem; border-radius:8px; border:1.5px solid var(--border-color); background:transparent; color:var(--text-primary); font-size:.78rem; font-weight:700; cursor:pointer; transition:all .18s; }
                        .kns-btn:hover { border-color:#818cf8; color:#818cf8; background:rgba(99,102,241,.07); }
                        .kns-btn.danger:hover { border-color:#ef4444; color:#ef4444; background:rgba(239,68,68,.07); }
                        .kns-btn.primary { background:linear-gradient(135deg,#6366f1,#8b5cf6); border-color:transparent; color:#fff; }
                        .kns-btn.primary:hover { opacity:.9; }
                        .kns-btn.green { background:rgba(34,197,94,.1); border-color:rgba(34,197,94,.3); color:#22c55e; }
                        .kns-btn.green:hover { background:rgba(34,197,94,.18); }
                        .kns-actions-row { display:flex; gap:.6rem; flex-wrap:wrap; margin-bottom:1rem; }
                        .kns-empty-list { text-align:center; padding:2.5rem; color:var(--text-muted); font-size:.85rem; }
                        .kns-contract-invoice { display:inline-flex; align-items:center; gap:.3rem; font-size:.68rem; font-family:'Courier New',monospace; background:rgba(99,102,241,.1); color:#818cf8; border:1px solid rgba(99,102,241,.2); border-radius:6px; padding:.2rem .5rem; }
                    `}</style>

                    <div className="kns-header">
                        <div>
                            <h2>Daftar Konsinyasi</h2>
                            <p>Kelola kontrak titipan produk ke konsumen & jadwal pengirimannya.</p>
                        </div>
                        <div style={{display:'flex', gap:'.75rem', flexWrap:'wrap'}}>
                            <button className="kns-btn primary" onClick={openNewKonsinyasi}>
                                <Plus size={14} /> Buat Kontrak Baru
                            </button>
                            <button className="kns-btn" style={{background:'rgba(168,85,247,.12)',color:'#a855f7',borderColor:'rgba(168,85,247,.3)'}} onClick={() => setActiveTab('Rencana Pengiriman')}>
                                <BarChart3 size={14} /> Rencana Pengiriman
                            </button>
                        </div>
                    </div>

                    {konsinyasiLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Memuat data...</div>
                    ) : (
                        <div className="kns-layout">
                            {/* LEFT: Contract List */}
                            <div className="kns-list-panel">
                                <div className="kns-list-head">
                                    <span>Daftar Kontrak ({konsinyasiList.length})</span>
                                </div>
                                {konsinyasiList.length === 0 ? (
                                    <div className="kns-empty-list">Belum ada kontrak konsinyasi.</div>
                                ) : konsinyasiList.map(c => (
                                    <div key={c.id} className={`kns-list-item ${konsinyasiDetailId === c.id ? 'active' : ''}`} onClick={() => setKonsinyasiDetailId(konsinyasiDetailId === c.id ? null : c.id)}>
                                        <div className="kns-list-item-top">
                                            <span className="kns-list-store">{c.storeName}</span>
                                            <span className="kns-status-badge" style={{ background: `${STATUS_COLOR[c.status]}20`, color: STATUS_COLOR[c.status], border: `1px solid ${STATUS_COLOR[c.status]}40` }}>{c.status}</span>
                                        </div>
                                        <span className="kns-list-no">{c.contractNo}</span>
                                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
                                            {c.konsumen?.name} · {c.items.length} produk · {c.schedules.length} jadwal
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* RIGHT: Contract Detail */}
                            <div className="kns-detail-panel">
                                {!detailContract ? (
                                    <div className="kns-detail-empty">
                                        <FileText size={40} style={{ opacity: .25 }} />
                                        <span>Pilih kontrak untuk melihat detail</span>
                                    </div>
                                ) : (
                                    <div>
                                        {/* Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.75rem', marginBottom: '.75rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '.2rem' }}>{detailContract.storeName}</div>
                                                <span className="kns-contract-invoice">{detailContract.contractNo}</span>
                                            </div>
                                            <span className="kns-status-badge" style={{ fontSize: '.75rem', padding: '.3rem .75rem', background: `${STATUS_COLOR[detailContract.status]}20`, color: STATUS_COLOR[detailContract.status], border: `1px solid ${STATUS_COLOR[detailContract.status]}40` }}>{detailContract.status}</span>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="kns-actions-row">
                                            <button className="kns-btn" onClick={() => openEditKonsinyasi(detailContract)}><Edit3 size={13} /> Edit</button>
                                            {detailContract.status === 'DRAFT' && <button className="kns-btn green" onClick={() => updateKonsinyasiStatus(detailContract.id, 'ACTIVE')}><CheckCircle2 size={13} /> Aktifkan</button>}
                                            {detailContract.status === 'ACTIVE' && <button className="kns-btn" onClick={() => updateKonsinyasiStatus(detailContract.id, 'PAUSED')}><Clock size={13} /> Pause</button>}
                                            {detailContract.status === 'PAUSED' && <button className="kns-btn green" onClick={() => updateKonsinyasiStatus(detailContract.id, 'ACTIVE')}><Zap size={13} /> Lanjutkan</button>}
                                            {detailContract.status !== 'TERMINATED' && <button className="kns-btn danger" onClick={() => updateKonsinyasiStatus(detailContract.id, 'TERMINATED')}><X size={13} /> Terminasi</button>}
                                            {detailContract.status === 'DRAFT' && <button className="kns-btn danger" onClick={() => deleteKonsinyasi(detailContract.id)}><X size={13} /> Hapus</button>}
                                            {['ACTIVE', 'PAUSED'].includes(detailContract.status) && (
                                                <button className="kns-btn primary" onClick={() => openScheduleModal(detailContract.id)}><Plus size={13} /> Tambah Jadwal Kirim</button>
                                            )}
                                            {detailContract.status === 'ACTIVE' && detailContract.schedules?.length === 0 && (
                                                <button className="kns-btn green" style={{ fontWeight: 800 }} onClick={() => triggerFirstDelivery(detailContract.id)}><Zap size={13} /> Buat Pengiriman Pertama</button>
                                            )}
                                        </div>

                                        {/* KYC Info */}
                                        <div className="kns-section-title">Data KYC Konsumen</div>
                                        <div className="kns-kyc-grid">
                                            {[
                                                { label: 'Nama Pemilik', value: detailContract.ownerName },
                                                { label: 'Nama Toko', value: detailContract.storeName },
                                                { label: 'Konsumen Terdaftar', value: detailContract.konsumen?.name || '-' },
                                                { label: 'No. Handphone', value: detailContract.storePhone || '-' },
                                                { label: 'Alamat', value: detailContract.storeAddress },
                                                { label: 'NIK', value: detailContract.idCardNo || '-' },
                                                { label: 'NPWP', value: detailContract.npwpNo || '-' },
                                                { label: 'Siklus Tagihan', value: detailContract.billingCycle },
                                                { label: 'Tgl Mulai', value: detailContract.startDate ? new Date(detailContract.startDate).toLocaleDateString('id-ID') : '-' },
                                                { label: 'Tgl Berakhir', value: detailContract.endDate ? new Date(detailContract.endDate).toLocaleDateString('id-ID') : '-' },
                                            ].map(f => (
                                                <div key={f.label} className="kns-kyc-field">
                                                    <label>{f.label}</label>
                                                    <div className="kns-kyc-value">{f.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {detailContract.notes && <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '.5rem' }}>📝 {detailContract.notes}</div>}

                                        {/* Products in contract */}
                                        <div className="kns-section-title">Produk Titipan & Harga</div>
                                        <table className="kns-items-table">
                                            <thead><tr><th>Produk</th><th>Varian</th><th>Harga Titipan</th><th>Max Qty/Kirim</th></tr></thead>
                                            <tbody>
                                                {detailContract.items.map(it => (
                                                    <tr key={it.id}>
                                                        <td><div style={{ fontWeight: 700 }}>{it.product?.name}</div><span style={{ fontSize: '.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{it.product?.code}</span></td>
                                                        <td>{it.packaging ? <span style={{ fontSize: '.72rem', background: 'rgba(34,197,94,.1)', color: '#86efac', border: '1px solid rgba(34,197,94,.2)', borderRadius: 6, padding: '.15rem .45rem' }}>📦 {it.packaging.name}</span> : <span style={{ fontSize: '.72rem', color: '#c084fc' }}>Satuan</span>}</td>
                                                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>Rp {Number(it.priceKonsinyasi).toLocaleString('id-ID')}</td>
                                                        <td style={{ color: 'var(--text-muted)' }}>{it.maxQtyPerDelivery > 0 ? it.maxQtyPerDelivery : '∞'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Delivery Schedules */}
                                        <div className="kns-section-title">Jadwal Pengiriman ({detailContract.schedules.length})</div>
                                        {detailContract.schedules.length === 0 ? (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '.83rem', textAlign: 'center', padding: '1.5rem', border: '1.5px dashed var(--border-color)', borderRadius: 10 }}>
                                                Belum ada jadwal. Klik "Tambah Jadwal Kirim" untuk membuat.
                                            </div>
                                        ) : detailContract.schedules.map(s => (
                                            <div key={s.id} className="kns-schedule-card">
                                                <div className="kns-schedule-head">
                                                    <div>
                                                        <div className="kns-schedule-date">📅 {new Date(s.deliveryDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                                        <span style={{ fontSize: '.7rem', padding: '.2rem .5rem', borderRadius: 20, background: `${SCHED_COLOR[s.status]}20`, color: SCHED_COLOR[s.status], border: `1px solid ${SCHED_COLOR[s.status]}40`, fontWeight: 700 }}>{s.status}</span>
                                                        {s.order && <span className="kns-contract-invoice" style={{ marginLeft: '.5rem' }}>{s.order.invoice_id}</span>}
                                                    </div>
                                                    {s.status === 'SCHEDULED' && (
                                                        <button className="kns-btn danger" style={{ padding: '.3rem .6rem', fontSize: '.7rem' }} onClick={() => deleteSchedule(s.id)}><X size={12} /></button>
                                                    )}
                                                </div>
                                                <div className="kns-schedule-items">
                                                    {s.items.map(si => (
                                                        <span key={si.id} style={{ marginRight: '.75rem' }}>
                                                            {si.product?.code} × {si.quantity}{si.packaging ? ` ${si.packaging.name}` : ' unit'}
                                                        </span>
                                                    ))}
                                                </div>
                                                {s.notes && <div style={{ fontSize: '.73rem', color: 'var(--text-muted)', marginTop: '.35rem' }}>📝 {s.notes}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (activeTab === 'Pengaturan') {
            return (
                <div className="animate-fade-up delay-100">
                    <style>{`
                        .set-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.75rem; flex-wrap:wrap; gap:1rem; }
                        .set-header h2 { font-size:1.25rem; font-weight:800; margin:0 0 .25rem; }
                        .set-header p { font-size:.8rem; color:var(--text-muted); margin:0; }
                        .set-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
                        @media(max-width:900px){ .set-grid{ grid-template-columns:1fr; } }
                        .set-panel { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:16px; overflow:hidden; }
                        .set-panel-head { display:flex; align-items:center; gap:.85rem; padding:1.25rem 1.4rem; border-bottom:1.5px solid var(--border-color); }
                        .set-panel-head-icon { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                        .set-panel-head-icon.indigo { background:rgba(99,102,241,.12); color:#6366f1; }
                        .set-panel-head-icon.red    { background:rgba(239,68,68,.1);   color:#ef4444; }
                        .set-panel-head-icon.amber  { background:rgba(245,158,11,.1);  color:#f59e0b; }
                        .set-panel-title { font-size:.93rem; font-weight:800; }
                        .set-panel-sub   { font-size:.73rem; color:var(--text-muted); margin-top:.1rem; }
                        .set-panel-body  { padding:1.4rem; display:flex; flex-direction:column; gap:1.1rem; }
                        .set-field-label { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-bottom:.4rem; display:block; }
                        .set-input { width:100%; padding:.6rem .85rem; border-radius:9px; border:1.5px solid var(--border-color); background:var(--bg-main,var(--bg-hover)); color:var(--text-primary); font-size:.85rem; outline:none; transition:border-color .18s; box-sizing:border-box; }
                        .set-input:focus { border-color:#6366f1; }
                        .set-input:disabled { opacity:.45; cursor:not-allowed; }
                        .set-textarea { width:100%; padding:.65rem .85rem; border-radius:9px; border:1.5px solid var(--border-color); background:var(--bg-main,var(--bg-hover)); color:var(--text-primary); font-size:.85rem; outline:none; resize:vertical; min-height:96px; transition:border-color .18s; box-sizing:border-box; font-family:inherit; }
                        .set-textarea:focus { border-color:#6366f1; }
                        .set-save-btn { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; padding:.65rem 1.75rem; border-radius:10px; background:linear-gradient(135deg,#4338ca,#818cf8); color:#fff; border:none; font-size:.85rem; font-weight:700; cursor:pointer; transition:opacity .18s; align-self:flex-start; }
                        .set-save-btn:hover { opacity:.88; }
                        .set-action-row { display:flex; align-items:center; gap:.9rem; padding:.85rem 1rem; border-radius:10px; border:1.5px solid var(--border-color); background:var(--bg-main,transparent); cursor:pointer; transition:border-color .18s,background .18s; }
                        .set-action-row:hover { border-color:#6366f1; background:rgba(99,102,241,.05); }
                        .set-action-row:hover .set-action-icon { color:#818cf8; }
                        .set-action-icon { width:34px; height:34px; border-radius:9px; background:var(--bg-hover); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:var(--text-muted); transition:color .18s; }
                        .set-action-text { flex:1; font-size:.85rem; font-weight:600; }
                        .set-action-arrow { color:var(--text-muted); opacity:.5; }
                        .set-divider { border:none; border-top:1.5px solid var(--border-color); margin:.2rem 0; }
                        .set-meta-row { display:flex; justify-content:space-between; align-items:center; padding:.5rem 0; }
                        .set-meta-label { font-size:.72rem; color:var(--text-muted); }
                        .set-meta-value { font-size:.72rem; font-weight:700; font-family:'Courier New',monospace; background:rgba(99,102,241,.1); color:#818cf8; border:1px solid rgba(99,102,241,.2); padding:.2rem .55rem; border-radius:6px; }
                    `}</style>

                    {/* Header */}
                    <div className="set-header">
                        <div>
                            <h2>Pengaturan Akun Stokis</h2>
                            <p>Kelola profil bisnis, keamanan, dan konfigurasi sistem gudang Anda.</p>
                        </div>
                    </div>

                    <div className="set-grid">
                        {/* Profil Bisnis */}
                        <div className="set-panel">
                            <div className="set-panel-head">
                                <div className="set-panel-head-icon indigo"><Building2 size={18} /></div>
                                <div>
                                    <div className="set-panel-title">Profil Bisnis / Gudang</div>
                                    <div className="set-panel-sub">Nama toko, alamat, dan kontak korespondensi</div>
                                </div>
                            </div>
                            <div className="set-panel-body">
                                <div>
                                    <label className="set-field-label">Nama Gudang / Store</label>
                                    <input type="text" className="set-input" value={profile.store_name || ''} onChange={e => setProfile({ ...profile, store_name: e.target.value })} placeholder="Nama toko atau gudang" />
                                </div>
                                <div>
                                    <label className="set-field-label">Email Korespondensi</label>
                                    <input type="text" className="set-input" value={profile.email || ''} disabled />
                                </div>
                                <div>
                                    <label className="set-field-label">Nomor Kontak / WhatsApp</label>
                                    <input type="text" className="set-input" value={profile.contact || ''} onChange={e => setProfile({ ...profile, contact: e.target.value })} placeholder="08xxxxxxxxxx" />
                                </div>
                                <div>
                                    <label className="set-field-label">Alamat Utama</label>
                                    <textarea className="set-textarea" value={profile.address || ''} onChange={e => setProfile({ ...profile, address: e.target.value })} placeholder="Jl. Contoh No. 1, Kota" />
                                </div>
                                <button className="set-save-btn" onClick={handleUpdateProfile}>
                                    {loadingProfile ? 'Menyimpan...' : <><CheckCircle2 size={15} /> Simpan Profil</>}
                                </button>
                            </div>
                        </div>

                        {/* Keamanan & Sistem */}
                        <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
                            <div className="set-panel">
                                <div className="set-panel-head">
                                    <div className="set-panel-head-icon red"><Settings size={18} /></div>
                                    <div>
                                        <div className="set-panel-title">Keamanan Akun</div>
                                        <div className="set-panel-sub">Password, notifikasi, dan sinkronisasi data</div>
                                    </div>
                                </div>
                                <div className="set-panel-body">
                                    <div className="set-action-row" onClick={handleChangePassword}>
                                        <div className="set-action-icon"><Settings size={15} /></div>
                                        <span className="set-action-text">Ganti Password Akun</span>
                                        <ChevronDown size={15} className="set-action-arrow" style={{transform:'rotate(-90deg)'}} />
                                    </div>
                                    <div className="set-action-row" onClick={() => MySwal.fire({ title: 'Notifikasi', text: 'Fitur pengaturan notifikasi sedang disiapkan.', background: 'var(--bg-card)' })}>
                                        <div className="set-action-icon"><Bell size={15} /></div>
                                        <span className="set-action-text">Pengaturan Notifikasi (WA / Push)</span>
                                        <ChevronDown size={15} className="set-action-arrow" style={{transform:'rotate(-90deg)'}} />
                                    </div>
                                    <div className="set-action-row" onClick={() => MySwal.fire({ title: 'Backup', text: 'Database Cloud tersinkronisasi otomatis.', background: 'var(--bg-card)' })}>
                                        <div className="set-action-icon"><Zap size={15} /></div>
                                        <span className="set-action-text">Sinkronisasi Database (Backup)</span>
                                        <ChevronDown size={15} className="set-action-arrow" style={{transform:'rotate(-90deg)'}} />
                                    </div>
                                </div>
                            </div>

                            <div className="set-panel">
                                <div className="set-panel-head">
                                    <div className="set-panel-head-icon amber"><Zap size={18} /></div>
                                    <div>
                                        <div className="set-panel-title">Informasi Sistem</div>
                                        <div className="set-panel-sub">Versi, lisensi, dan status platform</div>
                                    </div>
                                </div>
                                <div className="set-panel-body">
                                    <div className="set-meta-row">
                                        <span className="set-meta-label">Versi Aplikasi</span>
                                        <span className="set-meta-value">v1.0.4-beta</span>
                                    </div>
                                    <hr className="set-divider" />
                                    <div className="set-meta-row">
                                        <span className="set-meta-label">Lisensi</span>
                                        <span className="set-meta-value">Enterprise Edition</span>
                                    </div>
                                    <hr className="set-divider" />
                                    <div className="set-meta-row">
                                        <span className="set-meta-label">Status Server</span>
                                        <span className="set-meta-value" style={{background:'rgba(34,197,94,.1)',color:'#22c55e',borderColor:'rgba(34,197,94,.25)'}}>● Online</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeTab === 'Rencana Pengiriman') {
            const activeContracts = konsinyasiList.filter(c => c.status === 'ACTIVE');
            // Get all products with konsinyasi pricing
            const konsinyasiProducts = products.filter(p => {
                const hasKonsinyasiPrice = team.some(t => 
                    t.pricingOverrides?.some(po => po.productId === p.id && po.level_name?.includes('Konsinyasi'))
                );
                return hasKonsinyasiPrice || p.name?.toLowerCase().includes('konsinyasi');
            });

            const addDeliveryRow = (contractId = '') => {
                const newId = Date.now();
                const newRows = [];

                if (contractId) {
                    // Auto-generate rows untuk setiap produk dalam kontrak
                    const contract = konsinyasiList.find(c => c.id === contractId);
                    if (contract) {
                        contract.items.forEach((item, idx) => {
                            // Auto-select "Konsinyasi" packaging if available
                            const konsinyasiPackaging = item.product?.packagings?.find(pkg => pkg.name?.toLowerCase() === 'konsinyasi');
                            const selectedPackaging = konsinyasiPackaging || item.packaging || item.product?.packagings?.[0];
                            
                            newRows.push({
                                id: newId + idx,
                                deliveryDate: '',
                                contractId: contractId,
                                storeName: contract.storeName,
                                productId: item.product?.id || '',
                                productName: item.product?.name || '',
                                packagingId: selectedPackaging?.id || '',
                                packagingName: selectedPackaging?.name || 'Satuan',
                                quantity: 0,
                                isFromContract: true
                            });
                        });
                    }
                } else {
                    // Empty row untuk tambah produk lain
                    newRows.push({
                        id: newId,
                        deliveryDate: '',
                        contractId: '',
                        storeName: '',
                        productId: '',
                        productName: '',
                        packagingId: '',
                        packagingName: '',
                        quantity: 0,
                        isFromContract: false
                    });
                }

                setDeliveryRows([...deliveryRows, ...newRows]);
            };

            const updateRow = (rowId, field, value) => {
                // Jika field adalah contractId, auto-select produk kontrak pertama
                const updatedRows = deliveryRows.map(row => {
                    if (row.id === rowId) {
                        const updated = { ...row, [field]: value };
                        if (field === 'contractId' && value) {
                            // Auto-select first product dari kontrak dan set storeName
                            const contract = konsinyasiList.find(c => c.id === parseInt(value));
                            if (contract) {
                                updated.storeName = contract.storeName || '';
                                if (contract.items.length > 0) {
                                    const firstItem = contract.items[0];
                                    updated.productId = firstItem.product?.id || '';
                                    updated.productName = firstItem.product?.name || '';
                                    
                                    // Auto-select "Konsinyasi" packaging if available
                                    const konsinyasiPackaging = firstItem.product?.packagings?.find(pkg => pkg.name?.toLowerCase() === 'konsinyasi');
                                    const selectedPackaging = konsinyasiPackaging || firstItem.packaging || firstItem.product?.packagings?.[0];
                                    updated.packagingId = selectedPackaging?.id || '';
                                    updated.packagingName = selectedPackaging?.name || 'Satuan';
                                    updated.isFromContract = true;
                                }
                            }
                        }
                        return updated;
                    }
                    return row;
                });
                setDeliveryRows(updatedRows);
            };

            const updateRowProduct = (rowId, productId) => {
                const product = products.find(p => p.id === parseInt(productId));
                // Auto-select "Konsinyasi" packaging if available, otherwise first packaging
                const konsinyasiPackaging = product?.packagings?.find(pkg => pkg.name?.toLowerCase() === 'konsinyasi');
                const selectedPackaging = konsinyasiPackaging || product?.packagings?.[0];
                
                setDeliveryRows(deliveryRows.map(row => 
                    row.id === rowId ? { 
                        ...row, 
                        productId: productId, 
                        productName: product?.name,
                        packagingId: selectedPackaging?.id || '',
                        packagingName: selectedPackaging?.name || 'Satuan'
                    } : row
                ));
            };

            const updateRowPackaging = (rowId, packagingId) => {
                const allPackagings = products.flatMap(p => (p.packagings || []).map(pkg => ({...pkg, productId: p.id})));
                const packaging = allPackagings.find(pkg => pkg.id === parseInt(packagingId));
                setDeliveryRows(deliveryRows.map(row => 
                    row.id === rowId ? { 
                        ...row, 
                        packagingId: packagingId, 
                        packagingName: packaging?.name || 'Satuan'
                    } : row
                ));
            };

            const deleteRow = (rowId) => {
                setDeliveryRows(deliveryRows.filter(row => row.id !== rowId));
            };

            const saveDeliveryPlan = async () => {
                const validRows = deliveryRows.filter(r => r.deliveryDate && r.contractId && r.productId && r.quantity > 0);
                if (validRows.length === 0) {
                    MySwal.fire({title:'Info', text:'Isi minimal: Toko, Tanggal, Produk, dan Qty > 0', icon:'info'});
                    return;
                }

                // Group by contractId to batch
                const grouped = {};
                validRows.forEach(row => {
                    if (!grouped[row.contractId]) grouped[row.contractId] = [];
                    grouped[row.contractId].push(row);
                });

                const promises = Object.entries(grouped).map(([contractId, rows]) => {
                    const itemsByDate = {};
                    rows.forEach(row => {
                        if (!itemsByDate[row.deliveryDate]) itemsByDate[row.deliveryDate] = [];
                        itemsByDate[row.deliveryDate].push({
                            product_id: parseInt(row.productId),
                            packaging_id: parseInt(row.packagingId) || null,
                            quantity: parseInt(row.quantity)
                        });
                    });

                    return Promise.all(Object.entries(itemsByDate).map(([dateKey, itemsPayload]) =>
                        axios.post(`http://localhost:5000/api/konsinyasi/${contractId}/schedules`, {
                            delivery_date: dateKey,
                            notes: '',
                            items: itemsPayload
                        })
                    ));
                });

                try {
                    await Promise.all(promises.flat());
                    MySwal.fire({title:'Berhasil!', text:`${validRows.length} item pengiriman telah dibuat.`, icon:'success'});
                    setDeliveryRows([]);
                    fetchKonsinyasi();
                } catch (error) {
                    MySwal.fire({title:'Gagal!', text: error.response?.data?.message || 'Terjadi kesalahan.', icon:'error'});
                }
            };

            return (
                <div className="animate-fade-up">
                    <style>{`
                        .drv-page { padding:.75rem; }
                        .drv-header { margin-bottom:1.5rem; }
                        .drv-header h2 { font-size:1.1rem; font-weight:800; margin:0 0 .3rem; }
                        .drv-header p { font-size:.75rem; color:var(--text-muted); margin:0; }
                        .drv-table-wrap { background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:12px; overflow-x:auto; margin-bottom:1rem; }
                        .drv-table { width:100%; border-collapse:collapse; font-size:.75rem; }
                        .drv-table thead { position:sticky; top:0; background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(168,85,247,.08)); border-bottom:1.5px solid var(--border-color); }
                        .drv-table th { padding:.65rem; text-align:left; font-weight:700; color:var(--text-muted); font-size:.7rem; text-transform:uppercase; letter-spacing:.05em; }
                        .drv-table td { padding:.65rem; border-bottom:1px solid var(--border-color); }
                        .drv-table tbody tr:hover { background:rgba(168,85,247,.04); }
                        .drv-input { width:100%; padding:.4rem .5rem; background:#1e1b4b; color:#f0f0f0; border:1px solid var(--border-color); border-radius:5px; font-size:.75rem; font-weight:500; }
                        .drv-input::placeholder { color:#9ca3af; }
                        .drv-input:focus { outline:none; border-color:#a855f7; box-shadow:0 0 0 2px rgba(168,85,247,.1); }
                        .drv-select { width:100%; padding:.4rem .5rem; background:#1e1b4b; color:#f0f0f0; border:1px solid var(--border-color); border-radius:5px; font-size:.75rem; font-weight:500; cursor:pointer; appearance:none; background-image:url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f0f0f0' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat:no-repeat; background-position:right .5rem center; background-size:1.2em; padding-right:1.8rem; }
                        .drv-select:focus { outline:none; border-color:#a855f7; }
                        .drv-select option { background:#1e1b4b; color:#f0f0f0; padding:.4rem; }
                        .drv-select option:checked { background:linear-gradient(135deg,#4338ca,#7c3aed); color:#f0f0f0; }
                        .drv-actions { display:flex; gap:.5rem; margin-top:1rem; flex-wrap:wrap; }
                        .drv-btn { padding:.5rem 1rem; border-radius:8px; border:1.5px solid var(--border-color); background:transparent; font-weight:700; font-size:.75rem; cursor:pointer; transition:all .15s; display:inline-flex; align-items:center; gap:.3rem; }
                        .drv-btn:hover { opacity:.8; }
                        .drv-btn-add { color:#818cf8; border-color:rgba(129,140,248,.3); background:rgba(129,140,248,.05); }
                        .drv-btn-add:hover { background:rgba(129,140,248,.12); border-color:#818cf8; }
                        .drv-btn-save { background:linear-gradient(135deg,#6366f1,#a855f7); color:#fff; border:none; }
                        .drv-btn-save:hover { opacity:.9; }
                        .drv-btn-del { color:#ef4444; border-color:rgba(239,68,68,.3); background:rgba(239,68,68,.05); }
                        .drv-btn-del:hover { background:rgba(239,68,68,.15); border-color:#ef4444; }
                        .drv-empty { text-align:center; padding:2rem; color:var(--text-muted); }
                    `}</style>

                    <div className="drv-page">
                        <div className="drv-header">
                            <h2>📅 Rencana Pengiriman Konsinyasi</h2>
                            <p>Buat rencana pengiriman per toko dengan tanggal dan barang berbeda-beda</p>
                        </div>

                        {activeContracts.length === 0 ? (
                            <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: 12, padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <FileText size={48} style={{opacity:.2, marginBottom:'1rem'}} />
                                <div style={{fontSize:'.95rem', fontWeight:600, marginBottom:'.5rem'}}>Belum ada kontrak pengiriman aktif</div>
                                <div style={{fontSize:'.8rem', marginBottom:'1.5rem', color:'var(--text-muted)'}}>Buat kontrak konsinyasi dulu di "Daftar Konsinyasi" sebelum membuat rencana pengiriman.</div>
                                <button 
                                    onClick={() => setActiveTab('Daftar Konsinyasi')}
                                    style={{
                                        padding: '.6rem 1.5rem',
                                        borderRadius: '8px',
                                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                        color: '#fff',
                                        border: 'none',
                                        fontWeight: '700',
                                        fontSize: '.8rem',
                                        cursor: 'pointer',
                                        transition: 'all .2s',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '.5rem'
                                    }}
                                    onMouseEnter={e => e.target.style.opacity = '0.9'}
                                    onMouseLeave={e => e.target.style.opacity = '1'}
                                >
                                    📋 Buat Kontrak Baru
                                </button>
                            </div>
                        ) : (
                            <>
                                {deliveryRows.length === 0 ? (
                                    <div className="drv-empty">
                                        <p style={{margin:'0 0 1rem 0'}}>Belum ada rencana pengiriman.</p>
                                        <button className="drv-btn drv-btn-add" onClick={() => addDeliveryRow()}>
                                            <Plus size={14} /> Tambah Rencana Pengiriman
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="drv-table-wrap">
                                            <table className="drv-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{width:'18%'}}>Tanggal</th>
                                                        <th style={{width:'20%'}}>Toko</th>
                                                        <th style={{width:'35%'}}>Produk</th>
                                                        <th style={{width:'12%', textAlign:'center'}}>Qty</th>
                                                        <th style={{width:'15%', textAlign:'center'}}>Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {deliveryRows.map(row => (
                                                        <tr key={row.id}>
                                                            <td>
                                                                <input type="date" className="drv-input" value={row.deliveryDate} onChange={e => updateRow(row.id, 'deliveryDate', e.target.value)} />
                                                            </td>
                                                            <td>
                                                                <select className="drv-select" value={row.contractId} onChange={e => updateRow(row.id, 'contractId', e.target.value)}>
                                                                    <option value="">-- Pilih Toko --</option>
                                                                    {activeContracts.map(c => <option key={c.id} value={c.id}>{c.storeName}</option>)}
                                                                </select>
                                                            </td>
                                                            <td>
                                                                <div style={{display:'flex', gap:'.3rem', flexDirection:'column'}}>
                                                                    <select className="drv-select" value={row.productId} onChange={e => updateRowProduct(row.id, e.target.value)}>
                                                                        <option value="">-- Pilih Produk --</option>
                                                                        {row.contractId && (() => {
                                                                            const contract = konsinyasiList.find(c => c.id === parseInt(row.contractId));
                                                                            const contractProductIds = contract?.items.map(it => it.product?.id) || [];
                                                                            const contractProds = products.filter(p => contractProductIds.includes(p.id));
                                                                            const otherProds = products.filter(p => !contractProductIds.includes(p.id));
                                                                            
                                                                            return <>
                                                                                {contractProds.map(p => <option key={`c-${p.id}`} value={p.id}>✓ {p.name}</option>)}
                                                                                {otherProds.length > 0 && <option disabled>────── Produk Lain ──────</option>}
                                                                                {otherProds.map(p => <option key={`o-${p.id}`} value={p.id}>{p.name}</option>)}
                                                                            </>;
                                                                        })()}
                                                                        {!row.contractId && products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                                    </select>
                                                                    {row.productId && products.find(p => p.id === parseInt(row.productId))?.packagings?.length > 0 && (
                                                                        <select className="drv-select" value={row.packagingId} onChange={e => updateRowPackaging(row.id, e.target.value)}>
                                                                            <option value="">Satuan</option>
                                                                            {products.find(p => p.id === parseInt(row.productId))?.packagings?.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
                                                                        </select>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td style={{textAlign:'center'}}>
                                                                <input type="number" className="drv-input" style={{textAlign:'center'}} min="0" value={row.quantity} onChange={e => updateRow(row.id, 'quantity', parseInt(e.target.value) || 0)} placeholder="0" />
                                                            </td>
                                                            <td style={{textAlign:'center'}}>
                                                                <button className="drv-btn drv-btn-del" onClick={() => deleteRow(row.id)}>
                                                                    <X size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="drv-actions">
                                            <button className="drv-btn drv-btn-add" onClick={() => addDeliveryRow()}>
                                                <Plus size={14} /> Tambah Produk Lain
                                            </button>
                                            <button className="drv-btn drv-btn-add" onClick={() => {
                                                if (activeContracts.length === 0) {
                                                    MySwal.fire({title:'Info', text:'Belum ada toko aktif', icon:'info'});
                                                    return;
                                                }
                                                const contractId = activeContracts[0].id;
                                                addDeliveryRow(contractId);
                                            }}>
                                                <Plus size={14} /> Tambah Produk dari Toko
                                            </button>
                                            <button className="drv-btn drv-btn-save" onClick={saveDeliveryPlan}>
                                                <CheckCircle2 size={14} /> Simpan Semua ({deliveryRows.length})
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
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
                        <p>Titik survei lapangan yang dilakukan oleh tim sales · {hasCoords.length} titik berkoordinat GPS dari {visitMarkers.length} total kunjungan</p>
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
                        <button className={'comm-tab ' + (commTab === 'laporan' ? 'active' : '')} onClick={() => { setCommTab('laporan'); setSalesReportId(null); }}>Laporan Sales</button>
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
                                <div style={{textAlign:'center',padding:'3rem',color:'var(--text-muted)',background:'var(--bg-card)',borderRadius:14,border:'1.5px solid var(--border-color)'}}>Belum ada produk. Tambahkan produk di menu Produk terlebih dahulu.</div>
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
                                            const cfg = pendingConfigs[p.id] || { isActive: false, commissionType: 'CUMULATIVE', packagings: {} };
                                            const tiers = p.priceTiers || [];
                                            return (
                                                <React.Fragment key={p.id}>
                                                <tr>
                                                    <td>
                                                        <div style={{fontWeight:800,color:'var(--text-main)'}}>{p.name}</div>
                                                        <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginBottom:'.3rem'}}>{p.code}</div>
                                                        <span style={{fontSize:'.65rem',fontWeight:800,color:'#818cf8',background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:4,padding:'1px 7px'}}>Satuan / Unit</span>
                                                    </td>
                                                    <td>
                                                        {tiers.length === 0 && (p.packagings || []).length === 0
                                                            ? <span style={{color:'var(--text-muted)',fontSize:'.75rem'}}>Belum ada tier harga</span>
                                                            : tiers.map(t => (
                                                                <div key={t.id} style={{fontSize:'.75rem',color:'var(--text-muted)',lineHeight:1.7}}>
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
                                                {/* Packaging sub-rows */}
                                                {(p.packagings || []).filter(pkg => pkg.priceTiers && pkg.priceTiers.length > 0).map(pkg => {
                                                    const pkgCfg = cfg.packagings?.[pkg.id] || { isActive: false, commissionType: 'CUMULATIVE' };
                                                    return (
                                                        <tr key={`pkg-${pkg.id}`}>
                                                            <td style={{paddingLeft:'2rem'}}>
                                                                <span style={{fontSize:'.68rem',fontWeight:800,color:'#10b981',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:5,padding:'2px 8px',display:'inline-flex',alignItems:'center',gap:4}}>
                                                                    📦 {pkg.name} ({pkg.unitQty} unit)
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {pkg.priceTiers.map(pt => (
                                                                    <div key={pt.id} style={{fontSize:'.75rem',color:'var(--text-muted)',lineHeight:1.7}}>
                                                                        {pt.level_name}: <strong style={{color:'#34d399'}}>Rp {pt.commission.toLocaleString('id-ID')}</strong>
                                                                    </div>
                                                                ))}
                                                            </td>
                                                            <td style={{textAlign:'center'}}>
                                                                <span className="comm-toggle" onClick={() => setPendingConfigs(pc => ({ ...pc, [p.id]: { ...pc[p.id], packagings: { ...pc[p.id].packagings, [pkg.id]: { ...pkgCfg, isActive: !pkgCfg.isActive } } } }))} title={pkgCfg.isActive ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}>
                                                                    {pkgCfg.isActive ? <ToggleRight size={28} color="#10b981" /> : <ToggleLeft size={28} color="var(--text-muted)" />}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <select className="comm-select" value={pkgCfg.commissionType} disabled={!pkgCfg.isActive} onChange={e => setPendingConfigs(pc => ({ ...pc, [p.id]: { ...pc[p.id], packagings: { ...pc[p.id].packagings, [pkg.id]: { ...pkgCfg, commissionType: e.target.value } } } }))}>
                                                                    <option value="CUMULATIVE">Kumulatif (setiap pembelian)</option>
                                                                    <option value="FIRST_PURCHASE">Hanya pembelian pertama</option>
                                                                </select>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </>
                    ) : commTab === 'campaigns' ? (
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
                    ) : commTab === 'laporan' ? (
                        <>
                            {commSalesTeam.length === 0 ? (
                                <div style={{textAlign:'center',padding:'3rem',color:'var(--text-muted)',background:'var(--bg-card)',borderRadius:14,border:'1.5px solid var(--border-color)'}}>Belum ada anggota Sales. Tambahkan Sales di menu Manajemen Tim.</div>
                            ) : (
                                <div style={{display:'flex',flexDirection:'column',gap:'.85rem'}}>
                                    {commSalesTeam.map(s => {
                                        const totalComm = salesCommissionMap[s.id] || 0;
                                        const consumerCount = salesConsumerMap[s.id] || 0;
                                        const isExpanded = salesReportId === s.id;
                                        return (
                                            <div key={s.id} style={{background:'var(--bg-card)',border:`1.5px solid ${isExpanded ? '#6366f1' : 'var(--border-color)'}`,borderRadius:14,padding:'1.1rem 1.25rem',transition:'border-color .15s'}}>
                                                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.75rem',flexWrap:'wrap'}}>
                                                    <div style={{display:'flex',alignItems:'center',gap:'.85rem'}}>
                                                        <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(99,102,241,.15)',border:'1.5px solid rgba(129,140,248,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'.88rem',color:'#818cf8',flexShrink:0}}>{s.name.substring(0,2).toUpperCase()}</div>
                                                        <div>
                                                            <div style={{fontWeight:800,fontSize:'.9rem'}}>{s.name}</div>
                                                            <div style={{fontSize:'.72rem',color:'var(--text-muted)',marginTop:2}}>{s.email}{s.contact ? ` · ${s.contact}` : ''}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{display:'flex',alignItems:'center',gap:'1.5rem',flexWrap:'wrap'}}>
                                                        <div style={{textAlign:'center'}}>
                                                            <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--text-muted)',marginBottom:'.2rem'}}>Total Komisi</div>
                                                            <div style={{fontWeight:800,fontSize:'1rem',color:'#818cf8'}}>Rp {totalComm.toLocaleString('id-ID')}</div>
                                                        </div>
                                                        <div style={{textAlign:'center'}}>
                                                            <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--text-muted)',marginBottom:'.2rem'}}>Konsumen</div>
                                                            <div style={{fontWeight:800,fontSize:'1rem'}}>{consumerCount}</div>
                                                        </div>
                                                        <button onClick={() => fetchSalesReport(s.id)} style={{display:'flex',alignItems:'center',gap:'.4rem',padding:'.5rem 1rem',borderRadius:9,border:`1.5px solid ${isExpanded ? '#6366f1' : 'var(--border-color)'}`,background:isExpanded ? 'rgba(99,102,241,.1)' : 'transparent',color:isExpanded ? '#818cf8' : 'var(--text-muted)',fontWeight:700,fontSize:'.8rem',cursor:'pointer',transition:'all .15s'}}>
                                                            {isExpanded ? 'Tutup' : 'Lihat Detail'}
                                                            <ChevronDown size={14} style={{transform:isExpanded ? 'rotate(180deg)' : 'none',transition:'transform .2s'}} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div style={{marginTop:'1.1rem',paddingTop:'1.1rem',borderTop:'1px solid var(--border-color)'}}>
                                                        {salesReportLoading ? (
                                                            <div style={{textAlign:'center',padding:'1.5rem',color:'var(--text-muted)',fontSize:'.85rem'}}>Memuat data...</div>
                                                        ) : (
                                                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem'}}>
                                                                <div>
                                                                    <div style={{fontWeight:800,fontSize:'.85rem',marginBottom:'.5rem',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                                                        <span>🧾 Riwayat Order ({salesReportData.orders.length})</span>
                                                                        <span style={{color:'#818cf8',fontWeight:700,fontSize:'.8rem'}}>Rp {salesReportData.grandTotalCommission.toLocaleString('id-ID')}</span>
                                                                    </div>
                                                                    {salesReportData.orders.length === 0 ? (
                                                                        <div style={{textAlign:'center',padding:'1rem',color:'var(--text-muted)',fontSize:'.78rem',border:'1px dashed var(--border-color)',borderRadius:9}}>Belum ada order selesai.</div>
                                                                    ) : (
                                                                        <div style={{maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:'.35rem'}}>
                                                                            {salesReportData.orders.map(o => (
                                                                                <div key={o.orderId} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.55rem .75rem',borderRadius:9,border:'1px solid var(--border-color)',background:'rgba(255,255,255,.01)'}}>
                                                                                    <div>
                                                                                        <div style={{fontWeight:700,fontSize:'.78rem',fontFamily:'Courier New,monospace'}}>{o.invoice_id}</div>
                                                                                        <div style={{fontSize:'.68rem',color:'var(--text-muted)',marginTop:'.1rem'}}>{new Date(o.date).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})} · {o.buyerName}</div>
                                                                                    </div>
                                                                                    <div style={{fontWeight:800,fontSize:'.82rem',color:'#818cf8',fontFamily:'Courier New,monospace'}}>+Rp {o.totalCommission.toLocaleString('id-ID')}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div style={{fontWeight:800,fontSize:'.85rem',marginBottom:'.5rem'}}>👤 Konsumen Terdaftar ({salesReportData.consumers.length})</div>
                                                                    {salesReportData.consumers.length === 0 ? (
                                                                        <div style={{textAlign:'center',padding:'1rem',color:'var(--text-muted)',fontSize:'.78rem',border:'1px dashed var(--border-color)',borderRadius:9}}>Belum ada konsumen terdaftar.</div>
                                                                    ) : (
                                                                        <div style={{maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:'.35rem'}}>
                                                                            {salesReportData.consumers.map(c => (
                                                                                <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'.55rem .75rem',borderRadius:9,border:'1px solid var(--border-color)',background:'rgba(255,255,255,.01)'}}>
                                                                                    <div>
                                                                                        <div style={{fontWeight:700,fontSize:'.78rem'}}>{c.name}</div>
                                                                                        <div style={{fontSize:'.68rem',color:'var(--text-muted)',marginTop:'.1rem'}}><span style={{background:'rgba(99,102,241,.1)',color:'#818cf8',borderRadius:4,padding:'1px 5px',fontSize:'.65rem',fontWeight:700}}>{c.role}</span> · {c.email}</div>
                                                                                    </div>
                                                                                    <div style={{fontSize:'.68rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{new Date(c.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : null}

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
                                        {!isSidebarCollapsed && <span>{item.name}</span>}
                                        {(activeTab === item.name && !isSidebarCollapsed) && <div className="active-indicator" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

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
                            <div className="text-xs text-muted font-mono bg-[rgba(255,255,255,0.05)] px-1.5 rounded">⌘ K</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Bell */}
                        <button className="navbar-bell" title="Notifikasi">
                            <Bell size={18} />
                            <span className="navbar-bell-dot" />
                        </button>

                        {/* Profile Pill */}
                        <div style={{ position: 'relative' }}>
                            <button
                                className={`navbar-profile-btn ${isProfileDropdownOpen ? 'active' : ''}`}
                                onClick={() => setIsProfileDropdownOpen(v => !v)}
                            >
                                <div className="navbar-profile-avatar">
                                    {profile.name ? profile.name.charAt(0).toUpperCase() : 'S'}
                                </div>
                                <div className="navbar-profile-info">
                                    <span className="navbar-profile-name">{profile.name || 'Stokis'}</span>
                                    <span className="navbar-profile-store">{profile.store_name || 'Gudang Pusat'}</span>
                                </div>
                                <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.2s', transform: isProfileDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                            </button>

                            {isProfileDropdownOpen && (
                                <>
                                    <div className="profile-dropdown-overlay" onClick={() => setIsProfileDropdownOpen(false)} />
                                    <div className="profile-dropdown animate-fade-up">
                                        <div className="profile-dropdown-user">
                                            <div className="profile-dropdown-avatar">
                                                {profile.name ? profile.name.charAt(0).toUpperCase() : 'S'}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div className="profile-dropdown-name">{profile.name || 'Stokis'}</div>
                                                <div className="profile-dropdown-email">{profile.email || '—'}</div>
                                                {profile.store_name && <div className="profile-dropdown-store">{profile.store_name}</div>}
                                            </div>
                                        </div>
                                        <div className="profile-dropdown-divider" />
                                        <button className="profile-dropdown-item" onClick={openEditProfile}>
                                            <Edit3 size={15} /> Edit Profil
                                        </button>
                                        <button className="profile-dropdown-item" onClick={() => { setIsProfileDropdownOpen(false); setActiveTab('Pengaturan'); }}>
                                            <Settings size={15} /> Pengaturan Akun
                                        </button>
                                        <div className="profile-dropdown-divider" />
                                        <button className="profile-dropdown-item profile-dropdown-item--danger" onClick={handleLogout}>
                                            <LogOut size={15} /> Keluar dari Sistem
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* CONTENT VIEWPORT */}
                < main className="app-content" >
                    <div className="max-w-6xl mx-auto w-full">
                        {renderContent()}
                    </div>
                </main >
            </div >
            {/* DYNAMIC REACT MODAL: ADD PRODUCT & MULTI-TIER */}
            {
                isAddModalOpen && (
                    <div className="modal-overlay animate-fade-up">
                        <div className="modal-content animate-fade-up" style={{ maxWidth: '680px' }}>

                            {/* Modal Header */}
                            <div className="modal-header" style={{ background: 'linear-gradient(135deg,rgba(129,140,248,0.08),rgba(168,85,247,0.04))' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,rgba(129,140,248,0.25),rgba(168,85,247,0.25))', color: '#a5b4fc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Diamond size={18} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                            {editingProductId ? 'Edit SKU & Multi-Tier' : 'Daftarkan SKU Baru'}
                                        </h3>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                            {editingProductId ? 'Perbarui data produk & skema harga' : 'Tambah produk & konfigurasi harga distribusi'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="modal-body">
                                {/* Basic Info */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '0.85rem', marginBottom: '1.5rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(161,161,170,0.7)', display: 'block', marginBottom: '0.4rem' }}>Nama Produk</label>
                                        <input type="text" className="modal-input"
                                            placeholder="Cth: Minyak Goreng 1L" value={formProduct.name} onChange={e => setFormProduct({ ...formProduct, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(161,161,170,0.7)', display: 'block', marginBottom: '0.4rem' }}>Stok Gudang</label>
                                        <input type="number" className="modal-input"
                                            placeholder="0" value={formProduct.stock} onChange={e => setFormProduct({ ...formProduct, stock: e.target.value })} />
                                    </div>
                                </div>

                                {/* Tiers Section Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(161,161,170,0.7)' }}>Skema Harga & Komisi</div>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#818cf8', background: 'rgba(129,140,248,0.12)', padding: '0.15rem 0.6rem', borderRadius: '999px', letterSpacing: '0.05em' }}>UNLIMITED TIERS</span>
                                </div>

                                {/* Column header */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 32px', gap: '0.5rem', padding: '0 0 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.6rem' }}>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(161,161,170,0.4)' }}>Nama Level / Area</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(161,161,170,0.4)', textAlign: 'right' }}>Harga Jual (Rp)</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#818cf8', textAlign: 'right' }}>Komisi (Rp)</div>
                                    <div />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                    {formTiers.map((tier, index) => (
                                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 32px', gap: '0.5rem', alignItems: 'center', animation: 'fadeUp 0.25s ease forwards', animationDelay: `${index * 40}ms` }}>
                                            <input type="text" className="modal-input" style={{ fontSize: '0.85rem' }}
                                                placeholder="Cth: Harga Substokis / Area Timur"
                                                value={tier.level_name} onChange={e => handleTierChange(index, 'level_name', e.target.value)} />
                                            <input type="number" className="modal-input" style={{ fontSize: '0.85rem', fontFamily: 'monospace', textAlign: 'right' }}
                                                placeholder="0"
                                                value={tier.price} onChange={e => handleTierChange(index, 'price', e.target.value)} />
                                            <input type="number" className="modal-input" style={{ fontSize: '0.85rem', fontFamily: 'monospace', textAlign: 'right', borderColor: 'rgba(129,140,248,0.25)', color: '#a5b4fc' }}
                                                placeholder="0"
                                                value={tier.commission} onChange={e => handleTierChange(index, 'commission', e.target.value)} />
                                            <button
                                                onClick={() => handleRemoveTierRow(index)}
                                                disabled={index === 0}
                                                title="Hapus baris"
                                                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0 : 1, flexShrink: 0, transition: 'background 0.15s' }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button onClick={handleAddTierRow}
                                    style={{ marginTop: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(129,140,248,0.07)', border: '1px dashed rgba(129,140,248,0.25)', borderRadius: 8, color: '#818cf8', fontSize: '0.78rem', fontWeight: 600, padding: '0.45rem 0.85rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
                                    <Plus size={13} /> Tambah Tier Harga
                                </button>

                                {/* ── Packaging Section ── */}
                                <div style={{ marginTop: '1.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
                                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
                                        <div>
                                            <div style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(161,161,170,0.7)' }}>Kemasan / Satuan Bundel</div>
                                            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:2 }}>Opsional. Atur harga khusus per satuan bundel (Dus, Karton, dll) sesuai tier harga.</div>
                                        </div>
                                        <button onClick={addPackaging} style={{ display:'inline-flex', alignItems:'center', gap:'0.35rem', background:'rgba(16,185,129,0.07)', border:'1px dashed rgba(16,185,129,0.3)', borderRadius:8, color:'#10b981', fontSize:'0.78rem', fontWeight:600, padding:'0.45rem 0.85rem', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                                            <Plus size={13} /> Tambah Kemasan
                                        </button>
                                    </div>

                                    {formPackagings.length === 0 ? (
                                        <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', textAlign:'center', padding:'0.85rem', border:'1px dashed rgba(255,255,255,0.07)', borderRadius:8 }}>
                                            Belum ada kemasan. Produk hanya dijual satuan (unit).
                                        </div>
                                    ) : (
                                        <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
                                            {formPackagings.map((pkg, pkgIdx) => (
                                                <div key={pkgIdx} style={{ background:'rgba(16,185,129,0.04)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:10, padding:'0.85rem 1rem' }}>
                                                    {/* Packaging header row */}
                                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 120px auto 32px', gap:'0.6rem', alignItems:'center', marginBottom:'0.75rem' }}>
                                                        <div>
                                                            <div style={{ fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', color:'rgba(161,161,170,0.5)', marginBottom:3 }}>Nama Kemasan</div>
                                                            <input type="text" className="modal-input" style={{ fontSize:'0.83rem' }} placeholder="Cth: Dus, Karton, Lusin" value={pkg.name} onChange={e => updatePackaging(pkgIdx, 'name', e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', color:'rgba(161,161,170,0.5)', marginBottom:3 }}>Isi (Unit)</div>
                                                            <input type="number" className="modal-input" style={{ fontSize:'0.83rem', fontFamily:'monospace', textAlign:'right' }} placeholder="12" value={pkg.unitQty} onChange={e => updatePackaging(pkgIdx, 'unitQty', e.target.value)} />
                                                        </div>
                                                        <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:'0.78rem', color:'var(--text-muted)', userSelect:'none', whiteSpace:'nowrap' }}>
                                                            <input type="checkbox" style={{ width:15, height:15, accentColor:'#10b981', cursor:'pointer' }} checked={!!pkg.isDefault} onChange={e => updatePackaging(pkgIdx, 'isDefault', e.target.checked)} />
                                                            Default
                                                        </label>
                                                        <button onClick={() => removePackaging(pkgIdx)} style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:7, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.15)', color:'#f87171', cursor:'pointer', flexShrink:0 }}>
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                    {/* Per-tier prices for this packaging */}
                                                    {pkg.priceTiers.length > 0 && (
                                                        <>
                                                            <div style={{ display:'grid', gridTemplateColumns:'1fr 140px 140px', gap:'0.5rem', padding:'0 0 0.4rem', borderBottom:'1px solid rgba(255,255,255,0.05)', marginBottom:'0.45rem' }}>
                                                                <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(161,161,170,0.35)' }}>Tier</div>
                                                                <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(161,161,170,0.35)', textAlign:'right' }}>Harga / Kemasan (Rp)</div>
                                                                <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#818cf8', textAlign:'right' }}>Komisi / Kemasan (Rp)</div>
                                                            </div>
                                                            {pkg.priceTiers.map((pt, tIdx) => (
                                                                <div key={tIdx} style={{ display:'grid', gridTemplateColumns:'1fr 140px 140px', gap:'0.5rem', alignItems:'center', marginBottom:'0.35rem' }}>
                                                                    <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-muted)', paddingLeft:2 }}>{pt.level_name || `Tier ${tIdx+1}`}</div>
                                                                    <input type="number" className="modal-input" style={{ fontSize:'0.83rem', fontFamily:'monospace', textAlign:'right' }} placeholder="0" value={pt.price} onChange={e => updatePackagingTier(pkgIdx, tIdx, 'price', e.target.value)} />
                                                                    <input type="number" className="modal-input" style={{ fontSize:'0.83rem', fontFamily:'monospace', textAlign:'right', borderColor:'rgba(129,140,248,0.25)', color:'#a5b4fc' }} placeholder="0" value={pt.commission} onChange={e => updatePackagingTier(pkgIdx, tIdx, 'commission', e.target.value)} />
                                                                </div>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button onClick={() => setIsAddModalOpen(false)} className="btn btn-secondary">Batalkan</button>
                                <button onClick={submitProduct} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg,#818cf8,#a855f7)', color: '#fff', border: 'none', borderRadius: 9, padding: '0.55rem 1.25rem', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(129,140,248,0.3)' }}>
                                    {editingProductId ? 'Simpan Perubahan' : 'Simpan ke Database'} <ArrowUpRight size={15} />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DYNAMIC REACT MODAL: ADD RESTOCK (PURCHASING) */}
            {
                isRestockModalOpen && (
                    <div className="modal-overlay animate-fade-up">
                        <div className="modal-content animate-fade-up" style={{ maxWidth: '500px', padding: 0, overflow: 'hidden' }}>

                            {/* Gradient Header */}
                            <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #059669 60%, #10b981 100%)', padding: '1.4rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ShoppingCart size={18} color="#fff" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Catat Restock Gudang</div>
                                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Stok akan bertambah otomatis setelah disimpan</div>
                                    </div>
                                </div>
                                <button onClick={() => setIsRestockModalOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1.1rem', lineHeight: 1 }}>&times;</button>
                            </div>

                            <div className="modal-body" style={{ padding: '1.4rem 1.5rem' }}>
                                {/* SKU Select */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.4rem' }}>Pilih SKU Produk</label>
                                    <select className="modal-input" style={{ appearance: 'none', backgroundImage: 'none' }} value={formRestock.productId} onChange={e => setFormRestock({ ...formRestock, productId: e.target.value })}>
                                        <option value="" disabled>-- Pilih Barang dari Katalog --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.code} — {p.name} (Sisa: {p.stock})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Qty + Price */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.4rem' }}>Jumlah Masuk (Qty)</label>
                                        <input type="number" className="modal-input" placeholder="Cth: 50" value={formRestock.quantity} onChange={e => setFormRestock({ ...formRestock, quantity: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.4rem' }}>Harga Beli Satuan (Rp)</label>
                                        <input type="number" className="modal-input" placeholder="Modal pabrik" value={formRestock.price_buy} onChange={e => setFormRestock({ ...formRestock, price_buy: e.target.value })} />
                                    </div>
                                </div>

                                {/* Preview total */}
                                {formRestock.quantity && formRestock.price_buy && (
                                    <div style={{ borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Estimasi Total Tagihan</div>
                                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>
                                                Rp {Number(formRestock.quantity * formRestock.price_buy).toLocaleString('id-ID')}
                                            </div>
                                        </div>
                                        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <DollarSign size={20} color="#10b981" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.7rem' }}>
                                <button onClick={() => setIsRestockModalOpen(false)} className="btn btn-secondary">Batalkan</button>
                                <button onClick={submitRestock} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.3rem', borderRadius: 10, background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                                    <ShoppingCart size={15} /> Eksekusi Restock
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* KONSINYASI CONTRACT MODAL */}
            {showKonsinyasiModal && (
                <div className="modal-overlay animate-fade-up" onClick={e => e.target === e.currentTarget && setShowKonsinyasiModal(false)}>
                    <div className="modal-content animate-fade-up" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ background: 'linear-gradient(135deg,#0f1729,#1a2040)', borderBottom: '1.5px solid rgba(99,102,241,.25)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.9rem' }}>
                                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(99,102,241,.2)', border: '1.5px solid rgba(99,102,241,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={18} color="#818cf8" /></div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '.95rem' }}>{editingKonsinyasi ? 'Edit Kontrak Konsinyasi' : 'Buat Kontrak Konsinyasi Baru'}</div>
                                    <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>Isi data KYC dan produk titipan</div>
                                </div>
                            </div>
                            <button onClick={() => setShowKonsinyasiModal(false)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            {/* Konsumen picker */}
                            <div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>Konsumen Terdaftar *</div>
                                <select className="modal-input" value={kForm.konsumenId} onChange={async (e) => {
                                    const k = konsumenList.find(k => k.id === parseInt(e.target.value));
                                    console.log('[DEBUG] Konsumen selected:', { value: e.target.value, konsumen: k });
                                    
                                    setKForm(f => ({
                                        ...f,
                                        konsumenId: e.target.value,
                                        storeName: k?.store_name || f.storeName,
                                        storeAddress: k?.address || f.storeAddress,
                                        storePhone: k?.contact || f.storePhone,
                                        ownerName: k?.name || f.ownerName
                                    }));
                                    
                                    // Re-fetch prices for all existing items with new konsumen
                                    if (e.target.value && kForm.items.length > 0) {
                                        const updatedItems = [...kForm.items];
                                        for (let idx = 0; idx < updatedItems.length; idx++) {
                                            const item = updatedItems[idx];
                                            if (item.productId) {
                                                const price = await fetchDefaultKonsinyasiPrice(item.productId, item.packagingId, e.target.value);
                                                updatedItems[idx].priceKonsinyasi = String(price);
                                            }
                                        }
                                        setKForm(f => ({ ...f, items: updatedItems }));
                                    }
                                }}>
                                    <option value="">— Pilih Konsumen —</option>
                                    {konsumenList.map(k => <option key={k.id} value={k.id}>{k.name} {k.store_name ? `— ${k.store_name}` : ''}</option>)}
                                </select>
                            </div>
                            {/* KYC Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                                {[
                                    { key: 'ownerName', label: 'Nama Pemilik *', placeholder: 'Budi Santoso' },
                                    { key: 'storeName', label: 'Nama Toko *', placeholder: 'Warung Bu Budi' },
                                    { key: 'storePhone', label: 'No. HP', placeholder: '08xxxxxxxx' },
                                    { key: 'idCardNo', label: 'NIK KTP', placeholder: '32xxxxxxxxxxxxxx' },
                                    { key: 'npwpNo', label: 'NPWP (opsional)', placeholder: 'xx.xxx.xxx.x-xxx.xxx' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>{f.label}</div>
                                        <input type="text" className="modal-input" placeholder={f.placeholder} value={kForm[f.key]} onChange={e => setKForm(p => ({ ...p, [f.key]: e.target.value }))} />
                                    </div>
                                ))}
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>Alamat Toko *</div>
                                    <input type="text" className="modal-input" placeholder="Jl. Merdeka No. 10, Bandung" value={kForm.storeAddress} onChange={e => setKForm(p => ({ ...p, storeAddress: e.target.value }))} />
                                </div>
                            </div>
                            {/* Billing & dates */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>Siklus Tagihan</div>
                                    <select className="modal-input" value={kForm.billingCycle} onChange={e => setKForm(p => ({ ...p, billingCycle: e.target.value }))}>
                                        <option value="WEEKLY">Mingguan</option>
                                        <option value="MONTHLY">Bulanan</option>
                                    </select>
                                </div>
                                <div>
                                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>Tgl Mulai</div>
                                    <input type="date" className="modal-input" value={kForm.startDate} onChange={e => setKForm(p => ({ ...p, startDate: e.target.value }))} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>Tgl Berakhir</div>
                                    <input type="date" className="modal-input" value={kForm.endDate} onChange={e => setKForm(p => ({ ...p, endDate: e.target.value }))} />
                                </div>
                            </div>
                            {/* Notes */}
                            <div>
                                <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>Catatan Kontrak</div>
                                <textarea className="modal-input" rows={2} placeholder="Syarat & ketentuan, catatan khusus..." value={kForm.notes} onChange={e => setKForm(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical' }} />
                            </div>
                            {/* Products */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.65rem' }}>
                                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Produk Titipan</div>
                                    <button className="btn btn-secondary py-1 text-xs" onClick={() => setKForm(p => ({ ...p, items: [...p.items, { productId: '', packagingId: '', priceKonsinyasi: '', maxQtyPerDelivery: '0' }] }))}>+ Tambah Produk</button>
                                </div>
                                {kForm.items.length === 0 && <div style={{ textAlign: 'center', padding: '1rem', border: '1.5px dashed var(--border-color)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '.8rem' }}>Belum ada produk. Klik "+ Tambah Produk"</div>}
                                {kForm.items.map((it, idx) => {
                                    const selProd = products.find(p => p.id === parseInt(it.productId));
                                    const handleProductChange = async (e) => {
                                        const items = [...kForm.items];
                                        items[idx].productId = e.target.value;
                                        items[idx].packagingId = '';
                                        setKForm(p => ({ ...p, items }));
                                        
                                        // Fetch and auto-populate default price for satuan unit (sesuai tier konsumen)
                                        if (e.target.value && kForm.konsumenId) {
                                            const defaultPrice = await fetchDefaultKonsinyasiPrice(e.target.value, '', kForm.konsumenId);
                                            const updatedItems = [...kForm.items];
                                            updatedItems[idx].priceKonsinyasi = String(defaultPrice);
                                            setKForm(p => ({ ...p, items: updatedItems }));
                                        }
                                    };
                                    
                                    const handlePackagingChange = async (e) => {
                                        const items = [...kForm.items];
                                        items[idx].packagingId = e.target.value;
                                        setKForm(p => ({ ...p, items }));
                                        
                                        // Fetch and auto-populate default price for selected packaging (sesuai tier konsumen)
                                        if (it.productId && e.target.value && kForm.konsumenId) {
                                            const defaultPrice = await fetchDefaultKonsinyasiPrice(it.productId, e.target.value, kForm.konsumenId);
                                            const updatedItems = [...kForm.items];
                                            updatedItems[idx].priceKonsinyasi = String(defaultPrice);
                                            setKForm(p => ({ ...p, items: updatedItems }));
                                        }
                                    };
                                    
                                    return (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px 36px', gap: '.5rem', marginBottom: '.5rem', alignItems: 'end' }}>
                                            <div>
                                                {idx === 0 && <div style={{ fontSize: '.62rem', color: 'var(--text-muted)', marginBottom: '.25rem', fontWeight: 700 }}>PRODUK</div>}
                                                <select className="modal-input" value={it.productId} onChange={handleProductChange}>
                                                    <option value="">— Pilih —</option>
                                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                {idx === 0 && <div style={{ fontSize: '.62rem', color: 'var(--text-muted)', marginBottom: '.25rem', fontWeight: 700 }}>VARIAN</div>}
                                                <select className="modal-input" value={it.packagingId} onChange={handlePackagingChange}>
                                                    <option value="">Satuan Unit</option>
                                                    {(selProd?.packagings || []).map(pk => <option key={pk.id} value={pk.id}>📦 {pk.name} ({pk.unitQty} unit)</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                {idx === 0 && <div style={{ fontSize: '.62rem', color: 'var(--text-muted)', marginBottom: '.25rem', fontWeight: 700 }}>HARGA TITIPAN</div>}
                                                <input type="number" className="modal-input" placeholder="0" value={it.priceKonsinyasi} onChange={e => { const items = [...kForm.items]; items[idx].priceKonsinyasi = e.target.value; setKForm(p => ({ ...p, items })); }} />
                                            </div>
                                            <div>
                                                {idx === 0 && <div style={{ fontSize: '.62rem', color: 'var(--text-muted)', marginBottom: '.25rem', fontWeight: 700 }}>MAX QTY/KIRIM</div>}
                                                <input type="number" className="modal-input" placeholder="0=bebas" value={it.maxQtyPerDelivery} onChange={e => { const items = [...kForm.items]; items[idx].maxQtyPerDelivery = e.target.value; setKForm(p => ({ ...p, items })); }} />
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                                <button onClick={() => setKForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))} style={{ height: 38, width: 36, borderRadius: 8, border: '1.5px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.07)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowKonsinyasiModal(false)} className="btn btn-secondary">Batal</button>
                            <button onClick={saveKonsinyasi} className="btn btn-primary font-bold">{editingKonsinyasi ? 'Simpan Perubahan' : 'Buat Kontrak'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* KONSINYASI SCHEDULE MODAL */}
            {showScheduleModal && (() => {
                const contract = konsinyasiList.find(c => c.id === scheduleContractId);
                return (
                    <div className="modal-overlay animate-fade-up" onClick={e => e.target === e.currentTarget && setShowScheduleModal(false)}>
                        <div className="modal-content animate-fade-up" style={{ maxWidth: '560px' }}>
                            <div style={{ background: 'linear-gradient(135deg,#0b2316,#14532d)', borderBottom: '1.5px solid rgba(34,197,94,.2)', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '.9rem' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(34,197,94,.15)', border: '1.5px solid rgba(34,197,94,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CalendarDays size={18} color="#22c55e" /></div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '.95rem' }}>Tambah Jadwal Pengiriman</div>
                                        <div style={{ fontSize: '.72rem', color: 'rgba(34,197,94,.7)' }}>{contract?.storeName} — {contract?.contractNo}</div>
                                    </div>
                                </div>
                                <button onClick={() => setShowScheduleModal(false)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
                                <div>
                                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>Tanggal Pengiriman *</div>
                                    <input type="date" className="modal-input" value={scheduleForm.deliveryDate} onChange={e => setScheduleForm(f => ({ ...f, deliveryDate: e.target.value }))} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>Catatan</div>
                                    <input type="text" className="modal-input" placeholder="Opsional..." value={scheduleForm.notes} onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: '.65rem' }}>Qty per Produk</div>
                                    {scheduleForm.items.map((si, idx) => {
                                        const contractItem = contract?.items.find(ci => ci.productId === parseInt(si.productId) && (ci.packagingId || null) === (si.packagingId ? parseInt(si.packagingId) : null));
                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.55rem', padding: '.65rem .85rem', border: '1.5px solid var(--border-color)', borderRadius: 9 }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '.83rem' }}>{contractItem?.product?.name}</div>
                                                    <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>
                                                        {contractItem?.packaging ? `📦 ${contractItem.packaging.name}` : 'Satuan'} · Harga: Rp {Number(contractItem?.priceKonsinyasi || 0).toLocaleString('id-ID')}
                                                        {contractItem?.maxQtyPerDelivery > 0 && ` · Max: ${contractItem.maxQtyPerDelivery}`}
                                                    </div>
                                                </div>
                                                <input type="number" min="0" className="modal-input" style={{ width: 80 }} placeholder="0" value={si.quantity} onChange={e => { const items = [...scheduleForm.items]; items[idx].quantity = e.target.value; setScheduleForm(f => ({ ...f, items })); }} />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', padding: '.75rem', borderRadius: 9, background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.15)' }}>
                                    ✅ Jadwal ini akan <strong style={{ color: '#22c55e' }}>otomatis membuat pesanan</strong> di tab Distribusi dan terlihat sebagai pesanan konsinyasi di aplikasi konsumen.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button onClick={() => setShowScheduleModal(false)} className="btn btn-secondary">Batal</button>
                                <button onClick={saveSchedule} className="btn btn-primary font-bold">Buat Jadwal & Pesanan</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* DYNAMIC REACT MODAL: ADD TEAM MEMBER */}
            {
                isAddTeamModalOpen && (
                    <div className="modal-overlay animate-fade-up">
                        <div className="modal-content animate-fade-up" style={{ maxWidth: '550px', padding: 0, overflow: 'hidden' }}>

                            {/* Gradient Header */}
                            <div style={{ background: editingTeamId ? 'linear-gradient(135deg,#1e1b4b 0%,#4338ca 60%,#6366f1 100%)' : 'linear-gradient(135deg,#1e1b4b 0%,#4338ca 60%,#818cf8 100%)', padding: '1.4rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Users size={18} color="#fff" />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                                            {editingTeamId
                                                ? (teamModalRoles.includes('KONSUMEN') ? 'Edit Data Pelanggan' : 'Edit Profil Anggota Tim')
                                                : (teamModalRoles.includes('KONSUMEN') ? 'Tambah Pelanggan Baru' : 'Rekrut Personel Baru')}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                                            {editingTeamId
                                                ? (teamModalRoles.includes('KONSUMEN') ? 'Perbarui data akun pelanggan Anda' : 'Perbarui data akun anggota tim')
                                                : (teamModalRoles.includes('KONSUMEN') ? 'Daftarkan Sub-Stokis, Konsumen, atau Member baru' : 'Daftarkan akun baru untuk tim operasional')}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddTeamModalOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1.1rem', lineHeight: 1 }}>&times;</button>
                            </div>

                            <div className="modal-body" style={{ padding: '1.4rem 1.5rem 0.5rem' }}>
                                {/* Role Selector */}
                                <div style={{ marginBottom: '1.1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.45rem' }}>Tentukan Role Operasional</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {teamModalRoles.map(r => {
                                            const active = formTeam.role === r;
                                            const rColors = { SUBSTOKIS: '#818cf8', SALES: '#60a5fa', DRIVER: '#f59e0b', KONSUMEN: '#f59e0b', MEMBER: '#10b981' };
                                            const c = rColors[r] || 'var(--primary)';
                                            return (
                                                <button key={r} onClick={() => setFormTeam({ ...formTeam, role: r })} style={{ flex: 1, padding: '0.55rem', borderRadius: 9, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all .15s', background: active ? `${c}22` : 'rgba(0,0,0,0.2)', color: active ? c : 'var(--text-muted)', border: `1.5px solid ${active ? c : 'var(--border-color)'}` }}>
                                                    {r}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Name + Contact */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.4rem' }}>Nama Lengkap</label>
                                        <input type="text" className="modal-input" placeholder="Nama KTP" value={formTeam.name} onChange={e => setFormTeam({ ...formTeam, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.4rem' }}>No Handphone / WA</label>
                                        <input type="text" className="modal-input" placeholder="08..." value={formTeam.contact} onChange={e => setFormTeam({ ...formTeam, contact: e.target.value })} />
                                    </div>
                                </div>

                                {/* Store name (SUBSTOKIS only) */}
                                {formTeam.role === 'SUBSTOKIS' && (
                                    <div style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.4rem' }}>Nama Toko Cabang</label>
                                        <input type="text" className="modal-input" placeholder="Contoh: Toko Berkah Mandiri" value={formTeam.store_name} onChange={e => setFormTeam({ ...formTeam, store_name: e.target.value })} />
                                    </div>
                                )}

                                {/* Address */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.4rem' }}>Alamat / Wilayah Operasi</label>
                                    <input type="text" className="modal-input" placeholder="Jalan Raya No. 123..." value={formTeam.address} onChange={e => setFormTeam({ ...formTeam, address: e.target.value })} />
                                </div>

                                {/* Koordinat GPS */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.5rem' }}>Titik Koordinat (GPS)</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <button type="button" disabled={teamGettingLocation} onClick={() => {
                                            if (!navigator.geolocation) return MySwal.fire({ icon: 'error', title: 'Tidak Didukung', text: 'Browser tidak mendukung geolocation.', background: 'var(--bg-card)', color: 'var(--text-main)' });
                                            setTeamGettingLocation(true);
                                            navigator.geolocation.getCurrentPosition(
                                                (pos) => {
                                                    const lat = pos.coords.latitude.toFixed(7);
                                                    const lng = pos.coords.longitude.toFixed(7);
                                                    setFormTeam(f => ({ ...f, latitude: lat, longitude: lng }));
                                                    setTeamMapPickerCoord({ lat: parseFloat(lat), lng: parseFloat(lng) });
                                                    setTeamGettingLocation(false);
                                                },
                                                () => { MySwal.fire({ icon: 'warning', title: 'Gagal', text: 'Tidak bisa mendapatkan lokasi. Pastikan izin lokasi diaktifkan.', background: 'var(--bg-card)', color: 'var(--text-main)' }); setTeamGettingLocation(false); },
                                                { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
                                            );
                                        }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.5rem 0.75rem', borderRadius: 9, fontSize: '0.78rem', fontWeight: 700, cursor: teamGettingLocation ? 'not-allowed' : 'pointer', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1.5px solid rgba(99,102,241,0.3)', opacity: teamGettingLocation ? 0.6 : 1 }}>
                                            📍 {teamGettingLocation ? 'Mengambil Lokasi...' : 'Gunakan Lokasi Saat Ini'}
                                        </button>
                                        <button type="button" onClick={() => {
                                            setTeamMapPickerCoord(formTeam.latitude && formTeam.longitude ? { lat: parseFloat(formTeam.latitude), lng: parseFloat(formTeam.longitude) } : null);
                                            setTeamMapPickerOpen(true);
                                        }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.5rem 0.75rem', borderRadius: 9, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1.5px solid rgba(16,185,129,0.3)' }}>
                                            🗺 Pilih di Peta
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 3 }}>Latitude</label>
                                            <input type="number" className="modal-input" placeholder="-6.1751" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} value={formTeam.latitude} onChange={e => setFormTeam(f => ({ ...f, latitude: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 3 }}>Longitude</label>
                                            <input type="number" className="modal-input" placeholder="106.8272" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} value={formTeam.longitude} onChange={e => setFormTeam(f => ({ ...f, longitude: e.target.value }))} />
                                        </div>
                                    </div>
                                    {formTeam.latitude && formTeam.longitude ? (
                                        <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>📍 {parseFloat(formTeam.latitude).toFixed(5)}, {parseFloat(formTeam.longitude).toFixed(5)}</div>
                                    ) : (
                                        <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Opsional — digunakan sebagai titik pengiriman di peta</div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.1rem 0 1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.07em', whiteSpace: 'nowrap', background: 'var(--bg-card)', paddingRight: '0.5rem' }}>Kredensial Login</span>
                                </div>

                                {/* Email + Password */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.75rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.4rem' }}>Email Login</label>
                                        <input type="email" className="modal-input" style={{ fontFamily: 'monospace' }} placeholder="email@contoh.com" value={formTeam.email} onChange={e => setFormTeam({ ...formTeam, email: e.target.value })} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '0.4rem' }}>Password {editingTeamId && <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(kosongkan jika tak diubah)</span>}</label>
                                        <input type="text" className="modal-input" style={{ fontFamily: 'monospace' }} placeholder="Min. 6 karakter" value={formTeam.password} onChange={e => setFormTeam({ ...formTeam, password: e.target.value })} />
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Email & password ini digunakan personel untuk login ke aplikasi smartphone mereka.</div>
                            </div>

                            <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.7rem' }}>
                                <button onClick={() => setIsAddTeamModalOpen(false)} className="btn btn-secondary">Batalkan</button>
                                <button onClick={submitTeamMember} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.3rem', borderRadius: 10, background: 'linear-gradient(135deg,#4338ca,#818cf8)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                                    <Users size={14} /> {editingTeamId ? 'Simpan Perubahan' : 'Lakukan Registrasi'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MAP PICKER MODAL untuk form tim/pelanggan */}
            {teamMapPickerOpen && (() => {
                const MapClickHandler = ({ onPick }) => { useMapEvents({ click: e => onPick(e.latlng) }); return null; };
                const initCenter = teamMapPickerCoord ? [teamMapPickerCoord.lat, teamMapPickerCoord.lng] : [-6.1751, 106.8272];
                return (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.25rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
                            <button onClick={() => setTeamMapPickerOpen(false)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-main)', fontSize: '1.1rem' }}>&times;</button>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-main)' }}>Pilih Titik Lokasi di Peta</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    {teamMapPickerCoord ? `📍 ${teamMapPickerCoord.lat.toFixed(5)}, ${teamMapPickerCoord.lng.toFixed(5)}` : 'Klik pada peta untuk menentukan lokasi'}
                                </div>
                            </div>
                            <button onClick={() => {
                                if (!teamMapPickerCoord) return MySwal.fire({ icon: 'warning', title: 'Belum Ada Titik', text: 'Klik pada peta terlebih dahulu.', background: 'var(--bg-card)', color: 'var(--text-main)' });
                                setFormTeam(f => ({ ...f, latitude: teamMapPickerCoord.lat.toFixed(7), longitude: teamMapPickerCoord.lng.toFixed(7) }));
                                setTeamMapPickerOpen(false);
                            }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 1.1rem', borderRadius: 9, background: 'linear-gradient(135deg,#4338ca,#818cf8)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                                ✓ Konfirmasi Lokasi
                            </button>
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <MapContainer center={initCenter} zoom={14} style={{ height: '100%', width: '100%' }} key={JSON.stringify(initCenter)}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                                <MapClickHandler onPick={ll => setTeamMapPickerCoord({ lat: ll.lat, lng: ll.lng })} />
                                {teamMapPickerCoord && (
                                    <Marker position={[teamMapPickerCoord.lat, teamMapPickerCoord.lng]}>
                                        <Popup>Titik lokasi dipilih</Popup>
                                    </Marker>
                                )}
                            </MapContainer>
                        </div>
                    </div>
                );
            })()}

            {/* DYNAMIC REACT MODAL: PREFERENSI HARGA PRODUK INDIVIDUAL */}
            {
                isPricingModalOpen && pricingTargetUser && (() => {
                    const ptRole = pricingTargetUser.role;
                    const ptColor = ptRole === 'SUBSTOKIS' ? '#818cf8' : ptRole === 'MEMBER' ? '#10b981' : ptRole === 'KONSUMEN' ? '#f59e0b' : '#60a5fa';
                    const ptBg = ptRole === 'SUBSTOKIS' ? 'rgba(129,140,248,0.12)' : ptRole === 'MEMBER' ? 'rgba(16,185,129,0.12)' : ptRole === 'KONSUMEN' ? 'rgba(245,158,11,0.12)' : 'rgba(96,165,250,0.12)';
                    return (
                        <div className="modal-overlay animate-fade-up">
                            <div className="modal-content animate-fade-up" style={{ maxWidth: '820px', padding: 0, overflow: 'hidden' }}>

                                {/* Gradient Header */}
                                <div style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 55%,#4338ca 100%)', padding: '1.4rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                        <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(255,255,255,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <DollarSign size={20} color="#fff" />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>Mapping Harga Katalog</div>
                                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', marginTop: 3, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                Untuk pelanggan:
                                                <span style={{ background: ptBg, color: ptColor, border: `1px solid ${ptColor}55`, borderRadius: 6, padding: '1px 8px', fontWeight: 700, fontSize: '0.72rem' }}>
                                                    {pricingTargetUser.name}
                                                </span>
                                                <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', borderRadius: 6, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 600 }}>
                                                    {ptRole}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsPricingModalOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1.1rem', lineHeight: 1 }}>&times;</button>
                                </div>

                                {/* Column header bar */}
                                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '0.6rem 1.4rem', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)', gap: '1rem' }}>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Produk / SKU</span>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Pilih Tier — klik untuk memilih, klik lagi untuk reset ke Harga Umum</span>
                                </div>

                                {/* Product rows */}
                                <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                                    {products.length === 0 ? (
                                        <div style={{ padding: '3rem 1.4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                            Belum ada produk terdaftar untuk diatur.
                                        </div>
                                    ) : products.map((product, idx) => {
                                        const override = pricingOverrides.find(p => p.productId === product.id);
                                        const currentValue = override ? override.level_name : '';
                                        return (
                                            <div key={product.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '1rem 1.4rem', borderBottom: idx < products.length - 1 ? '1px solid var(--border-color)' : 'none', alignItems: 'start', gap: '1rem', transition: 'background .15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                {/* Product info */}
                                                <div style={{ paddingTop: 2 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>{product.name}</div>
                                                    <div style={{ display: 'inline-block', marginTop: 4, fontSize: '0.68rem', fontFamily: 'monospace', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '1px 7px', color: 'var(--text-muted)' }}>{product.code}</div>
                                                </div>
                                                <div>
                                                    {/* Clickable tier chips */}
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {product.priceTiers?.map(pt => {
                                                            const selected = currentValue === pt.level_name;
                                                            return (
                                                                <div key={pt.id}
                                                                    onClick={() => handlePricingChange(product.id, selected ? '' : pt.level_name)}
                                                                    style={{
                                                                        borderRadius: 9, padding: '0.35rem 0.7rem', cursor: 'pointer', transition: 'all .15s', position: 'relative',
                                                                        background: selected ? 'rgba(129,140,248,0.18)' : 'rgba(129,140,248,0.05)',
                                                                        border: selected ? '1.5px solid #818cf8' : '1.5px solid rgba(129,140,248,0.2)',
                                                                        boxShadow: selected ? '0 0 0 3px rgba(129,140,248,0.12)' : 'none',
                                                                        transform: selected ? 'translateY(-1px)' : 'none',
                                                                    }}>
                                                                    {selected && (
                                                                        <div style={{ position: 'absolute', top: -7, right: -7, width: 16, height: 16, borderRadius: '50%', background: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#fff', fontWeight: 900 }}>✓</div>
                                                                    )}
                                                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: selected ? '#818cf8' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{pt.level_name}</div>
                                                                    <div style={{ fontSize: '0.78rem', color: selected ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: selected ? 700 : 500, marginTop: 2 }}>Rp {Number(pt.price).toLocaleString('id-ID')}</div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Packaging tier selector */}
                                                    {product.packagings?.length > 0 && (
                                                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', borderTop: '1px dashed rgba(16,185,129,0.2)', paddingTop: '0.65rem' }}>
                                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '.07em' }}>📦 Tier Kemasan</span>
                                                            {product.packagings.map(pkg => {
                                                                const currentPkgTier = packagingOverrides.find(p => p.packagingId === pkg.id)?.level_name || '';
                                                                return (
                                                                    <div key={pkg.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap', minWidth: '6rem' }}>
                                                                            {pkg.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pkg.unitQty} unit)</span>
                                                                        </span>
                                                                        {pkg.priceTiers?.length > 0 ? pkg.priceTiers.map(pt => {
                                                                            const sel = currentPkgTier === pt.level_name;
                                                                            return (
                                                                                <div key={pt.id} onClick={() => handlePackagingTierChange(pkg.id, sel ? '' : pt.level_name)} style={{ position: 'relative', borderRadius: 8, padding: '0.25rem 0.6rem', cursor: 'pointer', transition: 'all .15s', background: sel ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.04)', border: sel ? '1.5px solid #10b981' : '1.5px solid rgba(16,185,129,0.2)', boxShadow: sel ? '0 0 0 3px rgba(16,185,129,0.12)' : 'none' }}>
                                                                                    {sel && <div style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#fff', fontWeight: 900 }}>✓</div>}
                                                                                    <div style={{ fontSize: '0.63rem', fontWeight: 700, color: sel ? '#10b981' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{pt.level_name}</div>
                                                                                    <div style={{ fontSize: '0.75rem', color: sel ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: sel ? 700 : 500, marginTop: 1 }}>Rp {Number(pt.price).toLocaleString('id-ID')}</div>
                                                                                </div>
                                                                            );
                                                                        }) : <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada tier harga</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Footer */}
                                <div style={{ padding: '1rem 1.4rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.7rem' }}>
                                    <button onClick={() => setIsPricingModalOpen(false)} className="btn btn-secondary">Tutup</button>
                                    <button onClick={savePricingOverrides} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.3rem', borderRadius: 10, background: 'linear-gradient(135deg,#4338ca,#818cf8)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                                        <CheckCircle2 size={15} /> Simpan Mapping Harga
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }
            {/* EDIT PROFIL MODAL */}
            {isEditProfileModalOpen && (
                <div className="modal-overlay animate-fade-up" onClick={() => setIsEditProfileModalOpen(false)}>
                    <div className="modal-content animate-fade-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(129,140,248,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Edit3 size={16} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Edit Profil</h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Perbarui informasi akun Anda</p>
                                </div>
                            </div>
                            <button onClick={() => setIsEditProfileModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.25rem' }}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="text-xs text-muted font-bold tracking-wider uppercase mb-1 block">Nama Lengkap</label>
                                    <input className="modal-input" placeholder="Nama Anda" value={formEditProfile.name} onChange={e => setFormEditProfile(prev => ({ ...prev, name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted font-bold tracking-wider uppercase mb-1 block">Email</label>
                                    <input className="modal-input" type="email" placeholder="email@example.com" value={formEditProfile.email} onChange={e => setFormEditProfile(prev => ({ ...prev, email: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted font-bold tracking-wider uppercase mb-1 block">Nama Toko / Gudang</label>
                                    <input className="modal-input" placeholder="Toko Makmur Sentosa" value={formEditProfile.store_name} onChange={e => setFormEditProfile(prev => ({ ...prev, store_name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted font-bold tracking-wider uppercase mb-1 block">Kontak / WhatsApp</label>
                                    <input className="modal-input" placeholder="08xxxxxxxxxx" value={formEditProfile.contact} onChange={e => setFormEditProfile(prev => ({ ...prev, contact: e.target.value }))} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="text-xs text-muted font-bold tracking-wider uppercase mb-1 block">Alamat Lengkap</label>
                                    <textarea className="modal-input" rows="3" placeholder="Jl. Contoh No. 1, Kota..." value={formEditProfile.address} onChange={e => setFormEditProfile(prev => ({ ...prev, address: e.target.value }))} style={{ resize: 'none' }} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                        <label className="text-xs text-muted font-bold tracking-wider uppercase block">Titik Lokasi (GPS)</label>
                                        <button type="button" disabled={gettingLocation} style={{ fontSize: '0.72rem', background: gettingLocation ? 'rgba(129,140,248,0.08)' : 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 6, padding: '3px 10px', cursor: gettingLocation ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: gettingLocation ? 0.6 : 1 }}
                                            onClick={() => {
                                                if (!navigator.geolocation) {
                                                    MySwal.fire({ icon: 'error', title: 'Tidak Didukung', text: 'Browser Anda tidak mendukung fitur GPS.', background: 'var(--bg-card)', color: 'var(--text-main)', timer: 2500, showConfirmButton: false });
                                                    return;
                                                }
                                                setGettingLocation(true);
                                                navigator.geolocation.getCurrentPosition(
                                                    pos => {
                                                        setFormEditProfile(prev => ({
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
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label className="text-xs text-muted mb-1 block">Latitude</label>
                                            <input className="modal-input" type="number" step="any" placeholder="-6.175000" value={formEditProfile.latitude} onChange={e => setFormEditProfile(prev => ({ ...prev, latitude: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted mb-1 block">Longitude</label>
                                            <input className="modal-input" type="number" step="any" placeholder="106.827000" value={formEditProfile.longitude} onChange={e => setFormEditProfile(prev => ({ ...prev, longitude: e.target.value }))} />
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>Titik ini digunakan sebagai tujuan pengiriman di peta untuk driver.</p>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setIsEditProfileModalOpen(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleSaveProfile}>Simpan Perubahan</button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default DashboardStokis;
