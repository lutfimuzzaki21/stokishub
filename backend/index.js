const express = require('express');
const cors = require('cors');
require('dotenv').config();

const http = require('http'); // 1. Tambahkan http
const { Server } = require('socket.io'); // 2. Tambahkan Socket.IO

const app = express();
const port = process.env.PORT || 5000;

const server = http.createServer(app); // 3. Wrap express app dengan http.createServer
const io = new Server(server, {
  cors: {
    origin: '*', // Izinkan semua origin untuk dev
  }
});

app.use(cors());
app.use(express.json());

// In-process memory store for driver live locations (so we don't query DB every second)
const activeDrivers = new Map();

io.on('connection', (socket) => {
  console.log('Client connected to WebSocket:', socket.id);

  // Menerima update lokasi dari Driver app (Simulated for now)
  socket.on('updateLocation', (data) => {
    // data: { driverId: 1, lat: -6.200000, lng: 106.816666 }
    activeDrivers.set(data.driverId, data);

    // Broadcast lokasi terbaru ke semua dashboard Stokis yang listen
    io.emit('driverLocationChanged', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Main Route Check
app.get('/', (req, res) => {
  res.send('StokisHub API is running...');
});

// Import basic auth (mocked for now)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  // This is just a mocking logic for initial UI since DB is likely empty. 
  // Normally we query DB. But for phase 1 demo, we bypass or create default users.

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid Credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, role: user.role, name: user.name, id: user.id, parent_id: user.parent_id, sales_id: user.sales_id ?? null, price_level: user.price_level, email: user.email, contact: user.contact, address: user.address, store_name: user.store_name, latitude: user.latitude, longitude: user.longitude });
  } catch (err) {
    console.error(err);
    // Give a dummy response for pure frontend viewing if DB not ready
    res.status(500).json({ message: 'Database might not be initialized yet. Please migrate.', error: err.message });
  }
});

app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving user profile' });
  }
});

// Update User Profile (termasuk koordinat lokasi)
app.put('/api/user/:id', async (req, res) => {
  try {
    const { name, email, store_name, contact, address, latitude, longitude, password } = req.body;
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (email !== undefined) dataToUpdate.email = email;
    if (store_name !== undefined) dataToUpdate.store_name = store_name;
    if (contact !== undefined) dataToUpdate.contact = contact;
    if (address !== undefined) dataToUpdate.address = address;
    if (latitude !== undefined) dataToUpdate.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) dataToUpdate.longitude = longitude ? parseFloat(longitude) : null;
    if (password) dataToUpdate.password = await bcrypt.hash(password, 10);

    const updated = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: dataToUpdate
    });
    const { password: _, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') return res.status(400).json({ message: 'Email sudah terdaftar.' });
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
});

// ==============================
// PRODUCT & MULTI-PRICE API
// ==============================

// GET All Products for Stokis
app.get('/api/products', async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId) : undefined;
    const buyerId = req.query.buyerId ? parseInt(req.query.buyerId) : undefined;
    const filter = userId ? { userId } : {};

    const products = await prisma.product.findMany({
      where: filter,
      include: {
        priceTiers: true,
        packagings: { include: { priceTiers: true, userPackagingTiers: buyerId ? { where: { userId: buyerId } } : undefined }, orderBy: { createdAt: 'asc' } },
        userPriceTiers: buyerId ? {
          where: { userId: buyerId }
        } : undefined
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving products', error: err.message });
  }
});

// POST Add New Product for Stokis
app.post('/api/products', async (req, res) => {
  let { code, brand, name, stock, userId, priceTiers } = req.body;

  // Auto-generate SKU if not provided
  if (!code) {
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const initial = name ? String(name).replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() : 'PRD';
    code = `${initial}-${randomNum}`;
  }

  if (!name || !userId || !priceTiers || priceTiers.length === 0) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const newProduct = await prisma.product.create({
      data: {
        code,
        brand: brand || '',
        name,
        stock: parseInt(stock) || 0,
        userId: parseInt(userId),
        priceTiers: {
          create: priceTiers.map(tier => ({
            level_name: tier.level_name,
            price: parseFloat(tier.price),
            commission: parseFloat(tier.commission),
            userId: parseInt(userId)
          }))
        }
      },
      include: {
        priceTiers: true
      }
    });

    res.status(201).json(newProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating product', error: err.message });
  }
});

// PUT Update Product and its Multi-Price Tiers
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, stock, userId, priceTiers } = req.body;

  if (!name || !userId || !priceTiers || priceTiers.length === 0) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const updatedProduct = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name,
        stock: parseInt(stock) || 0,
        priceTiers: {
          deleteMany: {}, // Delete old tiers
          create: priceTiers.map(tier => ({
            level_name: tier.level_name,
            price: parseFloat(tier.price) || 0,
            commission: parseFloat(tier.commission) || 0,
            userId: parseInt(userId)
          }))
        }
      },
      include: {
        priceTiers: true
      }
    });

    res.json(updatedProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating product', error: err.message });
  }
});

// DELETE Product
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Delete associated PriceTiers first due to Foreign Key constraint
    await prisma.priceTier.deleteMany({
      where: { productId: parseInt(id) }
    });

    // Delete the product itself
    await prisma.product.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting product', error: err.message });
  }
});

// ==============================
// PACKAGING API
// ==============================

// GET packagings for a product
app.get('/api/products/:productId/packagings', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const packagings = await prisma.productPackaging.findMany({
      where: { productId },
      include: { priceTiers: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(packagings);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching packagings', error: err.message });
  }
});

// POST save all packagings for a product (bulk upsert — replace all)
app.post('/api/products/:productId/packagings/bulk', async (req, res) => {
  const productId = parseInt(req.params.productId);
  const { packagings } = req.body; // [{ id?, name, unitQty, isDefault, priceTiers: [{ level_name, price, commission }] }]
  if (!Array.isArray(packagings)) return res.status(400).json({ message: 'packagings must be an array' });
  try {
    // Delete all existing packagings for this product (cascades to PackagingPriceTier)
    await prisma.productPackaging.deleteMany({ where: { productId } });
    // Re-create
    for (const pkg of packagings) {
      await prisma.productPackaging.create({
        data: {
          productId,
          name: pkg.name,
          unitQty: parseInt(pkg.unitQty),
          isDefault: !!pkg.isDefault,
          priceTiers: {
            create: (pkg.priceTiers || []).map(t => ({
              level_name: t.level_name,
              price: parseFloat(t.price) || 0,
              commission: parseFloat(t.commission) || 0,
            })),
          },
        },
      });
    }
    const result = await prisma.productPackaging.findMany({
      where: { productId },
      include: { priceTiers: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error saving packagings', error: err.message });
  }
});

// DELETE a single packaging
app.delete('/api/packagings/:id', async (req, res) => {
  try {
    await prisma.productPackaging.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Packaging deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting packaging', error: err.message });
  }
});

// ==============================
// PURCHASING API
// ==============================

// GET All Purchases for Stokis
app.get('/api/purchases', async (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId) : undefined;
    const filter = userId ? { userId } : {};

    const purchases = await prisma.purchase.findMany({
      where: filter,
      include: {
        product: true
      },
      orderBy: { date: 'desc' }
    });
    res.json(purchases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving purchases', error: err.message });
  }
});

// POST Add New Purchase (Restock)
app.post('/api/purchases', async (req, res) => {
  const { productId, price_buy, quantity, userId } = req.body;

  if (!productId || !price_buy || !quantity || !userId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Use transaction to ensure both operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create purchase history
      const newPurchase = await tx.purchase.create({
        data: {
          productId: parseInt(productId),
          price_buy: parseFloat(price_buy),
          quantity: parseInt(quantity),
          userId: parseInt(userId)
        },
        include: {
          product: true
        }
      });

      // 2. Increase product stock
      await tx.product.update({
        where: { id: parseInt(productId) },
        data: {
          stock: { increment: parseInt(quantity) }
        }
      });

      return newPurchase;
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error processing purchase', error: err.message });
  }
});

// ==============================
// TEAM MANAGEMENT API
// ==============================

// GET All Team Members for a Stokis
app.get('/api/team', async (req, res) => {
  try {
    const parent_id = req.query.parentId ? parseInt(req.query.parentId) : undefined;
    if (!parent_id) return res.status(400).json({ message: 'Missing parentId parameter' });
    const team = await prisma.user.findMany({
      where: {
        parent_id: parent_id,
        role: {
          in: ['SUBSTOKIS', 'SALES', 'DRIVER', 'KONSUMEN', 'MEMBER']
        }
      },
      include: {
        userPriceTiers: true,
        userPackagingTiers: true
      },
      orderBy: { createdAt: 'desc' }
    });
    // Remove passwords before sending to frontend
    const safeTeam = team.map(({ password, ...rest }) => rest);
    res.json(safeTeam);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving team', error: err.message });
  }
});

// GET Team Member Individual Product Tiers
app.get('/api/team/:id/pricing', async (req, res) => {
  const { id } = req.params;
  try {
    const [unitOverrides, packagingOverrides] = await Promise.all([
      prisma.userPriceTier.findMany({ where: { userId: parseInt(id) } }),
      prisma.userPackagingTier.findMany({ where: { userId: parseInt(id) } }),
    ]);
    res.json({ unitOverrides, packagingOverrides });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving individual pricing', error: err.message });
  }
});

// POST Set Team Member Individual Product Tiers
app.post('/api/team/:id/pricing', async (req, res) => {
  const { id } = req.params;
  const { pricingOverrides, packagingOverrides } = req.body;

  if (!Array.isArray(pricingOverrides)) {
    return res.status(400).json({ message: 'Expected an array of pricing mapping' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.userPriceTier.deleteMany({ where: { userId: parseInt(id) } });
      await tx.userPackagingTier.deleteMany({ where: { userId: parseInt(id) } });

      if (pricingOverrides.length > 0) {
        await tx.userPriceTier.createMany({
          data: pricingOverrides.map(p => ({
            userId: parseInt(id),
            productId: parseInt(p.productId),
            level_name: p.level_name
          }))
        });
      }

      if (Array.isArray(packagingOverrides) && packagingOverrides.length > 0) {
        await tx.userPackagingTier.createMany({
          data: packagingOverrides.map(p => ({
            userId: parseInt(id),
            packagingId: parseInt(p.packagingId),
            level_name: p.level_name
          }))
        });
      }

      const [unitOverrides, pkgOverrides] = await Promise.all([
        tx.userPriceTier.findMany({ where: { userId: parseInt(id) } }),
        tx.userPackagingTier.findMany({ where: { userId: parseInt(id) } }),
      ]);
      return { unitOverrides, packagingOverrides: pkgOverrides };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error saving individual pricing', error: err.message });
  }
});

// POST Add New Team Member
app.post('/api/team', async (req, res) => {
  const { name, email, role, password, contact, address, store_name, price_level } = req.body;
  const parent_id = req.body.parent_id || 2; // Hardcode stokis ID for now if not provided

  if (!name || !email || !role || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Sales hanya boleh dimiliki oleh Stokis
    if (role === 'SALES') {
      const parentUser = await prisma.user.findUnique({ where: { id: parseInt(parent_id) }, select: { role: true } });
      if (!parentUser || parentUser.role !== 'STOKIS') {
        return res.status(400).json({ message: 'Sales hanya dapat didaftarkan di bawah Stokis, bukan Sub Stokis.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newMember = await prisma.user.create({
      data: {
        name,
        email,
        role,
        password: hashedPassword,
        parent_id,
        contact,
        address,
        store_name,
        price_level: price_level || 'Harga Umum'
      }
    });

    const { password: _, ...safeMember } = newMember;
    res.status(201).json(safeMember);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(400).json({ message: 'Email sudah terdaftar.' });
    }
    res.status(500).json({ message: 'Error creating team member', error: err.message });
  }
});

// PUT Update Team Member
app.put('/api/team/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password, contact, address, store_name, price_level, latitude, longitude } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const dataToUpdate = {
      name,
      email,
      role,
      contact,
      address,
      store_name: (role === 'SUBSTOKIS' || role === 'STOKIS') ? store_name : undefined
    };

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    if (price_level) dataToUpdate.price_level = price_level;
    if (latitude !== undefined) dataToUpdate.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) dataToUpdate.longitude = longitude ? parseFloat(longitude) : null;

    const updatedMember = await prisma.user.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    const { password: _, ...safeMember } = updatedMember;
    res.json(safeMember);
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') {
      return res.status(400).json({ message: 'Email sudah terdaftar.' });
    }
    res.status(500).json({ message: 'Error updating team member', error: err.message });
  }
});

// DELETE Team Member
app.delete('/api/team/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Team member deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting team member', error: err.message });
  }
});

// ==============================
// DISTRIBUTION (ORDERS) API
// ==============================

// GET Single Order with Details
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        buyer: true,
        stokis: true,
        driver: true,
        items: { include: { product: true, packaging: true } }
      }
    });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Safety: Remove passwords
    if (order.buyer) delete order.buyer.password;
    if (order.stokis) delete order.stokis.password;
    if (order.driver) delete order.driver.password;

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving order details' });
  }
});

// GET All Orders with Filter (Improved)
app.get('/api/orders', async (req, res) => {
  try {
    const { stokisId, buyerId, driverId, status } = req.query;

    let filter = {};
    if (stokisId) filter.stokisId = parseInt(stokisId);
    if (buyerId) filter.buyerId = parseInt(buyerId);
    if (driverId) filter.driverId = parseInt(driverId);
    if (status) filter.status = status;

    const orders = await prisma.order.findMany({
      where: filter,
      include: {
        buyer: true,
        driver: true,
        items: { include: { product: true, packaging: true } }
      },
      orderBy: { date: 'desc' }
    });

    const safeOrders = orders.map(order => {
      if (order.buyer) delete order.buyer.password;
      if (order.driver) delete order.driver.password;
      return order;
    });

    res.json(safeOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving orders', error: err.message });
  }
});

// PUT Update Order Status & Assign Driver
app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, driverId } = req.body;

  try {
    const dataToUpdate = { status };
    if (driverId) {
      dataToUpdate.driverId = parseInt(driverId);
    }

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { buyer: true, items: { include: { product: true } } }
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Kurangi stok saat Stokis memproses pesanan (PENDING → PROCESSING)
    if (status === 'PROCESSING' && order.status === 'PENDING') {
      for (const item of order.items) {
        const dbProduct = await prisma.product.findUnique({ where: { id: item.productId } });
        const totalUnits = item.quantity * (item.unitQty || 1);
        if (!dbProduct || dbProduct.stock < totalUnits) {
          return res.status(400).json({ message: `Stok produk ${dbProduct ? dbProduct.name : '#' + item.productId} tidak mencukupi untuk diproses.` });
        }
      }
      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity * (item.unitQty || 1) } }
        });
      }
    }

    // Stock Transfer Logic when DELIVERED
    if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
      if (order.buyer.role === 'SUBSTOKIS') {
        const items = order.items;
        for (const item of items) {
          const originalProduct = item.product;

          const existingProduct = await prisma.product.findFirst({
            where: {
              userId: order.buyerId,
              code: originalProduct.code
            }
          });

          if (existingProduct) {
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: { stock: { increment: item.quantity * (item.unitQty || 1) } }
            });
          } else {
            await prisma.product.create({
              data: {
                userId: order.buyerId,
                code: originalProduct.code,
                brand: originalProduct.brand,
                name: originalProduct.name,
                stock: item.quantity * (item.unitQty || 1)
              }
            });
          }
        }
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
      include: { buyer: true, driver: true, stokis: true }
    });

    if (updatedOrder.buyer) delete updatedOrder.buyer.password;
    if (updatedOrder.driver) delete updatedOrder.driver.password;
    if (updatedOrder.stokis) delete updatedOrder.stokis.password;

    res.json(updatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating order', error: err.message });
  }
});

// POST Create Order (Purchasing from Stokis)
app.post('/api/orders', async (req, res) => {
  try {
    const { buyerId, stokisId, items } = req.body;

    if (!buyerId || !stokisId || !items || items.length === 0) {
      return res.status(400).json({ message: 'Pembeli, Stokis, atau keranjang tidak valid.' });
    }

    for (const item of items) {
      const dbProduct = await prisma.product.findUnique({ where: { id: parseInt(item.productId) } });
      const unitQty = item.packagingId ? (parseInt(item.unitQty) || 1) : 1;
      const totalUnits = item.quantity * unitQty;
      if (!dbProduct || dbProduct.stock < totalUnits) {
        return res.status(400).json({ message: `Stok barang ${dbProduct ? dbProduct.name : 'tidak ditemukan'} tidak mencukupi.` });
      }
    }

    // Auto-resolve salesId: ambil dari data buyer jika buyer punya sales_id
    const buyer = await prisma.user.findUnique({
      where: { id: parseInt(buyerId) },
      select: { id: true, sales_id: true }
    });
    const resolvedSalesId = buyer?.sales_id || null;

    const total_amount = items.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0);

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          invoice_id: `INV-${Date.now()}`,
          total_amount,
          stokisId: parseInt(stokisId),
          buyerId: parseInt(buyerId),
          salesId: resolvedSalesId,
          status: 'PENDING',
          items: {
            create: items.map(i => ({
              productId: parseInt(i.productId),
              quantity: parseInt(i.quantity),
              price: parseFloat(i.price),
              packagingId: i.packagingId ? parseInt(i.packagingId) : null,
              packagingName: i.packagingName || null,
              unitQty: i.packagingId ? (parseInt(i.unitQty) || 1) : 1,
            }))
          }
        },
        include: { items: true, buyer: true }
      });

      // Stok TIDAK dikurangi di sini — pengurangan terjadi saat Stokis memproses pesanan (status → PROCESSING)

      return newOrder;
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error processing purchase order', error: err.message });
  }
});

// POST Create Dummy Order (For Testing)
app.post('/api/orders/dummy', async (req, res) => {
  try {
    const stokisId = 2;
    const product = await prisma.product.findFirst();
    const buyer = await prisma.user.findFirst({ where: { role: { in: ['SUBSTOKIS', 'SALES'] } } });

    if (!product || !buyer) return res.status(400).json({ message: 'Need product & substokis/sales data first.' });

    // Ambil order qty secara default, tapi kalau stock sedikit maka habiskan saja stocknya
    let qty = Math.floor(Math.random() * 50) + 10;
    if (product.stock < qty && product.stock > 0) qty = product.stock;
    if (product.stock === 0) return res.status(400).json({ message: 'Stok barang habis, simulasi PO tidak bisa dilanjutkan.' });

    const price = 50000;

    const order = await prisma.$transaction(async (tx) => {
      // 1. Buat Order Record
      const newOrder = await tx.order.create({
        data: {
          invoice_id: `INV-${Date.now()}`,
          total_amount: qty * price,
          stokisId,
          buyerId: buyer.id,
          status: 'PENDING',
          items: {
            create: [{ productId: product.id, quantity: qty, price }]
          }
        }
      });

      // 2. Potong Stokis Inventory!
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: qty } }
      });

      return newOrder;
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generate dummy', error: err.message });
  }
});

// POST Create Dummy GPS Movement (For Testing WebSocket Real-time Map)
app.post('/api/simulate-gps', (req, res) => {
  const { driverId, lat, lng } = req.body;
  if (!driverId || !lat || !lng) {
    return res.status(400).json({ message: 'Need driverId, lat, lng' });
  }

  const data = {
    driverId: parseInt(driverId),
    lat: parseFloat(lat),
    lng: parseFloat(lng)
  };

  activeDrivers.set(data.driverId, data);
  io.emit('driverLocationChanged', data);

  res.json({ message: 'Simulated GPS transmitted via WebSocket', data });
});

// Endpoint GET untuk initial map rendering jika Socket belum emit
app.get('/api/live-drivers', (req, res) => {
  const driversObj = Object.fromEntries(activeDrivers);
  res.json(driversObj);
});

// ─────────────────────────────────────────────────────────────────────────────
// VISIT ROUTES (Sales field visits)
// ─────────────────────────────────────────────────────────────────────────────

// GET all visits for a salesperson
app.get('/api/visits', async (req, res) => {
  const { salesId, stokisId } = req.query;
  try {
    let where = {};
    if (salesId) {
      where = { salesId: parseInt(salesId) };
    } else if (stokisId) {
      const salesTeam = await prisma.user.findMany({
        where: { parent_id: parseInt(stokisId), role: 'SALES' },
        select: { id: true },
      });
      const salesIds = salesTeam.map(s => s.id);
      where = salesIds.length > 0 ? { salesId: { in: salesIds } } : { id: -1 };
    }
    const visits = await prisma.visit.findMany({
      where,
      include: { sales: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(visits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching visits', error: err.message });
  }
});

// POST create a new visit
app.post('/api/visits', async (req, res) => {
  const { salesId, name, address, lat, lng, notes, status } = req.body;
  if (!salesId || !name || !address) {
    return res.status(400).json({ message: 'salesId, name, address required' });
  }
  try {
    const visit = await prisma.visit.create({
      data: {
        salesId: parseInt(salesId),
        name,
        address,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        notes: notes || null,
        status: status || 'PENDING',
      }
    });
    res.json(visit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating visit', error: err.message });
  }
});

// PUT update visit status
app.put('/api/visits/:id', async (req, res) => {
  const { status, notes } = req.body;
  try {
    const visit = await prisma.visit.update({
      where: { id: parseInt(req.params.id) },
      data: { status, notes }
    });
    res.json(visit);
  } catch (err) {
    res.status(500).json({ message: 'Error updating visit', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMISSION ROUTE (Sales commission from delivered orders)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/commissions', async (req, res) => {
  const { salesId } = req.query;
  if (!salesId) return res.status(400).json({ message: 'salesId required' });

  try {
    // Sales bisa langsung di bawah Stokis, atau di bawah Substokis
    // Commission configs selalu milik Stokis — walk up the hierarchy
    const salesUser = await prisma.user.findUnique({
      where: { id: parseInt(salesId) },
      select: { id: true, parent_id: true }
    });
    let stokisId = null;
    if (salesUser?.parent_id) {
      const parent = await prisma.user.findUnique({
        where: { id: salesUser.parent_id },
        select: { id: true, role: true, parent_id: true }
      });
      if (parent?.role === 'STOKIS') {
        stokisId = parent.id;
      } else if (parent?.role === 'SUBSTOKIS' && parent.parent_id) {
        // Sales → Substokis → Stokis
        stokisId = parent.parent_id;
      } else {
        stokisId = salesUser.parent_id;
      }
    }

    const orders = await prisma.order.findMany({
      where: {
        salesId: parseInt(salesId),
        status: 'DELIVERED',
      },
      include: {
        items: {
          include: {
            product: { include: { priceTiers: true } }
          }
        },
        buyer: { select: { id: true, name: true, role: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Ambil CommissionConfig dan Campaign aktif yang relevan
    const now = new Date();
    const [salesConfigs, defaultConfigs, activeCampaigns] = stokisId ? await Promise.all([
      prisma.commissionConfig.findMany({ where: { stokisId, salesId: parseInt(salesId) } }),
      prisma.commissionConfig.findMany({ where: { stokisId, salesId: null } }),
      prisma.commissionCampaign.findMany({
        where: {
          stokisId,
          isActive: true,
          OR: [{ salesId: parseInt(salesId) }, { salesId: null }],
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ]
        },
        include: { items: true }
      }),
    ]) : [[], [], []];

    // Config spesifik sales menggantikan config default
    const getConfig = (productId) =>
      salesConfigs.find(c => c.productId === productId) ||
      defaultConfigs.find(c => c.productId === productId) ||
      null;

    // Kumpulkan semua campaign item aktif untuk sebuah produk
    const getCampaignItems = (productId) =>
      activeCampaigns
        .filter(c => c.items.some(i => i.productId === productId))
        .map(c => {
          const item = c.items.find(i => i.productId === productId);
          return { combineWithDefault: c.combineWithDefault, amountType: item.amountType, amount: item.amount };
        });

    // Build map untuk cek FIRST_PURCHASE: (buyerId, productId) → id order pertama
    const allBuyerIds = [...new Set(orders.map(o => o.buyerId))];
    const historicalOrders = allBuyerIds.length > 0 ? await prisma.order.findMany({
      where: { salesId: parseInt(salesId), status: 'DELIVERED', buyerId: { in: allBuyerIds } },
      select: { id: true, buyerId: true, items: { select: { productId: true } } },
      orderBy: { date: 'asc' },
    }) : [];
    const firstOrderMap = new Map();
    for (const o of historicalOrders) {
      for (const item of o.items) {
        const key = `${o.buyerId}-${item.productId}`;
        if (!firstOrderMap.has(key)) firstOrderMap.set(key, o.id);
      }
    }

    const result = orders.map(order => {
      let totalCommission = 0;
      const itemsWithCommission = order.items.map(item => {
        const tiers = item.product?.priceTiers || [];
        const matchedTier = tiers.find(t => Math.abs(t.price - item.price) < 1)
          || tiers.slice().sort((a, b) => Math.abs(a.price - item.price) - Math.abs(b.price - item.price))[0];
        let baseCommission = matchedTier ? matchedTier.commission : 0;

        // Terapkan CommissionConfig: isActive & commissionType
        const config = getConfig(item.productId);
        if (config) {
          if (!config.isActive) {
            baseCommission = 0;
          } else if (config.commissionType === 'FIRST_PURCHASE') {
            const key = `${order.buyerId}-${item.productId}`;
            if (firstOrderMap.get(key) !== order.id) baseCommission = 0;
          }
          // CUMULATIVE: selalu hitung komisi (default)
        }

        // Terapkan CommissionCampaign
        const campaignItems = getCampaignItems(item.productId);
        let finalCommission = baseCommission;
        if (campaignItems.length > 0) {
          const replacing = campaignItems.filter(ci => !ci.combineWithDefault);
          const additive = campaignItems.filter(ci => ci.combineWithDefault);
          if (replacing.length > 0) {
            // Ganti komisi base dengan nilai campaign terbesar
            finalCommission = replacing.reduce((max, ci) => {
              const val = ci.amountType === 'FLAT' ? ci.amount : baseCommission * ci.amount / 100;
              return Math.max(max, val);
            }, 0);
          }
          // Tambahkan bonus additive campaigns
          for (const ci of additive) {
            finalCommission += ci.amountType === 'FLAT' ? ci.amount : baseCommission * ci.amount / 100;
          }
        }

        const itemCommission = finalCommission * item.quantity;
        totalCommission += itemCommission;
        return {
          productName: item.product?.name || 'Unknown',
          quantity: item.quantity,
          price: item.price,
          commissionPerUnit: finalCommission,
          tierMatched: matchedTier?.level_name || '-',
          totalItemCommission: itemCommission,
        };
      });
      return {
        orderId: order.id,
        invoice_id: order.invoice_id,
        date: order.date,
        buyerName: order.buyer?.name,
        totalAmount: order.total_amount,
        totalCommission,
        items: itemsWithCommission,
      };
    });

    const grandTotalCommission = result.reduce((s, o) => s + o.totalCommission, 0);
    res.json({ orders: result, grandTotalCommission });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching commissions', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER CONSUMER (Sales registers a new Konsumen/Member)
// ─────────────────────────────────────────────────────────────────────────────

// GET Single User public info (no password)
app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: { id: true, name: true, store_name: true, role: true, email: true, contact: true, address: true },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

// GET available parent options (stokis + substokis) untuk sales yang hanya di bawah Stokis
app.get('/api/parent-options', async (req, res) => {
  const { salesId } = req.query;
  if (!salesId) return res.status(400).json({ message: 'salesId required' });
  try {
    const sales = await prisma.user.findUnique({ where: { id: parseInt(salesId) }, select: { id: true, parent_id: true } });
    if (!sales?.parent_id) return res.json([]);

    // Sales selalu langsung di bawah Stokis
    const stokisData = await prisma.user.findUnique({ where: { id: sales.parent_id }, select: { id: true, name: true, store_name: true, role: true, latitude: true, longitude: true } });
    if (!stokisData || stokisData.role !== 'STOKIS') return res.json([]);

    // Ambil semua substokis di bawah stokis ini
    const substokisList = await prisma.user.findMany({
      where: { parent_id: stokisData.id, role: 'SUBSTOKIS' },
      select: { id: true, name: true, store_name: true, role: true, latitude: true, longitude: true },
      orderBy: { name: 'asc' },
    });

    const options = [
      { id: stokisData.id, name: stokisData.store_name || stokisData.name, role: stokisData.role, latitude: stokisData.latitude, longitude: stokisData.longitude },
      ...substokisList.map(s => ({ id: s.id, name: s.store_name || s.name, role: s.role, latitude: s.latitude, longitude: s.longitude })),
    ];
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching parent options', error: err.message });
  }
});

app.post('/api/consumers', async (req, res) => {
  const { name, store_name, email, contact, address, role, parentId, price_level, latitude, longitude, salesId } = req.body;
  if (!name || !email || !parentId) {
    return res.status(400).json({ message: 'name, email, parentId required' });
  }
  if (role !== 'KONSUMEN' && role !== 'MEMBER') {
    return res.status(400).json({ message: 'role must be KONSUMEN or MEMBER' });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: 'Email sudah terdaftar' });

    const defaultPassword = await bcrypt.hash('pass1234', 10);

    const consumer = await prisma.user.create({
      data: {
        name,
        store_name: store_name || null,
        email,
        password: defaultPassword,
        role,
        parent_id: parseInt(parentId),
        contact: contact || null,
        address: address || null,
        price_level: price_level || 'Harga Umum',
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        sales_id: salesId ? parseInt(salesId) : null,
      }
    });
    res.json({ id: consumer.id, name: consumer.name, email: consumer.email, role: consumer.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error registering consumer', error: err.message });
  }
});

// GET consumers/members (registered by a stokis or parent)
app.get('/api/consumers', async (req, res) => {
  const { parentId, salesId } = req.query;
  try {
    const where = {
      role: { in: ['KONSUMEN', 'MEMBER'] },
      ...(parentId ? { parent_id: parseInt(parentId) } : {}),
      ...(salesId ? { sales_id: parseInt(salesId) } : {}),
    };
    const consumers = await prisma.user.findMany({
      where,
      select: { id: true, name: true, store_name: true, email: true, role: true, contact: true, address: true, latitude: true, longitude: true, price_level: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(consumers);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching consumers', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMISSION MANAGEMENT (Stokis configures sales commission per product & campaigns)
// ─────────────────────────────────────────────────────────────────────────────

// GET default commission configs + products for a stokis
app.get('/api/commission-configs', async (req, res) => {
  const { stokisId, salesId } = req.query;
  if (!stokisId) return res.status(400).json({ message: 'stokisId required' });
  const salesIdFilter = salesId ? parseInt(salesId) : null;
  try {
    const products = await prisma.product.findMany({
      where: { userId: parseInt(stokisId) },
      include: {
        priceTiers: true,
        packagings: {
          include: {
            priceTiers: true,
            commissionConfigs: {
              where: { stokisId: parseInt(stokisId), salesId: salesIdFilter },
            },
          },
          orderBy: { unitQty: 'asc' },
        },
        commissionConfigs: {
          where: { stokisId: parseInt(stokisId), salesId: salesIdFilter, packagingId: null }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching commission configs', error: err.message });
  }
});

// POST bulk-save commission configs (upsert per product and per packaging)
app.post('/api/commission-configs/save', async (req, res) => {
  const { stokisId, salesId, configs } = req.body;
  // configs: [{ productId, packagingId?, isActive, commissionType }]
  // salesId: null = default for all, number = override for specific sales person
  if (!stokisId || !Array.isArray(configs)) return res.status(400).json({ message: 'stokisId and configs required' });
  const salesIdVal = salesId ? parseInt(salesId) : null;
  try {
    const ops = configs.map(async c => {
      const packagingIdVal = c.packagingId ? parseInt(c.packagingId) : null;
      const existing = await prisma.commissionConfig.findFirst({
        where: { stokisId: parseInt(stokisId), salesId: salesIdVal, productId: parseInt(c.productId), packagingId: packagingIdVal }
      });
      if (existing) {
        return prisma.commissionConfig.update({
          where: { id: existing.id },
          data: { isActive: c.isActive, commissionType: c.commissionType }
        });
      } else {
        return prisma.commissionConfig.create({
          data: { stokisId: parseInt(stokisId), salesId: salesIdVal, productId: parseInt(c.productId), packagingId: packagingIdVal, isActive: c.isActive, commissionType: c.commissionType }
        });
      }
    });
    await Promise.all(ops);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error saving commission configs', error: err.message });
  }
});

// GET all campaigns for a stokis
app.get('/api/commission-campaigns', async (req, res) => {
  const { stokisId } = req.query;
  if (!stokisId) return res.status(400).json({ message: 'stokisId required' });
  try {
    const campaigns = await prisma.commissionCampaign.findMany({
      where: { stokisId: parseInt(stokisId) },
      include: {
        salesUser: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, code: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching campaigns', error: err.message });
  }
});

// POST create new campaign
app.post('/api/commission-campaigns', async (req, res) => {
  const { stokisId, salesId, name, description, isActive, combineWithDefault, startDate, endDate, items } = req.body;
  if (!stokisId || !name) return res.status(400).json({ message: 'stokisId and name required' });
  try {
    const campaign = await prisma.commissionCampaign.create({
      data: {
        stokisId: parseInt(stokisId),
        salesId: salesId ? parseInt(salesId) : null,
        name,
        description: description || null,
        isActive: isActive !== false,
        combineWithDefault: combineWithDefault !== false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        items: {
          create: (items || []).map(i => ({
            productId: parseInt(i.productId),
            amountType: i.amountType || 'FLAT',
            amount: parseFloat(i.amount)
          }))
        }
      },
      include: { salesUser: { select: { id: true, name: true } }, items: { include: { product: { select: { id: true, name: true, code: true } } } } }
    });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: 'Error creating campaign', error: err.message });
  }
});

// PUT update campaign (replace items)
app.put('/api/commission-campaigns/:id', async (req, res) => {
  const { salesId, name, description, isActive, combineWithDefault, startDate, endDate, items } = req.body;
  const id = parseInt(req.params.id);
  try {
    await prisma.commissionCampaignItem.deleteMany({ where: { campaignId: id } });
    const campaign = await prisma.commissionCampaign.update({
      where: { id },
      data: {
        salesId: salesId ? parseInt(salesId) : null,
        name,
        description: description || null,
        isActive: isActive !== false,
        combineWithDefault: combineWithDefault !== false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        items: {
          create: (items || []).map(i => ({
            productId: parseInt(i.productId),
            amountType: i.amountType || 'FLAT',
            amount: parseFloat(i.amount)
          }))
        }
      },
      include: { salesUser: { select: { id: true, name: true } }, items: { include: { product: { select: { id: true, name: true, code: true } } } } }
    });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ message: 'Error updating campaign', error: err.message });
  }
});

// PATCH toggle campaign active status
app.patch('/api/commission-campaigns/:id/toggle', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const current = await prisma.commissionCampaign.findUnique({ where: { id }, select: { isActive: true } });
    const updated = await prisma.commissionCampaign.update({
      where: { id },
      data: { isActive: !current.isActive }
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Error toggling campaign', error: err.message });
  }
});

// DELETE campaign
app.delete('/api/commission-campaigns/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.commissionCampaign.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting campaign', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// KONSINYASI ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Generate contract number
async function generateContractNo(stokisId) {
  const year = new Date().getFullYear();
  const count = await prisma.konsinyasiContract.count({ where: { stokisId } });
  return `KNS-${year}-${String(count + 1).padStart(4, '0')}`;
}

// GET default price for konsinyasi (sesuai custom tier konsumen dari UserPriceTier & UserPackagingTier)
app.get('/api/konsinyasi/default-price', async (req, res) => {
  const { productId, packagingId, konsumenId } = req.query;
  
  console.log('[DEBUG] konsinyasi default-price request:', { productId, packagingId, konsumenId });
  
  if (!productId || !konsumenId) {
    return res.status(400).json({ message: 'productId and konsumenId required' });
  }

  try {
    let defaultPrice = null;

    // Try to get pricing from packaging first if packaging is selected
    if (packagingId) {
      // Check if konsumen has custom tier for this packaging from UserPackagingTier
      const userPackagingTier = await prisma.userPackagingTier.findUnique({
        where: {
          userId_packagingId: {
            userId: parseInt(konsumenId),
            packagingId: parseInt(packagingId)
          }
        },
        select: { level_name: true }
      });

      console.log('[DEBUG] userPackagingTier:', userPackagingTier);

      if (userPackagingTier) {
        // Get packaging price tier with this level_name from PackagingPriceTier
        const packagingPriceTier = await prisma.packagingPriceTier.findFirst({
          where: {
            packagingId: parseInt(packagingId),
            level_name: userPackagingTier.level_name
          },
          select: { price: true }
        });

        if (packagingPriceTier) {
          defaultPrice = packagingPriceTier.price;
          console.log('[DEBUG] matched packaging price tier from PackagingPriceTier:', userPackagingTier.level_name, 'price:', defaultPrice);
        }
      }
    }

    // If no packaging price found, get from product tier
    if (defaultPrice === null) {
      // Check if konsumen has custom tier for this product from UserPriceTier
      const userPriceTier = await prisma.userPriceTier.findUnique({
        where: {
          userId_productId: {
            userId: parseInt(konsumenId),
            productId: parseInt(productId)
          }
        },
        select: { level_name: true }
      });

      console.log('[DEBUG] userPriceTier:', userPriceTier);

      if (userPriceTier) {
        // Get product price tier with this level_name from PriceTier table
        const priceTier = await prisma.priceTier.findFirst({
          where: {
            productId: parseInt(productId),
            level_name: userPriceTier.level_name
          },
          select: { price: true }
        });

        if (priceTier) {
          defaultPrice = priceTier.price;
          console.log('[DEBUG] matched product price tier from PriceTier:', userPriceTier.level_name, 'price:', defaultPrice);
        }
      }
    }

    console.log('[DEBUG] final result:', { defaultPrice });
    res.json({ defaultPrice: defaultPrice || 0 });
  } catch (err) {
    console.error('[ERROR] default-price endpoint:', err);
    res.status(500).json({ message: 'Error fetching default price', error: err.message });
  }
});

// GET list contracts for a stokis
app.get('/api/konsinyasi', async (req, res) => {
  const { stokisId } = req.query;
  if (!stokisId) return res.status(400).json({ message: 'stokisId required' });
  try {
    const contracts = await prisma.konsinyasiContract.findMany({
      where: { stokisId: parseInt(stokisId) },
      include: {
        konsumen: { select: { id: true, name: true, store_name: true, contact: true, address: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true } },
            packaging: { select: { id: true, name: true, unitQty: true } },
          }
        },
        schedules: {
          orderBy: { deliveryDate: 'asc' },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, code: true } },
                packaging: { select: { id: true, name: true, unitQty: true } },
              }
            },
            order: { select: { id: true, invoice_id: true, status: true } },
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(contracts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching konsinyasi', error: err.message });
  }
});

// GET single contract
app.get('/api/konsinyasi/:id', async (req, res) => {
  try {
    const contract = await prisma.konsinyasiContract.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        konsumen: { select: { id: true, name: true, store_name: true, contact: true, address: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, code: true } },
            packaging: { select: { id: true, name: true, unitQty: true } },
          }
        },
        schedules: {
          orderBy: { deliveryDate: 'asc' },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, code: true } },
                packaging: { select: { id: true, name: true, unitQty: true } },
              }
            },
            order: { select: { id: true, invoice_id: true, status: true } },
          }
        },
      },
    });
    if (!contract) return res.status(404).json({ message: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching contract', error: err.message });
  }
});

// POST create contract
app.post('/api/konsinyasi', async (req, res) => {
  const { stokisId, konsumenId, ownerName, storeName, storeAddress, storePhone, idCardNo, npwpNo,
    billingCycle, startDate, endDate, notes, items } = req.body;
  if (!stokisId || !konsumenId || !ownerName || !storeName || !storeAddress) {
    return res.status(400).json({ message: 'stokisId, konsumenId, ownerName, storeName, storeAddress required' });
  }
  try {
    const contractNo = await generateContractNo(parseInt(stokisId));
    const contract = await prisma.konsinyasiContract.create({
      data: {
        stokisId: parseInt(stokisId),
        konsumenId: parseInt(konsumenId),
        contractNo,
        ownerName,
        storeName,
        storeAddress,
        storePhone: storePhone || null,
        idCardNo: idCardNo || null,
        npwpNo: npwpNo || null,
        billingCycle: billingCycle || 'MONTHLY',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        notes: notes || null,
        status: 'DRAFT',
        items: items && items.length > 0 ? {
          create: items.map(it => ({
            productId: parseInt(it.productId),
            packagingId: it.packagingId ? parseInt(it.packagingId) : null,
            priceKonsinyasi: parseFloat(it.priceKonsinyasi) || 0,
            maxQtyPerDelivery: parseInt(it.maxQtyPerDelivery) || 0,
          }))
        } : undefined,
      },
      include: {
        items: { include: { product: true, packaging: true } },
      }
    });
    res.json(contract);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating contract', error: err.message });
  }
});

// PUT update contract (KYC + items)
app.put('/api/konsinyasi/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { ownerName, storeName, storeAddress, storePhone, idCardNo, npwpNo,
    billingCycle, startDate, endDate, notes, items } = req.body;
  try {
    // Delete existing items then re-create
    await prisma.konsinyasiItem.deleteMany({ where: { contractId: id } });
    const contract = await prisma.konsinyasiContract.update({
      where: { id },
      data: {
        ownerName, storeName, storeAddress,
        storePhone: storePhone || null,
        idCardNo: idCardNo || null,
        npwpNo: npwpNo || null,
        billingCycle: billingCycle || 'MONTHLY',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        notes: notes || null,
        items: items && items.length > 0 ? {
          create: items.map(it => ({
            productId: parseInt(it.productId),
            packagingId: it.packagingId ? parseInt(it.packagingId) : null,
            priceKonsinyasi: parseFloat(it.priceKonsinyasi) || 0,
            maxQtyPerDelivery: parseInt(it.maxQtyPerDelivery) || 0,
          }))
        } : undefined,
      },
      include: {
        items: { include: { product: true, packaging: true } },
        schedules: true,
      }
    });
    res.json(contract);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating contract', error: err.message });
  }
});

// PATCH update contract status
app.patch('/api/konsinyasi/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['DRAFT', 'ACTIVE', 'PAUSED', 'TERMINATED'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const contractId = parseInt(req.params.id);

    // Fetch full contract data before updating
    const existing = await prisma.konsinyasiContract.findUnique({
      where: { id: contractId },
      include: {
        items: { include: { product: true, packaging: true } },
        schedules: { take: 1 }
      }
    });
    if (!existing) return res.status(404).json({ message: 'Contract not found' });

    const contract = await prisma.konsinyasiContract.update({
      where: { id: contractId },
      data: { status },
    });

    // Auto-create first delivery order when activating a contract that:
    // 1. was previously DRAFT (not re-activating from PAUSED)
    // 2. has a startDate on or before today
    // 3. has no schedules yet
    // 4. has items with maxQtyPerDelivery > 0
    if (status === 'ACTIVE' && existing.status === 'DRAFT' && existing.schedules.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDate = existing.startDate ? new Date(existing.startDate) : null;
      if (startDate) startDate.setHours(0, 0, 0, 0);

      const eligibleItems = existing.items.filter(ci => ci.maxQtyPerDelivery > 0);

      if (startDate && startDate <= today && eligibleItems.length > 0) {
        const deliveryDate = new Date(); // use actual now for timestamp precision
        const ts = Date.now();
        const invoiceId = `${existing.contractNo}-${ts}`;

        const orderItemsData = eligibleItems.map(ci => ({
          productId: ci.productId,
          packagingId: ci.packagingId || null,
          packagingName: ci.packaging ? ci.packaging.name : null,
          unitQty: ci.packaging ? ci.packaging.unitQty : 1,
          quantity: ci.maxQtyPerDelivery,
          price: ci.priceKonsinyasi,
        }));

        const totalAmount = orderItemsData.reduce((sum, it) => sum + it.price * it.quantity, 0);

        await prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              invoice_id: invoiceId,
              date: deliveryDate,
              status: 'PENDING',
              total_amount: totalAmount,
              isKonsinyasi: true,
              stokisId: existing.stokisId,
              buyerId: existing.konsumenId,
              items: {
                create: orderItemsData.map(it => ({
                  productId: it.productId,
                  packagingId: it.packagingId,
                  packagingName: it.packagingName,
                  unitQty: it.unitQty,
                  quantity: it.quantity,
                  price: it.price,
                }))
              }
            }
          });
          await tx.konsinyasiSchedule.create({
            data: {
              contractId,
              deliveryDate,
              notes: 'Pengiriman pertama (otomatis saat kontrak diaktifkan)',
              orderId: order.id,
              status: 'SCHEDULED',
              items: {
                create: eligibleItems.map(ci => ({
                  productId: ci.productId,
                  packagingId: ci.packagingId || null,
                  quantity: ci.maxQtyPerDelivery,
                }))
              }
            }
          });
        });
      }
    }

    res.json(contract);
  } catch (err) {
    res.status(500).json({ message: 'Error updating status', error: err.message });
  }
});

// POST manually trigger first delivery for an ACTIVE contract with no schedules
app.post('/api/konsinyasi/:id/trigger-first-delivery', async (req, res) => {
  const contractId = parseInt(req.params.id);
  try {
    const existing = await prisma.konsinyasiContract.findUnique({
      where: { id: contractId },
      include: {
        items: { include: { product: true, packaging: true } },
        schedules: { take: 1 }
      }
    });
    if (!existing) return res.status(404).json({ message: 'Contract not found' });
    if (existing.status !== 'ACTIVE') return res.status(400).json({ message: 'Kontrak harus ACTIVE' });
    if (existing.schedules.length > 0) return res.status(400).json({ message: 'Sudah ada jadwal pengiriman' });

    const eligibleItems = existing.items.filter(ci => ci.maxQtyPerDelivery > 0);
    if (eligibleItems.length === 0) return res.status(400).json({ message: 'Tidak ada produk dengan maxQtyPerDelivery > 0' });

    const deliveryDate = new Date();
    const ts = Date.now();
    const invoiceId = `${existing.contractNo}-${ts}`;

    const orderItemsData = eligibleItems.map(ci => ({
      productId: ci.productId,
      packagingId: ci.packagingId || null,
      packagingName: ci.packaging ? ci.packaging.name : null,
      unitQty: ci.packaging ? ci.packaging.unitQty : 1,
      quantity: ci.maxQtyPerDelivery,
      price: ci.priceKonsinyasi,
    }));

    const totalAmount = orderItemsData.reduce((sum, it) => sum + it.price * it.quantity, 0);

    const schedule = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          invoice_id: invoiceId,
          date: deliveryDate,
          status: 'PENDING',
          total_amount: totalAmount,
          isKonsinyasi: true,
          stokisId: existing.stokisId,
          buyerId: existing.konsumenId,
          items: {
            create: orderItemsData.map(it => ({
              productId: it.productId,
              packagingId: it.packagingId,
              packagingName: it.packagingName,
              unitQty: it.unitQty,
              quantity: it.quantity,
              price: it.price,
            }))
          }
        }
      });
      return await tx.konsinyasiSchedule.create({
        data: {
          contractId,
          deliveryDate,
          notes: 'Pengiriman pertama (otomatis)',
          orderId: order.id,
          status: 'SCHEDULED',
          items: {
            create: eligibleItems.map(ci => ({
              productId: ci.productId,
              packagingId: ci.packagingId || null,
              quantity: ci.maxQtyPerDelivery,
            }))
          }
        },
        include: { items: { include: { product: true, packaging: true } }, order: true }
      });
    });

    res.json(schedule);
  } catch (err) {
    res.status(500).json({ message: 'Error triggering first delivery', error: err.message });
  }
});

// DELETE contract (only DRAFT)
app.delete('/api/konsinyasi/:id', async (req, res) => {
  try {
    const contract = await prisma.konsinyasiContract.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!contract) return res.status(404).json({ message: 'Not found' });
    if (contract.status !== 'DRAFT') return res.status(400).json({ message: 'Hanya kontrak DRAFT yang bisa dihapus' });
    await prisma.konsinyasiContract.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting contract', error: err.message });
  }
});

// POST add delivery schedule + auto-create Order
app.post('/api/konsinyasi/:id/schedules', async (req, res) => {
  const contractId = parseInt(req.params.id);
  const { deliveryDate, notes, items } = req.body; // items: [{productId, packagingId?, quantity}]
  if (!deliveryDate || !items || items.length === 0) {
    return res.status(400).json({ message: 'deliveryDate and items required' });
  }
  try {
    const contract = await prisma.konsinyasiContract.findUnique({
      where: { id: contractId },
      include: { items: { include: { product: { include: { priceTiers: true } }, packaging: { include: { priceTiers: true } } } } }
    });
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    // Build order items with price from konsinyasi contract items
    const orderItemsData = items.map(si => {
      const contractItem = contract.items.find(ci =>
        ci.productId === parseInt(si.productId) &&
        (ci.packagingId || null) === (si.packagingId ? parseInt(si.packagingId) : null)
      );
      const price = contractItem ? contractItem.priceKonsinyasi : 0;
      let packagingName = null;
      let unitQty = 1;
      if (si.packagingId && contractItem?.packaging) {
        packagingName = contractItem.packaging.name;
        unitQty = contractItem.packaging.unitQty;
      }
      return {
        productId: parseInt(si.productId),
        packagingId: si.packagingId ? parseInt(si.packagingId) : null,
        packagingName,
        unitQty,
        quantity: parseInt(si.quantity),
        price,
      };
    });

    const totalAmount = orderItemsData.reduce((sum, it) => sum + it.price * it.quantity, 0);

    // Generate invoice ID
    const ts = Date.now();
    const invoiceId = `${contract.contractNo}-${ts}`;

    // Create order + schedule atomically
    const schedule = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          invoice_id: invoiceId,
          date: new Date(deliveryDate),
          status: 'PENDING',
          total_amount: totalAmount,
          isKonsinyasi: true,
          stokisId: contract.stokisId,
          buyerId: contract.konsumenId,
          items: {
            create: orderItemsData.map(it => ({
              productId: it.productId,
              packagingId: it.packagingId,
              packagingName: it.packagingName,
              unitQty: it.unitQty,
              quantity: it.quantity,
              price: it.price,
            }))
          }
        }
      });

      const sched = await tx.konsinyasiSchedule.create({
        data: {
          contractId,
          deliveryDate: new Date(deliveryDate),
          notes: notes || null,
          orderId: order.id,
          status: 'SCHEDULED',
          items: {
            create: items.map(si => ({
              productId: parseInt(si.productId),
              packagingId: si.packagingId ? parseInt(si.packagingId) : null,
              quantity: parseInt(si.quantity),
            }))
          }
        },
        include: {
          items: { include: { product: true, packaging: true } },
          order: true,
        }
      });
      return sched;
    });

    // Activate contract if still DRAFT
    if (contract.status === 'DRAFT') {
      await prisma.konsinyasiContract.update({
        where: { id: contractId },
        data: { status: 'ACTIVE' }
      });
    }

    res.json(schedule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating schedule', error: err.message });
  }
});

// DELETE schedule (only SCHEDULED status)
app.delete('/api/konsinyasi/schedules/:scheduleId', async (req, res) => {
  const scheduleId = parseInt(req.params.scheduleId);
  try {
    const sched = await prisma.konsinyasiSchedule.findUnique({ where: { id: scheduleId } });
    if (!sched) return res.status(404).json({ message: 'Schedule not found' });
    if (sched.status !== 'SCHEDULED') return res.status(400).json({ message: 'Hanya jadwal SCHEDULED yang bisa dihapus' });
    // Delete linked order too
    if (sched.orderId) {
      await prisma.order.delete({ where: { id: sched.orderId } });
    } else {
      await prisma.konsinyasiSchedule.delete({ where: { id: scheduleId } });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting schedule', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// Ganti app.listen menjadi server.listen untuk Socket.IO

// ─────────────────────────────────────────────────────────────────────────────
// FINANCE & COMMISSION MANAGEMENT ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET Commission Summary for Stokis
app.get('/api/finance/commission-summary', async (req, res) => {
  const { stokisId } = req.query;
  if (!stokisId) return res.status(400).json({ message: 'stokisId required' });

  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const configs = await prisma.commissionConfig.findMany({
      where: { stokisId: parseInt(stokisId) }
    });

    const campaigns = await prisma.commissionCampaign.findMany({
      where: { stokisId: parseInt(stokisId), isActive: true }
    });

    // Get all sales people under this stokis
    const salesTeam = await prisma.user.findMany({
      where: { parent_id: parseInt(stokisId), role: 'SALES' },
      select: { id: true, name: true }
    });

    // Calculate total commission and month commission
    let totalCommission = 0;
    let monthCommission = 0;

    for (const sales of salesTeam) {
      const orders = await prisma.order.findMany({
        where: {
          salesId: sales.id,
          status: 'DELIVERED'
        },
        include: { items: true }
      });

      for (const order of orders) {
        const orderDate = new Date(order.date);
        let orderCommission = 0;

        for (const item of order.items) {
          const config = configs.find(c => c.productId === item.productId && (c.salesId === sales.id || c.salesId === null));
          if (config && config.isActive) {
            const commissionAmount = config.commissionAmount || 0;
            const itemTotal = item.quantity * item.price;
            // Default: treat as flat amount, adjust as needed
            orderCommission += commissionAmount * item.quantity;
          }
        }

        totalCommission += orderCommission;
        if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
          monthCommission += orderCommission;
        }
      }
    }

    res.json({
      totalCommission,
      monthCommission,
      configCount: configs.length,
      campaignCount: campaigns.length,
      salesCount: salesTeam.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error calculating commission summary', error: err.message });
  }
});

// GET All Commission Configs for a Stokis
app.get('/api/commission-configs', async (req, res) => {
  const { stokisId } = req.query;
  if (!stokisId) return res.status(400).json({ message: 'stokisId required' });

  try {
    const configs = await prisma.commissionConfig.findMany({
      where: { stokisId: parseInt(stokisId) },
      include: {
        product: { select: { id: true, name: true, code: true } },
        salesUser: { select: { id: true, name: true } },
        packaging: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(configs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error retrieving commission configs', error: err.message });
  }
});

// POST Create Commission Config
app.post('/api/commission-configs', async (req, res) => {
  const { stokisId, salesId, productId, packagingId, commissionAmount, commissionType } = req.body;

  if (!stokisId || !productId || commissionAmount === undefined) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const config = await prisma.commissionConfig.create({
      data: {
        stokisId: parseInt(stokisId),
        salesId: salesId ? parseInt(salesId) : null,
        productId: parseInt(productId),
        packagingId: packagingId ? parseInt(packagingId) : null,
        commissionAmount: parseFloat(commissionAmount),
        commissionType: commissionType || 'FLAT',
        isActive: true
      },
      include: {
        product: { select: { id: true, name: true } },
        salesUser: { select: { id: true, name: true } }
      }
    });

    res.status(201).json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating commission config', error: err.message });
  }
});

// PUT Update Commission Config
app.put('/api/commission-configs/:id', async (req, res) => {
  const { id } = req.params;
  const { commissionAmount, commissionType, isActive } = req.body;

  try {
    const config = await prisma.commissionConfig.update({
      where: { id: parseInt(id) },
      data: {
        commissionAmount: commissionAmount !== undefined ? parseFloat(commissionAmount) : undefined,
        commissionType: commissionType || undefined,
        isActive: isActive !== undefined ? isActive : undefined
      },
      include: {
        product: { select: { id: true, name: true } },
        salesUser: { select: { id: true, name: true } }
      }
    });

    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating commission config', error: err.message });
  }
});

// DELETE Commission Config
app.delete('/api/commission-configs/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.commissionConfig.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Commission config deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting commission config', error: err.message });
  }
});

server.listen(port, () => {
  console.log(`Server and WebSocket are running on port: ${port}`);
});
