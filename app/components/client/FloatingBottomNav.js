'use client'
import React from 'react'

const DEFAULT_PRIMARY_COLOR = '#73d13d'

function normalizeHex(value) {
  if (typeof value !== 'string') return DEFAULT_PRIMARY_COLOR
  const trimmed = value.trim().toLowerCase()
  if (!trimmed.startsWith('#')) return DEFAULT_PRIMARY_COLOR
  if (/^#([0-9a-f]{3})$/.test(trimmed)) return trimmed
  if (/^#([0-9a-f]{6})$/.test(trimmed)) return trimmed
  if (/^#([0-9a-f]{8})$/.test(trimmed)) return trimmed.slice(0, 7)
  return DEFAULT_PRIMARY_COLOR
}

function hexToRgba(hex, alpha = 1) {
  const normalized = normalizeHex(hex)
  const value = normalized.length === 4
    ? normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3]
    : normalized.slice(1)
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * FloatingBottomNav
 * Properti:
 * - menuItems: Array<{ id, label, icon: ReactComponent, onClick?: fn, component?: ReactNode }>
 *   - Daftar menu navigasi bawah. Setiap item memiliki id, label, icon, fungsi onClick (opsional), dan komponen yang akan ditampilkan.
 * - bottom: string (offset bottom tailwind, default: 'bottom-4')
 *   - Jarak dari bawah layar.
 * - maxWidth: string (maksimal lebar tailwind, default: 'max-w-lg')
 *   - Maksimal lebar navigasi.
 * - className: string (kelas tambahan opsional)
 *   - Untuk menambah kelas CSS custom.
 * - initialActiveId: string (opsional)
 *   - id menu yang aktif saat pertama kali render.
 * - onActiveIdChange: function (opsional)
 *   - Callback yang dipanggil saat activeId berubah.
 *
 * Contoh Penggunaan:
 * <FloatingBottomNav
 *   menuItems={[
 *     {id:'home', label:'Home', icon: HomeIcon, component: <HomeComponent />},
 *     {id:'produk', label:'Produk', icon: ShoppingCart, component: <>
 *       <CartClient />
 *     </>},
 *     ...
 *   ]}
 *   initialActiveId="produk"
 *   onActiveIdChange={(id) => console.log('Active ID changed to:', id)}
 * />
 */
export default function FloatingBottomNav({ menuItems = [], bottom = 'bottom-4', maxWidth = 'max-w-lg', className = '', initialActiveId = null, onActiveIdChange = null }) {
  // active item state (renders component)
  const [activeId, setActiveId] = React.useState(initialActiveId || menuItems[0]?.id || null)
  const [primaryColor, setPrimaryColor] = React.useState(DEFAULT_PRIMARY_COLOR)

  // Update activeId when initialActiveId changes
  React.useEffect(() => {
    if (initialActiveId && initialActiveId !== activeId) {
      setActiveId(initialActiveId);
    }
  }, [initialActiveId]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const sync = () => {
      try {
        const cssValue = getComputedStyle(document.documentElement).getPropertyValue('--app-primary-color')
        setPrimaryColor(normalizeHex(cssValue || ''))
      } catch (err) {
        setPrimaryColor(DEFAULT_PRIMARY_COLOR)
      }
    }
    sync()
    const handler = (event) => {
      const raw = event?.detail?.primaryColor
      if (typeof raw === 'string' && raw) {
        setPrimaryColor(normalizeHex(raw))
      } else {
        sync()
      }
    }
    window.addEventListener('themeUpdated', handler)
    window.addEventListener('themeApplied', handler)
    return () => {
      window.removeEventListener('themeUpdated', handler)
      window.removeEventListener('themeApplied', handler)
    }
  }, [])

  const handleSetActiveId = (id) => {
    setActiveId(id);
    if (onActiveIdChange) {
      onActiveIdChange(id);
    }
  };

  // columns equal to number of menu items
  const cols = Math.max(1, menuItems.length)
  // determine active item and nav styles
  const activeItem = menuItems.find((m) => m.id === activeId) || null
  const accentColor = activeItem?.navAccent || activeItem?.accent || primaryColor
  const navStyle = activeItem?.navStyle || {}
  const navBorder = navStyle.border || `1px solid ${hexToRgba(primaryColor, 0.25)}`
  const navShadow = navStyle.boxShadow || `0 6px 18px ${hexToRgba(primaryColor, 0.12)}`
  const navBackground = navStyle.background || '#fff'

  return (
    <div className={`relative ${className}`}>
      {/* Active content: add responsive bottom padding so content never hidden by nav */}
      <div className="w-full" style={{ paddingBottom: '84px' }}>
        <div className="md:pb-14">{menuItems.find((m) => m.id === activeId)?.component}</div>
      </div>

      {/* Nav: floating pill centered and rounded on all screens */}
      <div className={`fixed z-50 left-1/2 -translate-x-1/2 ${maxWidth} ${bottom} px-4`}>
        <div
          className="rounded-full shadow-md"
          style={{
            overflow: 'hidden',
            background: navBackground,
            border: navBorder,
            boxShadow: navShadow,
          }}
        >
          <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {menuItems.map((item) => (
              <NavButton key={item.id} item={item} setActiveId={handleSetActiveId} activeId={activeId} accentColor={accentColor} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function NavButton({ item, setActiveId, activeId, accentColor = DEFAULT_PRIMARY_COLOR }) {
  const Icon = item.icon
  const handleClick = (e) => {
    if (item.onClick) {
      item.onClick(e)
    }
    // if item has a component, set it as active (default behaviour)
    if (item.component && setActiveId) setActiveId(item.id)
  }
  const isActive = activeId === item.id
  const activeBg = hexToRgba(accentColor, 0.16)
  return (
    <div className="relative flex items-center justify-center h-full">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex flex-col items-center justify-center px-5 h-full w-full group rounded-full"
        aria-label={item.label}
        style={{
          height: '100%',
          backgroundColor: isActive ? activeBg : 'transparent',
          color: isActive ? accentColor : undefined,
        }}
      >
        <span className="flex items-center justify-center h-full">
          {Icon && (
            <span className="w-5 h-5" style={{ color: isActive ? accentColor : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {React.createElement(Icon)}
            </span>
          )}
        </span>
        <span className="sr-only">{item.label}</span>
      </button>

      {/* Tooltip (simple) */}
      {item.label && (
        <div className="pointer-events-none absolute -top-10 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 shadow">
            {item.label}
          </div>
        </div>
      )}
    </div>
  )
}
