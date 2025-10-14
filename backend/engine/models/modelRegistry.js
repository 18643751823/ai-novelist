const BaseModelAdapter = require('./BaseModelAdapter');

class ModelRegistry {
    constructor() {
        this.adapters = {}; // { adapter_name: adapter_instance }
        this.modelMapping = {}; // { model_id: adapter_name }
    }

    /**
     * 注册一个新的模型适配器。
     * @param {string} name - 适配器名称。
     * @param {BaseModelAdapter} adapterInstance - 适配器实例。
     */
    async registerAdapter(name, adapterInstance) {
        if (!(adapterInstance instanceof BaseModelAdapter)) {
            throw new Error("Registered adapter must be an instance of BaseModelAdapter.");
        }
        if (this.adapters[name]) {
            console.warn(`[API设置调试] 适配器 '${name}' 已存在，将被覆盖。`);
        }

        this.adapters[name] = adapterInstance;

        // 注册此适配器支持的所有模型
        const models = await adapterInstance.listModels(); // 添加 await
        
        console.log(`[API设置调试] 适配器 '${name}' 注册了 ${models.length} 个模型`);
        
        models.forEach(modelInfo => {
            let modelId = modelInfo.id;
            // 为 openrouter 和 ollama 模型ID添加提供商前缀，以确保唯一性
            if (name === 'openrouter' && !modelId.startsWith('openrouter/')) {
                modelId = `openrouter/${modelId}`;
            } else if (name === 'ollama' && !modelId.startsWith('ollama/')) {
                modelId = `ollama/${modelId}`;
            }

            if (this.modelMapping[modelId] && this.modelMapping[modelId] !== name) {
                console.warn(`[API设置调试] 模型 '${modelId}' 已被适配器 '${this.modelMapping[modelId]}' 注册，将被适配器 '${name}' 覆盖。`);
            }
            this.modelMapping[modelId] = name;
            console.log(`[API设置调试] 已注册模型: ${modelId} -> ${name}`);
        });
    }

    /**
     * 根据模型ID获取对应的适配器。
     * @param {string} modelId - 模型ID。
     * @returns {BaseModelAdapter|null} 对应的适配器实例，如果未找到则返回null。
     */
    getAdapterForModel(modelId) {
        const adapterName = this.modelMapping[modelId];
        if (!adapterName) {
            return null;
        }
        return this.adapters[adapterName];
    }

    /**
     * 列出所有已注册的模型。
     * @returns {Array<Object>} 所有模型的信息列表。
     */
    async listAllModels() {
        let allModels = [];
        for (const adapterName in this.adapters) {
            const adapter = this.adapters[adapterName];
            const adapterModels = await adapter.listModels();

            const processedModels = adapterModels.map(model => {
                // 为每个模型添加提供商信息
                model.provider = adapterName;
                
                // 特殊处理ollama,确保id前缀正确
                if (adapterName === 'ollama' && !model.id.startsWith('ollama/')) {
                    model.id = `ollama/${model.id}`;
                }
                
                // 在 listAllModels 中也进行同样的处理，以确保返回给前端的 ID 是一致的
                if (adapterName === 'openrouter' && !model.id.startsWith('openrouter/')) {
                    model.id = `openrouter/${model.id}`;
                }

                return model;
            });

            allModels = allModels.concat(processedModels);
        }
        return allModels;
    }
}

module.exports = ModelRegistry;