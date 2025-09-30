import { IFileUploadService } from '../types/index.js';
import path from 'path';
import fs from 'fs/promises';

export class FileUploadService implements IFileUploadService {
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly allowedTypes: string[];

  constructor(
    uploadDir: string = 'uploads',
    maxFileSize: number = 5 * 1024 * 1024, // 5MB
    allowedTypes: string[] = ['jpeg', 'jpg', 'png', 'gif']
  ) {
    this.uploadDir = uploadDir;
    this.maxFileSize = maxFileSize;
    this.allowedTypes = allowedTypes;
  }

  async uploadFile(file: any): Promise<string> {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new Error('File size exceeds maximum allowed size');
    }

    // Validate file type
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    if (!this.allowedTypes.includes(fileExtension)) {
      throw new Error(`File type ${fileExtension} is not allowed`);
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    const filepath = path.join(this.uploadDir, filename);

    try {
      // Ensure upload directory exists
      await fs.mkdir(this.uploadDir, { recursive: true });
      
      // Move file to upload directory
      await fs.rename(file.path, filepath);
      
      return `/uploads/${filename}`;
    } catch (error) {
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  async deleteFile(filename: string): Promise<void> {
    const filepath = path.join(this.uploadDir, filename);
    
    try {
      await fs.unlink(filepath);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  isValidFileType(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase().slice(1);
    return this.allowedTypes.includes(extension);
  }

  isValidFileSize(size: number): boolean {
    return size <= this.maxFileSize;
  }
}