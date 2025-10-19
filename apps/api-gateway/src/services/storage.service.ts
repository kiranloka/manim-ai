import * as Minio from "minio";
import { promises as fs } from "fs";

export interface UploadResult {
  success: boolean;
  objectName: string;
  url: string;
  size: number;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  stream?: NodeJS.ReadableStream;
  metadata?: any;
  error?: string;
}

export class StorageService {
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor() {
    if (
      !process.env.MINIO_ENDPOIN ||
      !process.env.MINIO_ACCESS_KEY ||
      !process.env.MINIO_SECRET_KEY
    ) {
      throw new Error("Minio credentials are not found!");
    }

    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT as string,
      port: parseInt(process.env.MINIO_PORT || "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });

    this.bucketName = process.env.MINIO_BUCKET || "manim";
    this.initializeBucket();
  }

  private async initializeBucket(): Promise<void> {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName, "us-east-1");
        console.log("Creating bucket", this.bucketName);

        const bucketPolicy = {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${this.bucketName}/videos/*`],
            },
          ],
        };

        await this.minioClient.setBucketPolicy(
          this.bucketName,
          JSON.stringify(bucketPolicy)
        );

        console.log("Set bucket read policy for ", this.bucketName);
      } else {
        console.log(`Minio bucket exists `, this.bucketName);
      }
    } catch (error) {
      console.error("Error initializing a bucket", error);
      throw error;
    }
  }

  async uploadVideo(
    localFilePath: string,
    videoId: string,
    userId: string,
    metadata: any = {}
  ): Promise<UploadResult> {
    try {
      const objectName = `videos/${userId}/${videoId}.mp4`;

      const stats = await fs.stat(localFilePath);

      const metaData = {
        "Content-Type": "video/mp4",
        "x-amz-meta-user-id": userId,
        "x-amz-meta-video-id": videoId,
        "x-amz-meta-created-at": new Date().toISOString(),
        "x-amz-meta-file-size": stats.size.toString(),
        ...metadata,
      };

      console.log("uploading file to minio: ", objectName);

      const result = await this.minioClient.fPutObject(
        this.bucketName,
        objectName,
        localFilePath,
        metaData
      );

      const url = await this.getVideoUrl(videoId, userId);

      console.log("Video uploaded successfully!");

      return {
        success: true,
        objectName,
        url,
        size: stats.size,
      };
    } catch (error) {
      console.log("Error uploading the file :", error);
      return {
        success: false,
        objectName: "",
        url: "",
        size: 0,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  async getVideoStream(
    videoId: string,
    userId: string
  ): Promise<DownloadResult> {
    try {
      const object = `videos/${userId}/${videoId}.mp4`;

      const stat = await this.minioClient.statObject(this.bucketName, object);
      if (!stat) {
        throw new Error("Video does not exist on the bucket");
      }
      const stream = await this.minioClient.getObject(this.bucketName, object);

      return {
        success: true,
        stream,
        metadata: stat,
      };
    } catch (error) {
      console.error("Unable to get the video stream");
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get the video stream",
      };
    }
  }

  async getVideoUrl(
    videoId: string,
    userId: string,
    expirySeconds: number = 3600
  ): Promise<string> {
    try {
      const object = `videos/${userId}/${videoId}.mp4`;

      const url = this.minioClient.presignedGetObject(
        this.bucketName,
        object,
        expirySeconds
      );

      return url;
    } catch (error) {
      console.error("Unable to get the video url");
      return "";
    }
  }

  async getVideoMetadata(videoId: string, userId: string): Promise<any> {
    try {
      const objectName = `videos/${userId}/${videoId}.mp4`;

      const stat = await this.minioClient.statObject(
        this.bucketName,
        objectName
      );

      return {
        success: true,
        size: stat.size,
        lastModified: stat.lastModified,
        etag: stat.etag,
        metadata: stat.metaData,
      };
    } catch (error) {
      console.error("Unable to get the video metadata");
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to get the video metadata",
      };
    }
  }

  async deleteVideo(videoId: string, userId: string): Promise<boolean> {
    try {
      const objectName = `videos/${userId}/${videoId}.mp4`;
      const result = await this.minioClient.removeObject(
        this.bucketName,
        objectName
      );

      console.log(`Removing the video ${objectName} from the bucket`);
      return true;
    } catch (error) {
      console.error("Unable to delete the video");
      return false;
    }
  }
}
