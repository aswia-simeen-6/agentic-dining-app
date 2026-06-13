import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, MapPin, Clock, Globe, Phone, UtensilsCrossed, ExternalLink, Navigation } from 'lucide-react'
import clsx from 'clsx'
import type { Restaurant } from '../types/api'

interface RestaurantCardProps {
  restaurant: Restaurant
  index: number
  rank?: number
  isSelected?: boolean
  onClick?: () => void
}

function PriceLevel({ level }: { level: number | null }) {
  if (level === null) return null
  const filled = level
  const empty = 4 - level
  return (
    <span className="text-sm font-medium">
      <span className="text-brand-600 dark:text-brand-400">{'$'.repeat(filled)}</span>
      <span className="text-gray-300 dark:text-gray-600">{'$'.repeat(empty)}</span>
    </span>
  )
}

function StarRating({ rating, count }: { rating: number | null; count: number | null }) {
  if (rating === null) return null
  return (
    <div className="flex items-center gap-1">
      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
        {rating.toFixed(1)}
      </span>
      {count !== null && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({count.toLocaleString()})
        </span>
      )}
    </div>
  )
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={clsx(
            'w-3 h-3',
            i < rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600',
          )}
        />
      ))}
    </div>
  )
}

export function RestaurantCard({ restaurant, index, rank, isSelected = false, onClick }: RestaurantCardProps) {
  const [imgError, setImgError] = useState(false)

  const visibleReviews = restaurant.reviews.slice(0, 2)

  const gradients = [
    'from-brand-600 to-purple-800',
    'from-indigo-500 to-brand-700',
    'from-violet-600 to-fuchsia-600',
  ]
  const gradientClass = gradients[index % gradients.length]

  const encodedName = encodeURIComponent(restaurant.name)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedName}&query_place_id=${restaurant.place_id}`
  const openTableUrl = `https://www.opentable.com/s/?term=${encodedName}&covers=2`

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.1,
        duration: 0.3,
        ease: 'easeOut',
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      className={clsx(
        'relative flex flex-col rounded-2xl overflow-hidden',
        'bg-white dark:bg-gray-800',
        'border border-gray-200 dark:border-gray-700',
        'shadow-sm hover:shadow-lg dark:hover:shadow-gray-900/50',
        'transition-shadow duration-300',
        onClick && 'cursor-pointer',
        isSelected && 'ring-2 ring-brand-500 shadow-lg',
        !isSelected && rank === 1 && 'ring-2 ring-amber-400',
      )}
    >
      {/* Rank badge */}
      {rank !== undefined && (
        <div className="absolute top-3 left-3 z-10">
          <span
            className={clsx(
              'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shadow-md',
              rank === 1
                ? 'bg-amber-500'
                : rank === 2
                  ? 'bg-gray-400'
                  : 'bg-amber-700',
            )}
          >
            #{rank}
          </span>
        </div>
      )}

      {/* Photo */}
      <div className="relative h-44 overflow-hidden shrink-0">
        {restaurant.photo_url && !imgError ? (
          <img
            src={restaurant.photo_url}
            alt={`Photo of ${restaurant.name}`}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className={clsx(
              'w-full h-full bg-gradient-to-br flex items-center justify-center',
              gradientClass,
            )}
          >
            <UtensilsCrossed className="w-12 h-12 text-white/50" />
          </div>
        )}
        {/* Subtle overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Header */}
        <div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-snug line-clamp-1">
            {restaurant.name}
          </h3>

          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <StarRating rating={restaurant.rating} count={restaurant.rating_count} />
            <PriceLevel level={restaurant.price_level} />
          </div>
        </div>

        {/* Cuisine tags */}
        {restaurant.cuisine_types.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {restaurant.cuisine_types.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Details */}
        <div className="flex flex-col gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          {restaurant.address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
              <span className="line-clamp-2">{restaurant.address}</span>
            </div>
          )}
          {restaurant.hours && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              <span className="line-clamp-1">{restaurant.hours}</span>
            </div>
          )}
          {restaurant.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              <a
                href={`tel:${restaurant.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                {restaurant.phone}
              </a>
            </div>
          )}
          {restaurant.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              <a
                href={restaurant.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate"
              >
                {restaurant.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        {/* Menu summary */}
        {restaurant.menu_summary && (
          <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 italic">
            {restaurant.menu_summary}
          </div>
        )}

        {/* Reviews — required for Google Places ToS */}
        {visibleReviews.length > 0 && (
          <div className="flex flex-col gap-3 pt-1 border-t border-gray-100 dark:border-gray-700/60">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">
              Guest Reviews
            </p>
            {visibleReviews.map((review, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={review.author_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate"
                  >
                    {review.author_name}
                  </a>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ReviewStars rating={review.rating} />
                    <span className="text-xs text-gray-400">{review.relative_time}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                  {review.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action bar — expands when card is selected */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-700/60"
          >
            <div className="flex gap-2 p-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                Google Maps
              </a>
              <a
                href={openTableUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-semibold border border-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                OpenTable
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}
