from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader,TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter,CharacterTextSplitter
from langchain_community.vectorstores import LanceDB
import os
import json
import time
import shutil
from datetime import datetime
from pathlib import Path
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import DashScopeEmbeddings
from langchain_ollama import OllamaEmbeddings

# 导入配置
def load_config():
    """从 store.json 加载配置"""
    config_file = Path(__file__).parent.parent / "config" / "store.json"
    if not config_file.exists():
        return {}
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, Exception):
        return {}

# 从配置中获取嵌入模型相关设置
_config = load_config()
embedding_model = _config.get("embeddingModel")
embedding_url = _config.get("embeddingUrl")

# 从配置中获取文档分块相关设置
chunk_size = _config.get("ragChunkSize", 200)
chunk_overlap = _config.get("ragChunkOverlap", 20)
# 返回参数
retrieval_top_k = _config.get("retrievalTopK", 5)


def prepare_doc(orgfile_path,chunk_size,chunk_overlap):
    # 初始化documents列表
    documents = []
    loader = TextLoader(orgfile_path, encoding='utf-8')
    documents += loader.load()
    
    # 获取原始文件名
    original_filename = os.path.basename(orgfile_path)
    
    # 使用配置的分块参数进行文档切分
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]  # 优先按段落、句子、单词分割
    )
    documents = text_splitter.split_documents(documents)
    
    # 为每个文档片段添加元数据
    for i, doc in enumerate(documents):
        # 保留原有元数据
        if not doc.metadata:
            doc.metadata = {}
        
        # 添加自定义元数据
        doc.metadata.update({
            'original_filename': original_filename,
            'file_path': orgfile_path,
            'chunk_index': i,
            'total_chunks': len(documents),
            'chunk_size': chunk_size,
            'chunk_overlap': chunk_overlap,
            'created_at': datetime.now().isoformat()
        })
    
    print(f"文档切分完成: 分块长度={chunk_size}, 重叠长度={chunk_overlap}, 切分后文档数量={len(documents)}")
    return documents

def prepare_emb(model_id,embedding_url,embedding_api_key=None):
    if embedding_url == "https://dashscope.aliyuncs.com/compatible-mode/v1":
        # 去掉id前面的提供商，比如openai/text-embedding-v4的openai
        if '/' in model_id:
            embedding_model = model_id.split('/', 1)[1]
        else:
            embedding_model = model_id
        # 创建嵌入模型配置
        embeddings = DashScopeEmbeddings(
            model=embedding_model, # 使用配置的嵌入模型名
            dashscope_api_key=embedding_api_key
        )
        print(f"1. 嵌入模型准备就绪")
        return embeddings
    elif embedding_url == "http://127.0.0.1:11434":
        if '/' in model_id:
            embedding_model = model_id.split('/', 1)[1]
        else:
            embedding_model = model_id
        # 创建ollama嵌入模型配置
        embeddings = OllamaEmbeddings(
            model=embedding_model
        )
        print("2. 嵌入模型准备就绪")
        return embeddings
    else:
        # 其他openai兼容的嵌入模型，由于过网关，没必要去除
        embeddings = OpenAIEmbeddings(
            model=model_id, # 使用传入的模型ID
            dimensions=None, # 暂时应为 None，使用模型的默认维度，但是需要提取维度信息作为记录。以后考虑增加自定义维度功能
            openai_api_key="sk-123",
            openai_api_base="http://127.0.0.1:4000",
            timeout=600,
            check_embedding_ctx_length=False  # 禁用上下文长度检查，避免token化问题
        )
        print("3. 嵌入模型准备就绪")
        return embeddings



# 指定数据库保存路径
import os
db_path = os.path.join(os.path.dirname(__file__), "..", "data", "lancedb")
# 确保目录存在,创建嵌入表
os.makedirs(db_path, exist_ok=True)
def create_db(documents, embeddings, db_path):
    # 根据时间戳生成表名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    table_name = f"db_{timestamp}"
    
    # 创建数据库
    docemb = LanceDB.from_documents(
        documents,
        embeddings,
        uri=db_path,  # 固定的保存路径
        table_name=table_name  # 使用时间戳生成的表名
    )
    print(f"向量数据库已创建并保存到: {db_path}, 表名: {table_name}")
    return table_name




def load(embeddings, db_path, table_name):
    """
    加载已存在的向量数据库
    """
    # 获取数据库文件完整路径
    db_file = os.path.join(db_path, f"{table_name}.lance")
    
    # 检查数据库是否存在
    if not os.path.exists(db_file):
        print(f"数据库不存在: {db_file}")
        return None
    
    try:
        # 直接连接到已存在的数据库
        vector_store = LanceDB(
            embedding=embeddings,
            uri=db_path,
            table_name=table_name  # 使用传入的表名参数
        )
        
        print(f"成功加载数据库: {db_path}, 表名: {table_name}")
        return vector_store
        
    except Exception as e:
        print(f"加载数据库失败: {e}")
        return None


def list_available_tables(db_path, embeddings=None):
    """
    列出数据库路径中所有可用的表，并显示对应的原始文件名
    
    Args:
        db_path: 数据库路径
        embeddings: 嵌入模型实例（可选，用于获取表详细信息）
    
    Returns:
        list: 包含表名和文件名的字典列表
    """
    if not os.path.exists(db_path):
        print(f"数据库路径不存在: {db_path}")
        return []
    
    # 获取所有 .lance 文件
    lance_files = [f for f in os.listdir(db_path) if f.endswith('.lance')]
    
    # 提取表名（去掉 .lance 后缀）
    table_names = [f.replace('.lance', '') for f in lance_files]
    
    result = []
    print("当前可用的知识库表：")
    
    for table_name in table_names:
        table_info = {"table_name": table_name, "original_filename": "未知"}
        
        # 如果提供了embeddings，尝试获取表的详细信息
        if embeddings:
            try:
                # 连接到表
                vector_store = LanceDB(
                    embedding=embeddings,
                    uri=db_path,
                    table_name=table_name
                )
                
                # 获取第一条记录来提取元数据
                # 使用limit(1)只获取一条记录以提高性能
                results = vector_store.similarity_search_with_score(
                    query="",  # 空查询，只是为了获取记录
                    k=1
                )
                
                if results:
                    doc, score = results[0]
                    original_filename = doc.metadata.get('original_filename', '未知')
                    created_at = doc.metadata.get('created_at', '未知')
                    total_chunks = doc.metadata.get('total_chunks', '未知')
                    
                    table_info.update({
                        "original_filename": original_filename,
                        "created_at": created_at,
                        "total_chunks": total_chunks
                    })
                    
                    print(f"- 表名: {table_name} | 文件名: {original_filename} | 创建时间: {created_at} | 片段数: {total_chunks}")
                else:
                    print(f"- 表名: {table_name} | 文件名: 未知 | 状态: 空表")
                    
            except Exception as e:
                print(f"- 表名: {table_name} | 文件名: 未知 | 状态: 无法访问 ({str(e)})")
        else:
            # 如果没有提供embeddings，只显示表名
            print(f"- 表名: {table_name} | 文件名: 需要提供embeddings参数获取详细信息")
        
        result.append(table_info)
    
    return result
def delete_table(db_path, table_name):
    """
    删除指定的数据库表文件
    
    Args:
        db_path: 数据库路径
        table_name: 要删除的表名
    
    Returns:
        bool: 删除是否成功
    """
    # 构建数据库文件路径
    db_dir = os.path.join(db_path, f"{table_name}.lance")
    
    # 检查数据库目录是否存在
    if not os.path.exists(db_dir):
        print(f"数据库表不存在: {db_dir}")
        return False
    
    try:
        # shutil.rmtree递归删除
        shutil.rmtree(db_dir)
        
        print(f"成功删除数据库表: {table_name}")
        return True
    except Exception as e:
        print(f"删除数据库表失败: {e}")
        return False

def update_table_metadata(db_path, table_name, embeddings, metadata_updates):
    """
    更新表中所有文档的元数据（使用LanceDB的原生API）
    
    Args:
        db_path: 数据库路径
        table_name: 表名
        embeddings: 嵌入模型实例
        metadata_updates: 要更新的元数据字典，如 {'original_filename': '新文件名.txt'}
    
    Returns:
        bool: 更新是否成功
    """
    try:
        # 直接连接到LanceDB
        import lancedb
        db = lancedb.connect(db_path)
        table = db.open_table(table_name)
        
        # 获取所有数据
        arrow_data = table.to_arrow()
        data = arrow_data.to_pylist()
        
        # 更新所有行的元数据
        for i in range(len(data)):
            updated_metadata = data[i]['metadata'].copy()
            updated_metadata.update(metadata_updates)
            data[i]['metadata'] = updated_metadata
        
        # 删除表中的所有数据
        table.delete(where="1=1")
        
        # 添加更新后的数据
        table.add(data)
        
        print(f"成功更新表 {table_name} 的元数据，更新了 {len(data)} 行")
        return True
        
    except Exception as e:
        print(f"更新表元数据失败: {e}")
        return False

def search_emb(vector_store,embeddings,search_input):
    results = vector_store.similarity_search_by_vector(
        embedding=embeddings.embed_query(search_input), 
        k=1
    )
    for doc in results:
        print("检索结果：")
        print(f"* {doc.page_content} [{doc.metadata}]")


# 主循环：
def main():
    while True:
        user_input=input("1：获取列表，2：删除指定列表，3：嵌入文件，4：加载文件和查询文件，5：更新元数据")
        if user_input == "1":
            emb=prepare_emb(embedding_model, embedding_url)
            available_tables=list_available_tables(db_path,emb)
            print(available_tables)
        elif user_input == "2":
            user_input2=input("请输入要删除的列表")
            del_result=delete_table(db_path,user_input2)
            print(del_result)
        elif user_input == "3":
            user_input2=input("请输入要嵌入的路径")
            orgfile_path=user_input2
            doc=prepare_doc(orgfile_path,chunk_size,chunk_overlap)
            emb=prepare_emb(embedding_model, embedding_url)
            create_db(doc, emb, db_path)
        elif user_input == "4":
            available_tables=list_available_tables(db_path)
            user_input2=input("请选择知识库文件")
            user_input3=input("请输入查询文本")
            emb=prepare_emb(embedding_model, embedding_url)
            embdoc=load(emb, db_path, user_input2)
            search_emb(embdoc,emb,user_input3)
        elif user_input == "5":
            # 更新元数据
            emb=prepare_emb(embedding_model, embedding_url)
            available_tables=list_available_tables(db_path, emb)
            table_name = input("请输入要更新的表名: ")
            
            # 显示当前元数据
            try:
                vector_store = LanceDB(
                    embedding=emb,
                    uri=db_path,
                    table_name=table_name
                )
                results = vector_store.similarity_search_with_score(query="", k=1)
                if results:
                    doc, score = results[0]
                    print("当前元数据:")
                    for key, value in doc.metadata.items():
                        print(f"  {key}: {value}")
                else:
                    print("表中没有数据")
                    continue
            except Exception as e:
                print(f"无法获取表信息: {e}")
                continue
            
            # 获取要更新的元数据
            print("\n请输入要更新的元数据（格式: key=value，输入空行结束）:")
            metadata_updates = {}
            while True:
                line = input().strip()
                if not line:
                    break
                if '=' in line:
                    key, value = line.split('=', 1)
                    metadata_updates[key.strip()] = value.strip()
            
            if metadata_updates:
                result = update_table_metadata(db_path, table_name, emb, metadata_updates)
                print(f"更新结果: {result}")
            else:
                print("没有输入要更新的元数据")
        else:
            print("无效的输入，请重新选择")


if __name__ == "__main__":
    main()