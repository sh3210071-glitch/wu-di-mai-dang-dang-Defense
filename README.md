# 无敌麦当当新星防御 (Invincible McDangdang Nova Defense)

一个基于 React + Vite + Tailwind CSS 开发的经典导弹指令风格塔防游戏。

## 游戏特点
- **核心玩法**：点击屏幕发射拦截导弹，预判并摧毁落下的敌方火箭。
- **关卡系统**：包含两个关卡，第二关难度（速度）大幅提升。
- **中英双语**：支持一键切换中英文界面。
- **响应式设计**：适配 PC 和移动端触摸操作。

## 本地开发

1. 克隆仓库：
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

## 部署到 Vercel

1. 将代码推送至 GitHub。
2. 在 Vercel 中导入该项目。
3. 在 Vercel 项目设置中添加环境变量：
   - `GEMINI_API_KEY`: 你的 Google Gemini API 密钥（可选，用于扩展功能）。
4. 点击部署。

## 技术栈
- React 19
- Vite
- Tailwind CSS 4
- Lucide React (图标)
- Motion (动画)
