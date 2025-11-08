"use client";

import React, { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  // ArcElement removed (no doughnut)
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
} from 'chart.js';
import { Card, Spin, Typography, Modal, Select, DatePicker, Space } from 'antd';

ChartJS.register(
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title
);

const { Title: HTitle, Text } = Typography;

export default function StatistikPenjualan() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    totalRevenue: 0,
  });
  const [recentByDay, setRecentByDay] = useState([]); // [{date: '2025-09-01', total: 123}, ...]
  const [productStats, setProductStats] = useState([]); // [{name: 'Produk A', qty: 10}, ...]
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [dayTopModalOpen, setDayTopModalOpen] = useState(false);
  const [selectedDayTopList, setSelectedDayTopList] = useState(null);
  const [dayTopMap, setDayTopMap] = useState({}); // { '2025-09-01': [{name, qty}, ...] }
  const [dayProductMapState, setDayProductMapState] = useState({});
  const [period, setPeriod] = useState('7d'); // '7d'|'30d'|'1y'|'custom'
  const [customRange, setCustomRange] = useState(null); // [moment, moment]
  const [customGranularity, setCustomGranularity] = useState('daily'); // 'daily'|'monthly'

  // Derive a stable scalar key from customRange (moment objects) so the
  // useEffect dependency array has a constant size and doesn't trigger
  // "changed size between renders" React warning when customRange is an array.
  const customRangeKey = (customRange && Array.isArray(customRange) && customRange[0] && customRange[1])
    ? `${customRange[0].valueOf()}|${customRange[1].valueOf()}`
    : null;

  useEffect(() => {
    let mounted = true;
  async function fetchStats() {
  if (mounted) setLoading(true);
      try {
        const res = await fetch('/api/order');
        if (!res.ok) throw new Error('Failed fetching stats');
        const json = await res.json();
        const s = json.stats || {};
        const orders = json.orders || [];

        // Only consider completed and paid orders for sales statistics
        const filteredOrders = (orders || []).filter(o => {
          return String(o.status || '').toLowerCase() === 'diterima' &&
                 String(o.payment_status || '').toLowerCase() === 'lunas';
        });
        // Determine date keys (daily or monthly) according to selected period
        const toLocalDate = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        function formatDay(d) { return d.toISOString().slice(0,10); }
        function formatMonth(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

        const today = new Date();
        let dateKeys = [];
        let granularity = 'daily';
        if (period === '7d') {
          granularity = 'daily';
          for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
            d.setUTCDate(d.getUTCDate() - i);
            dateKeys.push(formatDay(d));
          }
        } else if (period === '30d') {
          granularity = 'daily';
          for (let i = 29; i >= 0; i--) {
            const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
            d.setUTCDate(d.getUTCDate() - i);
            dateKeys.push(formatDay(d));
          }
        } else if (period === '1y') {
          granularity = 'monthly';
          const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          for (let i = 11; i >= 0; i--) {
            const d = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - i, 1);
            dateKeys.push(formatMonth(d));
          }
        } else if (period === 'custom' && customRange) {
          granularity = customGranularity === 'monthly' ? 'monthly' : 'daily';
          const [mStart, mEnd] = customRange;
          const start = new Date(mStart.year(), mStart.month(), mStart.date ? mStart.date() : 1);
          const end = new Date(mEnd.year(), mEnd.month(), mEnd.date ? mEnd.date() : 1);
          if (granularity === 'daily') {
            const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
            for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) dateKeys.push(formatDay(new Date(d)));
          } else {
            // monthly
            const s = new Date(start.getFullYear(), start.getMonth(), 1);
            const e = new Date(end.getFullYear(), end.getMonth(), 1);
            for (let d = new Date(s); d <= e; d.setMonth(d.getMonth()+1)) dateKeys.push(formatMonth(new Date(d)));
          }
        }

        // Build map keyed by dateKeys (day or month)
        const map = {};
        dateKeys.forEach(k => map[k] = 0);

        (filteredOrders || []).forEach(o => {
          try {
            if (!o || !o.created_at) return;
            const dt = new Date(o.created_at);
            if (isNaN(dt)) return;
            const key = (granularity === 'monthly') ? formatMonth(dt) : formatDay(dt);
            if (key in map) map[key] = (map[key] || 0) + (Number(o.total_amount) || 0);
          } catch (e) { /* ignore */ }
        });

        const dayPairs = dateKeys.map(k => ({ date: k, total: map[k] || 0, granularity }));

        // Prepare per-day (or per-month) product totals and unit breakdowns
        // dayProdMap: { 'YYYY-MM-DD' or 'YYYY-MM': { productName: { total, units: {unitName: qty}} } }
        const dayProdMap = {};
        (filteredOrders || []).forEach(o => {
          // determine order date key using the same granularity as dateKeys
          let key = 'unknown';
          try {
            if (o && o.created_at) {
              const dt = new Date(o.created_at);
              if (!isNaN(dt)) key = (granularity === 'monthly') ? formatMonth(dt) : formatDay(dt);
              else key = (String(o.created_at)||'').split('T')[0].split(' ')[0] || 'unknown';
            }
          } catch (e) { key = 'unknown'; }
          if (!dayProdMap[key]) dayProdMap[key] = {};
          (o.items || []).forEach(it => {
            const name = it.product_name || it.unit_name || 'Unknown';
            const unitName = it.unit_name || 'Unit';
            const qty = Number(it.quantity || 0);
            if (!dayProdMap[key][name]) dayProdMap[key][name] = { total: 0, units: {} };
            dayProdMap[key][name].total += qty;
            dayProdMap[key][name].units[unitName] = (dayProdMap[key][name].units[unitName] || 0) + qty;
          });
        });

        // For each dateKey produce full product list for that period key
        const dayTop = {};
        dateKeys.forEach(k => {
          const prodObj = dayProdMap[k] || {};
          const arr = Object.keys(prodObj).map(n => ({ name: n, total: prodObj[n].total, units: prodObj[n].units }));
          arr.sort((a,b) => b.total - a.total);
          dayTop[k] = arr; // full list (no top-10 slicing)
        });

        // Compute union of all product names across the period
        const unionNames = new Set();
        dateKeys.forEach(k => {
          const pm = dayProdMap[k] || {};
          Object.keys(pm).forEach(n => unionNames.add(n));
        });

        // Compute overall totals for union names across period (no top-10 limit)
        const overallTotals = [];
        unionNames.forEach(name => {
          let tot = 0;
          dateKeys.forEach(k => { if (dayProdMap[k] && dayProdMap[k][name]) tot += dayProdMap[k][name].total; });
          overallTotals.push({ name, total: tot });
        });
        overallTotals.sort((a,b) => b.total - a.total);
        const topNames = overallTotals.map(p => p.name); // all products, sorted by total

        // Build productStats as list of products with total and units merged across period
        const prodPairs = topNames.map(n => {
          // compute total and merged units
          let total = 0; const units = {};
            dateKeys.forEach(k => {
              if (dayProdMap[k] && dayProdMap[k][n]) {
                total += dayProdMap[k][n].total;
                Object.keys(dayProdMap[k][n].units || {}).forEach(u => {
                  units[u] = (units[u] || 0) + dayProdMap[k][n].units[u];
                });
              }
            });
          return { name: n, total, units };
        });

  // Save dayTop map and full day product map for modal/tooltips
  if (!mounted) return;
  setDayTopMap(dayTop);
  setDayProductMapState(dayProdMap);

        if (!mounted) return;
        setStats({
          total: s.total || 0,
          pending: s.pending || 0,
          processing: s.processing || 0,
          shipped: s.shipped || 0,
          delivered: s.delivered || 0,
          cancelled: s.cancelled || 0,
          totalRevenue: s.totalRevenue || 0,
        });
  setRecentByDay(dayPairs);
  setProductStats(prodPairs);
      } catch (err) {
        console.error('Failed loading stats', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchStats();
    return () => (mounted = false);
  }, [period, customRangeKey, customGranularity]);

  // doughnut removed per request

  const barData = {
    labels: recentByDay.map(d => d.date),
    datasets: [
      {
        label: 'Pendapatan (terakhir 7 hari)',
        data: recentByDay.map(d => d.total),
        backgroundColor: 'rgba(24,144,255,0.6)'
      }
    ]
  };

  const formatRupiah = (v) => {
    try {
      return `Rp ${Number(v || 0).toLocaleString('id-ID')}`;
    } catch (e) {
      return `Rp ${v}`;
    }
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Statistik Omset' },
      tooltip: {
        callbacks: {
          label: function(context) {
            const val = context.parsed && typeof context.parsed.y !== 'undefined' ? context.parsed.y : context.raw;
            return `Omset: ${formatRupiah(val)}`;
          }
        }
      }
    },
    onHover: (event, elements) => {
      const target = event.native ? event.native.target : (event?.target || null);
      if (target) target.style.cursor = elements && elements.length ? 'pointer' : 'default';
    }
  };

  // Build line datasets: one dataset per top product across last7 days
  const last7 = recentByDay.map(d => d.date);
  const lineLabels = last7;
  const lineDatasets = productStats.map((p, idx) => ({
    label: p.name,
    data: last7.map(k => {
      // value on that day
  const v = (dayProductMapState[k] && dayProductMapState[k][p.name]) ? dayProductMapState[k][p.name] : null;
      return v ? v.total : 0;
    }),
    fill: false,
    borderColor: `hsl(${(idx * 36) % 360} 80% 50%)`,
    backgroundColor: `hsl(${(idx * 36) % 360} 80% 50%)`,
    tension: 0.2,
  }));

  const lineDataMultiple = { labels: lineLabels, datasets: lineDatasets };

  const lineOptionsMultiple = {
    responsive: true,
    plugins: {
      legend: { display: true, position: 'bottom' },
      title: { display: true, text: 'Statistik Penjualan Produk' },
      tooltip: {
        callbacks: {
          title: (ctx) => ctx[0]?.label || '',
          label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue || ctx.raw}`,
          afterBody: (ctx) => {
            // ctx[0] contains datasetIndex and dataIndex
            const item = ctx[0];
            if (!item) return [];
            const dayIndex = item.dataIndex;
            const productName = item.dataset.label;
            const dayKey = last7[dayIndex];
            if (!dayKey || !dayProductMapState[dayKey] || !dayProductMapState[dayKey][productName]) return [];
            const units = dayProductMapState[dayKey][productName].units || {};
            return Object.keys(units).map(u => `${u}: ${units[u]}`);
          }
        }
      }
    },
    onHover: (event, elements) => {
      const target = event.native ? event.native.target : (event?.target || null);
      if (target) target.style.cursor = elements && elements.length ? 'pointer' : 'default';
    }
  };

  return (
    <>
    <Card style={{ width: '100%' }} title={<HTitle level={4}>Statistik Penjualan</HTitle>}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 300 }}>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
              <Space>
                <Select value={period} onChange={(v) => setPeriod(v)} style={{ width: 180 }} options={[
                  { label: '7 hari terakhir', value: '7d' },
                  { label: '30 hari terakhir', value: '30d' },
                  { label: '1 tahun terakhir (per bulan)', value: '1y' },
                  { label: 'Custom', value: 'custom' }
                ]} />

                {period === 'custom' && (
                  <>
                    <Select value={customGranularity} onChange={(v)=>setCustomGranularity(v)} style={{ width: 140 }} options={[{label: 'Per hari', value: 'daily'}, {label: 'Per bulan', value: 'monthly'}]} />
                    <DatePicker.RangePicker onChange={(r)=>setCustomRange(r)} />
                  </>
                )}
              </Space>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18 }}>
              <Card size="small" variant="outlined" style={{ padding: 12 }}>
                <div style={{ minHeight: 200 }}>
                  <Bar data={barData} options={barOptions} onClick={(evt, elements) => {
                    if (!elements || !elements.length) return;
                    const el = elements[0];
                    const idx = el.index;
                    const day = recentByDay[idx];
                    setSelectedDay(day);
                    setModalOpen(true);
                  }} />
                </div>
              </Card>

              <Card size="small" variant="outlined" style={{ padding: 12 }}>
                <div style={{ minHeight: 200 }}>
                  <Line data={lineDataMultiple} options={lineOptionsMultiple} onClick={(evt, elements) => {
                    if (!elements || !elements.length) return;
                    // elements[0] may be a point: datasetIndex and index
                    const el = elements[0];
                    const dayIdx = el.index;
                    const datasetIdx = el.datasetIndex;
                    const dayKey = last7[dayIdx];
                    const product = productStats[datasetIdx];
                    if (product && dayKey) {
                      const units = (dayProductMapState[dayKey] && dayProductMapState[dayKey][product.name]) ? dayProductMapState[dayKey][product.name].units : {};
                      setSelectedProductDetail({ name: product.name, units });
                      setProductModalOpen(true);
                    }
                  }} />
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </Card>

    {selectedDay && (
      <Modal
        title={`Pendapatan untuk ${selectedDay.date}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <p><strong>{formatRupiah(selectedDay.total)}</strong></p>
      </Modal>
    )}

    {selectedProductDetail && (
      <Modal
        title={`${selectedProductDetail.name} — Detail Unit`}
        open={productModalOpen}
        onCancel={() => setProductModalOpen(false)}
        footer={null}
      >
        <div>
          {Object.keys(selectedProductDetail.units || {}).map(k => (
            <p key={k}><strong>{k}:</strong> {selectedProductDetail.units[k]}</p>
          ))}
        </div>
      </Modal>
    )}

    {selectedDayTopList && (
      <Modal
        title={`Top produk pada ${selectedDayTopList.date}`}
        open={dayTopModalOpen}
        onCancel={() => setDayTopModalOpen(false)}
        footer={null}
      >
        <div>
          {selectedDayTopList.list.map((p, i) => (
            <p key={p.name}><strong>{i+1}. {p.name}</strong> — {p.total} unit</p>
          ))}
        </div>
      </Modal>
    )}
    </>
  );
}
