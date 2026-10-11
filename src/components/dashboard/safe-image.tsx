"use client"

import * as React from "react"
import { ImageIcon } from "lucide-react"
import { cn } from "cn"

/**
 * A stored picture that may no longer load — an object removed from the
 * bucket, a link into storage that has since been closed. Instead of the
 * browser's broken-image glyph it shows a quiet tile with a picture icon,
 * filling exactly the box the picture would have, so nothing around it moves.
 *
 * Everything else is a plain <img>: same attributes, same classes.
 */
export function SafeImage({
  src,
  alt,
  className,
  fallback,
  fallbackClassName,
  ...props
}: Omit<React.ComponentProps<"img">, "src"> & {
  src: string
  /** Rendered instead of the default tile when the picture fails. */
  fallback?: React.ReactNode
  /** Extra classes for the default tile (it already fills its box). */
  fallbackClassName?: string
}) {
  // Keyed by address, so a new picture in the same place gets a fresh try.
  const [failed, setFailed] = React.useState<string | null>(null)

  if (failed === src) {
    if (fallback !== undefined) return <>{fallback}</>
    return (
      <span
        role="img"
        aria-label={alt ? `${alt} (picture unavailable)` : "Picture unavailable"}
        className={cn(
          "bg-n-100 text-n-400 flex size-full items-center justify-center",
          fallbackClassName
        )}
      >
        <ImageIcon aria-hidden className="size-[40%] max-h-6 max-w-6" strokeWidth={1.6} />
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailed(src)
        props.onError?.(event)
      }}
      // A picture that failed before React attached onError (server-rendered,
      // or served from the cache) is caught here instead.
      ref={(node) => {
        if (node && node.complete && node.naturalWidth === 0 && node.currentSrc) {
          setFailed(src)
        }
      }}
    />
  )
}
