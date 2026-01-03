# 修改说明 v2.0

## 版本信息
- 修改日期: 2026-01-03
- 版本: v2.0
- 修改内容: 使用Download/smart-wardrobe文件夹,移除Expo Go私有路径依赖,添加文件选择器功能

## 主要修改

### 1. 新增 lib/file-access.ts ⭐
**新增内容:**
- 定义 `/Download/smart-wardrobe/` 文件夹路径
- 提供文件选择器功能,支持从Download文件夹选择图片
- 提供文件复制到应用私有目录的功能
- 提供扫描smart-wardrobe文件夹的功能
- **移除了对Expo Go私有路径的依赖**

**关键函数:**
- `getSmartWardrobeDownloadPath()`: 获取smart-wardrobe文件夹路径
  - Android: `/storage/emulated/0/Download/smart-wardrobe`
  - iOS: `{DocumentDirectory}/smart-wardrobe`
- `getAppPrivateDirectory()`: 获取应用私有存储目录
- `pickFileFromDownload()`: 使用文件选择器选择单个文件
- `pickMultipleFilesFromDownload()`: 使用文件选择器选择多个文件
- `copyFileToAppDir()`: 复制文件到应用私有目录
- `scanImagesInSmartWardrobeFolder()`: 扫描smart-wardrobe文件夹中的图片

### 2. 修改 lib/folder-manager.ts
**修改内容:**
- 使用新的 `file-access.ts` 模块
- 将导入文件夹路径改为 `/Download/smart-wardrobe/`
- 移除了对 `FileSystem.documentDirectory` 的直接依赖
- 适配新的文件访问方式

### 3. 修改 lib/image-utils.ts
**修改内容:**
- 引入 `getAppPrivateDirectory()` 函数
- 将图片保存路径统一使用私有目录函数
- 移除了硬编码的路径

### 4. 修改 app/(tabs)/import.tsx ⭐
**新增两种导入方式:**

#### 方式一: 手动选择导入
- 使用文件选择器逐个选择图片
- 适合少量图片导入
- 自动从文件路径推断分类

#### 方式二: 自动扫描导入
- 自动扫描smart-wardrobe文件夹
- 批量导入所有图片
- 按文件夹分类导入

**新增功能:**
- `handlePickAndImport()`: 使用文件选择器手动选择并导入图片
- `inferCategoryFromPath()`: 从文件路径推断衣服分类
- `handleShowFolderHint()`: 显示文件夹位置提示

## 功能说明

### 文件夹结构
```
Download/smart-wardrobe/
├── 外套/
├── 夹克/
├── 上衣/
├── 裤子/
├── 长裙/
├── 短裙/
├── 鞋子/
└── 配饰/
```

### 导入流程对比

| 方式 | 适用场景 | 操作步骤 | 分类方式 |
|------|---------|---------|---------|
| **手动选择** | 少量图片 | 点击按钮 → 选择图片 → 自动导入 | 自动推断 |
| **自动扫描** | 大量图片 | 复制到分类文件夹 → 刷新 → 导入 | 按文件夹 |

## 技术细节

### 路径管理
✅ **不再使用**: 
- `host.exp.exponent`
- `ExponentExperienceData`
- `/data/user/0/`

✅ **改为使用**: 
- 公共Download文件夹: `/storage/emulated/0/Download/smart-wardrobe` (Android)
- 应用Documents目录: `{DocumentDirectory}/smart-wardrobe` (iOS)
- 应用私有目录: `{DocumentDirectory}/wardrobe/` (所有平台)

### 文件访问流程
```
USB传输
  ↓
/Download/smart-wardrobe/
  ↓
文件选择器 / 自动扫描
  ↓
压缩 + 缩略图
  ↓
应用私有目录
  ↓
应用内使用
```

## 使用说明

### 对于用户

#### 方法一 - 手动选择导入 (推荐新手)
1. 使用USB将图片复制到 `Download/smart-wardrobe/` (不需要分类)
2. 打开应用 → 导入标签页
3. 点击 **"手动选择导入"**
4. 在文件选择器中选择图片
5. 完成!

#### 方法二 - 自动扫描导入 (推荐批量)
1. 使用USB将图片**按分类**复制到 `Download/smart-wardrobe/` 的子文件夹
2. 打开应用 → 导入标签页
3. 点击 **"刷新统计"** 查看待导入数量
4. 点击 **"自动扫描导入"**
5. 完成!

### 对于开发者

```bash
# 安装依赖
pnpm install

# 运行
pnpm android  # Android
pnpm ios      # iOS

# 开发模式
pnpm dev
```

## 技术特性
- ✅ 不依赖Expo Go私有路径
- ✅ 支持USB传输后直接导入
- ✅ 两种导入方式(手动/自动)
- ✅ 自动创建文件夹结构
- ✅ 图片压缩和缩略图
- ✅ 自动分类管理
- ✅ 导入统计功能
- ✅ 可选删除源文件
- ✅ 支持Android和iOS
- ✅ 智能分类推断

## 注意事项

### Android
- 需要存储权限访问Download文件夹
- 路径: `/storage/emulated/0/Download/smart-wardrobe`

### iOS
- 使用应用Documents目录
- 通过"文件"应用访问

### 分类推断规则
手动选择导入时,从文件路径自动推断:
- 包含"外套"/"coat" → 外套
- 包含"夹克"/"jacket" → 夹克
- 包含"上衣"/"top" → 上衣
- 包含"裤子"/"pants" → 裤子
- 包含"长裙"/"long-skirt" → 长裙
- 包含"短裙"/"short-skirt" → 短裙
- 包含"鞋子"/"shoes" → 鞋子
- 包含"配饰"/"accessory" → 配饰
- **默认** → 上衣

## 测试建议
- [ ] 文件夹自动创建
- [ ] 手动选择导入
- [ ] 自动扫描导入
- [ ] 多种图片格式
- [ ] 批量导入性能
- [ ] 删除源文件功能
- [ ] 分类推断准确性
- [ ] Android/iOS兼容性
- [ ] USB传输后访问

## 版本历史

### v2.0 (2026-01-03) - 当前版本
- ✨ 使用Download/smart-wardrobe文件夹
- ✨ 移除Expo Go私有路径依赖
- ✨ 添加文件选择器功能
- ✨ 支持手动选择和自动扫描两种导入方式
- ✨ 添加智能分类推断功能
- 📝 新增 lib/file-access.ts 模块
- 🔧 重构文件路径管理

### v1.0 (2026-01-03)
- 初始版本
- 使用MyClothes文件夹
- 基本的批量导入功能
