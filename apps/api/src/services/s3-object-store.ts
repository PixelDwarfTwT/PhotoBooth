import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { ApiEnvironment } from "../config/env.js";
import { collectBoundedObjectBody } from "./bounded-object-body.js";
import type { PrivateObjectStore } from "./share-service.js";

const MAX_SHARE_BYTES = 10 * 1024 * 1024;

export class S3ObjectStore implements PrivateObjectStore {
  private readonly client: S3Client;

  constructor(private readonly config: NonNullable<ApiEnvironment["s3"]>) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint
        ? { endpoint: config.endpoint, forcePathStyle: true }
        : {}),
      maxAttempts: 3,
    });
  }

  async putObject(
    key: string,
    body: Uint8Array,
    mimeType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: Buffer.from(body),
        ContentType: mimeType,
        CacheControl: "private, no-store",
        ...(this.config.endpoint ? {} : { ServerSideEncryption: "AES256" }),
      }),
    );
  }

  async getObject(key: string): Promise<Buffer | null> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (!response.Body) return null;
    if (
      response.ContentLength !== undefined &&
      response.ContentLength > MAX_SHARE_BYTES
    ) {
      throw new Error(
        "Stored share object exceeds the configured maximum size.",
      );
    }
    return collectBoundedObjectBody(
      response.Body as AsyncIterable<Uint8Array>,
      MAX_SHARE_BYTES,
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }

  async close(): Promise<void> {
    this.client.destroy();
  }
}
