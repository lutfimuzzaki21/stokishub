const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('Memulai proses seeding database...');

    // Enkripsi password default (password123)
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Buat Super Admin
    const superadmin = await prisma.user.upsert({
        where: { email: 'superadmin@stokishub.com' },
        update: {},
        create: {
            email: 'superadmin@stokishub.com',
            name: 'Sistem Administrator',
            password: passwordHash,
            role: 'SUPERADMIN',
        },
    });
    console.log('✅ Super Admin dibuat');

    // 2. Buat Stokis (Pusat Hierarki Fase 1)
    const stokis = await prisma.user.upsert({
        where: { email: 'stokis@stokishub.com' },
        update: {},
        create: {
            email: 'stokis@stokishub.com',
            name: 'Ahmad Stokis',
            store_name: 'Toko Makmur Sentosa (Pusat)',
            contact: '081234567890',
            address: 'Jl. Merdeka No 1, Jakarta',
            password: passwordHash,
            role: 'STOKIS',
        },
    });
    console.log('✅ Stokis dibuat');

    // 3. Buat Sub-Stokis (Berafiliasi / Kontrak dengan Stokis Utama)
    const substokis = await prisma.user.upsert({
        where: { email: 'substokis1@stokishub.com' },
        update: {},
        create: {
            email: 'substokis1@stokishub.com',
            name: 'Budi Cabang',
            store_name: 'Toko Harapan Makmur (Cabang 1)',
            parent_id: stokis.id, // Menunjuk ke Stokis pusatnya
            password: passwordHash,
            role: 'SUBSTOKIS',
        },
    });
    console.log('✅ Sub-Stokis dibuat');

    // 4. Buat Tim Internal: Sales dan Driver
    await prisma.user.upsert({
        where: { email: 'sales@stokishub.com' },
        update: {},
        create: {
            email: 'sales@stokishub.com',
            name: 'Doni Marketer',
            parent_id: stokis.id,
            password: passwordHash,
            role: 'SALES',
        },
    });

    await prisma.user.upsert({
        where: { email: 'driver@stokishub.com' },
        update: {},
        create: {
            email: 'driver@stokishub.com',
            name: 'Acep Kurir',
            parent_id: stokis.id,
            password: passwordHash,
            role: 'DRIVER',
        },
    });
    console.log('✅ Tim Internal (Sales & Driver) dibuat');

    // 5. Buat Konsumen (Umum & Member)
    await prisma.user.upsert({
        where: { email: 'umum@stokishub.com' },
        update: {},
        create: {
            email: 'umum@stokishub.com',
            name: 'Siti Konsumen Biasa',
            password: passwordHash,
            role: 'KONSUMEN',
        },
    });

    await prisma.user.upsert({
        where: { email: 'member@stokishub.com' },
        update: {},
        create: {
            email: 'member@stokishub.com',
            name: 'Bambang Member VIP',
            parent_id: stokis.id, // Berkontrak rutin dengan Stokis ini
            password: passwordHash,
            role: 'MEMBER',
        },
    });
    console.log('✅ Konsumen dan Member dibuat');

    // 6. Buat Produk untuk Stokis
    const p1 = await prisma.product.create({
        data: {
            code: 'BRS-001',
            brand: 'Beras Raja',
            name: 'Beras Premium 5kg',
            stock: 1500,
            userId: stokis.id, // Kepemilikan stokis
            priceTiers: {
                create: [
                    { level_name: 'Harga Substokis', price: 65000, commission: 1500, userId: stokis.id },
                    { level_name: 'Harga Umum', price: 72000, commission: 2000, userId: stokis.id },
                    { level_name: 'Harga Member', price: 68000, commission: 1800, userId: stokis.id },
                ]
            }
        }
    });

    const p2 = await prisma.product.create({
        data: {
            code: 'MYK-002',
            brand: 'Minyak Bunda',
            name: 'Minyak Goreng 2L',
            stock: 800,
            userId: stokis.id,
            priceTiers: {
                create: [
                    { level_name: 'Harga Substokis', price: 31000, commission: 1000, userId: stokis.id },
                    { level_name: 'Harga Umum', price: 35000, commission: 1500, userId: stokis.id },
                    { level_name: 'Harga Member', price: 33000, commission: 1200, userId: stokis.id },
                ]
            }
        }
    });

    console.log('✅ Produk dan Sistem Tiering Multi-Harga dengan Komisi dibuat');

    console.log('\n================================');
    console.log('🎉 SEEDING SUCESSFULLY COMPLETE 🎉');
    console.log('================================');
    console.log('Anda bisa menggunakan akun berikut:');
    console.log('Email: stokis@stokishub.com');
    console.log('Pass : password123');
}

main()
    .catch((e) => {
        console.error('Error saat seeding: ', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
