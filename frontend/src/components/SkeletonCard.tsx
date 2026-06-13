export function SkeletonCard() {
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
      aria-hidden="true"
    >
      {/* Photo skeleton */}
      <div className="h-44 bg-gray-200 dark:bg-gray-700 animate-pulse" />

      {/* Content skeleton */}
      <div className="flex flex-col gap-3 p-4">
        {/* Title */}
        <div className="flex flex-col gap-2">
          <div className="h-5 w-3/4 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>

        {/* Tags */}
        <div className="flex gap-2">
          <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-5 w-14 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>

        {/* Details */}
        <div className="flex flex-col gap-2">
          <div className="h-4 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-4 w-2/3 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-4 w-1/2 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>

        {/* Review block */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2">
          <div className="h-3 w-24 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="flex flex-col gap-1">
            <div className="h-3 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-3 w-5/6 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-3 w-4/6 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
