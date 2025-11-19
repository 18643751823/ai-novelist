import os
from pathlib import Path

# 检查上传目录
upload_dir = Path('uploads')
print(f'上传目录是否存在: {upload_dir.exists()}')
print(f'上传目录路径: {upload_dir.absolute()}')

# 检查当前工作目录
print(f'当前工作目录: {os.getcwd()}')

# 检查上传目录权限
if upload_dir.exists():
    print(f'上传目录权限: {oct(upload_dir.stat().st_mode)}')
else:
    print('上传目录不存在，尝试创建...')
    upload_dir.mkdir(exist_ok=True)
    print(f'上传目录创建成功: {upload_dir.exists()}')