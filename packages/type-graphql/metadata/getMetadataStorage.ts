import { MetadataStorage } from "../metadata/metadata-storage"

export function getMetadataStorage(): MetadataStorage {
  return (
    (globalThis as any).TypeGraphQLMetadataStorage ||
    ((globalThis as any).TypeGraphQLMetadataStorage = new MetadataStorage())
  )
}
