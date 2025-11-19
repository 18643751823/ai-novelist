"""
AI Novelist 后端主应用
基于FastAPI的Web服务，提供AI聊天、文件操作、RAG等功能
"""

import os
import signal
import sys
import atexit
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from config import settings
from ai_agent.chat_api import router as chat_router
from ai_agent.config_api import router as ai_config_router
from ai_agent.tool_config_api import router as tool_config_router
from ai_agent.history_api import router as history_router
from file.file_api import router as file_router
from services.websocket_manager import websocket_manager
from services.config_api import router as config_router
from embedding.embedding_api import router as embedding_router
from api_provider import api_provider_router

# 创建FastAPI应用
app = FastAPI(
    title="AI Novelist Backend",
    description="AI小说创作助手后端服务",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    # 配置离线模式，避免CDN资源加载问题
    swagger_ui_parameters={
        "syntaxHighlight.theme": "obsidian",
        "tryItOutEnabled": True,
        "displayRequestDuration": True
    }
)

# 配置CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React开发服务器
        "http://127.0.0.1:3000",
        "http://localhost:5173",  # Vite开发服务器
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件目录
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# 挂载上传文件目录
uploads_dir = os.path.join(os.path.dirname(__file__), "data", "uploads")
if os.path.exists(uploads_dir):
    app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# 包含API路由
app.include_router(chat_router)
app.include_router(ai_config_router)
app.include_router(tool_config_router)
app.include_router(history_router)
app.include_router(file_router)
app.include_router(config_router)
app.include_router(embedding_router)
app.include_router(api_provider_router)

# 健康检查端点
@app.get("/")
async def root():
    """根端点，用于健康检查"""
    return {
        "message": "AI Novelist Python Backend is running",
        "version": "0.1.0",
        "status": "healthy"
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "message": "AI Novelist Python Backend is running",
        "backend_type": "python",
        "host": settings.HOST,
        "port": settings.PORT
    }

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理器"""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "服务器内部错误",
            "detail": str(exc)
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """HTTP异常处理器"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail
        }
    )

# WebSocket端点 (在ai_agent/api.py中已经实现，这里不再重复)

# 配置日志
import logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 优雅关闭处理
def cleanup_resources():
    """清理资源，确保数据库连接正确关闭"""
    logger.info("正在清理资源...")
    try:
        # 关闭数据库连接
        from ai_agent.history_api import close_db_connection
        close_db_connection()
        
        # 清理WAL文件
        db_path = "checkpoints.db"
        wal_path = f"{db_path}-wal"
        shm_path = f"{db_path}-shm"
        
        for temp_file in [wal_path, shm_path]:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    logger.info(f"已清理临时文件: {temp_file}")
                except Exception as e:
                    logger.warning(f"清理临时文件失败 {temp_file}: {e}")
        
        logger.info("资源清理完成")
    except Exception as e:
        logger.error(f"资源清理过程中发生错误: {e}")

def signal_handler(signum, frame):
    """信号处理器"""
    logger.info(f"收到信号 {signum}，正在优雅关闭...")
    cleanup_resources()
    sys.exit(0)

# 注册信号处理器
signal.signal(signal.SIGINT, signal_handler)  # Ctrl+C
signal.signal(signal.SIGTERM, signal_handler) # 终止信号

# 注册退出时的清理函数
atexit.register(cleanup_resources)

if __name__ == "__main__":
    try:
        # 启动服务器
        logger.info("启动AI Novelist后端服务...")
        uvicorn.run(
            "main:app",
            host=settings.HOST,
            port=settings.PORT,
            reload=settings.DEBUG,
            log_level="info" if settings.DEBUG else "warning"
        )
    except KeyboardInterrupt:
        logger.info("收到键盘中断，正在优雅关闭...")
        cleanup_resources()
    except Exception as e:
        logger.error(f"服务器启动失败: {e}")
        cleanup_resources()
        sys.exit(1)
