const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { ipcMain } = require('electron');

class ImageUploadService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.setupStorage();
    this.setupIpcHandlers();
  }

  setupStorage() {
    // 确保上传目录存在
    this.ensureUploadDir();
    
    // 配置multer存储
    this.storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        await this.ensureUploadDir();
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        // 生成唯一文件名：时间戳 + 随机数 + 原扩展名
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `image_${timestamp}_${random}${ext}`;
        cb(null, filename);
      }
    });

    // 文件过滤器
    this.fileFilter = (req, file, cb) => {
      const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('不支持的文件类型。仅支持 JPG, PNG, GIF, SVG, WebP 格式。'), false);
      }
    };

    this.upload = multer({
      storage: this.storage,
      fileFilter: this.fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB限制
        files: 1 // 单文件上传
      }
    });
  }

  setupIpcHandlers() {
    // 处理图片上传请求
    ipcMain.handle('upload-image', async (event, fileData) => {
      try {
        // 这里处理从剪贴板粘贴的图片数据
        if (fileData && fileData.buffer) {
          const filename = `paste_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;
          const filePath = path.join(this.uploadDir, filename);
          
          // 将数组数据转换为 Buffer
          const buffer = Buffer.from(new Uint8Array(fileData.buffer));
          await fs.writeFile(filePath, buffer);
          
          return {
            success: true,
            data: {
              filename: filename,
              url: `app://uploads/${filename}`,
              path: filePath
            }
          };
        }
        
        return { success: false, error: '无效的文件数据' };
      } catch (error) {
        console.error('图片上传错误:', error);
        return { success: false, error: error.message };
      }
    });

    // 处理拖拽上传
    ipcMain.handle('upload-image-file', async (event, filePath) => {
      try {
        const stats = await fs.stat(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
        
        if (!allowedTypes.includes(ext)) {
          return { success: false, error: '不支持的文件类型' };
        }

        if (stats.size > 5 * 1024 * 1024) {
          return { success: false, error: '文件大小超过5MB限制' };
        }

        const filename = `drag_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        const destPath = path.join(this.uploadDir, filename);
        
        // 复制文件到上传目录
        await fs.copyFile(filePath, destPath);
        
        return {
          success: true,
          data: {
            filename: filename,
            url: `app://uploads/${filename}`,
            path: destPath
          }
        };
      } catch (error) {
        console.error('拖拽上传错误:', error);
        return { success: false, error: error.message };
      }
    });
  }

  async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  getUploadMiddleware() {
    return this.upload.single('image');
  }

  async handleUpload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '没有选择文件' });
      }

      const fileInfo = {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
        url: `file://${req.file.path}`
      };

      console.log('图片上传成功:', fileInfo);

      res.json({
        success: true,
        message: '图片上传成功',
        data: fileInfo
      });

    } catch (error) {
      console.error('图片上传错误:', error);
      
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: '文件大小超过限制（最大5MB）' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: '只能上传一个文件' });
        }
      }
      
      res.status(500).json({ error: '图片上传失败' });
    }
  }
}

module.exports = ImageUploadService;