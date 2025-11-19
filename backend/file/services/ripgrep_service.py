"""
Ripgrep搜索服务
基于ripgrep的文件内容搜索功能
"""

import subprocess
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import asyncio


class RipgrepService:
    def __init__(self):
        self.max_results = 300
        self.max_line_length = 500

    def _truncate_line(self, line: str, max_length: int = None) -> str:
        """截断行内容"""
        if max_length is None:
            max_length = self.max_line_length
        return line[:max_length] + " [truncated...]" if len(line) > max_length else line

    async def _exec_ripgrep(self, args: List[str]) -> str:
        """执行ripgrep命令"""
        try:
            process = await asyncio.create_subprocess_exec(
                "rg", *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if stderr:
                raise Exception(f"ripgrep process error: {stderr.decode()}")
                
            return stdout.decode('utf-8')
        except Exception as e:
            raise Exception(f"执行ripgrep失败: {e}")

    async def regex_search_files(self, cwd: str, directory_path: str, regex: str, file_pattern: str = "*") -> str:
        """使用正则表达式搜索文件内容"""
        try:
            args = [
                "--json", "-e", regex, 
                "--glob", file_pattern, 
                "--context", "1", 
                directory_path
            ]

            output = await self._exec_ripgrep(args)
        except Exception as error:
            print(f"Error executing ripgrep: {error}")
            return "No results found"

        results = []
        current_file = None

        for line in output.split("\n"):
            if line:
                try:
                    import json
                    parsed = json.loads(line)
                    
                    if parsed["type"] == "begin":
                        current_file = {
                            "file": parsed["data"]["path"]["text"],
                            "searchResults": [],
                        }
                    elif parsed["type"] == "end":
                        if current_file:
                            results.append(current_file)
                        current_file = None
                    elif (parsed["type"] in ["match", "context"]) and current_file:
                        line_data = {
                            "line": parsed["data"]["line_number"],
                            "text": self._truncate_line(parsed["data"]["lines"]["text"]),
                            "isMatch": parsed["type"] == "match",
                        }
                        
                        if parsed["type"] == "match":
                            line_data["column"] = parsed["data"]["absolute_offset"]

                        last_result = current_file["searchResults"][-1] if current_file["searchResults"] else None
                        if last_result and last_result["lines"]:
                            last_line = last_result["lines"][-1]
                            if parsed["data"]["line_number"] <= last_line["line"] + 1:
                                last_result["lines"].append(line_data)
                            else:
                                current_file["searchResults"].append({
                                    "lines": [line_data],
                                })
                        else:
                            current_file["searchResults"].append({
                                "lines": [line_data],
                            })
                except Exception as error:
                    print(f"Error parsing ripgrep output: {error}")

        return self._format_results(results, cwd)

    def _format_results(self, file_results: List[Dict], cwd: str) -> str:
        """格式化搜索结果"""
        output = ""
        total_results = sum(len(file["searchResults"]) for file in file_results)

        if total_results >= self.max_results:
            output += f"Showing first {self.max_results} of {self.max_results}+ results. Use a more specific search if necessary.\n\n"
        else:
            output += f"Found {'1 result' if total_results == 1 else f'{total_results} results'}.\n\n"

        grouped_results = {}
        for file in file_results[:self.max_results]:
            relative_file_path = str(Path(file["file"]).relative_to(cwd)).replace("\\", "/")
            if relative_file_path not in grouped_results:
                grouped_results[relative_file_path] = []
            grouped_results[relative_file_path].extend(file["searchResults"])

        for file_path, results in grouped_results.items():
            output += f"# {file_path}\n"
            for result in results:
                if result["lines"]:
                    for line in result["lines"]:
                        line_number = str(line["line"]).rjust(3, " ")
                        output += f"{line_number} | {line['text'].rstrip()}\n"
                    output += "----\n"
            output += "\n"

        return output.rstrip()

    def parse_search_results(self, search_output: str, novel_dir_path: str) -> List[Dict[str, Any]]:
        """解析ripgrep搜索结果"""
        results = []
        lines = search_output.split('\n')
        current_file = None
        
        for line in lines:
            if line.startswith('# '):
                # 文件路径行
                file_path = line[2:].strip()
                current_file = {
                    "name": os.path.basename(file_path),
                    "path": file_path,
                    "preview": ""
                }
                results.append(current_file)
            elif line.strip() and not line.startswith('---') and current_file:
                # 内容行，添加到预览
                if len(current_file["preview"]) < 100:  # 限制预览长度
                    current_file["preview"] += line.strip() + ' '
        
        return results


# 创建单例实例
ripgrep_service = RipgrepService()