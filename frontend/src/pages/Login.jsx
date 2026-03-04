import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, TrendingUp, Eye, EyeOff, ShieldCheck, Package, BarChart3, Users } from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import axios from 'axios';

const MySwal = withReactContent(Swal);

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        if (!email || !password) {
            setLoading(false);
            return MySwal.fire({
                icon: 'error',
                title: 'Login Gagal',
                text: 'Email dan password dibutuhkan!',
                background: '#18181b',
                color: '#f4f4f5',
                confirmButtonColor: '#ef4444'
            });
        }

        try {
            const response = await axios.post('http://localhost:5000/api/auth/login', {
                email,
                password
            });

            const { token, role, name, id: userId, parent_id: parentId, price_level } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('role', role);
            localStorage.setItem('userId', userId);
            localStorage.setItem('priceLevel', price_level || 'Harga Umum');
            if (parentId) localStorage.setItem('parentId', parentId);

            MySwal.fire({
                icon: 'success',
                title: `Halo, ${name}!`,
                text: `Sistem berhasil mengautentikasi Anda sebagai ${role}.`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true,
                background: '#18181b',
                color: '#f4f4f5',
                iconColor: '#a855f7'
            }).then(() => {
                if (role === 'SUBSTOKIS') {
                    navigate('/dashboard/substokis');
                } else if (role === 'STOKIS') {
                    navigate('/dashboard/stokis');
                } else {
                    navigate('/dashboard/stokis');
                }
            });

        } catch (err) {
            MySwal.fire({
                icon: 'error',
                title: 'Login Gagal',
                text: err.response?.data?.message || 'Terjadi kesalahan pada server atau kredensial salah.',
                background: '#18181b',
                color: '#f4f4f5',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            setLoading(false);
        }
    };

    const features = [
        { icon: <Package size={18} />, title: 'Manajemen Stok', desc: 'Pantau inventaris secara real-time' },
        { icon: <BarChart3 size={18} />, title: 'Laporan & Analitik', desc: 'Insight distribusi & penjualan' },
        { icon: <Users size={18} />, title: 'Multi-Level Akses', desc: 'Stokis, Substokis & Driver' },
    ];

    return (
        <>
            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                }
                @keyframes gridMove {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(60px); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .login-root {
                    min-height: 100vh;
                    display: flex;
                    overflow: hidden;
                    background: #09090b;
                }
                /* ---- LEFT PANEL ---- */
                .login-left {
                    flex: 1;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    padding: 3rem;
                    overflow: hidden;
                    background: linear-gradient(135deg, #0f0f23 0%, #16093a 50%, #0c1a2e 100%);
                }
                .login-left-grid {
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(rgba(129,140,248,0.07) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(129,140,248,0.07) 1px, transparent 1px);
                    background-size: 60px 60px;
                    animation: gridMove 8s linear infinite;
                }
                .login-left-orb1 {
                    position: absolute;
                    top: -80px; left: -80px;
                    width: 380px; height: 380px;
                    background: radial-gradient(circle, rgba(129,140,248,0.25) 0%, transparent 70%);
                    border-radius: 50%;
                    pointer-events: none;
                }
                .login-left-orb2 {
                    position: absolute;
                    bottom: -60px; right: -60px;
                    width: 300px; height: 300px;
                    background: radial-gradient(circle, rgba(232,121,249,0.2) 0%, transparent 70%);
                    border-radius: 50%;
                    pointer-events: none;
                }
                .left-logo {
                    position: relative;
                    z-index: 10;
                }
                .left-logo-icon {
                    width: 48px; height: 48px;
                    background: linear-gradient(135deg, #818cf8, #e879f9);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 0.75rem;
                    box-shadow: 0 0 30px rgba(129,140,248,0.4);
                }
                .left-hero {
                    position: relative;
                    z-index: 10;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .left-hero h2 {
                    font-size: 2.4rem;
                    font-weight: 800;
                    line-height: 1.2;
                    color: #f4f4f5;
                    margin-bottom: 1rem;
                }
                .left-hero p {
                    color: rgba(244,244,245,0.5);
                    font-size: 0.95rem;
                    line-height: 1.6;
                    max-width: 340px;
                }
                .left-features {
                    position: relative;
                    z-index: 10;
                    display: flex;
                    flex-direction: column;
                    gap: 0.85rem;
                }
                .feature-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.85rem;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 12px;
                    padding: 0.85rem 1rem;
                    backdrop-filter: blur(10px);
                    transition: background 0.2s;
                }
                .feature-item:hover {
                    background: rgba(255,255,255,0.07);
                }
                .feature-icon {
                    width: 36px; height: 36px;
                    background: linear-gradient(135deg, rgba(129,140,248,0.2), rgba(232,121,249,0.2));
                    border-radius: 9px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #a5b4fc;
                    flex-shrink: 0;
                }
                .feature-text-title {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #f4f4f5;
                    margin-bottom: 0.1rem;
                }
                .feature-text-desc {
                    font-size: 0.75rem;
                    color: rgba(244,244,245,0.45);
                }
                /* ---- RIGHT PANEL ---- */
                .login-right {
                    width: 480px;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem 2.5rem;
                    background: #09090b;
                    position: relative;
                    border-left: 1px solid rgba(255,255,255,0.06);
                }
                .login-right-orb {
                    position: absolute;
                    top: 0; right: 0;
                    width: 260px; height: 260px;
                    background: radial-gradient(circle, rgba(129,140,248,0.1) 0%, transparent 70%);
                    pointer-events: none;
                }
                .login-form-wrap {
                    width: 100%;
                    max-width: 360px;
                    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
                }
                .login-title {
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: #f4f4f5;
                    margin-bottom: 0.4rem;
                }
                .login-subtitle {
                    font-size: 0.875rem;
                    color: rgba(244,244,245,0.45);
                    margin-bottom: 2.25rem;
                }
                /* Input Label */
                .login-label {
                    display: block;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: rgba(244,244,245,0.6);
                    margin-bottom: 0.4rem;
                    letter-spacing: 0.01em;
                }
                .login-input-wrap {
                    position: relative;
                    margin-bottom: 1.1rem;
                }
                .login-input-icon {
                    position: absolute;
                    top: 50%; left: 1rem;
                    transform: translateY(-50%);
                    color: rgba(244,244,245,0.3);
                    pointer-events: none;
                    transition: color 0.2s;
                }
                .login-input {
                    width: 100%;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #f4f4f5;
                    padding: 0.85rem 1rem 0.85rem 2.85rem;
                    border-radius: 10px;
                    font-family: inherit;
                    font-size: 0.9rem;
                    outline: none;
                    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
                }
                .login-input::placeholder { color: rgba(244,244,245,0.25); }
                .login-input:focus {
                    border-color: #818cf8;
                    background: rgba(129,140,248,0.05);
                    box-shadow: 0 0 0 3px rgba(129,140,248,0.15);
                }
                .login-input:focus ~ .login-input-icon { color: #818cf8; }
                .login-input-wrap:focus-within .login-input-icon { color: #818cf8; }
                .pw-toggle {
                    position: absolute;
                    top: 50%; right: 1rem;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: rgba(244,244,245,0.3);
                    cursor: pointer;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    transition: color 0.2s;
                }
                .pw-toggle:hover { color: rgba(244,244,245,0.7); }
                /* Submit btn */
                .login-btn {
                    width: 100%;
                    height: 50px;
                    border: none;
                    border-radius: 10px;
                    font-family: inherit;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                    position: relative;
                    overflow: hidden;
                    transition: opacity 0.2s, transform 0.15s;
                    background: linear-gradient(135deg, #818cf8 0%, #a855f7 100%);
                    color: #fff;
                    box-shadow: 0 4px 24px rgba(129,140,248,0.35);
                }
                .login-btn:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 28px rgba(129,140,248,0.45);
                }
                .login-btn:active:not(:disabled) { transform: translateY(0); }
                .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .login-btn-shimmer {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
                    background-size: 200% 100%;
                    animation: shimmer 2s infinite;
                }
                .login-divider {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin: 1.75rem 0 1.25rem;
                }
                .login-divider-line {
                    flex: 1;
                    height: 1px;
                    background: rgba(255,255,255,0.07);
                }
                .login-divider-text {
                    font-size: 0.75rem;
                    color: rgba(244,244,245,0.3);
                    white-space: nowrap;
                }
                .login-secure-badge {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    font-size: 0.75rem;
                    color: rgba(244,244,245,0.3);
                }
                .login-secure-badge svg { color: rgba(129,140,248,0.6); }
                /* Responsive: hide left panel on small screens */
                @media (max-width: 768px) {
                    .login-left { display: none; }
                    .login-right { width: 100%; border-left: none; }
                }
            `}</style>

            <div className="login-root">
                {/* LEFT – Branding Panel */}
                <div className="login-left">
                    <div className="login-left-grid" />
                    <div className="login-left-orb1" />
                    <div className="login-left-orb2" />

                    {/* Logo */}
                    <div className="left-logo">
                        <div className="left-logo-icon">
                            <TrendingUp size={22} color="#fff" />
                        </div>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f4f4f5' }}>
                            Stokis<span style={{ background: 'linear-gradient(135deg,#818cf8,#e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hub</span>
                        </span>
                    </div>

                    {/* Hero Text */}
                    <div className="left-hero">
                        <h2>
                            Kelola distribusi<br />
                            <span style={{ background: 'linear-gradient(135deg,#818cf8,#e879f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>lebih cerdas</span>
                        </h2>
                        <p>Platform manajemen rantai pasok terpadu untuk stokis, substokis, dan driver dalam satu ekosistem digital.</p>
                    </div>

                    {/* Feature Cards */}
                    <div className="left-features">
                        {features.map((f, i) => (
                            <div className="feature-item" key={i}>
                                <div className="feature-icon">{f.icon}</div>
                                <div>
                                    <div className="feature-text-title">{f.title}</div>
                                    <div className="feature-text-desc">{f.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT – Form Panel */}
                <div className="login-right">
                    <div className="login-right-orb" />
                    <div className="login-form-wrap">
                        <h1 className="login-title">Selamat datang</h1>
                        <p className="login-subtitle">Masuk ke akun Anda untuk melanjutkan</p>

                        <form onSubmit={handleLogin}>
                            {/* Email */}
                            <div>
                                <label className="login-label">Alamat Email</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon"><Mail size={16} /></span>
                                    <input
                                        type="email"
                                        className="login-input"
                                        placeholder="stokis@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="login-label">Password</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon"><Lock size={16} /></span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="login-input"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="current-password"
                                        style={{ paddingRight: '3rem' }}
                                    />
                                    <button
                                        type="button"
                                        className="pw-toggle"
                                        onClick={() => setShowPassword(v => !v)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button type="submit" className="login-btn" disabled={loading}>
                                {!loading && <div className="login-btn-shimmer" />}
                                {loading ? (
                                    <>
                                        <div style={{ width: 17, height: 17, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                        Mengautentikasi...
                                    </>
                                ) : (
                                    <>
                                        Masuk Sistem <ArrowRight size={17} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="login-divider">
                            <div className="login-divider-line" />
                            <span className="login-divider-text">v2.0 NextGen PWA</span>
                            <div className="login-divider-line" />
                        </div>

                        <div className="login-secure-badge">
                            <ShieldCheck size={14} />
                            Koneksi terenkripsi & aman
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Login;
