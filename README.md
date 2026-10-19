# 答题冲锋 · Quiz & Conquer

蓝军慢跑答题，选完答案自动加速冲锋。答对并穿过半透明屏障时，获得增兵、兵力翻倍或护盾；答错让敌军增援。连续突破六道防线，最后攻下城堡。

**完整试玩（游戏 + MiniMax）：https://quiz-crowd-runner.test-garden.workers.dev/**

GitHub Pages：https://335083474.github.io/quiz-crowd-runner/ 。如 Pages 发布延迟，可直接使用上方完整试玩地址。

浏览器直接运行，支持手机触屏和电脑鼠标，无需登录。当前包含六道自写演示题，读题不限时，支持暂停、声音开关、错题回顾和重开。初始 40 人，画面最多绘制 150 名蓝军，人数标记显示实际兵力。

右上角齿轮可切换中英文、上传 JSON/CSV/TXT 题库、使用 MiniMax 整理原始题目或生成解释。题库保存在当前浏览器，确认保存后才用于下一局；每局最多抽取六道题。

完整站点由 Cloudflare Worker 托管静态游戏和 AI 接口。密钥保存在服务端 Secret 中，D1 原子计数将本站 AI 调用限制在每分钟 6 次、每日 50 次，失败请求也计入额度。题目内容不写入数据库。普通游戏不消耗 AI 额度。

## 开发

需要 Node.js 22.12+。

```sh
npm ci
npm run dev
npm test
npm run build
```

## 发布

推送到 `main` 后，GitHub Actions 自动运行规则测试、构建并发布至 GitHub Pages。

```sh
npm run build -- --base=/quiz-crowd-runner/
```

模型和授权链接使用 Vite 的部署路径，可同时用于根路径本地预览和 GitHub Pages 子目录。

## 素材

城堡、塔楼及攻城器械来自 [Kenney Castle Kit](https://kenney.nl/assets/castle-kit)，遵循 CC0 授权。运行所需模型位于 `public/models/`，原授权见 `public/KENNEY-LICENSE.txt`。红蓝小人和屏障由程序生成。
