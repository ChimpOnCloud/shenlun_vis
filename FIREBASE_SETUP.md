# Firebase 手把手搭建教程

跟着做大约 10 分钟。遇到问题随时把截图发给我。

> 前置条件：能正常访问 Google 的网络环境。

---

## 第一步：创建 Firebase 项目

1. 打开 <https://console.firebase.google.com/>，用 Google 账号登录（没有就先注册一个，免费）。
2. 点击 **「创建项目 / Create a project」**。
3. 项目名称填 `shenlun-vis`（随意），点 **继续**。
4. 到 Google Analytics 那一步时，**把开关关掉**（个人工具用不到，关掉更省事），点 **创建项目**。
5. 等约 30 秒，看到「您的新项目已准备就绪」，点 **继续** 进入控制台。

## 第二步：创建 Firestore 数据库（存批注的地方）

1. 在左侧菜单点 **「构建 / Build」→「Firestore Database」**。
2. 点 **「创建数据库」**。
3. **选择位置**：展开下拉框，选 `asia-southeast1 (Singapore)` 新加坡 —— 国内访问延迟最低。
   ⚠️ 位置创建后不能改，这一步看准再点 **下一步**。
4. 安全规则选 **「以测试模式启动 / Start in test mode」**，点 **启用**。
   - 测试模式 = 30 天内任何人可读写，个人开发阶段完全够用。
   - 30 天到期前 Firebase 会发邮件提醒，到时按文末「安全规则」一节改一行即可。

等十几秒，你会看到一个空的数据库页面，这就对了。

## 第三步：注册 Web 应用，拿到配置密钥

1. 点左上角 **「项目概览 / Project Overview」** 回到首页。
2. 页面中间有三个图标（iOS / Android / **Web `</>`**），点 **Web `</>`** 图标。
3. 应用昵称填 `shenlun-vis-web`，**不要勾** Firebase Hosting，点 **「注册应用」**。
4. 页面会显示一段这样的代码（这就是你的密钥配置）：

```js
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "shenlun-vis.firebaseapp.com",
  projectId: "shenlun-vis",
  storageBucket: "shenlun-vis.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

5. **把这段内容复制下来**（点代码框右上角复制按钮），然后点「继续前往控制台」。

> 以后想再找它：项目概览 → 右上角齿轮 ⚙️ → 项目设置 → 往下滑到「您的应用」。

## 第四步：把配置填进项目

1. 在项目根目录（`shenlun_vis/`）把 `.env.example` 复制一份，改名为 `.env`：

```bash
cp .env.example .env
```

2. 用编辑器打开 `.env`，按下面的**对应关系**把值填进去（不要加引号、不要加逗号）：

| `.env` 里的变量名 | 对应 firebaseConfig 里的字段 |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

填完长这样（示例）：

```
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=shenlun-vis.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=shenlun-vis
VITE_FIREBASE_STORAGE_BUCKET=shenlun-vis.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
```

3. 保存文件。

## 第五步：重启并验证

1. 在终端按 `Ctrl + C` 停掉 dev server，重新运行：

```bash
npm run dev
```

2. 打开 <http://localhost:5173>，看顶部工具栏右侧：
   - 显示 **「本地模式（未配置 Firebase）」** → `.env` 没填对，检查变量名拼写。
   - 显示 **「已同步到 Firebase」** → 成功了！
3. 终极验证：拖一份 PDF 进去，点「添加批注」在页面上点一下、写句话、保存。然后回到 Firebase 控制台的 Firestore 页面，能看到 `workspaces → (一串id) → annotations` 里多了一条数据 —— 说明批注真的存进云端了。

---

## 附：安全规则（30 天测试期到期后这样改）

控制台 → Firestore Database → **「规则 / Rules」** 标签页，改成：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /workspaces/{workspaceId}/{doc=**} {
      allow read, write: if true;
    }
  }
}
```

点 **「发布」**。这个规则仍然是谁都能读写（个人单机工具可以接受），只是去掉了 30 天期限。如果以后要多人用或部署到公网，再加 Firebase Auth 登录验证，到时找我改。

## 常见问题

**Q：要花钱吗？**
不用。Firestore 免费额度是每天 5 万次读、2 万次写、1GB 存储，个人批注工具一天撑死几百次操作，远远用不完。

**Q：PDF 文件本身存哪了？**
存在你浏览器的 IndexedDB 里（本地），不上传云端。好处：刷新页面文件还在、不占云空间、大文件秒开。代价：换电脑/换浏览器要重新拖入文件（批注在云端，会自动同步回来）。

**Q：控制台打不开 / 一直转圈？**
需要能访问 Google 的网络环境，和访问 Gmail 的要求一样。

**Q：`.env` 改了没反应？**
Vite 只在启动时读 `.env`，改完必须重启 `npm run dev`。
