# 课表工具（Android App 工程）

把 `app/prototype.html`（那个单文件原型）装进 Capacitor 的壳里做成一个**真 App**，
并让课表和待办变成**系统的本地通知**——锁屏能响、关掉 App 也能响、重启手机也还在。

App 名：**课表工具**　包名：`app.kebiao.tool`（改包名 = 手机里会变成一个全新的 App，慎改）

网页做不到这件事的原因是：页面切到后台会被浏览器冻结定时器。本地通知不是网页的定时器，
它交给系统的 `AlarmManager`（Android）/ `UNUserNotificationCenter`（iOS）排程，所以能响。

---

## 目录

```
capacitor-app/
├─ app/
│  └─ prototype.html  ← 原型本体（就是那个单文件 HTML，改这里）
├─ www/
│  ├─ index.html      ← 打包产物（由 npm run pack 生成，别手改）
│  ├─ shell.js        ← 原生外壳适配：藏掉原型里的假状态栏
│  └─ notify.js       ← 读 kcb.v1 数据 → 注册本地通知
├─ resources/         ← 图标（启动图标 / 自适应前景 / 通知栏小图标）
├─ tools/
│  ├─ pack.js         ← 把 app/prototype.html 注入外壳脚本，输出 www/index.html
│  ├─ patch_android.py← 加权限 + 换图标（npx cap add android 之后跑）
│  └─ generate_icons.py
├─ .github/workflows/android.yml  ← 云端出 APK
├─ capacitor.config.json
└─ package.json
```

---

## 路线一：让 GitHub 帮你出 APK（不用装 Node、不用装 Android Studio）

这是最省事的路径，全程在浏览器里点。

1. **建仓库**：github.com → New repository → 名字随便（下面假设叫 `kebiao-tool`）→ **Private** 或 Public 都行 → 不要勾 README。
2. **传文件**：仓库页 → `Add file` → `Upload files` → 把本文件夹里的
   **`app/`、`www/`、`resources/`、`tools/`、`.github/`、`capacitor.config.json`、`package.json`、`.gitignore`、`README.md`**
   一起拖进去（Chrome 支持整个文件夹拖拽）→ `Commit changes`。
   > `.github` 是隐藏文件夹：拖文件夹进去就行；如果系统不显示它，用 GitHub 网页的
   > `Add file → Create new file`，文件名填 `.github/workflows/android.yml`，粘贴文件内容。
3. **跑构建**：仓库页 → `Actions` → 左边选 `build-apk` → 右边 `Run workflow` → 绿色按钮。
   第一次跑约 4–6 分钟（要下载 Gradle 和 Android SDK）。
4. **拿安装包**：跑完点进这次运行 → 页面底部 `Artifacts` → 下载 `课表工具-apk`（是个 zip，里面是 `app-debug.apk`）。
5. **装到手机**：把 apk 传到手机（微信文件传输助手 / 数据线 / 网盘都行）→ 点开 → 允许「安装未知应用」→ 装。
6. **首次打开**：会弹「允许发送通知」→ 允许。之后课表提醒就有了。

> 每次 `push` 到 `main` 也会自动跑一次，所以以后改了原型（重新 `npm run pack` 传上去）就能拿到新包。

---

## 路线二：本机出 APK（装了 Node + Android Studio 的话）

```bash
# 1. 装 Node 18 或 20（https://nodejs.org），然后：
npm install

# 2. 生成 www/index.html（从原型打包）
npm run pack

# 3. 生成 Android 工程（只需一次）
npx cap add android

# 4. 补权限 + 换图标
python tools/patch_android.py

# 5. 打开 Android Studio 编译，或直接命令行出 debug 包
npx cap sync android
cd android && gradlew.bat assembleDebug     # macOS / Linux 用 ./gradlew
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

改了原型之后只要 `npm run pack && npx cap sync android` 再编一次。

---

## 提醒是怎么排的

`notify.js` 读 `localStorage['kcb.v1']`（就是原型存的那份数据），然后：

| 数据 | 排程 | 说明 |
| --- | --- | --- |
| 每门课 | `schedule.on.weekday/hour/minute` + `repeats: true` | 每周同一天同一时刻重复，时间 = 上课时间 − 该课的提前量 |
| 每条未完成待办 | `schedule.at` | 到点一次性；已过期的不补 |

几个容易踩的点，已经处理掉了：

- **weekday 的编号不一样**：原型 `1 = 周一 … 7 = 周日`，Capacitor / iOS 是 `1 = 周日 … 7 = 周六`，
  所以代码里做了 `(day % 7) + 1`。测试里 1→2、7→1 都对。
- **改数据要重排**：原型每次保存都会调 `saveState()`，`notify.js` 把它包了一层，
  改完 1.2 秒后用「先 `cancel` 旧的、再 `schedule` 新的」的方式整体重排，不会残留上节课的提醒。
- **Android 12+ 的精确闹钟**：`patch_android.py` 会补 `SCHEDULE_EXACT_ALARM`、`USE_EXACT_ALARM`、
  `RECEIVE_BOOT_COMPLETED`、`POST_NOTIFICATIONS`、`VIBRATE`、`WAKE_LOCK` 六条权限，少了会被系统延迟。
- **首次启动的时序**：原型是在页面初始化之后才写 `localStorage` 的，所以第一次读不到数据时
  不排也不提示，等第一次保存后再排一次（所以第一次打开可能晚 1–2 秒看到「已排程 N 节课提醒」）。
- **后台耗电**：不用常驻进程、不用服务器，全是系统闹钟，一天二十几条通知几乎不耗电。

想手动触发一次重排（调试用）：`kcbSyncNotifications()`。

---

## iOS

同一套代码也支持 iOS，但要 Mac + Xcode：

```bash
npx cap add ios
npx cap open ios      # 在 Xcode 里配 Team、Bundle ID，选真机跑
```

GitHub Actions 也能编 iOS，但要 `runs-on: macos-latest`（免费额度 2000 分钟/月，按 macOS 10 倍折算，
一次构建大概要 2–4 分钟 → 折合 20–40 分钟额度），而且要配证书和描述文件，比 Android 麻烦。
只想自己用的话，Mac 上 Xcode 直接连手机跑一次就够了。

---

## 正式签名（可选，想发到应用商店才需要）

现在的 APK 是 **debug 签名**，能装能用，但不能上架、也不能覆盖安装正式版。要正式签名：

```bash
keytool -genkey -v -keystore kcb.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kcb
```

然后在 GitHub 仓库 `Settings → Secrets` 里存 `KEYSTORE_BASE64` / `KEYSTORE_PASSWORD` /
`KEY_ALIAS` / `KEY_PASSWORD`，workflow 里加一步解码 keystore 并 `assembleRelease`。

---

## 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| Actions 报 `npx cap add android` 失败 | 第一次跑要联网装 platform 包，重跑一次即可；确认 `package.json` 没手改坏 |
| 装上去了但一条通知都没响 | 手机设置里给这个 App 开「允许通知」+「闹钟和提醒」；国产 ROM 还要在「自启动/后台运行」里放行 |
| 通知晚了几分钟 | 部分 ROM 把精确闹钟限流了：设置里搜「精确闹钟」允许本应用 |
| 双状态栏 | 说明 `shell.js` 没生效：确认 `www/index.html` 里 `</body>` 前有 `<script src="shell.js">` |
| 打开是白屏 | `www/index.html` 没生成：跑 `npm run pack`（它读 `app/prototype.html`） |
| 改了原型 App 里没变 | 忘了 `npm run pack` + `npx cap sync android` |
