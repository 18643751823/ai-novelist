import os
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from langchain import tools
from langchain.tools import tool, ToolRuntime
from langgraph.types import interrupt,Command

# 导入配置和路径验证器
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../'))
from config import settings
from file.utils.path_validator import PathValidator

class ApplyDiffInput(BaseModel):
    """应用差异的输入参数"""
    path: str = Field(description="文件路径（相对于novel目录的相对路径）")
    diff: str = Field(description="差异内容")

# ==================== Diff应用相关辅助函数 ====================

def levenshtein_distance(s1: str, s2: str) -> int:
    """计算两个字符串之间的Levenshtein距离"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]

def get_similarity(original: str, search: str) -> float:
    """计算两个字符串之间的相似度"""
    if search == "":
        return 0.0
    
    # 简单的文本归一化
    def normalize_text(text: str) -> str:
        # 移除多余空格，转换为小写
        return ' '.join(text.lower().split())
    
    normalized_original = normalize_text(original)
    normalized_search = normalize_text(search)
    
    if normalized_original == normalized_search:
        return 1.0
    
    dist = levenshtein_distance(normalized_original, normalized_search)
    max_length = max(len(normalized_original), len(normalized_search))
    
    return 1.0 - dist / max_length if max_length > 0 else 0.0

def add_line_numbers(content: str, start_line: int = 1) -> str:
    """为内容添加行号"""
    if content == "":
        return "" if start_line == 1 else f"{start_line} | \n"
    
    lines = content.split("\n")
    # 移除最后的空行
    if lines and lines[-1] == "":
        lines.pop()
    
    max_line_number_width = len(str(start_line + len(lines) - 1))
    numbered_lines = []
    
    for i, line in enumerate(lines):
        line_number = str(start_line + i).rjust(max_line_number_width, ' ')
        numbered_lines.append(f"{line_number} | {line}")
    
    return "\n".join(numbered_lines) + "\n"

def every_line_has_line_numbers(content: str) -> bool:
    """检查每行是否都有行号前缀"""
    lines = content.splitlines()
    # 处理最后的空行
    if lines and lines[-1].strip() == '':
        lines.pop()
    
    if not lines:
        return False
    
    # 检查每行是否以"数字 | "格式开头
    pattern = re.compile(r'^\s*\d+\s+\|(?!\|)')
    return all(pattern.match(line) for line in lines)

def strip_line_numbers(content: str, aggressive: bool = False) -> str:
    """移除内容中的行号"""
    lines = content.splitlines()
    processed_lines = []
    
    for line in lines:
        if aggressive:
            # 宽松模式：匹配 "数字 | 内容" 或 "| 内容"
            match = re.match(r'^\s*(?:\d+\s)?\|\s?(.*)$', line)
        else:
            # 严格模式：只匹配 "数字 | 内容"
            match = re.match(r'^\s*\d+\s+\|(?!\|)\s?(.*)$', line)
        
        if match:
            processed_lines.append(match.group(1))
        else:
            processed_lines.append(line)
    
    line_ending = "\r\n" if content.find("\r\n") != -1 else "\n"
    return line_ending.join(processed_lines)

def unescape_markers(content: str) -> str:
    """取消转义的标记字符"""
    return (
        content.replace("\\<<<<<<<", "<<<<<<<")
        .replace("\\=======", "=======")
        .replace("\\>>>>>>>", ">>>>>>>")
        .replace("\\-------", "-------")
        .replace("\\:start_line:", ":start_line:")
    )

def validate_marker_sequencing(diff_content: str) -> dict:
    """验证diff标记的序列是否正确"""
    class State:
        START = 0
        AFTER_SEARCH = 1
        AFTER_SEPARATOR = 2
    
    state = State.START
    lines = diff_content.split('\n')
    
    for line_num, line in enumerate(lines, 1):
        marker = line.strip()
        
        if state == State.START:
            if marker == '=======':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的======="}
            if marker == '>>>>>>> REPLACE':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的>>>>>>> REPLACE"}
            if marker == '<<<<<<< SEARCH':
                state = State.AFTER_SEARCH
                
        elif state == State.AFTER_SEARCH:
            if marker == '<<<<<<< SEARCH':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的<<<<<<< SEARCH"}
            if marker == '>>>>>>> REPLACE':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的>>>>>>> REPLACE"}
            if marker == '=======':
                state = State.AFTER_SEPARATOR
                
        elif state == State.AFTER_SEPARATOR:
            if marker == '<<<<<<< SEARCH':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的<<<<<<< SEARCH"}
            if marker == '=======':
                return {"success": False, "error": f"无效的diff格式：第{line_num}行出现意外的======="}
            if marker == '>>>>>>> REPLACE':
                state = State.START
    
    if state != State.START:
        expected = "=======" if state == State.AFTER_SEARCH else ">>>>>>> REPLACE"
        return {"success": False, "error": f"无效的diff格式：意外的内容结尾。期望{expected}"}
    
    return {"success": True}

def fuzzy_search(lines: List[str], search_chunk: str, start_index: int, end_index: int) -> dict:
    """模糊搜索匹配的内容"""
    best_score = 0.0
    best_match_index = -1
    best_match_content = ""
    search_lines = search_chunk.splitlines()
    search_len = len(search_lines)
    
    mid_point = (start_index + end_index) // 2
    left_index = mid_point
    right_index = mid_point + 1
    
    while left_index >= start_index or right_index <= end_index - search_len:
        if left_index >= start_index:
            original_chunk = "\n".join(lines[left_index:left_index + search_len])
            similarity = get_similarity(original_chunk, search_chunk)
            if similarity > best_score:
                best_score = similarity
                best_match_index = left_index
                best_match_content = original_chunk
            left_index -= 1
        
        if right_index <= end_index - search_len:
            original_chunk = "\n".join(lines[right_index:right_index + search_len])
            similarity = get_similarity(original_chunk, search_chunk)
            if similarity > best_score:
                best_score = similarity
                best_match_index = right_index
                best_match_content = original_chunk
            right_index += 1
    
    return {
        "best_score": best_score,
        "best_match_index": best_match_index,
        "best_match_content": best_match_content
    }


@tool(args_schema=ApplyDiffInput)
def apply_diff(path: str, diff: str, runtime: ToolRuntime = None) -> str:
    """应用差异修改
    
    使用标准的SEARCH/REPLACE块格式来修改文件内容。
    
    格式示例：
    <<<<<<< SEARCH
    :start_line:1
    -------
    原始内容第一行
    原始内容第二行
    =======
    修改后内容第一行
    修改后内容第二行
    >>>>>>> REPLACE
    
    重要说明：
    1. 必须使用 <<<<<<< SEARCH 和 >>>>>>> REPLACE 标记
    2. 使用 :start_line:行号 指定搜索起始行（可选，但推荐）
    3. 使用 ------- 分隔元数据和搜索内容
    4. 使用 ======= 分隔搜索内容和替换内容
    5. 不支持git diff格式或其他diff格式
    
    Args:
        path: 文件路径（相对于novel目录的相对路径）
        diff: 差异内容，必须使用SEARCH/REPLACE块格式
        runtime: LangChain运行时上下文
    """
    user_choice = interrupt("工具中断，扣1恢复，扣2取消")
    choice_action = user_choice.get("choice_action", "2")
    choice_data = user_choice.get("choice_data", "无附加信息")
    
    if choice_action == "1":
        try:
            # 初始化路径验证器
            path_validator = PathValidator(settings.NOVEL_DIR)
            
            # 规范化路径
            clean_path = path_validator.normalize_path(path)
            
            # 验证路径安全性
            if not path_validator.is_safe_path(clean_path):
                return f"【用户额外信息】：{choice_data}，【工具执行结果】：应用差异失败，不安全的文件路径: {path}"
                
            # 获取完整路径
            file_path = path_validator.get_full_path(clean_path)
            
            # 读取原始文件内容
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
    
            # 验证diff格式
            valid_seq = validate_marker_sequencing(diff)
            if not valid_seq["success"]:
                return f"【用户额外信息】：{choice_data}，【工具执行结果】：应用差异失败: {valid_seq['error']}"
    
            # 解析diff块
            diff_block_pattern = r'(?:^|\n)(?<!\\)<<<<<<< SEARCH\s*\n([\s\S]*?)(?<!\\)-------\s*\n([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)=======\s*\n)([\s\S]*?)(?:\n)?(?:(?<=\n)(?<!\\)>>>>>>> REPLACE)(?=\n|$)'
            matches = list(re.finditer(diff_block_pattern, diff))
    
            if not matches:
                return f"【用户额外信息】：{choice_data}，【工具执行结果】：应用差异失败: 无效的diff格式 - 未找到有效的SEARCH/REPLACE块"
    
            # 确定行结束符
            line_ending = "\r\n" if "\r\n" in original_content else "\n"
            result_lines = original_content.splitlines()
            delta = 0
            applied_count = 0
            fail_parts = []
    
            # 解析所有替换操作并按起始行排序
            replacements = []
            for match in matches:
                metadata_block = match.group(1)
                search_content = match.group(2)
                replace_content = match.group(3)
        
                start_line = 0
                start_line_match = re.search(r':(?:start_line|start_paragraph):\s*(\d+)', metadata_block)
                if start_line_match:
                    start_line = int(start_line_match.group(1))
        
                replacements.append({
                    "start_line": start_line,
                    "search_content": search_content,
                    "replace_content": replace_content
                })
    
            # 按起始行排序
            replacements.sort(key=lambda x: x["start_line"])
    
            # 应用每个替换
            for replacement in replacements:
                search_content = replacement["search_content"]
                replace_content = replacement["replace_content"]
                start_line = replacement["start_line"] + (0 if replacement["start_line"] == 0 else delta)
        
                # 取消转义标记
                search_content = unescape_markers(search_content)
                replace_content = unescape_markers(replace_content)
                
                # 处理行号
                has_all_line_numbers = (every_line_has_line_numbers(search_content) and
                                      every_line_has_line_numbers(replace_content)) or \
                                     (every_line_has_line_numbers(search_content) and
                                      replace_content.strip() == "")
        
                if has_all_line_numbers and start_line == 0:
                    # 从搜索内容的第一行提取起始行号
                    first_line = search_content.split("\n")[0]
                    line_num_match = re.match(r'^\s*(\d+)\s+\|', first_line)
                    if line_num_match:
                        start_line = int(line_num_match.group(1))
        
                if has_all_line_numbers:
                    search_content = strip_line_numbers(search_content)
                    replace_content = strip_line_numbers(replace_content)
        
                # 跳过空搜索或相同内容
                if not search_content.strip() or search_content == replace_content:
                    fail_parts.append({"success": False, "error": "搜索内容为空或与替换内容相同"})
                    continue
        
                search_lines = search_content.splitlines()
                replace_lines = replace_content.splitlines()
                search_chunk = "\n".join(search_lines)
        
                # 查找匹配位置
                match_index = -1
                best_match_score = 0.0
                search_start_index = 0
                search_end_index = len(result_lines)
        
                FUZZY_THRESHOLD = 0.9
                BUFFER_LINES = 40
        
                if start_line > 0:
                    exact_start_index = start_line - 1
                    if exact_start_index < len(result_lines):
                        original_chunk = "\n".join(result_lines[exact_start_index:exact_start_index + len(search_lines)])
                        similarity = get_similarity(original_chunk, search_chunk)
                        if similarity >= FUZZY_THRESHOLD:
                            match_index = exact_start_index
                            best_match_score = similarity
                        else:
                            search_start_index = max(0, start_line - (BUFFER_LINES + 1))
                            search_end_index = min(len(result_lines), start_line + len(search_lines) + BUFFER_LINES)
        
                # 如果精确匹配失败，进行模糊搜索
                if match_index == -1:
                    search_result = fuzzy_search(result_lines, search_chunk, search_start_index, search_end_index)
                    match_index = search_result["best_match_index"]
                    best_match_score = search_result["best_score"]
        
                # 如果仍然没有找到匹配，尝试宽松的行号移除
                if match_index == -1 or best_match_score < FUZZY_THRESHOLD:
                    aggressive_search_content = strip_line_numbers(search_content, aggressive=True)
                    if aggressive_search_content != search_content:
                        aggressive_search_chunk = "\n".join(aggressive_search_content.splitlines())
                        search_result = fuzzy_search(result_lines, aggressive_search_chunk, search_start_index, search_end_index)
                        if search_result["best_match_index"] != -1 and search_result["best_score"] >= FUZZY_THRESHOLD:
                            match_index = search_result["best_match_index"]
                            best_match_score = search_result["best_score"]
                            search_content = aggressive_search_content
                            replace_content = strip_line_numbers(replace_content, aggressive=True)
                            search_lines = search_content.splitlines()
                            replace_lines = replace_content.splitlines()
        
                # 检查匹配结果
                if match_index == -1 or best_match_score < FUZZY_THRESHOLD:
                    error_msg = f"【用户额外信息】：{choice_data}，【工具执行结果】：未找到足够相似的匹配 (相似度: {best_match_score:.2f}, 需要: {FUZZY_THRESHOLD})"
                    # 显示附近的内容
                    start = max(0, start_line - 5)
                    end = min(len(result_lines), start_line + 5)
                    original_section = add_line_numbers("\n".join(result_lines[start:end]), start + 1)
                    fail_parts.append({
                        "success": False,
                        "error": f"{error_msg}\n第{start_line}行附近的内容:\n{original_section}"
                    })
                    continue
        
                # 应用替换，保持缩进
                matched_lines = result_lines[match_index:match_index + len(search_lines)]
                original_indents = [re.match(r'^[\t ]*', line).group() if line else "" for line in matched_lines]
                search_indents = [re.match(r'^[\t ]*', line).group() if line else "" for line in search_lines]
        
                indented_replace_lines = []
                for i, line in enumerate(replace_lines):
                    if i < len(original_indents):
                        matched_indent = original_indents[0] if original_indents else ""
                        current_indent = re.match(r'^[\t ]*', line).group() if line else ""
                        search_base_indent = search_indents[0] if search_indents else ""
                
                        search_base_level = len(search_base_indent)
                        current_level = len(current_indent)
                        relative_level = current_level - search_base_level
                
                        if relative_level < 0:
                            final_indent = matched_indent[:max(0, len(matched_indent) + relative_level)]
                        else:
                            final_indent = matched_indent + current_indent[search_base_level:]
                
                        indented_replace_lines.append(final_indent + line.lstrip())
                    else:
                        indented_replace_lines.append(line)
        
                # 执行替换
                result_lines[match_index:match_index + len(search_lines)] = indented_replace_lines
                delta += len(replace_lines) - len(search_lines)
                applied_count += 1
    
            # 检查应用结果
            if applied_count == 0:
                error_details = "\n".join([part["error"] for part in fail_parts])
                return f"【用户额外信息】：{choice_data}，【工具执行结果】：应用差异失败: 未应用任何更改。所有diff部分都失败了。\n失败详情:\n{error_details}"
    
            # 写入修改后的内容
            new_content = line_ending.join(result_lines)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
    
            success_msg = f"【用户额外信息】：{choice_data}，【工具执行结果】：差异已成功应用到文件 '{path}'，应用了 {applied_count} 个更改"
            if fail_parts:
                error_details = "\n".join([part["error"] for part in fail_parts])
                success_msg += f"【用户额外信息】：{choice_data}，【工具执行结果】： {len(fail_parts)} 个更改失败:\n{error_details}"
    
                return success_msg
        except Exception as e:
            return f"【用户额外信息】：{choice_data}，【工具执行结果】：应用差异失败: {str(e)}"
    else:
        return f"【用户额外信息】：{choice_data}，【工具执行结果】：用户取消了工具"
