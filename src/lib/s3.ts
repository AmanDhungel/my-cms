/**
 * The storage implementation moved to `@/lib/storage/s3`, where the AWS SDK
 * is confined. This path stays so existing imports keep working unchanged.
 */
export * from "@/lib/storage/s3"
