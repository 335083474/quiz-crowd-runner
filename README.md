# 答题冲锋 · Quiz & Conquer

蓝军慢跑答题，选完答案自动加速冲锋。答对并穿过半透明屏障时，获得增兵、兵力翻倍或护盾；答错让敌军增援。连续突破六道防线，最后攻下城堡。

**完整试玩（游戏 + MiniMax）：https://quiz-crowd-runner.test-garden.workers.dev/**

GitHub Pages：https://335083474.github.io/quiz-crowd-runner/ 。如 Pages 发布延迟，可直接使用上方完整试玩地址。

浏览器直接运行，支持手机触屏和电脑鼠标，无需登录。当前包含六道自写演示题，读题不限时，支持暂停、声音开关、错题回顾和重开。初始 40 人，画面最多绘制 150 名蓝军，人数标记显示实际兵力。

右上角齿轮可切换中英文、上传 JSON/CSV/TXT 题库、使用 MiniMax 整理原始题目或生成解释。题库保存在当前浏览器，确认保存后才用于下一局；每局最多抽取六道题。

完整站点由 Cloudflare Worker 托管静态游戏和 AI 接口。密钥保存在服务端 Secret 中，D1 原子计数将本站 AI 调用限制在每分钟 6 次、每日 50 次，失败请求也计入额度。题目内容不写入数据库。普通游戏不消耗 AI 额度。

## 选择题库

首页点击“选择题库”，按科目、年份和试卷名称筛选。已整理 41 份可玩试卷、2711 条题目记录（单选 1533、多选 849、判断 329），涵盖期货基础知识、法律法规、投资分析；不同试卷可能包含重复题。另 7 份缺答案、1 份扫描版在目录中标记暂不可玩。

这批题库按原文答案提取，没有调用 AI；清除常见广告页眉并跳过识别到的版式和缺失材料问题。保留源文件名、SHA-256、原题号和页码，未逐题人工审校，历史内容按原文件保留。原 PDF/Word 和中间提取文本不提交。详见 [整理说明](docs/tiku-preparation.md)。

选择刷新后保留，每局随机最多六题。单选、判断选完直接冲锋；多选勾选后点“提交答案并冲锋”，答案须完整匹配。正常选择、答题和查看原解析不调用模型。

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
