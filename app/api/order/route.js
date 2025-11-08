import { NextResponse } from "next/server";
import { init, get, all, run } from "@/lib/db";
import fs from 'fs';
import path from 'path';
import { convertToWebp } from '@/lib/module/ConvertToWebp.js';
import { nowWIBForSQL } from '@/lib/module/TimestampIndonesia.js';

const imagesRoot = path.join(process.cwd(), 'database', 'images');

async function saveProofBase64(base64, baseName) {
  if (!base64?.trim()) return null;

  const proofDir = path.join(imagesRoot, 'proof');
  if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });

  try {
    const out = await convertToWebp(Buffer.from(base64.replace(/^data:.*;base64,/, ''), 'base64'), proofDir, baseName);
    if (out && fs.existsSync(out)) return `proof/${path.basename(out)}`;
  } catch (e) {
    console.warn('convertToWebp failed for proof:', e);
  }

  // fallback: write raw as webp
  try {
    const filename = `${baseName}.webp`;
    const outPath = path.join(proofDir, filename);
    fs.writeFileSync(outPath, Buffer.from(base64.replace(/^data:.*;base64,/, ''), 'base64'));
    return `proof/${filename}`;
  } catch (e) {
    console.error('Failed to write proof file:', e);
    return null;
  }
}

// Helper functions for consistent responses
function errorResponse(message, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function successResponse(data, message = "Success") {
  return NextResponse.json({ 
    success: true, 
    message, 
    data 
  });
}

// Generate unique order number
function generateOrderNumber() {
  const now = new Date();
  const timestamp = now.getTime().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

// Validate order data
function validateOrderData(data) {
  const errors = [];
  
  if (!data.user_id || typeof data.user_id !== 'number') {
    errors.push("User ID is required and must be a number");
  }
  
  if (!data.payment_id || typeof data.payment_id !== 'number') {
    errors.push("Payment method ID is required and must be a number");
  }
  
  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push("Order items are required and must be a non-empty array");
  }
  
  if (data.items) {
    data.items.forEach((item, index) => {
      if (!item.unit_id || typeof item.unit_id !== 'number') {
        errors.push(`Item ${index + 1}: Unit ID is required and must be a number`);
      }
      if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity is required and must be a positive number`);
      }
    });
  }

  // optional shipping_type validation
  if (data.shipping_type !== undefined && data.shipping_type !== null) {
    const allowed = ['delivery', 'pickup'];
    const v = String(data.shipping_type || '').toLowerCase();
    if (!allowed.includes(v)) {
      errors.push(`shipping_type must be one of: ${allowed.join(', ')}`);
    }
  }
  
  return errors;
}

// GET - Fetch orders (for admin management and user queries)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const paymentStatus = searchParams.get('paymentStatus');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const search = searchParams.get('search');
  const user_id = searchParams.get('user_id');
  const order_id = searchParams.get('id');

  try {
    await init();

    // Get specific order by ID
    if (order_id) {
      const order = await get(`
        SELECT o.*, pm.payment, pm.no_payment, u.name as user_name 
        FROM orders o
        LEFT JOIN payment_methods pm ON o.payment_id = pm.id
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `, [order_id]);
      
      if (!order) {
        return errorResponse("Order not found", 404);
      }
      
      const items = await all(`
        SELECT oi.*, pu.unit_name, p.name as product_name
        FROM order_items oi
        LEFT JOIN product_units pu ON oi.unit_id = pu.id
        LEFT JOIN products p ON pu.product_id = p.id
        WHERE oi.order_id = ?
      `, [order_id]);
      
      order.items = items || [];
      
      return successResponse(order, "Order retrieved successfully");
    }

    // Get orders for specific user
    if (user_id) {
      const orders = await all(`
        SELECT o.*, pm.payment, pm.no_payment
        FROM orders o
        LEFT JOIN payment_methods pm ON o.payment_id = pm.id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
      `, [user_id]);
      
      return successResponse(orders, "Orders retrieved successfully");
    }

    // Admin management view with filtering
    // Build WHERE conditions
    let whereConditions = [];
    let params = [];

    if (status) {
      whereConditions.push('o.status = ?');
      params.push(status);
    }

    if (paymentStatus) {
      whereConditions.push('o.payment_status = ?');
      params.push(paymentStatus);
    }

    if (startDate && endDate) {
      whereConditions.push('DATE(o.created_at) BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }

    if (search) {
      whereConditions.push('o.order_number LIKE ?');
      params.push(`%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? 
      'WHERE ' + whereConditions.join(' AND ') : '';

    // Get orders with customer and payment method info
    const ordersQuery = `
      SELECT 
        o.*,
        u.name as customer_name,
        u.no_hp as customer_phone,
        pm.payment as payment_method,
        pm.no_payment as payment_number
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN payment_methods pm ON o.payment_id = pm.id
      ${whereClause}
      ORDER BY o.created_at DESC
    `;

    const orders = await all(ordersQuery, params);

    // Get order items for each order
    for (let order of orders) {
      const items = await all(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
    }

    // Get statistics
    const stats = await get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'menunggu' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'diproses' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'dikirim' THEN 1 ELSE 0 END) as shipped,
        SUM(CASE WHEN status = 'diterima' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'dibatalkan' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN payment_status = 'lunas' THEN total_amount ELSE 0 END) as totalRevenue
      FROM orders
    `);

    return NextResponse.json({
      orders,
      stats: {
        total: stats?.total || 0,
        pending: stats?.pending || 0,
        processing: stats?.processing || 0,
        shipped: stats?.shipped || 0,
        delivered: stats?.delivered || 0,
        cancelled: stats?.cancelled || 0,
        totalRevenue: stats?.totalRevenue || 0
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    return errorResponse('Failed to fetch orders');
  }
}

// Calculate discount for a specific unit
async function calculateItemDiscount(originalPrice, productId, unitId, discounts) {
  const activeDiscounts = discounts.filter(d => {
    if (d.type === 'product' && Array.isArray(d.product_ids)) {
      return d.product_ids.includes(productId);
    }
    if (d.type === 'unit' && Array.isArray(d.unit_ids)) {
      return d.unit_ids.includes(unitId);
    }
    return false;
  });

  if (activeDiscounts.length === 0) return 0;

  let finalPrice = originalPrice;
  let totalDiscount = 0;
  
  activeDiscounts.forEach(discount => {
    let discountAmount = 0;
    if (discount.value_type === 'percentage') {
      discountAmount = finalPrice * discount.value / 100;
    } else if (discount.value_type === 'nominal') {
      discountAmount = Math.min(discount.value, finalPrice);
    }
    finalPrice = Math.max(0, finalPrice - discountAmount);
    totalDiscount += discountAmount;
  });

  return totalDiscount;
}

// POST - Create new order (checkout)
export async function POST(request) {
  try {
    await init();
    const body = await request.json();
    
    // Validate input data
    const validationErrors = validateOrderData(body);
    if (validationErrors.length > 0) {
      return errorResponse(`Validation failed: ${validationErrors.join(", ")}`, 400);
    }
    
  const { user_id, payment_id, items, shipping_address, notes, shipping_type = 'delivery', source = 'cart', proof_base64 } = body;
    
    // Verify user exists
    const user = await get("SELECT id FROM users WHERE id = ?", [user_id]);
    if (!user) {
      return errorResponse("User not found", 404);
    }
    
    // Verify payment method exists
    const paymentMethod = await get("SELECT id FROM payment_methods WHERE id = ?", [payment_id]);
    if (!paymentMethod) {
      return errorResponse("Payment method not found", 404);
    }
    
    // Get active discounts
    const discounts = await all(`
      SELECT d.*, 
        GROUP_CONCAT(dp.product_id) as product_ids,
        GROUP_CONCAT(du.unit_id) as unit_ids
      FROM discount d
      LEFT JOIN discount_products dp ON d.id = dp.discount_id
      LEFT JOIN discount_units du ON d.id = du.discount_id
      WHERE d.active = 1
      GROUP BY d.id
    `);
    
    const processedDiscounts = (discounts || []).map(d => ({
      ...d,
      product_ids: d.product_ids ? d.product_ids.split(',').map(id => parseInt(id)) : [],
      unit_ids: d.unit_ids ? d.unit_ids.split(',').map(id => parseInt(id)) : []
    }));
    
    // Validate and process order items
    const processedItems = [];
    let totalAmount = 0;
    
    for (const item of items) {
      // Get unit details with product info
      const unit = await get(`
        SELECT pu.*, p.name as product_name, p.id as product_id
        FROM product_units pu
        LEFT JOIN products p ON pu.product_id = p.id
        WHERE pu.id = ?
      `, [item.unit_id]);
      
      if (!unit) {
        return errorResponse(`Unit with ID ${item.unit_id} not found`, 404);
      }
      
      // Check stock availability
      if (unit.stock < item.quantity) {
        return errorResponse(`Insufficient stock for ${unit.product_name} - ${unit.unit_name}. Available: ${unit.stock}, Requested: ${item.quantity}`, 400);
      }
      
      const originalPrice = Number(unit.price || 0);
      const discountAmount = await calculateItemDiscount(originalPrice, unit.product_id, unit.id, processedDiscounts);
      const finalPrice = originalPrice - discountAmount;
      const totalPrice = finalPrice * item.quantity;
      
      processedItems.push({
        unit_id: unit.id,
        product_name: unit.product_name,
        unit_name: unit.unit_name,
        quantity: item.quantity,
        unit_price: originalPrice,
        discount_amount: discountAmount,
        total_price: totalPrice
      });
      
      totalAmount += totalPrice;
    }
    
    // Generate order number
    const orderNumber = generateOrderNumber();
    
    // Save proof if provided and payment is not Cash
    let proofPath = null;
    const pm = await get('SELECT payment FROM payment_methods WHERE id = ?', [payment_id]);
    const isCash = pm && String(pm.payment || '').toLowerCase().includes('cash');
    if (!isCash && proof_base64) {
      const base = `order_${orderNumber}`;
      proofPath = await saveProofBase64(proof_base64, base);
    }

    // Create order and decrease stock inside a transaction for atomicity
    let orderId;
    try {
      await run('BEGIN TRANSACTION');

      const now = nowWIBForSQL();
      const orderResult = await run(`
        INSERT INTO orders (
          user_id, order_number, total_amount, status, payment_id, 
          payment_status, shipping_type, shipping_address, notes, proof_payment_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        user_id, orderNumber, totalAmount, 'menunggu', payment_id,
        'belum_bayar', String(shipping_type || 'delivery'), shipping_address || null, notes || null, proofPath, now, now
      ]);

      orderId = orderResult.lastID;

      // Insert order items and update stock
      for (const item of processedItems) {
        await run(`
          INSERT INTO order_items (
            order_id, unit_id, product_name, unit_name, quantity, 
            unit_price, discount_amount, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderId, item.unit_id, item.product_name, item.unit_name,
          item.quantity, item.unit_price, item.discount_amount, item.total_price
        ]);

        // Update stock; ensure stock cannot go below zero at DB level (app already checked availability)
        await run(`
          UPDATE product_units 
          SET stock = stock - ? 
          WHERE id = ?
        `, [item.quantity, item.unit_id]);
      }

      // Clear cart if order source is cart
      if (source === 'cart') {
        await run("DELETE FROM cart WHERE user_id = ?", [user_id]);
      }

      await run('COMMIT');
    } catch (txErr) {
      try { await run('ROLLBACK'); } catch (r) { console.warn('Rollback failed', r); }
      throw txErr;
    }
    
    // Get created order with details
    const createdOrder = await get(`
      SELECT o.*, pm.payment, pm.no_payment
      FROM orders o
      LEFT JOIN payment_methods pm ON o.payment_id = pm.id
      WHERE o.id = ?
    `, [orderId]);
    
    const orderItems = await all(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [orderId]);
    
    createdOrder.items = orderItems;
    
    return successResponse(createdOrder, "Order created successfully");
  } catch (error) {
    console.error("POST order error:", error);
    return errorResponse("Failed to create order");
  }
}

// PATCH - Update order status
export async function PATCH(request) {
  try {
    await init();
    const body = await request.json();
    const { id, status, payment_status, proof_base64 } = body;
    
    if (!id) {
      return errorResponse("Order ID is required", 400);
    }
    
    // Check if order exists
    const existingOrder = await get("SELECT * FROM orders WHERE id = ?", [id]);
    if (!existingOrder) {
      return errorResponse("Order not found", 404);
    }
    
    // Update order
    const updateFields = [];
    const updateValues = [];
    
      if (status !== undefined) {
        const statusMap = {
          pending: 'menunggu',
          processing: 'diproses',
          shipped: 'dikirim',
          delivered: 'diterima',
          cancelled: 'dibatalkan'
        };
        const normStatus = status ? (statusMap[status] || statusMap[status.toLowerCase()] || status) : null;
        if (normStatus) {
          updateFields.push("status = ?");
          updateValues.push(normStatus);
        }
      }
    
      if (payment_status !== undefined) {
        const paymentMap = {
          unpaid: 'belum_bayar',
          paid: 'lunas',
          partial: 'dp'
        };
        const normPayment = payment_status ? (paymentMap[payment_status] || paymentMap[payment_status.toLowerCase()] || payment_status) : null;
        if (normPayment) {
          updateFields.push("payment_status = ?");
          updateValues.push(normPayment);
        }
      }
    
    if (updateFields.length > 0) {
      updateFields.push("updated_at = ?");
      updateValues.push(nowWIBForSQL());
      updateValues.push(id);

      await run(`
        UPDATE orders 
        SET ${updateFields.join(", ")} 
        WHERE id = ?
      `, updateValues);
    }
    
    // Handle proof upload if provided
    if (proof_base64) {
      try {
        // save proof image under database/images/proof
        const base = `order_${existingOrder.order_number || existingOrder.id}`;
        const proofPath = await saveProofBase64(proof_base64, base);
    if (proofPath) {
      await run(`UPDATE orders SET proof_payment_path = ?, payment_status = ?, updated_at = ? WHERE id = ?`, [proofPath, payment_status || 'menunggu_konfirmasi', nowWIBForSQL(), id]);
    }
      } catch (e) {
        console.warn('Failed to save proof in PATCH:', e);
      }
    }
    
    // Get updated order
    const updatedOrder = await get(`
      SELECT o.*, pm.payment, pm.no_payment
      FROM orders o
      LEFT JOIN payment_methods pm ON o.payment_id = pm.id
      WHERE o.id = ?
    `, [id]);
    
    return successResponse(updatedOrder, "Order updated successfully");
  } catch (error) {
    console.error("PATCH order error:", error);
    return errorResponse("Failed to update order");
  }
}

// PUT - Update order (for admin order management)
export async function PUT(request) {
  try {
    await init();
    const { id, status, payment_status, notes } = await request.json();
    
    if (!id) {
      return errorResponse("Order ID is required", 400);
    }
    
    // Check if order exists
    const existingOrder = await get("SELECT * FROM orders WHERE id = ?", [id]);
    if (!existingOrder) {
      return errorResponse("Order not found", 404);
    }
    
      // Update order
      const updateFields = [];
      const updateValues = [];

      const statusMap = {
        pending: 'menunggu',
        processing: 'diproses',
        shipped: 'dikirim',
        delivered: 'diterima',
        cancelled: 'dibatalkan'
      };
      const paymentMap = {
        unpaid: 'belum_bayar',
        paid: 'lunas',
        partial: 'dp'
      };

      if (status !== undefined) {
        const normStatus = status ? (statusMap[status] || statusMap[status.toLowerCase()] || status) : null;
        if (normStatus) {
          updateFields.push("status = ?");
          updateValues.push(normStatus);
        }
      }

      if (payment_status !== undefined) {
        const normPayment = payment_status ? (paymentMap[payment_status] || paymentMap[payment_status.toLowerCase()] || payment_status) : null;
        if (normPayment) {
          updateFields.push("payment_status = ?");
          updateValues.push(normPayment);
        }
      }

      if (notes !== undefined) {
        updateFields.push("notes = ?");
        updateValues.push(notes);
      }
    
    if (updateFields.length > 0) {
      updateFields.push("updated_at = ?");
      updateValues.push(nowWIBForSQL());
      updateValues.push(id);

      await run(`
        UPDATE orders 
        SET ${updateFields.join(", ")} 
        WHERE id = ?
      `, updateValues);
    }
    
    // Get updated order with all details
    const updatedOrder = await get(`
      SELECT 
        o.*,
        u.name as customer_name,
        u.no_hp as customer_phone,
        pm.payment as payment_method,
        pm.no_payment as payment_number
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN payment_methods pm ON o.payment_id = pm.id
      WHERE o.id = ?
    `, [id]);
    
    return successResponse(updatedOrder, "Order updated successfully");
  } catch (error) {
    console.error("PUT order error:", error);
    return errorResponse("Failed to update order");
  }
}
