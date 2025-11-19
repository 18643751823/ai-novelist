import os
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from langchain.tools import tool
from langchain_core.tools import BaseTool
from langchain_community.vectorstores import LanceDB
from langchain_community.embeddings import DashScopeEmbeddings

# 导入emb_service中的函数
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from embedding.emb_service import (
    load_config,
    prepare_emb,
    load,
    list_available_tables,
    db_path
)

class SearchEmbeddingInput(BaseModel):
    """嵌入搜索的输入参数"""
    query: str = Field(description="搜索查询文本")
    table_name: Optional[str] = Field(default=None, description="指定搜索的表名，如果不指定则列出所有可用表")
    top_k: Optional[int] = Field(default=5, description="返回的结果数量")


@tool(args_schema=SearchEmbeddingInput)
def search_embedding(query: str, table_name: Optional[str] = None,
                    top_k: Optional[int] = 5) -> str:
    """在向量数据库中搜索相似内容便于文本参考
    Args:
        query: 搜索查询文本
        table_name: 指定搜索的表名，如果不指定则列出所有可用表
        top_k: 返回的结果数量
    """
    try:
        # 加载配置
        _config = load_config()
        embedding_model = _config.get("embeddingModel")
        embedding_url = _config.get("embeddingUrl")
        embedding_api_key = _config.get("embeddingApiKey")
        
        # 准备嵌入模型
        embeddings = prepare_emb(embedding_model, embedding_url, embedding_api_key)
        
        # 如果没有指定表名，列出所有可用表
        if not table_name:
            available_tables = list_available_tables(db_path, embeddings)
            if not available_tables:
                return "【工具执行结果】：没有可用的知识库表，请先创建知识库"
            
            table_names = [table["table_name"] for table in available_tables]
            table_list = "\n".join([f"- {name}" for name in table_names])
            return f"【工具执行结果】：可用知识库表：\n{table_list}\n\n请使用table_name参数指定要搜索的表"
        
        # 加载指定的向量数据库
        vector_store = load(embeddings, db_path, table_name)
        if not vector_store:
            return f"【工具执行结果】：无法加载表 '{table_name}'，请检查表名是否正确"
        
        # 执行搜索
        results = vector_store.similarity_search_with_score(
            query=query,
            k=top_k
        )
        
        if not results:
            return f"【工具执行结果】：在表 '{table_name}' 中没有找到与查询 '{query}' 相关的内容"
        
        # 格式化搜索结果
        formatted_results = []
        for i, (doc, score) in enumerate(results):
            metadata = doc.metadata
            original_filename = metadata.get('original_filename', '未知')
            chunk_index = metadata.get('chunk_index', 0)
            
            result_item = f"结果 {i+1} (相似度: {score:.4f}):\n"
            result_item += f"来源文件: {original_filename}\n"
            result_item += f"内容块索引: {chunk_index}\n"
            result_item += f"内容: {doc.page_content}\n"
            formatted_results.append(result_item)
        
        results_text = "\n".join(formatted_results)
        
        return f"【工具执行结果】：在表 '{table_name}' 中找到 {len(results)} 个与查询 '{query}' 相关的结果：\n\n{results_text}"
        
    except Exception as e:
        return f"【工具执行结果】：搜索过程中发生错误: {str(e)}"


class ListKnowledgeBaseInput(BaseModel):
    """列出知识库的输入参数"""
    show_details: Optional[bool] = Field(default=True, description="是否显示详细信息")


@tool(args_schema=ListKnowledgeBaseInput)
def list_knowledge_base(show_details: Optional[bool] = True) -> str:
    """列出所有可用的知识库表
    Args:
        show_details: 是否显示详细信息
    """
    try:
        # 加载配置
        _config = load_config()
        embedding_model = _config.get("embeddingModel")
        embedding_url = _config.get("embeddingUrl")
        embedding_api_key = _config.get("embeddingApiKey")
        
        # 准备嵌入模型
        embeddings = prepare_emb(embedding_model, embedding_url, embedding_api_key) if show_details else None
        
        # 列出所有可用表
        available_tables = list_available_tables(db_path, embeddings)
        
        if not available_tables:
            return "【工具执行结果】：没有可用的知识库表"
        
        # 格式化结果
        if show_details:
            formatted_tables = []
            for table in available_tables:
                table_name = table.get("table_name", "未知")
                original_filename = table.get("original_filename", "未知")
                created_at = table.get("created_at", "未知")
                total_chunks = table.get("total_chunks", "未知")
                
                table_info = f"表名: {table_name}\n"
                table_info += f"原始文件名: {original_filename}\n"
                table_info += f"创建时间: {created_at}\n"
                table_info += f"文档块数: {total_chunks}\n"
                formatted_tables.append(table_info)
            
            tables_text = "\n".join(formatted_tables)
            return f"【工具执行结果】：找到 {len(available_tables)} 个知识库表：\n\n{tables_text}"
        else:
            table_names = [table.get("table_name", "未知") for table in available_tables]
            tables_text = "\n".join([f"- {name}" for name in table_names])
            return f"【工具执行结果】：可用的知识库表：\n{tables_text}"
            
    except Exception as e:
        return f"【工具执行结果】：列出知识库时发生错误: {str(e)}"