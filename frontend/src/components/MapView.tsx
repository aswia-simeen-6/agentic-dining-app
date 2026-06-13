import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import 'leaflet/dist/leaflet.css'
import type { Restaurant } from '../types/api'

interface MapViewProps {
  restaurants: Restaurant[]
  rankMap: Map<string, number>
}

export function MapView({ restaurants, rankMap }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Dynamically import leaflet to avoid SSR issues
    let cleanup: (() => void) | undefined

    void (async () => {
      const L = (await import('leaflet')).default

      // Fix leaflet default icon bug
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Detect dark mode
      const isDark = document.documentElement.classList.contains('dark')

      const lightTiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      const darkTiles =
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

      const tileUrl = isDark ? darkTiles : lightTiles
      const attribution = isDark
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      if (!containerRef.current) return

      const map = L.map(containerRef.current, { zoomControl: true })
      mapRef.current = map

      L.tileLayer(tileUrl, { attribution, maxZoom: 18 }).addTo(map)

      const validRestaurants = restaurants.filter(
        (r): r is Restaurant & { lat: number; lng: number } =>
          r.lat !== null && r.lng !== null,
      )

      if (validRestaurants.length === 0) {
        map.setView([40.7128, -74.006], 12)
        return
      }

      const bounds: [number, number][] = []

      for (const r of validRestaurants) {
        const isTop = rankMap.get(r.place_id) === 1
        const rank = rankMap.get(r.place_id)

        // Create custom colored icon
        const color = isTop ? '#9333ea' : '#6b7280'
        const svgIcon = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
              fill="${color}" stroke="white" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="5" fill="white"/>
            ${rank !== undefined ? `<text x="12" y="16" text-anchor="middle" font-size="7" font-weight="bold" fill="${color}">${rank}</text>` : ''}
          </svg>`

        const icon = L.divIcon({
          html: svgIcon,
          className: '',
          iconSize: [24, 36],
          iconAnchor: [12, 36],
          popupAnchor: [0, -36],
        })

        const stars = r.rating !== null ? `${'★'.repeat(Math.round(r.rating))}${'☆'.repeat(5 - Math.round(r.rating))} (${r.rating})` : 'No rating'
        const cuisine = r.cuisine_types.slice(0, 2).join(', ') || 'Restaurant'

        const popup = L.popup({ maxWidth: 220 }).setContent(`
          <div style="font-family:system-ui,sans-serif;padding:4px 2px">
            <strong style="font-size:14px;display:block;margin-bottom:4px">${r.name}</strong>
            <span style="color:#9333ea;font-size:12px">${stars}</span><br/>
            <span style="color:#6b7280;font-size:11px">${cuisine}</span>
            ${isTop ? '<br/><span style="background:#9333ea;color:white;font-size:10px;padding:2px 6px;border-radius:9999px;display:inline-block;margin-top:4px">#1 Pick</span>' : ''}
          </div>
        `)

        L.marker([r.lat, r.lng], { icon }).addTo(map).bindPopup(popup)
        bounds.push([r.lat, r.lng])
      }

      if (bounds.length === 1) {
        map.setView(bounds[0], 15)
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] })
      }

      cleanup = () => {
        map.remove()
        mapRef.current = null
      }
    })()

    return () => {
      cleanup?.()
    }
  }, [restaurants, rankMap])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm mb-8"
    >
      <div
        ref={containerRef}
        className="w-full h-[320px] md:h-[400px]"
        aria-label="Restaurant map"
      />
    </motion.div>
  )
}
