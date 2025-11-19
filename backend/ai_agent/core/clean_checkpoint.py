import sqlite3
import os

# 清理对话数据的函数
def cleanup_conversations():
    """清理对话数据的工具函数"""    
    db_path = "checkpoints.db"
    
    if not os.path.exists(db_path):
        print("数据库文件不存在")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取所有用户ID
    cursor.execute('SELECT DISTINCT thread_id FROM checkpoints')
    user_ids = [row[0] for row in cursor.fetchall()]
    
    if not user_ids:
        print("没有找到任何对话数据")
        conn.close()
        return
    
    print("当前所有用户ID:")
    for user_id in user_ids:
        cursor.execute('SELECT COUNT(*) FROM checkpoints WHERE thread_id = ?', (user_id,))
        count = cursor.fetchone()[0]
        print(f"  - 用户ID: {user_id} (对话数量: {count})")
    
    print("\n请选择操作:")
    print("1. 删除指定用户的对话")
    print("2. 删除所有用户的对话")
    print("3. 取消")
    
    choice = input("\n请输入选择 (1-3): ").strip()
    
    if choice == "1":
        target_id = input("请输入要删除的用户ID: ").strip()
        if target_id in user_ids:
            confirm = input(f"确定要删除用户 {target_id} 的所有对话数据吗? (y/N): ").strip().lower()
            if confirm == 'y':
                # 删除指定用户的数据
                cursor.execute('DELETE FROM checkpoints WHERE thread_id = ?', (target_id,))
                checkpoints_deleted = cursor.rowcount
                cursor.execute('DELETE FROM writes WHERE thread_id = ?', (target_id,))
                writes_deleted = cursor.rowcount
                
                conn.commit()
                print(f"已删除用户 {target_id} 的对话数据:")
                print(f"  - 检查点记录: {checkpoints_deleted} 条")
                print(f"  - 写入记录: {writes_deleted} 条")
            else:
                print("操作已取消")
        else:
            print("用户ID不存在")
    
    elif choice == "2":
        confirm = input("确定要删除所有用户的对话数据吗? 此操作不可恢复! (y/N): ").strip().lower()
        if confirm == 'y':
            # 获取删除前的统计
            cursor.execute('SELECT COUNT(*) FROM checkpoints')
            checkpoints_count = cursor.fetchone()[0]
            cursor.execute('SELECT COUNT(*) FROM writes')
            writes_count = cursor.fetchone()[0]
            
            # 删除所有数据
            cursor.execute('DELETE FROM checkpoints')
            cursor.execute('DELETE FROM writes')
            
            conn.commit()
            print("已删除所有对话数据:")
            print(f"  - 检查点记录: {checkpoints_count} 条")
            print(f"  - 写入记录: {writes_count} 条")
        else:
            print("操作已取消")
    
    elif choice == "3":
        print("操作已取消")
    
    else:
        print("无效选择")
    
    conn.close()