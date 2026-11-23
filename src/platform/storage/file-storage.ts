export type StoredFile = Readonly<{
  key: string;
  size: number;
  modifiedAt: string;
}>;

export interface FileStorage {
  put(key: string, contents: Uint8Array): Promise<StoredFile>;
  read(key: string): Promise<Uint8Array>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<StoredFile[]>;
}
