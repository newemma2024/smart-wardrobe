# 修改说明

## 版本信息
- 修改日期: 2026-01-03
- 修改内容: 添加从Download/MyClothes文件夹导入图片的功能

## 主要修改

### 1. lib/folder-manager.ts
**修改内容:**
- 将导入文件夹路径从应用内部目录改为Download/MyClothes文件夹
- Android设备使用: `/storage/emulated/0/Download/MyClothes`
- iOS设备使用: 应用Documents目录下的MyClothes文件夹

**修改原因:**
- 方便用户通过文件管理器直接访问和管理图片
- 使用系统公共Download文件夹更符合用户习惯

### 2. app/(tabs)/import.tsx
**修改内容:**
- 添加了醒目的"导入说明"区块
  - 说明MyClothes文件夹的位置
  - 指导用户如何复制图片到分类文件夹
  - 说明如何使用【图片导入】按钮
- 将"开始导入"按钮改为"图片导入"按钮
- 更新了所有相关的提示文字和说明

**用户界面改进:**
- 在顶部添加了蓝色高亮的导入说明区块
- 明确说明MyClothes文件夹的作用和位置
- 强调【图片导入】按钮的功能

## 功能说明

### 导入流程
1. 应用启动时自动在Download文件夹下创建MyClothes文件夹
2. MyClothes文件夹中包含按衣服分类的子文件夹:
   - 外套
   - 夹克
   - 上衣
   - 裤子
   - 长裙
   - 短裙
   - 鞋子
   - 配饰
3. 用户将衣服图片复制到对应的分类文件夹中
4. 在应用的导入画面点击"刷新统计"查看待导入图片
5. 点击"图片导入"按钮,所有图片自动导入到应用中

### 注意事项
- Android设备可以通过文件管理器直接访问Download/MyClothes文件夹
- iOS设备需要通过"文件"应用访问
- 支持JPG、JPEG、PNG、GIF格式的图片
- 可选择导入后自动删除源文件以节省空间

## 安装和使用

### 安装依赖
```bash
pnpm install
```

### 运行应用
```bash
# Android
pnpm android

# iOS
pnpm ios
```

### 开发模式
```bash
pnpm dev
```

## 技术细节
- 使用expo-file-system进行文件操作
- 支持图片压缩和缩略图生成
- 自动分类管理衣物图片
- 支持批量导入和统计功能
