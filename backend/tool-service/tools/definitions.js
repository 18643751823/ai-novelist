// 定义 AI 工具描述
const tools = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "将内容写入指定文件。如果文件不存在则创建，如果存在则覆盖。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要写入的文件路径，路径应相对于**工作区目录**，例如需要在工作区目录下写入'测试文件夹/Untitled.txt'，则给出的path参数为'测试文件夹/Untitled.txt'。"
          },
          content: {
            type: "string",
            description: "要写入文件的内容。"
          }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取指定文件的内容。段落是由换行符（'\\n'）分隔的。返回的内容会自动添加段落编号，格式为 '段落号 | 内容'。可以通过指定 start_paragraph 和 end_paragraph 来读取文件的特定部分。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要读取的文件路径，路径应相对于**工作区目录**。"
          },
          start_paragraph: {
            type: "number",
            description: "要读取的起始段落号（包含）。如果省略，则从文件开头读取。"
          },
          end_paragraph: {
            type: "number",
            description: "要读取的结束段落号（包含）。如果省略，则读取到文件末尾。"
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ask_user_question",
      description: "当AI需要用户提供更多信息时，向用户提问并提供可选答案。",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "要向用户提出的问题。"
          },
          options: {
            type: "array",
            items: { type: "string" },
            description: "可选的答案列表，用户可以选择其中一个。如果为空，用户可以自由回复。"
          }
        },
        required: ["question"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "insert_content",
      description: "在文件的指定段落号插入一个或多个全新的段落。不适用于在现有段落内修改文本。使用段落号 0 在文件末尾追加。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要修改的文件路径，相对于工作区目录。"
          },
          "paragraph": {
            type: "number",
            description: "要插入内容的段落号（1-based）。使用 0 在文件末尾追加。"
          },
          content: {
            type: "string",
            description: "要插入的内容。"
          }
        },
        required: ["path", "paragraph", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_and_replace",
      description: "在文件中搜索并替换文本或正则表达式。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要修改的文件路径，相对于工作区目录。"
          },
          search: {
            type: "string",
            description: "要搜索的文本或正则表达式。"
          },
          replace: {
            type: "string",
            description: "用于替换的文本。"
          },
          use_regex: {
            type: "boolean",
            description: "如果为 true，则将'search'参数视为正则表达式。默认为 false。"
          },
          ignore_case: {
            type: "boolean",
            description: "如果为 true，则在搜索时忽略大小写。默认为 false。"
          }
        },
        required: ["path", "search", "replace"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "apply_diff",
      description: "通过指定要搜索和替换的内容来精确修改文件。此工具能够保持缩进并支持模糊匹配。一个请求中可以包含多个独立的SEARCH/REPLACE块。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要修改的文件路径，相对于工作区目录。"
          },
          diff: {
            type: "string",
            description: "定义修改的diff块。格式为：\n<<<<<<< SEARCH\n:start_line: [起始行号]\n-------\n[要搜索的精确内容]\n=======\n[要替换成的新内容]\n>>>>>>> REPLACE\n"
          }
        },
        required: ["path", "diff"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "在指定目录下的文件中递归搜索匹配正则表达式的内容。返回包含文件路径、行号和匹配行的结果列表。",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要搜索的目录路径，相对于工作区目录。例如 'novel'。"
          },
          regex: {
            type: "string",
            description: "用于搜索的正则表达式（Rust-flavored）。"
          },
          file_pattern: {
            type: "string",
            description: "可选的Glob模式，用于过滤要搜索的文件。例如 '*.txt' 或 'chapter-*.txt'。"
          }
        },
        required: ["path", "regex"]
      }
    }
  }
];

module.exports = tools;