/**
 * 章节排序管理器
 * 负责处理章节排序逻辑（基于JSON配置排序）
 */

class ChapterOrderManager {
  /**
   * 对项目列表进行排序
   * @param {Array} items 项目列表
   * @returns {Array} 排序后的列表
   */
  static sortItems(items) {
    if (!items || !Array.isArray(items)) {
      return [];
    }

    console.log('[ChapterOrderManager] 开始前端排序，项目数量:', items.length);

    const sorted = [...items].sort((a, b) => {
      // 文件夹优先
      if (a.isFolder && !b.isFolder) {
        console.log(`[ChapterOrderManager] 文件夹优先: ${a.title} < ${b.title}`);
        return -1;
      }
      if (!a.isFolder && b.isFolder) {
        console.log(`[ChapterOrderManager] 文件夹优先: ${a.title} > ${b.title}`);
        return 1;
      }

      // 使用后端生成的 displayPrefix 进行排序
      const aPrefix = a.displayPrefix || '';
      const bPrefix = b.displayPrefix || '';
      
      console.log(`[ChapterOrderManager] 使用 displayPrefix 排序: ${a.title} -> "${aPrefix}", ${b.title} -> "${bPrefix}"`);

      // 如果都有 displayPrefix，按数字排序
      if (aPrefix && bPrefix) {
        const aNum = parseInt(aPrefix, 10);
        const bNum = parseInt(bPrefix, 10);
        
        console.log(`[ChapterOrderManager] 数字比较: ${aNum} vs ${bNum}`);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          const result = aNum - bNum;
          console.log(`[ChapterOrderManager] 数字排序结果: ${result}`);
          return result;
        }
      }

      // 其他情况按字母排序
      const alphaResult = a.title.localeCompare(b.title);
      console.log(`[ChapterOrderManager] 字母排序结果: ${alphaResult}`);
      return alphaResult;
    });

    console.log('[ChapterOrderManager] 排序后项目列表:', sorted.map(item => ({
      title: item.title,
      isFolder: item.isFolder,
      id: item.id
    })));
    
    return sorted;
  }

  /**
   * 移除项目的前缀（用于显示）
   * @param {string} title 标题
   * @param {boolean} isFolder 是否为文件夹
   * @returns {string} 移除前缀后的名称
   */
  static removePrefixForDisplay(title, isFolder) {
    // 现在直接返回原始标题，因为不再使用文件名前缀
    return title;
  }

  /**
   * 提取前缀用于显示
   * @param {string} title 标题
   * @param {boolean} isFolder 是否为文件夹
   * @returns {string} 前缀
   */
  static extractPrefixForDisplay(title, isFolder) {
    // 现在返回空字符串，因为不再使用文件名前缀
    return '';
  }
}

export default ChapterOrderManager;