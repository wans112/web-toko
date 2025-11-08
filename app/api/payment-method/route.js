import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { init, get, all, run } from "@/lib/db";

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

// Validation function for payment method data
function validatePaymentMethodData(data) {
  const errors = [];
  
  if (!data.payment || typeof data.payment !== 'string' || data.payment.trim().length === 0) {
    errors.push("Payment method name is required and must be a non-empty string");
  }
  
  if (data.payment && data.payment.trim().length > 100) {
    errors.push("Payment method name must not exceed 100 characters");
  }
  
  if (data.no_payment && typeof data.no_payment !== 'string') {
    errors.push("Payment number must be a string");
  }
  
  if (data.no_payment && data.no_payment.length > 50) {
    errors.push("Payment number must not exceed 50 characters");
  }
  
  return errors;
}

// Format payment method for response
function formatPaymentMethod(paymentMethod) {
  return {
    id: paymentMethod.id,
    payment: paymentMethod.payment,
    no_payment: paymentMethod.no_payment || null,
    image_path: paymentMethod.image_path || null,
    // expose an image_url that the frontend can fetch to render the image
    image_url: paymentMethod.image_path ? `/api/payment-method?image=${encodeURIComponent(paymentMethod.image_path)}` : null
  };
}

// GET - Retrieve all payment methods or single payment method by ID
export async function GET(request) {
  try {
    await init();
    const { searchParams } = new URL(request.url);
    const image = searchParams.get("image");
    // Serve image file when image param is present
    if (image) {
      const imagesDir = path.join(process.cwd(), "database", "images", "payment");
      // prevent path traversal - only allow filename
      const filename = path.basename(image);
      const filePath = path.join(imagesDir, filename);

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }

      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      const buffer = fs.readFileSync(filePath);

      return new NextResponse(buffer, { status: 200, headers: { "Content-Type": contentType } });
    }

    const id = searchParams.get("id");
    
    if (id) {
      // Get single payment method
      const paymentMethod = await get("SELECT * FROM payment_methods WHERE id = ?", [id]);
      
      if (!paymentMethod) {
        return errorResponse("Payment method not found", 404);
      }
      
      return successResponse(formatPaymentMethod(paymentMethod), "Payment method retrieved successfully");
    } else {
      // Get all payment methods
      const paymentMethods = await all("SELECT * FROM payment_methods ORDER BY payment ASC");
      
      const formattedPaymentMethods = paymentMethods.map(formatPaymentMethod);
      
      return successResponse(formattedPaymentMethods, "Payment methods retrieved successfully");
    }
  } catch (error) {
    console.error("GET payment methods error:", error);
    return errorResponse("Failed to retrieve payment methods");
  }
}

// POST - Create new payment method
export async function POST(request) {
  try {
    await init();
    // support multipart/form-data uploads (for QRIS images) via request.formData()
    let body = {};
    let savedFilename = null;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body.payment = formData.get("payment");
      body.no_payment = formData.get("no_payment");

      const file = formData.get("qris_image");
      if (file && file.size && file.name) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const imagesDir = path.join(process.cwd(), "database", "images", "payment");
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
        const safeName = `${Date.now()}_${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const filePath = path.join(imagesDir, safeName);
        fs.writeFileSync(filePath, buffer);
        savedFilename = safeName;
      }
    } else {
      body = await request.json();
    }
    
    // Validate input data
    const validationErrors = validatePaymentMethodData(body);
    if (validationErrors.length > 0) {
      return errorResponse(`Validation failed: ${validationErrors.join(", ")}`, 400);
    }
    
    const { payment, no_payment } = body;
    
    // Check if payment method with same name already exists
    const existingPaymentMethod = await get(
      "SELECT id FROM payment_methods WHERE LOWER(payment) = LOWER(?)", 
      [payment.trim()]
    );
    
    if (existingPaymentMethod) {
      return errorResponse("Payment method with this name already exists", 409);
    }
    
    // Insert new payment method
    const result = await run(
      "INSERT INTO payment_methods (payment, no_payment, image_path) VALUES (?, ?, ?)",
      [payment.trim(), no_payment?.trim() || null, savedFilename]
    );
    
    if (result.changes === 0) {
      return errorResponse("Failed to create payment method");
    }
    
    // Retrieve the created payment method
    const newPaymentMethod = await get("SELECT * FROM payment_methods WHERE id = ?", [result.lastID]);
    
    return successResponse(formatPaymentMethod(newPaymentMethod), "Payment method created successfully");
  } catch (error) {
    console.error("POST payment method error:", error);
    return errorResponse("Failed to create payment method");
  }
}

// PATCH - Update existing payment method
export async function PATCH(request) {
  try {
    await init();
    // support multipart/form-data for updates
    let body = {};
    let savedFilename = null;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body.id = formData.get("id");
      body.payment = formData.get("payment");
      body.no_payment = formData.get("no_payment");

      const file = formData.get("qris_image");
      if (file && file.size && file.name) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const imagesDir = path.join(process.cwd(), "database", "images", "payment");
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
        const safeName = `${Date.now()}_${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const filePath = path.join(imagesDir, safeName);
        fs.writeFileSync(filePath, buffer);
        savedFilename = safeName;
      }
    } else {
      body = await request.json();
    }

    const { id, payment, no_payment } = body;
    
    if (!id) {
      return errorResponse("Payment method ID is required", 400);
    }
    
    // Validate input data
    const validationErrors = validatePaymentMethodData({ payment, no_payment });
    if (validationErrors.length > 0) {
      return errorResponse(`Validation failed: ${validationErrors.join(", ")}`, 400);
    }
    
    // Check if payment method exists
    const existingPaymentMethod = await get("SELECT * FROM payment_methods WHERE id = ?", [id]);
    
    if (!existingPaymentMethod) {
      return errorResponse("Payment method not found", 404);
    }
    
    // Check if another payment method with same name exists (excluding current one)
    if (payment && payment.trim() !== existingPaymentMethod.payment) {
      const duplicatePaymentMethod = await get(
        "SELECT id FROM payment_methods WHERE LOWER(payment) = LOWER(?) AND id != ?",
        [payment.trim(), id]
      );
      
      if (duplicatePaymentMethod) {
        return errorResponse("Another payment method with this name already exists", 409);
      }
    }
    
    // Update payment method
    const newImagePath = savedFilename || existingPaymentMethod.image_path;

    const result = await run(
      "UPDATE payment_methods SET payment = ?, no_payment = ?, image_path = ? WHERE id = ?",
      [
        payment?.trim() || existingPaymentMethod.payment,
        no_payment?.trim() || existingPaymentMethod.no_payment,
        newImagePath,
        id
      ]
    );
    
    if (result.changes === 0) {
      return errorResponse("Failed to update payment method");
    }
    
    // Retrieve the updated payment method
    const updatedPaymentMethod = await get("SELECT * FROM payment_methods WHERE id = ?", [id]);
    
    return successResponse(formatPaymentMethod(updatedPaymentMethod), "Payment method updated successfully");
  } catch (error) {
    console.error("PATCH payment method error:", error);
    return errorResponse("Failed to update payment method");
  }
}

// DELETE - Remove payment method
export async function DELETE(request) {
  try {
    await init();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return errorResponse("Payment method ID is required", 400);
    }
    
    // Check if payment method exists
    const existingPaymentMethod = await get("SELECT * FROM payment_methods WHERE id = ?", [id]);
    
    if (!existingPaymentMethod) {
      return errorResponse("Payment method not found", 404);
    }
    
    // Check if payment method is being used in orders
    const ordersUsingPayment = await get("SELECT COUNT(*) as count FROM orders WHERE payment_id = ?", [id]);
    
    if (ordersUsingPayment.count > 0) {
      return errorResponse(
        `Cannot delete payment method. It is currently being used in ${ordersUsingPayment.count} order(s)`,
        409
      );
    }
    
    // Delete payment method
    const result = await run("DELETE FROM payment_methods WHERE id = ?", [id]);
    
    if (result.changes === 0) {
      return errorResponse("Failed to delete payment method");
    }
    
    return successResponse(
      { id: parseInt(id), payment: existingPaymentMethod.payment },
      "Payment method deleted successfully"
    );
  } catch (error) {
    console.error("DELETE payment method error:", error);
    return errorResponse("Failed to delete payment method");
  }
}