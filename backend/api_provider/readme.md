# 待排查问题：
## Litellm依赖版本问题：
- **现象**：直接pip安装，可用deepseek/deepseek-chat，而通过requirements.txt安装时会依赖冲突默认降级。降级后的litellm似乎无法使用deepseek/deepseek-chat，只能使用openai/deepseek-chat
- **怀疑原因**：依赖降级导致版本过旧，旧版可能暂未支持deepseek/deepseek-chat，只有openai兼容
更新在即暂时没空解决

# 待优化：
litellm可以热更新模型列表，不必重启
litellm无法使用ollama，暂时怀疑是程序保存的配置有格式问题，比如缺少key等
litellm无法和chatopenai配合起来流式输出，会报错不可序列化，未测试最新litellm版本是否还有问题