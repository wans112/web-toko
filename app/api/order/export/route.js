import { init, all } from '@/lib/db';

function escapeCsvCell(v) {
  if (v === null || typeof v === 'undefined') return '';
  const s = String(v);
  // escape quotes and remove newlines that would break CSV structure
  return '"' + s.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
}

export async function GET(req) {
  await init();
  try {
    const url = new URL(req.url);
    const format = (url.searchParams.get('format') || 'csv').toLowerCase();
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const status = url.searchParams.get('status');
    const paymentStatus = url.searchParams.get('paymentStatus');

    // Build SQL with optional filters
    const params = [];
    let where = ' WHERE 1=1 ';
    if (startDate) {
      where += ' AND date(o.created_at) >= ? ';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND date(o.created_at) <= ? ';
      params.push(endDate);
    }
    if (status) {
      where += ' AND o.status = ? ';
      params.push(status);
    }
    if (paymentStatus) {
      where += ' AND o.payment_status = ? ';
      params.push(paymentStatus);
    }

  const sql = `SELECT o.order_number, o.created_at, o.total_amount, o.status, o.payment_status, o.payment_id, o.shipping_type, o.shipping_address, oi.product_name, oi.unit_name, oi.quantity, oi.unit_price, oi.discount_amount, oi.total_price
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${where}
      ORDER BY o.created_at ASC`;

    const rows = await all(sql, params);

    if (format === 'csv') {
      const header = [
        'order_number','created_at','total_amount','status','payment_status','payment_id','shipping_type','shipping_address','product_name','unit_name','quantity','unit_price','discount_amount','total_price'
      ];
      const lines = [header.join(',')];
      for (const r of rows) {
        const line = [
          escapeCsvCell(r.order_number),
          escapeCsvCell(r.created_at),
          escapeCsvCell(r.total_amount),
          escapeCsvCell(r.status),
          escapeCsvCell(r.payment_status),
          escapeCsvCell(r.payment_id),
          escapeCsvCell(r.shipping_type),
          escapeCsvCell(r.shipping_address),
          escapeCsvCell(r.product_name),
          escapeCsvCell(r.unit_name),
          escapeCsvCell(r.quantity),
          escapeCsvCell(r.unit_price),
          escapeCsvCell(r.discount_amount),
          escapeCsvCell(r.total_price),
        ].join(',');
        lines.push(line);
      }
      const csv = lines.join('\n');
      const filename = `orders-${new Date().toISOString().slice(0,10)}.csv`;
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        }
      });
    }

    return new Response(JSON.stringify(rows), { status: 200 });
  } catch (err) {
    console.error('order export error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
