import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  thumbnailUrl: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadBuffer(
    buffer: Buffer,
    folder = 'products',
  ): Promise<CloudinaryUploadResult> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'webp' }],
        },
        (error, res) => {
          if (error || !res) reject(error ?? new Error('Upload falhou'));
          else resolve(res);
        },
      );
      stream.end(buffer);
    });

    const thumbnailUrl = cloudinary.url(result.public_id, {
      width: 200,
      height: 200,
      crop: 'fill',
      format: 'webp',
      quality: 70,
    });

    return {
      publicId: result.public_id,
      url: result.secure_url,
      thumbnailUrl,
    };
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      this.logger.warn(`Falha ao deletar imagem Cloudinary "${publicId}": ${err}`);
    }
  }
}
